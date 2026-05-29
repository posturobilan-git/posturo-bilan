"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { StudyMeasures } from "@/types";

// ─── Validation ranges (mirror lib/validations/study.schema.ts) ────────────────

const RANGES: Partial<Record<keyof StudyMeasures, { min: number; max: number; label: string }>> = {
  saddleHeight: { min: 50, max: 120, label: "Hauteur selle" },
  saddleSetback: { min: 0, max: 200, label: "Recul selle" },
  saddleAngle: { min: -10, max: 10, label: "Angle selle" },
  cleatAngle: { min: -15, max: 15, label: "Angle cale" },
};

// ─── Field helpers ────────────────────────────────────────────────────────────

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4 rounded-lg border border-gray-200 p-5">
      <legend className="px-1 text-sm font-semibold text-gray-700">{title}</legend>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>
    </fieldset>
  );
}

interface NumberFieldProps {
  label: string;
  unit?: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  min?: number;
  max?: number;
  required?: boolean;
  error?: string;
}

function NumberField({ label, unit, value, onChange, min, max, required, error }: NumberFieldProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-600">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
        {unit && <span className="ml-1 text-gray-400">({unit})</span>}
      </span>
      <input
        type="number"
        min={min}
        max={max}
        step="0.1"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))}
        className={`rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
          error
            ? "border-red-400 focus:border-red-500 focus:ring-red-500"
            : "border-gray-300 focus:border-brand-500 focus:ring-brand-500"
        }`}
      />
      {error && <span className="text-xs text-red-600">{error}</span>}
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <input
        type="text"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | undefined;
  options: string[];
  onChange: (v: string | undefined) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  /** Source of truth (the Zustand store) */
  values: StudyMeasures;
  onChange: (measures: StudyMeasures) => void;
  onNext: () => void;
  onSaveDraft: () => void;
  saving: boolean;
}

export function MeasuresForm({ values, onChange, onNext, onSaveDraft, saving }: Props) {
  const [errors, setErrors] = useState<Partial<Record<keyof StudyMeasures, string>>>({});

  function set<K extends keyof StudyMeasures>(key: K, value: StudyMeasures[K]) {
    onChange({ ...values, [key]: value });
    // Clear the field error as soon as the user edits it
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  /** Validates required fields + ranges; returns true if OK. */
  function validate(): boolean {
    const next: Partial<Record<keyof StudyMeasures, string>> = {};

    if (values.saddleHeight == null) next.saddleHeight = "Requis";
    if (values.saddleSetback == null) next.saddleSetback = "Requis";

    for (const [key, range] of Object.entries(RANGES) as [keyof StudyMeasures, typeof RANGES[keyof StudyMeasures]][]) {
      const v = values[key] as number | undefined;
      if (v != null && range && (v < range.min || v > range.max)) {
        next[key] = `Entre ${range.min} et ${range.max}`;
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleNext() {
    if (validate()) onNext();
  }

  function handleSaveDraft() {
    // Drafts allow partial data, but still block out-of-range values.
    const rangeErrors: Partial<Record<keyof StudyMeasures, string>> = {};
    for (const [key, range] of Object.entries(RANGES) as [keyof StudyMeasures, typeof RANGES[keyof StudyMeasures]][]) {
      const v = values[key] as number | undefined;
      if (v != null && range && (v < range.min || v > range.max)) {
        rangeErrors[key] = `Entre ${range.min} et ${range.max}`;
      }
    }
    setErrors(rangeErrors);
    if (Object.keys(rangeErrors).length === 0) onSaveDraft();
  }

  return (
    <div className="space-y-5">
      <FieldGroup title="Selle">
        <NumberField label="Hauteur selle" unit="cm" required min={50} max={120}
          value={values.saddleHeight} error={errors.saddleHeight} onChange={(val) => set("saddleHeight", val)} />
        <NumberField label="Recul selle" unit="mm" required min={0} max={200}
          value={values.saddleSetback} error={errors.saddleSetback} onChange={(val) => set("saddleSetback", val)} />
        <NumberField label="Angle selle" unit="°" min={-10} max={10}
          value={values.saddleAngle} error={errors.saddleAngle} onChange={(val) => set("saddleAngle", val)} />
        <TextField label="Modèle de selle"
          value={values.saddleModel} onChange={(val) => set("saddleModel", val)} />
      </FieldGroup>

      <FieldGroup title="Cintre / Potence">
        <NumberField label="Hauteur cintre" unit="cm"
          value={values.handlebarHeight} onChange={(val) => set("handlebarHeight", val)} />
        <NumberField label="Longueur potence" unit="mm"
          value={values.stemLength} onChange={(val) => set("stemLength", val)} />
        <NumberField label="Angle potence" unit="°"
          value={values.stemAngle} onChange={(val) => set("stemAngle", val)} />
        <NumberField label="Largeur cintre" unit="mm"
          value={values.handlebarWidth} onChange={(val) => set("handlebarWidth", val)} />
      </FieldGroup>

      <FieldGroup title="Position du corps">
        <NumberField label="Reach effectif" unit="mm"
          value={values.effectiveReach} onChange={(val) => set("effectiveReach", val)} />
        <NumberField label="Angle tronc" unit="°"
          value={values.trunkAngle} onChange={(val) => set("trunkAngle", val)} />
        <NumberField label="Angle genou (PDC)" unit="°"
          value={values.kneeAngle} onChange={(val) => set("kneeAngle", val)} />
      </FieldGroup>

      <FieldGroup title="Cale-pieds">
        <NumberField label="Angle cale" unit="°" min={-15} max={15}
          value={values.cleatAngle} error={errors.cleatAngle} onChange={(val) => set("cleatAngle", val)} />
        <SelectField label="Position cale"
          value={values.cleatPosition}
          options={["neutre", "avant", "arrière"]}
          onChange={(val) => set("cleatPosition", val)} />
      </FieldGroup>

      <FieldGroup title="Manivelles">
        <NumberField label="Longueur manivelles" unit="mm"
          value={values.crankLength} onChange={(val) => set("crankLength", val)} />
      </FieldGroup>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-gray-600">Observations libres</span>
        <textarea
          rows={4}
          maxLength={3000}
          value={values.observations ?? ""}
          onChange={(e) => set("observations", e.target.value || undefined)}
          placeholder="Remarques posturales, asymétries observées…"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </label>

      {Object.keys(errors).length > 0 && (
        <div className="rounded-md bg-red-50 p-3">
          <p className="text-sm text-red-700">Veuillez corriger les champs en rouge avant de continuer.</p>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="secondary" onClick={handleSaveDraft} loading={saving}>
          Sauvegarder brouillon
        </Button>
        <Button onClick={handleNext} loading={saving}>
          Étape suivante →
        </Button>
      </div>
    </div>
  );
}
