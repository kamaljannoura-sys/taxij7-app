import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Le compte répartiteur est créé à partir de variables d'environnement,
// afin de ne stocker aucun identifiant en clair dans le code.
// Les comptes chauffeurs sont créés séparément (script privé non versionné).
async function main() {
  const phone = process.env.DISPATCHER_PHONE || "0600000001";
  const password = process.env.DISPATCHER_PASSWORD || "changeme";
  const name = process.env.DISPATCHER_NAME || "Répartiteur";

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.upsert({
    where: { phone },
    update: { name, passwordHash, role: "DISPATCHER" },
    create: { name, phone, passwordHash, role: "DISPATCHER" },
  });
  console.log(`Dispatcher prêt: ${phone}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
