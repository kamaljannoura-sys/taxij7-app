import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import path from "path";
import { authRouter } from "./routes/auth";
import { driversRouter } from "./routes/drivers";
import { ridesRouter } from "./routes/rides";
import { publicRouter } from "./routes/public";
import { initSockets } from "./sockets";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/auth", authRouter);
app.use("/drivers", driversRouter);
app.use("/rides", ridesRouter);
app.use("/public", publicRouter);

const httpServer = createServer(app);
initSockets(httpServer);

const port = Number(process.env.PORT) || 4000;
httpServer.listen(port, () => {
  console.log(`Serveur Taxi J7 en écoute sur http://localhost:${port}`);
});
