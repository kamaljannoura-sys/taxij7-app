import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { assignOldestPendingRideTo } from "../lib/rideHelpers";
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

  if (parsed.data.status === "AVAILABLE") {
    const assigned = await assignOldestPendingRideTo(req.user!.id);
    if (assigned) {
      await prisma.driverProfile.update({
        where: { userId: req.user!.id },
        data: { status: "ON_RIDE" },
      });
      getIO().to("dispatchers").emit("driver:status", {
        driverId: req.user!.id,
        status: "ON_RIDE",
      });
      return res.json({ ...profile, status: "ON_RIDE" });
    }
  }

  res.json(profile);
});
