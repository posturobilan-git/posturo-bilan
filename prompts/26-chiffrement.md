# Prompt 26 — Chiffrement des données personnelles (PII)

> Lis CLAUDE.md.
> Chiffrement transparent des colonnes sensibles au niveau applicatif.
> La clé de chiffrement n'est jamais stockée en base — uniquement en variable
> d'environnement. Un dump Neon sans la clé est inutilisable.

## Colonnes à chiffrer

Sur le modèle `Patient` : `firstName`, `lastName`, `email`, `phone`
Sur le modèle `PatientIntake` : `medicalNotes`
Sur le modèle `User` (kinés) : `email`, `name`

Les UUIDs, statuts, mesures, scores et dates ne sont PAS chiffrés —
ils n'identifient personne sans les colonnes PII.

## Librairie

Utiliser le module natif Node.js `crypto` (AES-256-GCM, pas de dépendance externe).
Créer `lib/crypto.ts` :

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, "hex"); // 32 bytes = 64 hex chars

export function encrypt(text: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([
    cipher.update(text, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  // Format : iv(24) + tag(32) + encrypted — tout en hex, stocké comme string
  return iv.toString("hex") + tag.toString("hex") + encrypted.toString("hex");
}

export function decrypt(text: string): string {
  const iv = Buffer.from(text.slice(0, 24), "hex");
  const tag = Buffer.from(text.slice(24, 56), "hex");
  const encrypted = Buffer.from(text.slice(56), "hex");
  const decipher = createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final("utf8");
}

// Helper pour chiffrer/déchiffrer un objet partiel
export function encryptFields<T extends object>(
  obj: T,
  fields: (keyof T)[],
): T {
  const result = { ...obj };
  for (const field of fields) {
    if (result[field] && typeof result[field] === "string") {
      result[field] = encrypt(result[field] as string) as T[keyof T];
    }
  }
  return result;
}

export function decryptFields<T extends object>(
  obj: T,
  fields: (keyof T)[],
): T {
  const result = { ...obj };
  for (const field of fields) {
    if (result[field] && typeof result[field] === "string") {
      try {
        result[field] = decrypt(result[field] as string) as T[keyof T];
      } catch {
        // Valeur non chiffrée (données existantes avant migration) — laisser tel quel
      }
    }
  }
  return result;
}
```

## Constantes des champs chiffrés

Créer `lib/crypto.constants.ts` pour centraliser :

```typescript
export const PATIENT_ENCRYPTED_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "phone",
] as const;
export const INTAKE_ENCRYPTED_FIELDS = ["medicalNotes"] as const;
export const USER_ENCRYPTED_FIELDS = ["email", "name"] as const;
```

## Intégration dans les Server Actions

Chiffrer à l'écriture, déchiffrer à la lecture — de façon transparente.
Ne jamais stocker ou logger une valeur déchiffrée côté serveur.

```typescript
// Écriture — chiffrer avant Prisma
const encrypted = encryptFields(validated, PATIENT_ENCRYPTED_FIELDS);
await prisma.patient.create({ data: encrypted });

// Lecture — déchiffrer après Prisma
const raw = await prisma.patient.findUnique({ where: { id } });
const patient = decryptFields(raw, PATIENT_ENCRYPTED_FIELDS);
```

Appliquer dans toutes les Server Actions qui touchent ces modèles :
`patient.actions.ts`, `user.actions.ts`, et les routes webhook.

## Recherche — adapter le champ email

La recherche par email (déduplication dans les webhooks, login kiné) ne peut plus
se faire via un `WHERE email = ?` puisque la valeur est chiffrée.

Solution : ajouter une colonne `emailHash` (string, unique) sur `Patient` et `User`,
contenant un hash SHA-256 de l'email en minuscules — non réversible mais
déterministe, permet les lookups sans exposer l'email.

```typescript
import { createHash } from "crypto";
export const hashEmail = (email: string) =>
  createHash("sha256").update(email.toLowerCase()).digest("hex");

// À l'écriture
await prisma.patient.upsert({
  where: { emailHash: hashEmail(email) },
  create: { ...encryptFields(...), emailHash: hashEmail(email) },
  update: { ...encryptFields(...) },
});
```

Ajouter `emailHash` au schéma Prisma sur `Patient` et `User`, créer la migration.

## Migration des données existantes

Script à exécuter une seule fois sur la base de dev puis prod :

```typescript
// scripts/migrate-encrypt.ts
// Pour chaque Patient existant en clair → chiffrer et réécrire
const patients = await prisma.patient.findMany();
for (const p of patients) {
  await prisma.patient.update({
    where: { id: p.id },
    data: {
      ...encryptFields(p, PATIENT_ENCRYPTED_FIELDS),
      emailHash: hashEmail(p.email), // l'email est encore en clair ici
    },
  });
}
// Répéter pour User et PatientIntake
```

Prévoir le cas où `decrypt()` échoue sur une valeur déjà migrée (le try/catch
dans `decryptFields` gère ça).

## Variable d'environnement

Ajouter dans `.env.example` :

```bash
# Générer avec : node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY="64_caracteres_hexadecimaux_ici"
```

Ajouter dans Vercel pour chaque environnement (prod, preview, dev).
La clé de prod ne doit jamais être la même que dev.
Stocker la clé de prod dans un gestionnaire de secrets (1Password, Bitwarden)
en dehors de Vercel — si Vercel est compromis, la clé ne doit pas suffire.

## Validation

```bash
npx prisma migrate dev --name add-email-hash-and-encryption
npx ts-node scripts/migrate-encrypt.ts
npx tsc --noEmit

# Vérifier dans Prisma Studio que les colonnes PII sont bien du texte chiffré
# (chaîne hexadécimale longue, illisible)
# Vérifier que l'app fonctionne normalement côté UI (déchiffrement transparent)
# Vérifier que la recherche par email fonctionne via emailHash
# Vérifier que l'anonymisation RGPD (prompt 06) écrase bien les valeurs chiffrées
```
