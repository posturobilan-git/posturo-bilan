"use client";

import { useId } from "react";
import { missingControlProps, missingRowProps } from "@/lib/study/focus-missing";
import { FieldError } from "./FieldError";
import { MeasureDelta } from "./MeasureDelta";
import { INVALID_ROW_BASE, RequiredMark } from "./RequiredMark";

// Shared fixed-column grid so the per-row inputs line up exactly with the column
// header rendered once above them (avant · arrow · après · delta). All columns
// are fixed width so a filled cell and an empty cell occupy the same space.
const INPUT_GRID = "grid grid-cols-[6rem_0.875rem_6rem_4rem] items-center gap-x-2";

// Identical box metrics for the editable input and the read-only reference cell,
// so the "avant" and "après" columns align whether a value is present or not.
const FIELD_BASE = "h-9 w-full rounded-md border px-3 text-sm tabular-nums";
const LABEL = "text-[11px] font-medium uppercase tracking-wide text-content-subtle";

// La ligne a déjà son propre padding vertical (py-3) : la teinte le couvre pile.
const INVALID_ROW = `${INVALID_ROW_BASE} before:inset-y-0`;

function NumberField({
  value,
  ariaLabel,
  onChange,
  required = false,
  invalid = false,
  errorId,
}: {
  value: number | null;
  ariaLabel: string;
  onChange?: (v: number | null) => void;
  /** Valeur obligatoire pour passer à l'étape suivante. */
  required?: boolean;
  /** Obligatoire et encore vide après un passage bloqué. */
  invalid?: boolean;
  /** Id du message d'erreur affiché sous la ligne quand `invalid`. */
  errorId?: string;
}) {
  return (
    <input
      type="number"
      step="0.1"
      inputMode="decimal"
      placeholder="—"
      aria-label={ariaLabel}
      aria-required={required || undefined}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? errorId : undefined}
      {...missingControlProps(invalid)}
      value={value ?? ""}
      onChange={(e) => onChange?.(e.target.value === "" ? null : parseFloat(e.target.value))}
      className={`${FIELD_BASE} bg-surface text-content focus:outline-none focus:ring-1 ${
        invalid
          ? "border-danger-500 focus:border-danger-500 focus:ring-danger-500"
          : "border-border-strong focus:border-brand-500 focus:ring-brand-500"
      }`}
    />
  );
}

function ReferenceField({
  value,
  unit,
  ariaLabel,
}: {
  value: number | null;
  unit: string;
  ariaLabel: string;
}) {
  return (
    <div
      className={`${FIELD_BASE} flex items-center border-border bg-surface-muted text-content-muted`}
      aria-label={ariaLabel}
    >
      {value != null ? `${value} ${unit}` : "—"}
    </div>
  );
}

/** Column header — render once above a group of two-column (avant/après) rows. */
export function MeasuresHeader() {
  return (
    <div className={`${INPUT_GRID} pb-2`}>
      <span className={LABEL}>Avant</span>
      <span />
      <span className={LABEL}>Après</span>
      <span className={`${LABEL} text-right`}>Δ</span>
    </div>
  );
}

/**
 * A single measurement row, shared by the bike- and rider-measurement steps.
 *
 * - phase `before`: a single editable "avant" input (no header needed).
 * - phase `after`: "avant" is a read-only reference, "après" is editable + delta.
 * - phase `both`: both editable + delta (rider — avant/après on one screen).
 *
 * Two-column phases (`after`/`both`) expect a {@link MeasuresHeader} above them.
 *
 * A required measure needs both its "avant" and its "après" value; each step only
 * asks for the one(s) it lets you type: "avant" on `before`, "après" on `after`,
 * both on `both`. The pill sits on the name in every phase (the measure is
 * required), the alert goes on the empty value(s) only.
 */
export function MeasureRow({
  name,
  unit,
  required = false,
  invalidBefore = false,
  invalidAfter = false,
  reservedBefore = false,
  reservedAfter = false,
  before,
  after,
  phase,
  badge,
  onSetBefore,
  onSetAfter,
  onRemove,
}: {
  name: string;
  unit: string;
  /** Mesure obligatoire (avant ET après) : pastille « Obligatoire » sur le nom. */
  required?: boolean;
  /** « Avant » obligatoire et encore vide après un passage bloqué. */
  invalidBefore?: boolean;
  /** « Après » obligatoire et encore vide après un passage bloqué. */
  invalidAfter?: boolean;
  /** « Avant » / « après » qui étaient vides lors d'un passage bloqué : la ligne de message garde sa place. */
  reservedBefore?: boolean;
  reservedAfter?: boolean;
  before: number | null;
  after: number | null;
  phase: "before" | "after" | "both";
  /** Small chip shown next to the name (e.g. "Ajoutée pour cette étude"). */
  badge?: string;
  onSetBefore?: (v: number | null) => void;
  onSetAfter?: (v: number | null) => void;
  onRemove?: () => void;
}) {
  const showAfter = phase !== "before";
  const errorId = useId();
  const invalid = invalidBefore || invalidAfter;
  // Saisies exigées SUR CET ÉCRAN (en phase « après », « avant » n'est qu'une référence).
  const requiredBefore = required && phase !== "after";
  const requiredAfter = required && phase !== "before";
  // La ligne de message garde sa hauteur (texte le plus long possible) une fois la valeur
  // saisie : sinon les lignes suivantes remontent à chaque réponse.
  const reserveBefore = invalidBefore || reservedBefore;
  const reserveAfter = invalidAfter || reservedAfter;

  return (
    <div {...missingRowProps(invalid)} className={`py-3 ${invalid ? INVALID_ROW : ""}`}>
      <p className="text-sm font-medium text-content">
        {name}
        <span className="ml-1 font-normal text-content-subtle">({unit})</span>
        {required && <RequiredMark invalid={invalid} />}
        {badge && (
          <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
            {badge}
          </span>
        )}
      </p>

      <div className="mt-1.5 flex items-center gap-2">
        {showAfter ? (
          <div className={INPUT_GRID}>
            {phase === "after" ? (
              <ReferenceField value={before} unit={unit} ariaLabel={`${name} — avant réglage`} />
            ) : (
              <NumberField
                value={before}
                ariaLabel={`${name} — avant réglage`}
                onChange={onSetBefore}
                required={requiredBefore}
                invalid={invalidBefore}
                errorId={errorId}
              />
            )}
            <span aria-hidden className="text-center text-content-subtle">→</span>
            <NumberField
              value={after}
              ariaLabel={`${name} — après réglage`}
              onChange={onSetAfter}
              required={requiredAfter}
              invalid={invalidAfter}
              errorId={errorId}
            />
            <div className="text-right">
              <MeasureDelta before={before} after={after} unit={unit} />
            </div>
          </div>
        ) : (
          <div className="w-24">
            <NumberField
              value={before}
              ariaLabel={`${name} — avant réglage`}
              onChange={onSetBefore}
              required={requiredBefore}
              invalid={invalidBefore}
              errorId={errorId}
            />
          </div>
        )}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Retirer ${name}`}
            title="Retirer cette mesure de l'étude"
            className="flex h-9 w-7 shrink-0 items-center justify-center rounded-md border border-border-strong text-content-subtle transition-colors hover:bg-danger-50 hover:text-danger-600"
          >
            −
          </button>
        )}
      </div>

      <FieldError
        id={errorId}
        message={invalid ? missingMessage(phase, invalidBefore, invalidAfter) : null}
        reserve={reserveBefore || reserveAfter ? missingMessage(phase, reserveBefore, reserveAfter) : undefined}
      />
    </div>
  );
}

/** Message court sous la ligne ; nomme la colonne seulement quand l'écran en montre deux. */
function missingMessage(
  phase: "before" | "after" | "both",
  invalidBefore: boolean,
  invalidAfter: boolean
): string {
  if (phase === "before") return "Valeur obligatoire";
  if (invalidBefore && invalidAfter) return "Valeurs « avant » et « après » obligatoires";
  return invalidBefore ? "Valeur « avant » obligatoire" : "Valeur « après » obligatoire";
}
