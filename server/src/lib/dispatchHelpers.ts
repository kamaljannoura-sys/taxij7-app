import { prisma } from "./prisma";

interface DriverDistance {
  driverId: string;
  distance: number;
}

export async function findClosestAvailableDriver(
  pickupLat: number,
  pickupLng: number
): Promise<string | null> {
  const availableDrivers = await prisma.driverProfile.findMany({
    where: {
      status: "AVAILABLE",
      lat: { not: null },
      lng: { not: null },
    },
    select: {
      userId: true,
      lat: true,
      lng: true,
    },
  });

  if (availableDrivers.length === 0) return null;

  const driversWithDistance: DriverDistance[] = availableDrivers.map((driver) => ({
    driverId: driver.userId,
    distance: calculateDistance(
      pickupLat,
      pickupLng,
      driver.lat!,
      driver.lng!
    ),
  }));

  driversWithDistance.sort((a, b) => a.distance - b.distance);

  return driversWithDistance[0].driverId;
}

function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Rayon de la Terre en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function getDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  return calculateDistance(lat1, lng1, lat2, lng2);
}
