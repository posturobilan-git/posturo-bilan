import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

/**
 * Numéros de téléphone des patients : validés et normalisés en E.164
 * (`+33612345678`) avant d'être stockés — chiffrés — dans `Patient.phone`.
 * Un numéro saisi sans indicatif est lu comme un numéro français ; un numéro
 * international s'écrit avec son indicatif (`+41 79 123 45 67`).
 *
 * Module pur (aucune dépendance serveur) : utilisable côté client comme serveur.
 */
export const DEFAULT_PHONE_COUNTRY: CountryCode = "FR";

/**
 * Numéro valide → sa forme E.164 ; vide, illisible ou invalide → null.
 * `06 12 34 56 78`, `0612345678`, `+33 6 12 34 56 78` et `0033612345678`
 * donnent tous `+33612345678`.
 */
export function normalizePhone(input: string | null | undefined): string | null {
  const raw = input?.trim();
  if (!raw) return null;
  const parsed = parsePhoneNumberFromString(raw, DEFAULT_PHONE_COUNTRY);
  return parsed?.isValid() ? parsed.number : null;
}

/**
 * Forme lisible d'un numéro stocké : nationale pour un numéro français
 * (`06 12 34 56 78`), internationale sinon. Une valeur qui n'est pas un numéro
 * valide (donnée saisie avant l'introduction de la normalisation) est rendue
 * telle quelle.
 */
export function formatPhoneForDisplay(stored: string): string {
  const parsed = parsePhoneNumberFromString(stored, DEFAULT_PHONE_COUNTRY);
  if (!parsed?.isValid()) return stored;
  return parsed.country === DEFAULT_PHONE_COUNTRY ? parsed.formatNational() : parsed.formatInternational();
}
