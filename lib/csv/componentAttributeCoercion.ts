import type { ComponentAttribute } from "@prisma/client";

export interface AttributeValueTriple {
  valueText: string | null;
  valueNumber: number | null;
  valueBoolean: boolean | null;
}

export type CoercionResult =
  | { ok: true; value: AttributeValueTriple }
  | { ok: false; error: string };

const EMPTY_VALUE: AttributeValueTriple = { valueText: null, valueNumber: null, valueBoolean: null };

const TRUE_WORDS = new Set(["oui", "true", "1", "vrai"]);
const FALSE_WORDS = new Set(["non", "false", "0", "faux"]);

/**
 * Coerces a raw string (form field, CSV cell) into the typed value column that
 * matches the attribute's configured type. Shared by the component create/edit
 * action, the CSV import preview, and the seed script, so the NUMBER/BOOLEAN/
 * SELECT rules stay in exactly one place. An empty/blank input is not an error —
 * it means "no value provided" (caller decides whether that's acceptable based
 * on `isRequired`).
 */
export function coerceAttributeValue(
  attribute: Pick<ComponentAttribute, "type" | "options" | "name">,
  raw: string
): CoercionResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: EMPTY_VALUE };

  switch (attribute.type) {
    case "NUMBER": {
      const n = Number(trimmed.replace(",", "."));
      if (Number.isNaN(n)) {
        return { ok: false, error: `Valeur numérique invalide pour « ${attribute.name} » : "${trimmed}"` };
      }
      return { ok: true, value: { valueText: null, valueNumber: n, valueBoolean: null } };
    }
    case "BOOLEAN": {
      const lower = trimmed.toLowerCase();
      if (TRUE_WORDS.has(lower)) return { ok: true, value: { valueText: null, valueNumber: null, valueBoolean: true } };
      if (FALSE_WORDS.has(lower)) return { ok: true, value: { valueText: null, valueNumber: null, valueBoolean: false } };
      return { ok: false, error: `Valeur "oui/non" invalide pour « ${attribute.name} » : "${trimmed}"` };
    }
    case "SELECT": {
      // Normalise vers la casse canonique définie par l'admin (ex: "plate" → "Plate")
      // pour que les valeurs stockées — et donc les listes de filtres — ne divergent
      // jamais par la casse.
      const canonical = attribute.options.find((o) => o.toLowerCase() === trimmed.toLowerCase());
      if (!canonical) {
        return { ok: false, error: `Option invalide pour « ${attribute.name} » : "${trimmed}"` };
      }
      return { ok: true, value: { valueText: canonical, valueNumber: null, valueBoolean: null } };
    }
    case "TEXT":
    default:
      return { ok: true, value: { valueText: trimmed, valueNumber: null, valueBoolean: null } };
  }
}

/** Reverse of coerceAttributeValue: typed value → human-readable CSV cell text. */
export function humanizeAttributeValue(
  attribute: Pick<ComponentAttribute, "type">,
  value: AttributeValueTriple
): string {
  switch (attribute.type) {
    case "NUMBER":
      return value.valueNumber != null ? String(value.valueNumber) : "";
    case "BOOLEAN":
      return value.valueBoolean == null ? "" : value.valueBoolean ? "oui" : "non";
    case "SELECT":
    case "TEXT":
    default:
      return value.valueText ?? "";
  }
}

/** True when none of the three typed columns carry a value. */
export function isEmptyAttributeValue(value: AttributeValueTriple): boolean {
  return value.valueText == null && value.valueNumber == null && value.valueBoolean == null;
}
