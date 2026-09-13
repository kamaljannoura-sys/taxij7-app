import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { getIO } from "../sockets";
import { broadcastRideUpdate, rideInclude } from "../lib/rideHelpers";
import { findClosestAvailableDriver } from "../lib/dispatchHelpers";
import { clearDispatchState, reassign, scheduleResponseTimeout } from "../lib/dispatchQueue";

export const ridesRouter = Router();

ridesRouter.use(requireAuth);

// Dispatcher: list all rides (history + active)
ridesRouter.get("/", requireRole("DISPATCHER"), async (_req, res) => {
  const rides = await prisma.ride.findMany({
    include: rideInclude,
    orderBy: { createdAt: "desc" },
  });
  res.json(rides);
});

// Driver: list rides assigned to me
ridesRouter.get("/mine", requireRole("DRIVER"), async (req, res) => {
  const rides = await prisma.ride.findMany({
    where: {
      driverId: req.user!.id,
      status: { in: ["ASSIGNED", "ACCEPTED", "EN_ROUTE", "ARRIVED"] },
    },
    include: rideInclude,
    orderBy: { createdAt: "desc" },
  });
  res.json(rides);
});

// Driver: list available rides (pending)
ridesRouter.get("/available", requireRole("DRIVER"), async (_req, res) => {
  const rides = await prisma.ride.findMany({
    where: {
      status: "PENDING",
      driverId: null,
    },
    include: rideInclude,
    orderBy: { createdAt: "desc" },
  });
  res.json(rides);
});

const createRideSchema = z.object({
  clientName: z.string().min(1),
  clientPhone: z.string().min(1),
  pickupAddress: z.string().min(1),
  pickupLat: z.number().optional(),
  pickupLng: z.number().optional(),
  destinationAddress: z.string().min(1),
  notes: z.string().optional(),
  driverId: z.string().optional(),
});

// Dispatcher: create a ride, optionally assigning a driver immediately
ridesRouter.post("/", requireRole("DISPATCHER"), async (req, res) => {
  const parsed = createRideSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Données de course invalides" });
  }
  const { driverId, pickupLat, pickupLng, ...data } = parsed.data;

  let assignedDriverId: string | null | undefined = driverId;

  if (!assignedDriverId && pickupLat && pickupLng) {
    assignedDriverId = await findClosestAvailableDriver(pickupLat, pickupLng);
  }

  const ride = await prisma.ride.create({
    data: {
      ...data,
      pickupLat,
      pickupLng,
      dispatcherId: req.user!.id,
      driverId: assignedDriverId ?? null,
      status: assignedDriverId ? "ASSIGNED" : "PENDING",
    },
    include: rideInclude,
  });

  if (assignedDriverId) {
    await prisma.driverProfile.update({
      where: { userId: assignedDriverId },
      data: { status: "ON_RIDE" },
    });
    getIO().to(`driver:${assignedDriverId}`).emit("ride:new", ride);
    getIO().to("dispatchers").emit("driver:status", { driverId: assignedDriverId, status: "ON_RIDE" });
    scheduleResponseTimeout(ride.id, assignedDriverId, { resetTried: true });
  }
  getIO().to("dispatchers").emit("ride:new", ride);

  res.status(201).json(ride);
});

const assignSchema = z.object({ driverId: z.string().min(1) });

// Dispatcher: assign (or reassign) a pending ride to a driver
ridesRouter.patch("/:id/assign", requireRole("DISPATCHER"), async (req, res) => {
  const parsed = assignSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Chauffeur requis" });
  }

  const ride = await prisma.ride.update({
    where: { id: req.params.id },
    data: { driverId: parsed.data.driverId, status: "ASSIGNED" },
    include: rideInclude,
  });

  await prisma.driverProfile.update({
    where: { userId: parsed.data.driverId },
    data: { status: "ON_RIDE" },
  });

  getIO().to(`driver:${parsed.data.driverId}`).emit("ride:new", ride);
  getIO().to("dispatchers").emit("ride:updated", ride);
  getIO().to("dispatchers").emit("driver:status", {
    driverId: parsed.data.driverId,
    status: "ON_RIDE",
  });
  scheduleResponseTimeout(ride.id, parsed.data.driverId, { resetTried: true });

  res.json(ride);
});

// Driver: accept an assigned ride
ridesRouter.patch("/:id/accept", requireRole("DRIVER"), async (req, res) => {
  // Réclame de façon atomique : si la course a déjà été réattribuée à un
  // autre chauffeur entre-temps (délai de réponse expiré), on refuse plutôt
  // que d'accepter une course qui n'est plus la sienne.
  const claimed = await prisma.ride.updateMany({
    where: { id: req.params.id, driverId: req.user!.id, status: "ASSIGNED" },
    data: { status: "ACCEPTED" },
  });
  if (claimed.count === 0) {
    return res.status(409).json({ error: "Cette course ne vous est plus assignée." });
  }

  const ride = await prisma.ride.findUniqueOrThrow({
    where: { id: req.params.id },
    include: rideInclude,
  });
  clearDispatchState(ride.id);
  broadcastRideUpdate(ride, "ride:updated", ride);
  res.json(ride);
});

// Driver: decline an assigned ride (reassigned automatically to the next driver)
ridesRouter.patch("/:id/decline", requireRole("DRIVER"), async (req, res) => {
  const claimed = await prisma.ride.updateMany({
    where: { id: req.params.id, driverId: req.user!.id },
    data: { status: "PENDING", driverId: null },
  });
  if (claimed.count === 0) {
    return res.status(409).json({ error: "Cette course ne vous est plus assignée." });
  }

  const ride = await prisma.ride.findUniqueOrThrow({
    where: { id: req.params.id },
    include: rideInclude,
  });

  await prisma.driverProfile.update({
    where: { userId: req.user!.id },
    data: { status: "AVAILABLE" },
  });

  getIO().to("dispatchers").emit("ride:updated", ride);
  getIO().to(`driver:${req.user!.id}`).emit("ride:updated", ride);
  getIO().to("dispatchers").emit("driver:status", {
    driverId: req.user!.id,
    status: "AVAILABLE",
  });

  // Réattribue immédiatement au chauffeur disponible suivant plutôt que
  // d'attendre le délai de réponse (le refus est un signal explicite).
  reassign(ride.id).catch((err) =>
    console.error(`Erreur lors de la réattribution après refus (course ${ride.id}):`, err)
  );

  res.json(ride);
});

const rideStatusSchema = z.object({
  status: z.enum(["EN_ROUTE", "ARRIVED", "COMPLETED"]),
});

// Driver: progress a ride's status
ridesRouter.patch("/:id/status", requireRole("DRIVER"), async (req, res) => {
  const parsed = rideStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Statut invalide" });
  }

  const claimed = await prisma.ride.updateMany({
    where: { id: req.params.id, driverId: req.user!.id },
    data: { status: parsed.data.status },
  });
  if (claimed.count === 0) {
    return res.status(409).json({ error: "Cette course ne vous est plus assignée." });
  }

  const ride = await prisma.ride.findUniqueOrThrow({
    where: { id: req.params.id },
    include: rideInclude,
  });

  if (parsed.data.status === "COMPLETED") {
    clearDispatchState(ride.id);
  }

  if (parsed.data.status === "COMPLETED" && ride.driverId) {
    await prisma.driverProfile.update({
      where: { userId: ride.driverId },
      data: { status: "AVAILABLE" },
    });
    getIO().to("dispatchers").emit("driver:status", {
      driverId: ride.driverId,
      status: "AVAILABLE",
    });
  }

  broadcastRideUpdate(ride, "ride:updated", ride);
  res.json(ride);
});

const closestDriversSchema = z.object({
  pickupLat: z.number(),
  pickupLng: z.number(),
});

ridesRouter.post("/closest-drivers", requireRole("DISPATCHER"), async (req, res) => {
  const parsed = closestDriversSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Coordonnées de départ requises" });
  }

  const availableDrivers = await prisma.driverProfile.findMany({
    where: {
      status: "AVAILABLE",
      lat: { not: null },
      lng: { not: null },
    },
    include: {
      user: {
        select: { id: true, name: true, phone: true },
      },
    },
  });

  const driversWithDistance = availableDrivers.map((driver) => {
    const R = 6371;
    const dLat = ((driver.lat! - parsed.data.pickupLat) * Math.PI) / 180;
    const dLng = ((driver.lng! - parsed.data.pickupLng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((parsed.data.pickupLat * Math.PI) / 180) *
        Math.cos((driver.lat! * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return {
      driverId: driver.userId,
      driverName: driver.user.name,
      driverPhone: driver.user.phone,
      distance: Math.round(distance * 100) / 100,
      vehicle: driver.vehicle,
    };
  });

  driversWithDistance.sort((a, b) => a.distance - b.distance);

  res.json(driversWithDistance);
});
