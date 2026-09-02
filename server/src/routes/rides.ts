import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { getIO } from "../sockets";
import { broadcastRideUpdate, rideInclude } from "../lib/rideHelpers";

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

const createRideSchema = z.object({
  clientName: z.string().min(1),
  clientPhone: z.string().min(1),
  pickupAddress: z.string().min(1),
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
  const { driverId, ...data } = parsed.data;

  const ride = await prisma.ride.create({
    data: {
      ...data,
      dispatcherId: req.user!.id,
      driverId: driverId ?? null,
      status: driverId ? "ASSIGNED" : "PENDING",
    },
    include: rideInclude,
  });

  if (driverId) {
    await prisma.driverProfile.update({
      where: { userId: driverId },
      data: { status: "ON_RIDE" },
    });
    getIO().to(`driver:${driverId}`).emit("ride:new", ride);
    getIO().to("dispatchers").emit("driver:status", { driverId, status: "ON_RIDE" });
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

  res.json(ride);
});

// Driver: accept an assigned ride
ridesRouter.patch("/:id/accept", requireRole("DRIVER"), async (req, res) => {
  const ride = await prisma.ride.update({
    where: { id: req.params.id },
    data: { status: "ACCEPTED" },
    include: rideInclude,
  });
  broadcastRideUpdate(ride, "ride:updated", ride);
  res.json(ride);
});

// Driver: decline an assigned ride (goes back to pending, unassigned)
ridesRouter.patch("/:id/decline", requireRole("DRIVER"), async (req, res) => {
  const ride = await prisma.ride.update({
    where: { id: req.params.id },
    data: { status: "PENDING", driverId: null },
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

  const ride = await prisma.ride.update({
    where: { id: req.params.id },
    data: { status: parsed.data.status },
    include: rideInclude,
  });

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
