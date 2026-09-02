import { getIO } from "../sockets";

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
