"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { saveIntake } from "@/actions/intake.actions";
import { toast } from "@/lib/stores/toastStore";
import type { PatientIntake } from "@prisma/client";

const BIKE_TYPES = ["Route", "VTT", "Gravel", "Triathlon", "Piste", "Autre"];
const RIDING_LEVELS = ["Loisir", "Sportif", "Compétiteur"];

interface FormState {
  heightCm: number | undefined;
  weightKg: number | undefined;
  bikeType: string | undefined;
  ridingLevel: string | undefined;
  weeklyHours: number | undefined;
  yearsRiding: number | undefined;
  injuries: string[];
  goals: string | undefined;
  medicalNotes: string | undefined;
}

function initialState(intake: PatientIntake | null): FormState {
  return {
    heightCm: intake?.heightCm ?? undefined,
    weightKg: intake?.weightKg ?? undefined,
    bikeType: intake?.bikeType ?? undefined,
    ridingLevel: intake?.ridingLevel ?? undefined,
    weeklyHours: intake?.weeklyHours ?? undefined,
    yearsRiding: intake?.yearsRiding ?? undefined,
    injuries: intake?.injuries ?? [],
    goals: intake?.goals ?? undefined,
    medicalNotes: intake?.medicalNotes ?? undefined,
  };
}

// ─── Small field helpers ────────────────────────────────────────────────────

function NumberField({
  label, unit, value, onChange, min, max,
}: {
  label: string; unit?: string; value: number | undefined;
  onChange: (v: number | undefined) => void; min?: number; max?: number;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-600">
        {label}{unit && <span className="ml-1 text-gray-400">({unit})</span>}
      </span>
      <input
        type="number" min={min} max={max} step="0.1"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
    </label>
  );
}

function SelectField({
  label, value, options, onChange,
}: {
  label: string; value: string | undefined; options: string[];
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
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function InjuriesInput({
  injuries, onChange,
}: {
  injuries: string[]; onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const v = draft.trim();
    if (v && !injuries.includes(v)) onChange([...injuries, v]);
    setDraft("");
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-600">Douleurs déclarées</span>
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); add(); }
          }}
          placeholder="Ex: douleur genou gauche — Entrée pour ajouter"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <Button type="button" variant="secondary" size="sm" onClick={add}>Ajouter</Button>
      </div>
      {injuries.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {injuries.map((injury) => (
            <span key={injury} className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs text-red-700">
              {injury}
              <button
                type="button"
                onClick={() => onChange(injuries.filter((i) => i !== injury))}
                className="text-red-400 hover:text-red-600"
                aria-label={`Retirer ${injury}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main form ──────────────────────────────────────────────────────────────

interface Props {
  patientId: string;
  intake: PatientIntake | null;
}

export function IntakeForm({ patientId, intake }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => initialState(intake));
  const [pending, startTransition] = useTransition();

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await saveIntake(patientId, form);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Intake enregistré.");
      router.push(`/patients/${patientId}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <fieldset className="space-y-4 rounded-lg border border-gray-200 p-5">
        <legend className="px-1 text-sm font-semibold text-gray-700">Morphologie</legend>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <NumberField label="Taille" unit="cm" min={50} max={250}
            value={form.heightCm} onChange={(v) => set("heightCm", v)} />
          <NumberField label="Poids" unit="kg" min={20} max={300}
            value={form.weightKg} onChange={(v) => set("weightKg", v)} />
        </div>
      </fieldset>

      <fieldset className="space-y-4 rounded-lg border border-gray-200 p-5">
        <legend className="px-1 text-sm font-semibold text-gray-700">Pratique vélo</legend>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SelectField label="Type de vélo" value={form.bikeType}
            options={BIKE_TYPES} onChange={(v) => set("bikeType", v)} />
          <SelectField label="Niveau de pratique" value={form.ridingLevel}
            options={RIDING_LEVELS} onChange={(v) => set("ridingLevel", v)} />
          <NumberField label="Heures / semaine" min={0} max={60}
            value={form.weeklyHours} onChange={(v) => set("weeklyHours", v)} />
          <NumberField label="Années de pratique" min={0} max={100}
            value={form.yearsRiding} onChange={(v) => set("yearsRiding", v)} />
        </div>
      </fieldset>

      <fieldset className="space-y-4 rounded-lg border border-gray-200 p-5">
        <legend className="px-1 text-sm font-semibold text-gray-700">Douleurs & objectifs</legend>
        <InjuriesInput injuries={form.injuries} onChange={(next) => set("injuries", next)} />
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-600">Objectifs de l'étude</span>
          <textarea
            rows={3} maxLength={2000}
            value={form.goals ?? ""}
            onChange={(e) => set("goals", e.target.value || undefined)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-600">Notes médicales</span>
          <textarea
            rows={3} maxLength={2000}
            value={form.medicalNotes ?? ""}
            onChange={(e) => set("medicalNotes", e.target.value || undefined)}
            placeholder="Antécédents, opérations, contre-indications…"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </label>
      </fieldset>

      <div className="flex justify-between pt-2">
        <Button type="button" variant="secondary" onClick={() => router.push(`/patients/${patientId}`)}>
          Annuler
        </Button>
        <Button type="submit" loading={pending}>
          Enregistrer l'intake
        </Button>
      </div>
    </form>
  );
}
