import { prisma } from "./prisma";
import { getIO } from "../sockets";
import { findClosestAvailableDriver, getDistanceKm } from "./dispatchHelpers";

export const rideInclude = {
  driver: { select: { id: true, name: true, phone: true } },
  dispatcher: { select: { id: true, name: true } },
};

export function broadcastRideUpdate(
  ride: { driverId: string | null },
  event: "ride:new" | "ride:updated",
  payload: unknown
) {
  getIO().to("dispatchers").emit(event, payload);
  if (ride.driverId) {
    getIO().to(`driver:${ride.driverId}`).emit(event, payload);
  }
}

// Assigne une course en attente à un chauffeur disponible ayant activé sa
// position (comme sur Uber : sans position, pas d'appel reçu) : au plus
// proche du point de prise en charge si ses coordonnées sont connues, sinon
// à celui disponible depuis le plus longtemps parmi ceux localisés.
// Retourne la course mise à jour, ou null s'il n'y a aucun chauffeur localisé
// et disponible.
export async function autoAssignRide(
  rideId: string,
  pickupLat?: number | null,
  pickupLng?: number | null
) {
  let driverId: string | null = null;
  if (pickupLat != null && pickupLng != null) {
    driverId = await findClosestAvailableDriver(pickupLat, pickupLng);
  }
  if (!driverId) {
    const driver = await prisma.driverProfile.findFirst({
      where: { status: "AVAILABLE", lat: { not: null }, lng: { not: null } },
      orderBy: { updatedAt: "asc" },
    });
    driverId = driver?.userId ?? null;
  }
  if (!driverId) return null;

  // Réclame le chauffeur de façon atomique : si un autre appel l'a pris
  // entre-temps (deux réservations simultanées), on abandonne proprement.
  const claimed = await prisma.driverProfile.updateMany({
    where: { userId: driverId, status: "AVAILABLE" },
    data: { status: "ON_RIDE" },
  });
  if (claimed.count === 0) return null;

  const ride = await prisma.ride.update({
    where: { id: rideId },
    data: { driverId, status: "ASSIGNED" },
    include: rideInclude,
  });

  getIO().to("dispatchers").emit("ride:new", ride);
  getIO().to(`driver:${driverId}`).emit("ride:new", ride);
  getIO().to("dispatchers").emit("driver:status", {
    driverId,
    status: "ON_RIDE",
  });

  return ride;
}

// Assigne au chauffeur qui vient de se signaler disponible et localisé la
// course en attente la plus proche de sa position (ou la plus ancienne si
// aucune course en attente n'a de coordonnées connues). Retourne la course
// mise à jour, ou null s'il n'y a aucune course en attente à lui donner.
export async function assignClosestPendingRideTo(
  driverId: string,
  lat: number,
  lng: number
) {
  const pendingRides = await prisma.ride.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
  });
  if (pendingRides.length === 0) return null;

  const withCoords = pendingRides.filter(
    (r): r is typeof r & { pickupLat: number; pickupLng: number } =>
      r.pickupLat != null && r.pickupLng != null
  );
  const target =
    withCoords.length > 0
      ? withCoords.reduce((closest, r) =>
          getDistanceKm(lat, lng, r.pickupLat, r.pickupLng) <
          getDistanceKm(lat, lng, closest.pickupLat, closest.pickupLng)
            ? r
            : closest
        )
      : pendingRides[0];

  // Réclame la course de façon atomique : si un autre chauffeur l'a prise
  // entre-temps (deux passages "disponible/localisé" simultanés), on
  // abandonne proprement.
  const claimed = await prisma.ride.updateMany({
    where: { id: target.id, status: "PENDING" },
    data: { driverId, status: "ASSIGNED" },
  });
  if (claimed.count === 0) return null;

  await prisma.driverProfile.update({
    where: { userId: driverId },
    data: { status: "ON_RIDE" },
  });

  const ride = await prisma.ride.findUniqueOrThrow({
    where: { id: target.id },
    include: rideInclude,
  });

  getIO().to(`driver:${driverId}`).emit("ride:new", ride);
  getIO().to("dispatchers").emit("ride:updated", ride);
  getIO().to("dispatchers").emit("driver:status", { driverId, status: "ON_RIDE" });

  return ride;
}
