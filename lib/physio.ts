import type { PhysioOutputType } from "@prisma/client";

/** A physio result value. Its concrete type depends on the test's outputType. */
export type PhysioValue = number | boolean | string | null;

/** A physio result stored on a study — a single value per test (no before/after).
 * `comment` is an optional free-text note attached to any test, shown in the report. */
export interface StudyPhysioResult {
  physioTestId: string;
  value: PhysioValue;
  comment?: string | null;
}

/** Metadata needed to render a stored physio result. */
export interface PhysioTestInfo {
  name: string;
  outputType: PhysioOutputType;
  unit: string | null;
}

/** Human-readable rendering of a physio value for the given output type. */
export function formatPhysioValue(
  outputType: PhysioOutputType,
  value: PhysioValue,
  unit?: string | null
): string {
  if (value === null || value === undefined || value === "") return "—";
  switch (outputType) {
    case "YES_NO":
      return value ? "Oui" : "Non";
    case "POSITIVE_NEGATIVE":
      return value ? "Positif" : "Négatif";
    case "VALUE":
      return unit ? `${value} ${unit}` : String(value);
    default:
      // Fallback for any legacy string value still stored on old studies.
      return String(value);
  }
}

/** True when a result holds a meaningful (non-empty) value. */
export function hasPhysioValue(r: { value: PhysioValue }): boolean {
  return r.value !== null && r.value !== undefined && r.value !== "";
}
