import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { verifyToken } from "../middleware/auth";
import { prisma } from "../lib/prisma";

let io: Server | null = null;

export function initSockets(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("Non authentifié"));
    try {
      const user = verifyToken(token);
      socket.data.user = user;
      next();
    } catch {
      next(new Error("Token invalide"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user as { id: string; role: string };
    if (user.role === "DISPATCHER") {
      socket.join("dispatchers");
    } else {
      socket.join(`driver:${user.id}`);
      socket.join("drivers");

      socket.on("driver:location", async ({ lat, lng }: { lat: number; lng: number }) => {
        if (typeof lat !== "number" || typeof lng !== "number") return;
        await prisma.driverProfile.update({
          where: { userId: user.id },
          data: { lat, lng, locationUpdatedAt: new Date() },
        });
        io!.to("dispatchers").emit("driver:location", { driverId: user.id, lat, lng });
      });
    }
  });

  return io;
}

export function getIO(): Server {
  if (!io) throw new Error("Sockets non initialisés");
  return io;
}
