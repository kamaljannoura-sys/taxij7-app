import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { autoAssignRide, broadcastRideUpdate, rideInclude } from "../lib/rideHelpers";
import { scheduleResponseTimeout } from "../lib/dispatchQueue";

export const publicRouter = Router();

const bookingLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de demandes, réessayez plus tard." },
});

const bookingSchema = z.object({
  clientName: z.string().trim().min(1).max(100).optional(),
  clientPhone: z.string().trim().min(6).max(30),
  pickupAddress: z.string().trim().min(1).max(200),
  pickupLat: z.coerce.number().min(-90).max(90).optional(),
  pickupLng: z.coerce.number().min(-180).max(180).optional(),
  destinationAddress: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(500).optional(),
  vehicleType: z.enum(["STANDARD", "VAN", "PREMIUM"]).default("STANDARD"),
  estimatedPrice: z.coerce.number().min(0).max(2000).optional(),
});

// Client public : demande de course depuis le site web, sans authentification
publicRouter.post("/book", bookingLimiter, async (req, res) => {
  const parsed = bookingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Informations de réservation invalides" });
  }

  const ride = await prisma.ride.create({
    data: {
      clientName: parsed.data.clientName || "Client web",
      clientPhone: parsed.data.clientPhone,
      pickupAddress: parsed.data.pickupAddress,
      pickupLat: parsed.data.pickupLat,
      pickupLng: parsed.data.pickupLng,
      destinationAddress: parsed.data.destinationAddress,
      notes: parsed.data.notes,
      status: "PENDING",
      vehicleType: parsed.data.vehicleType,
      estimatedPrice: parsed.data.estimatedPrice,
    },
    include: rideInclude,
  });

  const assigned = await autoAssignRide(ride.id, parsed.data.pickupLat, parsed.data.pickupLng);
  if (assigned && assigned.driverId) {
    scheduleResponseTimeout(assigned.id, assigned.driverId);
  } else {
    broadcastRideUpdate(ride, "ride:new", ride);
  }

  res.status(201).json({ id: (assigned ?? ride).id });
});

const trackLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de demandes, réessayez plus tard." },
});

// Client public : suivi d'une course par son id, sans authentification
publicRouter.get("/track/:id", trackLimiter, async (req, res) => {
  const ride = await prisma.ride.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      status: true,
      pickupAddress: true,
      destinationAddress: true,
      createdAt: true,
      vehicleType: true,
      estimatedPrice: true,
      driver: {
        select: {
          name: true,
          phone: true,
          driverProfile: { select: { lat: true, lng: true, locationUpdatedAt: true } },
        },
      },
    },
  });

  if (!ride) {
    return res.status(404).json({ error: "Course introuvable" });
  }

  res.json(ride);
});
