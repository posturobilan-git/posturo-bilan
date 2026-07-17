import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

// Chiffrement applicatif des colonnes PII — la clé ne vit jamais en base, voir
// prompts/26-chiffrement.md. Un dump Neon sans ENCRYPTION_KEY est inutilisable.

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex) throw new Error("ENCRYPTION_KEY manquant — voir .env.example.");
  const key = Buffer.from(hex, "hex");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY invalide — attendu 64 caractères hexadécimaux (32 octets).");
  }
  return key;
}

export function encrypt(text: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format : iv(24) + tag(32) + encrypted — tout en hex, stocké comme string
  return iv.toString("hex") + tag.toString("hex") + encrypted.toString("hex");
}

export function decrypt(text: string): string {
  const key = getKey();
  const iv = Buffer.from(text.slice(0, 24), "hex");
  const tag = Buffer.from(text.slice(24, 56), "hex");
  const encrypted = Buffer.from(text.slice(56), "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

/** Helper pour chiffrer les champs PII d'un objet partiel avant écriture Prisma. */
export function encryptFields<T extends object>(obj: T, fields: readonly (keyof T)[]): T {
  const result = { ...obj };
  for (const field of fields) {
    const value = result[field];
    if (value && typeof value === "string") {
      result[field] = encrypt(value) as T[keyof T];
    }
  }
  return result;
}

/**
 * Helper pour déchiffrer les champs PII d'un objet lu depuis Prisma. Le
 * try/catch gère les valeurs non chiffrées (données antérieures à la
 * migration, ou placeholders d'anonymisation RGPD) — la valeur est alors
 * laissée telle quelle plutôt que de faire échouer la lecture.
 */
export function decryptFields<T extends object>(obj: T, fields: readonly (keyof T)[]): T {
  const result = { ...obj };
  for (const field of fields) {
    const value = result[field];
    if (value && typeof value === "string") {
      try {
        result[field] = decrypt(value) as T[keyof T];
      } catch {
        // Valeur non chiffrée — laisser tel quel.
      }
    }
  }
  return result;
}

/**
 * Hash déterministe (non réversible) d'un email, utilisé pour les lookups
 * (dédup webhook, login kiné) puisque la colonne `email` est chiffrée et ne
 * supporte plus `WHERE email = ?`.
 */
export function hashEmail(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}
