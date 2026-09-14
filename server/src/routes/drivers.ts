import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { assignClosestPendingRideTo } from "../lib/rideHelpers";
import { scheduleResponseTimeout } from "../lib/dispatchQueue";
import { getIO } from "../sockets";

export const driversRouter = Router();

driversRouter.use(requireAuth);

// Dispatcher: list all drivers with live status
driversRouter.get("/", requireRole("DISPATCHER"), async (_req, res) => {
  const drivers = await prisma.user.findMany({
    where: { role: "DRIVER" },
    select: {
      id: true,
      name: true,
      phone: true,
      role: true,
      createdAt: true,
      driverProfile: true,
      _count: {
        select: { assignedRides: { where: { status: "COMPLETED" } } },
      },
    },
    orderBy: { name: "asc" },
  });

  res.json(
    drivers.map(({ _count, ...driver }) => ({
      ...driver,
      completedRides: _count.assignedRides,
    }))
  );
});

const createDriverSchema = z.object({
  name: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(6).max(30),
  password: z.string().min(4).max(100),
  vehicle: z.string().trim().max(100).optional(),
  plate: z.string().trim().max(20).optional(),
});

// Dispatcher: create a new driver account
driversRouter.post("/", requireRole("DISPATCHER"), async (req, res) => {
  const parsed = createDriverSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Informations chauffeur invalides" });
  }

  const existing = await prisma.user.findUnique({ where: { phone: parsed.data.phone } });
  if (existing) {
    return res.status(409).json({ error: "Un compte existe déjà avec ce numéro" });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const driver = await prisma.user.create({
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone,
      passwordHash,
      role: "DRIVER",
      driverProfile: {
        create: {
          vehicle: parsed.data.vehicle,
          plate: parsed.data.plate,
        },
      },
    },
    select: {
      id: true,
      name: true,
      phone: true,
      role: true,
      createdAt: true,
      driverProfile: true,
    },
  });

  res.status(201).json({ ...driver, completedRides: 0 });
});

// Driver: get the dispatcher's contact info (to call/message from the app)
driversRouter.get("/dispatcher-contact", requireRole("DRIVER"), async (_req, res) => {
  const dispatcher = await prisma.user.findFirst({
    where: { role: "DISPATCHER" },
    select: { name: true, phone: true },
    orderBy: { createdAt: "asc" },
  });
  if (!dispatcher) {
    return res.status(404).json({ error: "Aucun répartiteur trouvé" });
  }
  res.json(dispatcher);
});

const statusSchema = z.object({
  status: z.enum(["AVAILABLE", "UNAVAILABLE"]),
});

// Driver: toggle own availability
driversRouter.patch("/me/status", requireRole("DRIVER"), async (req, res) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Statut invalide" });
  }

  const profile = await prisma.driverProfile.update({
    where: { userId: req.user!.id },
    data: { status: parsed.data.status },
  });

  getIO().to("dispatchers").emit("driver:status", {
    driverId: req.user!.id,
    status: profile.status,
  });

  // On ne tente une assignation immédiate que si la position du chauffeur est
  // déjà connue (sinon on attend qu'il l'active — voir le handler socket
  // "driver:location", qui retentera dès la première position reçue).
  if (parsed.data.status === "AVAILABLE" && profile.lat != null && profile.lng != null) {
    const assigned = await assignClosestPendingRideTo(req.user!.id, profile.lat, profile.lng);
    if (assigned) {
      scheduleResponseTimeout(assigned.id, req.user!.id);
      return res.json({ ...profile, status: "ON_RIDE" });
    }
  }

  res.json(profile);
});

// Driver: unlock car door
driversRouter.post("/me/unlock-door", requireRole("DRIVER"), async (_req, res) => {
  const driverId = _req.user!.id;

  const driver = await prisma.user.findUnique({
    where: { id: driverId },
    select: { id: true, name: true, driverProfile: true },
  });

  if (!driver || !driver.driverProfile) {
    return res.status(404).json({ error: "Chauffeur non trouvé" });
  }

  getIO().to("dispatchers").emit("vehicle:door-unlocked", {
    driverId,
    driverName: driver.name,
    vehicle: driver.driverProfile.vehicle,
    plate: driver.driverProfile.plate,
    timestamp: new Date().toISOString(),
  });

  res.json({ success: true, message: "Porte déverrouillée" });
});

// Driver: boost battery
driversRouter.post("/me/boost-battery", requireRole("DRIVER"), async (_req, res) => {
  const driverId = _req.user!.id;

  const driver = await prisma.user.findUnique({
    where: { id: driverId },
    select: { id: true, name: true, driverProfile: true },
  });

  if (!driver || !driver.driverProfile) {
    return res.status(404).json({ error: "Chauffeur non trouvé" });
  }

  getIO().to("dispatchers").emit("vehicle:battery-boosted", {
    driverId,
    driverName: driver.name,
    vehicle: driver.driverProfile.vehicle,
    plate: driver.driverProfile.plate,
    timestamp: new Date().toISOString(),
  });

  res.json({ success: true, message: "Batterie en cours de chargement" });
});
