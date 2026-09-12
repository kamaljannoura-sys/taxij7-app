import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";

export const testRouter = Router();

testRouter.post("/seed-drivers", async (_req, res) => {
  try {
    const drivers = [
      { name: "Ahmed", phone: "0612345678", lat: 45.5017, lng: -73.5673 },
      { name: "Marie", phone: "0687654321", lat: 45.5089, lng: -73.5550 },
      { name: "Jean", phone: "0698765432", lat: 45.4900, lng: -73.5800 },
    ];

    const results = [];
    for (const driver of drivers) {
      const passwordHash = await bcrypt.hash("12345", 10);
      const user = await prisma.user.upsert({
        where: { phone: driver.phone },
        update: { name: driver.name, role: "DRIVER" },
        create: { name: driver.name, phone: driver.phone, passwordHash, role: "DRIVER" },
      });

      await prisma.driverProfile.upsert({
        where: { userId: user.id },
        update: { lat: driver.lat, lng: driver.lng, status: "AVAILABLE", vehicle: "Toyota Prius" },
        create: { userId: user.id, lat: driver.lat, lng: driver.lng, status: "AVAILABLE", vehicle: "Toyota Prius" },
      });

      results.push({ name: driver.name, phone: driver.phone });
    }

    res.json({ message: "Drivers created", drivers: results });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
