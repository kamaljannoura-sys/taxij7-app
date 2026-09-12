import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

// Garantit qu'un compte répartiteur existe au démarrage, sans quoi il
// n'existait aucun moyen de se connecter sur un déploiement où le script
// prisma/seed.ts n'a jamais été lancé manuellement (ex: Render, qui ne
// l'exécute pas automatiquement). Idempotent : ne touche pas au mot de
// passe d'un compte déjà personnalisé via l'app (PATCH /auth/me), sauf si
// DISPATCHER_PASSWORD est explicitement défini dans l'environnement.
export async function ensureDispatcherSeeded() {
  const phone = process.env.DISPATCHER_PHONE || "0600000001";
  const name = process.env.DISPATCHER_NAME || "Répartiteur";

  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) return;

  const password = process.env.DISPATCHER_PASSWORD || "changeme";
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { name, phone, passwordHash, role: "DISPATCHER" },
  });
  console.log(`Compte répartiteur créé automatiquement: ${phone}`);
}
