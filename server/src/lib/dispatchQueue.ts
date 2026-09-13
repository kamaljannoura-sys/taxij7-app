import { prisma } from "./prisma";
import { getIO } from "../sockets";
import { rideInclude } from "./rideHelpers";
import { findClosestAvailableDriver } from "./dispatchHelpers";

// Délai laissé à un chauffeur pour accepter/refuser une course avant qu'elle
// ne soit automatiquement réattribuée au suivant.
const RESPONSE_TIMEOUT_MS = Number(process.env.RIDE_RESPONSE_TIMEOUT_MS) || 45_000;

// État en mémoire (process unique, cohérent avec le reste de l'app qui ne
// suppose aucune mise à l'échelle horizontale) : un timer par course en
// attente de réponse, et la liste des chauffeurs déjà essayés pour cette
// course afin de ne pas la leur re-proposer en boucle.
const timers = new Map<string, NodeJS.Timeout>();
const triedDrivers = new Map<string, Set<string>>();

// À appeler juste après qu'une course a été assignée à un chauffeur (peu
// importe la façon dont l'assignation a eu lieu). Démarre le compte à
// rebours de réponse et note ce chauffeur comme "déjà essayé" pour cette
// course. `resetTried`, à passer sur une assignation manuelle du
// dispatcher, repart d'une liste vierge (le choix du dispatcher prime).
export function scheduleResponseTimeout(
  rideId: string,
  driverId: string,
  options: { resetTried?: boolean } = {}
) {
  clearResponseTimeout(rideId);
  if (options.resetTried) {
    triedDrivers.set(rideId, new Set());
  }
  if (!triedDrivers.has(rideId)) {
    triedDrivers.set(rideId, new Set());
  }
  triedDrivers.get(rideId)!.add(driverId);

  const timer = setTimeout(() => {
    handleTimeout(rideId).catch((err) =>
      console.error(`Erreur lors de la réattribution automatique de la course ${rideId}:`, err)
    );
  }, RESPONSE_TIMEOUT_MS);
  timer.unref?.();
  timers.set(rideId, timer);
}

export function clearResponseTimeout(rideId: string) {
  const timer = timers.get(rideId);
  if (timer) {
    clearTimeout(timer);
    timers.delete(rideId);
  }
}

// À appeler quand une course sort définitivement du cycle de dispatch
// automatique : acceptée par le chauffeur, terminée ou annulée.
export function clearDispatchState(rideId: string) {
  clearResponseTimeout(rideId);
  triedDrivers.delete(rideId);
}

async function handleTimeout(rideId: string) {
  timers.delete(rideId);

  const ride = await prisma.ride.findUnique({ where: { id: rideId } });
  // Le chauffeur a déjà répondu entre-temps (acceptée/refusée), ou la
  // course a été traitée autrement (réassignée manuellement, annulée) :
  // rien à faire.
  if (!ride || ride.status !== "ASSIGNED") return;

  const unresponsiveDriverId = ride.driverId;
  await freeUnresponsiveDriver(unresponsiveDriverId);

  const pending = await prisma.ride.update({
    where: { id: rideId },
    data: { status: "PENDING", driverId: null },
    include: rideInclude,
  });
  getIO().to("dispatchers").emit("ride:updated", pending);
  if (unresponsiveDriverId) {
    getIO().to(`driver:${unresponsiveDriverId}`).emit("ride:updated", pending);
  }

  await reassign(rideId);
}

async function freeUnresponsiveDriver(driverId: string | null) {
  if (!driverId) return;
  const updated = await prisma.driverProfile.updateMany({
    where: { userId: driverId, status: "ON_RIDE" },
    data: { status: "AVAILABLE" },
  });
  if (updated.count > 0) {
    getIO().to("dispatchers").emit("driver:status", { driverId, status: "AVAILABLE" });
  }
}

// Cherche le prochain chauffeur disponible (en excluant ceux déjà essayés
// pour cette course) et lui réattribue la course. S'il n'y en a plus, la
// course repasse en attente et le cycle s'arrête.
export async function reassign(rideId: string) {
  const ride = await prisma.ride.findUnique({ where: { id: rideId } });
  if (!ride || ride.status !== "PENDING") {
    // La course a déjà été prise/traitée entre-temps.
    if (ride && ride.status !== "PENDING" && ride.status !== "ASSIGNED") {
      clearDispatchState(rideId);
    }
    return;
  }

  const tried = [...(triedDrivers.get(rideId) ?? [])];

  let nextDriverId: string | null = null;
  if (ride.pickupLat != null && ride.pickupLng != null) {
    nextDriverId = await findClosestAvailableDriver(ride.pickupLat, ride.pickupLng, tried);
  }
  if (!nextDriverId) {
    const fallback = await prisma.driverProfile.findFirst({
      where: {
        status: "AVAILABLE",
        lat: { not: null },
        lng: { not: null },
        userId: { notIn: tried },
      },
      orderBy: { updatedAt: "asc" },
    });
    nextDriverId = fallback?.userId ?? null;
  }

  if (!nextDriverId) {
    // Plus personne à essayer : la course reste en attente, le cycle
    // reprendra dès qu'un chauffeur redevient disponible (voir
    // assignClosestPendingRideTo, appelé depuis le statut/la position).
    clearDispatchState(rideId);
    return;
  }

  const claimed = await prisma.driverProfile.updateMany({
    where: { userId: nextDriverId, status: "AVAILABLE" },
    data: { status: "ON_RIDE" },
  });
  if (claimed.count === 0) {
    // Un autre flux vient de prendre ce chauffeur : on le marque comme
    // essayé et on retente immédiatement avec le suivant.
    if (!triedDrivers.has(rideId)) triedDrivers.set(rideId, new Set());
    triedDrivers.get(rideId)!.add(nextDriverId);
    return reassign(rideId);
  }

  const updated = await prisma.ride.update({
    where: { id: rideId },
    data: { driverId: nextDriverId, status: "ASSIGNED" },
    include: rideInclude,
  });

  getIO().to("dispatchers").emit("ride:updated", updated);
  getIO().to(`driver:${nextDriverId}`).emit("ride:new", updated);
  getIO().to("dispatchers").emit("driver:status", { driverId: nextDriverId, status: "ON_RIDE" });

  scheduleResponseTimeout(rideId, nextDriverId);
}
