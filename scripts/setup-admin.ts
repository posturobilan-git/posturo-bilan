import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { decryptFields, hashEmail } from "../lib/crypto";
import { USER_ENCRYPTED_FIELDS } from "../lib/crypto.constants";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const email = process.argv[2];
  if (!email) {
    throw new Error("Usage: npm run setup-admin -- email@cabinet.fr");
  }

  const user = await prisma.user.findUnique({ where: { emailHash: hashEmail(email) } });
  if (!user) {
    throw new Error(
      `Aucun utilisateur avec l'email ${email}. L'utilisateur doit d'abord se connecter une fois via Clerk.`
    );
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { role: "ADMIN" },
  });
  const decrypted = decryptFields(updated, USER_ENCRYPTED_FIELDS);

  console.log(`✅ ${decrypted.name} (${decrypted.email}) est maintenant ADMIN.`);
  console.log("Il peut valider les autres comptes depuis /parametres/equipe.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
