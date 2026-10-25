import type { PhysioValue } from "@/lib/physio";
import { appliesToBikeType } from "./config-order";

/**
 * Champs obligatoires de l'étude posturale, côté client.
 *
 * Miroir de `missingRequiredFields()` (actions/study.actions.ts), qui reste la
 * garde faisant autorité à la soumission : un test / une côte / une mesure du
 * cycliste actif et marqué `isRequired` est dû dès qu'il s'applique au type de
 * vélo choisi (tronc commun ou lié à ce vélo). Une côte ou une mesure du cycliste
 * obligatoire exige ses DEUX valeurs, « avant » et « après » ; un test physio
 * exige un résultat.
 *
 * Module pur (aucune dépendance React / DOM) pour rester testable seul.
 */

/** Étapes du stepper qui portent des champs obligatoires. */
export type RequiredStep = 3 | 4 | 5 | 6;

export type RequiredFieldKind = "physio" | "measure" | "rider";

/** Quelle valeur d'une côte / mesure est vide ; null pour un résultat de test physio. */
export type RequiredPhase = "before" | "after" | null;

/**
 * Étape qui saisit la valeur : tests physio → 3 ; côtes du vélo → « avant » à
 * l'étape 4 et « après » à l'étape 6 ; mesures du cycliste → les deux à l'étape 5.
 */
function stepOf(kind: RequiredFieldKind, phase: RequiredPhase): RequiredStep {
  if (kind === "physio") return 3;
  if (kind === "rider") return 5;
  return phase === "after" ? 6 : 4;
}

/** Clé d'une valeur obligatoire : `id` pour un test, `id:before` / `id:after` pour une mesure. */
export function fieldKey(id: string, phase: RequiredPhase = null): string {
  return phase ? `${id}:${phase}` : id;
}

/** Une valeur obligatoire encore vide. */
export interface MissingField {
  kind: RequiredFieldKind;
  id: string;
  name: string;
  phase: RequiredPhase;
  /** Étape où cette valeur se saisit (celle qu'on ne peut pas quitter sans elle). */
  step: RequiredStep;
  /** `fieldKey(id, phase)` : sert de clé d'alerte aux formulaires. */
  key: string;
}

/** Ce qu'il faut savoir d'un test / d'une côte pour décider s'il est dû. */
interface RequirableDef {
  id: string;
  name: string;
  isRequired: boolean;
  isCommon: boolean;
  bikeTypeLinks: { bikeTypeId: string }[];
}

type BeforeAfter = { before: number | null; after: number | null };

/** Obligatoire ET applicable : c'est ce qui bloque le passage à l'étape suivante. */
export function isEnforcedRequired(def: RequirableDef, bikeTypeId: string | null): boolean {
  return def.isRequired && appliesToBikeType(def, bikeTypeId);
}

function hasPhysioValue(v: PhysioValue | undefined): boolean {
  return v !== null && v !== undefined && v !== "";
}

function missing(kind: RequiredFieldKind, def: RequirableDef, phase: RequiredPhase): MissingField {
  return { kind, id: def.id, name: def.name, phase, step: stepOf(kind, phase), key: fieldKey(def.id, phase) };
}

/**
 * Toutes les valeurs obligatoires encore vides, dans l'ordre tests → côtes →
 * mesures cycliste (l'ordre d'affichage à l'écran est celui du DOM, voir
 * lib/study/focus-missing.ts). Une côte dont « avant » et « après » manquent
 * compte pour deux valeurs : chacune se saisit à sa propre étape.
 */
export function findMissingRequired(input: {
  bikeTypeId: string | null;
  physioTests: RequirableDef[];
  physioResults: Record<string, PhysioValue>;
  measurements: RequirableDef[];
  measureValues: Record<string, BeforeAfter>;
  riderMeasurements: RequirableDef[];
  riderMeasureValues: Record<string, BeforeAfter>;
}): MissingField[] {
  const { bikeTypeId } = input;
  const found: MissingField[] = [];

  for (const t of input.physioTests) {
    if (!isEnforcedRequired(t, bikeTypeId)) continue;
    if (!hasPhysioValue(input.physioResults[t.id])) found.push(missing("physio", t, null));
  }
  for (const m of input.measurements) {
    if (!isEnforcedRequired(m, bikeTypeId)) continue;
    const v = input.measureValues[m.id];
    if (v?.before == null) found.push(missing("measure", m, "before"));
    if (v?.after == null) found.push(missing("measure", m, "after"));
  }
  for (const m of input.riderMeasurements) {
    if (!isEnforcedRequired(m, bikeTypeId)) continue;
    const v = input.riderMeasureValues[m.id];
    if (v?.before == null) found.push(missing("rider", m, "before"));
    if (v?.after == null) found.push(missing("rider", m, "after"));
  }
  return found;
}

/**
 * Première étape de l'intervalle [from, to[ qui porte encore une valeur
 * obligatoire vide, ou null si on peut passer. Sert aux trois chemins qui
 * quittent une étape : bouton Suivant, clic sur le stepper, soumission finale.
 */
export function firstBlockingStep(
  missingFields: readonly MissingField[],
  from: number,
  to: number
): RequiredStep | null {
  let first: RequiredStep | null = null;
  for (const f of missingFields) {
    if (f.step < from || f.step >= to) continue;
    if (first === null || f.step < first) first = f.step;
  }
  return first;
}
