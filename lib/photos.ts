import type { PhotoAngle } from "@prisma/client";

// Display order of angles in the before/after comparison. The trailing `null`
// bucket holds photos with no angle set.
const ANGLE_ORDER: (PhotoAngle | null)[] = ["SIDE", "FRONT", "BACK", null];

/**
 * Pairs before/after photos so that the SAME angle sits side by side (prompt 25):
 * one row per (angle, index) — e.g. the side-view before next to the side-view
 * after. Within an angle, items keep their original order. A missing counterpart
 * yields a one-sided row (the caller renders an empty cell). Generic over any
 * item carrying an `angle`, so it works for both the web view and the PDF.
 */
export function pairByAngle<T extends { angle: PhotoAngle | null }>(
  before: T[],
  after: T[]
): { before?: T; after?: T }[] {
  const rows: { before?: T; after?: T }[] = [];
  for (const angle of ANGLE_ORDER) {
    const b = before.filter((p) => p.angle === angle);
    const a = after.filter((p) => p.angle === angle);
    for (let i = 0; i < Math.max(b.length, a.length); i++) {
      rows.push({ before: b[i], after: a[i] });
    }
  }
  return rows;
}
