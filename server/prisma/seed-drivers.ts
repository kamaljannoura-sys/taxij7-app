import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const drivers = [
    { name: "Ahmed", phone: "0612345678", lat: 45.5017, lng: -73.5673 },
    { name: "Marie", phone: "0687654321", lat: 45.5089, lng: -73.5550 },
    { name: "Jean", phone: "0698765432", lat: 45.4900, lng: -73.5800 },
  ];

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

    console.log(`✅ Driver: ${driver.name} (${driver.phone})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
