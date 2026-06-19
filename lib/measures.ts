/**
 * Formats the before→after delta of a measurement as a signed, unit-suffixed
 * string (e.g. `+5mm`, `-3°`, `0cm`). Returns null when either value is missing,
 * since a delta only makes sense once both are known.
 *
 * The sign is always explicit for non-zero deltas, but the value is left
 * deliberately neutral (no good/bad colouring): an increase isn't inherently
 * "positive" or "negative" — it depends on the measurement.
 */
export function formatDelta(
  before: number | null | undefined,
  after: number | null | undefined,
  unit: string
): string | null {
  if (before == null || after == null) return null;
  // Round to 2 decimals to avoid floating-point noise (e.g. 0.1 + 0.2).
  const delta = Math.round((after - before) * 100) / 100;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta}${unit}`;
}
