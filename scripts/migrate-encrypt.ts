import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { encrypt, decrypt, hashEmail } from "../lib/crypto";
import {
  PATIENT_ENCRYPTED_FIELDS,
  INTAKE_ENCRYPTED_FIELDS,
  USER_ENCRYPTED_FIELDS,
} from "../lib/crypto.constants";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/**
 * Script de migration à exécuter une seule fois (dev, puis prod) pour chiffrer
 * les colonnes PII existantes et backfiller emailHash. Idempotent : une valeur
 * qui se déchiffre déjà avec succès est considérée comme déjà migrée et n'est
 * pas re-chiffrée (sinon un second passage la chiffrerait deux fois — le
 * déchiffrement transparent de l'app ne fait qu'une seule passe et renverrait
 * alors du bruit au lieu du texte en clair).
 */
function toPlaintext(value: string): string {
  try {
    return decrypt(value);
  } catch {
    return value;
  }
}

async function migratePatients() {
  const patients = await prisma.patient.findMany();
  let migrated = 0;

  for (const p of patients) {
    const plainEmail = toPlaintext(p.email);
    const plainFirstName = toPlaintext(p.firstName);
    const plainLastName = toPlaintext(p.lastName);
    const plainPhone = p.phone ? toPlaintext(p.phone) : p.phone;

    await prisma.patient.update({
      where: { id: p.id },
      data: {
        email: encrypt(plainEmail),
        firstName: encrypt(plainFirstName),
        lastName: encrypt(plainLastName),
        phone: plainPhone ? encrypt(plainPhone) : plainPhone,
        emailHash: hashEmail(plainEmail),
      },
    });
    migrated++;
  }

  console.log(`Patient: ${migrated} ligne(s) migrée(s).`);
}

async function migrateUsers() {
  const users = await prisma.user.findMany();
  let migrated = 0;

  for (const u of users) {
    const plainEmail = toPlaintext(u.email);
    const plainName = toPlaintext(u.name);

    await prisma.user.update({
      where: { id: u.id },
      data: {
        email: encrypt(plainEmail),
        name: encrypt(plainName),
        emailHash: hashEmail(plainEmail),
      },
    });
    migrated++;
  }

  console.log(`User: ${migrated} ligne(s) migrée(s).`);
}

async function migrateIntakes() {
  const intakes = await prisma.patientIntake.findMany({
    where: { medicalNotes: { not: null } },
  });
  let migrated = 0;

  for (const i of intakes) {
    if (!i.medicalNotes) continue;
    await prisma.patientIntake.update({
      where: { id: i.id },
      data: { medicalNotes: encrypt(toPlaintext(i.medicalNotes)) },
    });
    migrated++;
  }

  console.log(`PatientIntake: ${migrated} ligne(s) migrée(s).`);
}

async function main() {
  // Champs concernés, pour référence : PATIENT_ENCRYPTED_FIELDS,
  // USER_ENCRYPTED_FIELDS, INTAKE_ENCRYPTED_FIELDS (lib/crypto.constants.ts).
  console.log(
    `Colonnes chiffrées — Patient: ${PATIENT_ENCRYPTED_FIELDS.join(", ")} · User: ${USER_ENCRYPTED_FIELDS.join(", ")} · PatientIntake: ${INTAKE_ENCRYPTED_FIELDS.join(", ")}`
  );
  await migratePatients();
  await migrateUsers();
  await migrateIntakes();
  console.log("✅ Migration terminée.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
