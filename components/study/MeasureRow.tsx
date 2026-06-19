"use client";

import { MeasureDelta } from "./MeasureDelta";

// Shared fixed-column grid so the per-row inputs line up exactly with the column
// header rendered once above them (avant · arrow · après · delta). All columns
// are fixed width so a filled cell and an empty cell occupy the same space.
const INPUT_GRID = "grid grid-cols-[6rem_0.875rem_6rem_4rem] items-center gap-x-2";

// Identical box metrics for the editable input and the read-only reference cell,
// so the "avant" and "après" columns align whether a value is present or not.
const FIELD_BASE = "h-9 w-full rounded-md border px-3 text-sm tabular-nums";
const LABEL = "text-[11px] font-medium uppercase tracking-wide text-content-subtle";

function NumberField({
  value,
  ariaLabel,
  onChange,
}: {
  value: number | null;
  ariaLabel: string;
  onChange?: (v: number | null) => void;
}) {
  return (
    <input
      type="number"
      step="0.1"
      inputMode="decimal"
      placeholder="—"
      aria-label={ariaLabel}
      value={value ?? ""}
      onChange={(e) => onChange?.(e.target.value === "" ? null : parseFloat(e.target.value))}
      className={`${FIELD_BASE} border-border-strong bg-surface text-content focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500`}
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
 */
export function MeasureRow({
  name,
  unit,
  required = false,
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
  required?: boolean;
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

  return (
    <div className="py-3">
      <p className="text-sm font-medium text-content">
        {name}
        <span className="ml-1 font-normal text-content-subtle">({unit})</span>
        {required && <span className="ml-0.5 text-danger-500">*</span>}
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
              <NumberField value={before} ariaLabel={`${name} — avant réglage`} onChange={onSetBefore} />
            )}
            <span aria-hidden className="text-center text-content-subtle">→</span>
            <NumberField value={after} ariaLabel={`${name} — après réglage`} onChange={onSetAfter} />
            <div className="text-right">
              <MeasureDelta before={before} after={after} unit={unit} />
            </div>
          </div>
        ) : (
          <div className="w-24">
            <NumberField value={before} ariaLabel={`${name} — avant réglage`} onChange={onSetBefore} />
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
    </div>
  );
}
