import { z } from "zod";

/**
 * Discriminated result type for Server Actions.
 * Actions should never throw to the client — they return one of these
 * so the UI can show a friendly notification.
 */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(error: string): ActionResult<never> {
  return { ok: false, error };
}

/**
 * Turns a ZodError into a single readable French sentence.
 * e.g. "Hauteur selle : la valeur doit être ≥ 50."
 */
export function formatZodError(err: z.ZodError): string {
  const first = err.issues[0];
  if (!first) return "Données invalides.";

  const fieldLabel = labelForPath(first.path);

  switch (first.code) {
    case "too_small":
      return `${fieldLabel} : la valeur doit être ≥ ${first.minimum}.`;
    case "too_big":
      return `${fieldLabel} : la valeur doit être ≤ ${first.maximum}.`;
    case "invalid_type":
      return `${fieldLabel} : champ requis ou type invalide.`;
    default:
      return `${fieldLabel} : ${first.message}`;
  }
}

const FIELD_LABELS: Record<string, string> = {
  saddleHeight: "Hauteur selle",
  saddleSetback: "Recul selle",
  saddleAngle: "Angle selle",
  handlebarHeight: "Hauteur cintre",
  stemLength: "Longueur potence",
  stemAngle: "Angle potence",
  handlebarWidth: "Largeur cintre",
  effectiveReach: "Reach effectif",
  trunkAngle: "Angle tronc",
  kneeAngle: "Angle genou",
  cleatAngle: "Angle cale",
  crankLength: "Longueur manivelles",
  observations: "Observations",
  email: "Email",
  firstName: "Prénom",
  lastName: "Nom",
};

function labelForPath(path: PropertyKey[]): string {
  const key = path[path.length - 1];
  if (typeof key === "string" && FIELD_LABELS[key]) return FIELD_LABELS[key];
  return typeof key === "string" ? key : "Champ";
}
