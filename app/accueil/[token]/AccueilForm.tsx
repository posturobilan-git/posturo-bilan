"use client";

import { useRef, useState, useTransition, type Ref } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { submitAccueilForm } from "@/actions/accueil.actions";
import { INTAKE_CGU, intakeCguIntro } from "@/lib/legal";
import { normalizePhone } from "@/lib/phone";

const BIKE_TYPES = ["Route", "VTT", "Gravel", "Triathlon", "Piste", "Autre"];
const RIDING_LEVELS = ["Loisir", "Sportif", "Compétiteur"];

interface FormState {
  phone: string;
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

const EMPTY: FormState = {
  phone: "",
  heightCm: undefined,
  weightKg: undefined,
  bikeType: undefined,
  ridingLevel: undefined,
  weeklyHours: undefined,
  yearsRiding: undefined,
  injuries: [],
  goals: undefined,
  medicalNotes: undefined,
};

// ─── Field helpers ───────────────────────────────────────────────────────────

function NumberField({
  label, unit, value, onChange, min, max,
}: {
  label: string; unit?: string; value: number | undefined;
  onChange: (v: number | undefined) => void; min?: number; max?: number;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-content-muted">
        {label}{unit && <span className="ml-1 text-content-subtle">({unit})</span>}
      </span>
      <input
        type="number" min={min} max={max} step="0.1"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))}
        className="rounded-md border border-border-strong px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
    </label>
  );
}

/** Message d'erreur du téléphone (obligatoire), ou null s'il est valide. */
function phoneProblem(value: string): string | null {
  if (normalizePhone(value)) return null;
  return value.trim()
    ? "Ce numéro ne semble pas valide (ex. 06 12 34 56 78, ou +41 79 123 45 67 pour un numéro étranger)."
    : "Le numéro de téléphone est obligatoire.";
}

function PhoneField({
  value,
  error,
  inputRef,
  onChange,
  onBlur,
}: {
  value: string;
  error: string | null;
  inputRef: Ref<HTMLInputElement>;
  onChange: (v: string) => void;
  onBlur: () => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-content-muted">
        Téléphone <span className="text-danger-600">*</span>
      </span>
      <input
        ref={inputRef}
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder="06 12 34 56 78"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "accueil-phone-error" : "accueil-phone-hint"}
        className={`rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
          error
            ? "border-danger-500 focus:border-danger-500 focus:ring-danger-500"
            : "border-border-strong focus:border-brand-500 focus:ring-brand-500"
        }`}
      />
      {error ? (
        <span id="accueil-phone-error" role="alert" className="text-xs text-danger-600">
          {error}
        </span>
      ) : (
        <span id="accueil-phone-hint" className="text-xs text-content-subtle">
          Pour que votre kinésithérapeute puisse vous joindre. Numéro français, ou avec son
          indicatif (+41…) pour un numéro étranger.
        </span>
      )}
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
      <span className="text-xs font-medium text-content-muted">{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="rounded-md border border-border-strong px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
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
      <span className="text-xs font-medium text-content-muted">Douleurs déclarées</span>
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); add(); }
          }}
          placeholder="Ex : douleur genou gauche — Entrée pour ajouter"
          className="flex-1 rounded-md border border-border-strong px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <Button type="button" variant="secondary" size="sm" onClick={add}>Ajouter</Button>
      </div>
      {injuries.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {injuries.map((injury) => (
            <span key={injury} className="inline-flex items-center gap-1 rounded-full bg-danger-50 px-2.5 py-0.5 text-xs text-danger-700">
              {injury}
              <button
                type="button"
                onClick={() => onChange(injuries.filter((i) => i !== injury))}
                className="text-danger-500 hover:text-danger-600"
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

// ─── Step 1 — CGU ─────────────────────────────────────────────────────────────

function CguStep({
  cabinetName,
  accepted,
  onAcceptedChange,
  onContinue,
}: {
  cabinetName: string;
  accepted: boolean;
  onAcceptedChange: (v: boolean) => void;
  onContinue: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-sm sm:p-8">
      <p className="text-sm font-semibold text-brand-600">{cabinetName}</p>
      <h1 className="mt-2 text-xl font-semibold text-content">Formulaire d&apos;accueil</h1>
      <p className="mt-3 text-sm text-content-muted">{intakeCguIntro(cabinetName)}</p>

      <div className="mt-6 space-y-4">
        {INTAKE_CGU.sections.map((s) => (
          <div key={s.title}>
            <h2 className="text-sm font-semibold text-content">{s.title}</h2>
            <p className="mt-1 text-sm text-content-muted">{s.body}</p>
          </div>
        ))}
      </div>

      <label className="mt-6 flex items-start gap-3 rounded-lg border border-border bg-surface-muted p-4">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => onAcceptedChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-border-strong text-brand-600 focus:ring-brand-500"
        />
        <span className="text-sm text-content">{INTAKE_CGU.consentLabel}</span>
      </label>

      <div className="mt-6 flex justify-end">
        <Button type="button" disabled={!accepted} onClick={onContinue}>
          Continuer
        </Button>
      </div>
    </div>
  );
}

// ─── Step 2 — Formulaire ──────────────────────────────────────────────────────

function FormStep({
  form,
  set,
  phoneError,
  phoneRef,
  onPhoneBlur,
  onBack,
  onSubmit,
  pending,
  error,
}: {
  form: FormState;
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  phoneError: string | null;
  phoneRef: Ref<HTMLInputElement>;
  onPhoneBlur: () => void;
  onBack: () => void;
  onSubmit: () => void;
  pending: boolean;
  error: string | null;
}) {
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
      className="space-y-5 rounded-xl border border-border bg-surface p-6 shadow-sm sm:p-8"
    >
      <div>
        <h1 className="text-xl font-semibold text-content">Vos informations</h1>
        <p className="mt-1 text-sm text-content-muted">
          Votre numéro de téléphone est obligatoire ; le reste est facultatif — mais
          plus vous en indiquez, mieux nous préparons votre étude.
        </p>
      </div>

      <fieldset className="space-y-4 rounded-lg border border-border p-5">
        <legend className="px-1 text-sm font-semibold text-content">Vos coordonnées</legend>
        <PhoneField
          value={form.phone}
          error={phoneError}
          inputRef={phoneRef}
          onChange={(v) => set("phone", v)}
          onBlur={onPhoneBlur}
        />
      </fieldset>

      <fieldset className="space-y-4 rounded-lg border border-border p-5">
        <legend className="px-1 text-sm font-semibold text-content">Morphologie</legend>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <NumberField label="Taille" unit="cm" min={50} max={250}
            value={form.heightCm} onChange={(v) => set("heightCm", v)} />
          <NumberField label="Poids" unit="kg" min={20} max={300}
            value={form.weightKg} onChange={(v) => set("weightKg", v)} />
        </div>
      </fieldset>

      <fieldset className="space-y-4 rounded-lg border border-border p-5">
        <legend className="px-1 text-sm font-semibold text-content">Pratique vélo</legend>
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

      <fieldset className="space-y-4 rounded-lg border border-border p-5">
        <legend className="px-1 text-sm font-semibold text-content">Douleurs &amp; objectifs</legend>
        <InjuriesInput injuries={form.injuries} onChange={(next) => set("injuries", next)} />
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-content-muted">Objectifs de l&apos;étude</span>
          <textarea
            rows={3} maxLength={2000}
            value={form.goals ?? ""}
            onChange={(e) => set("goals", e.target.value || undefined)}
            className="rounded-md border border-border-strong px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-content-muted">Notes médicales</span>
          <textarea
            rows={3} maxLength={2000}
            value={form.medicalNotes ?? ""}
            onChange={(e) => set("medicalNotes", e.target.value || undefined)}
            placeholder="Antécédents, opérations, contre-indications…"
            className="rounded-md border border-border-strong px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </label>
      </fieldset>

      {error && (
        <p className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>
      )}

      <div className="flex justify-between pt-2">
        <Button type="button" variant="secondary" onClick={onBack} disabled={pending}>
          Retour
        </Button>
        <Button type="submit" loading={pending}>
          Envoyer
        </Button>
      </div>
    </form>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function AccueilForm({
  token,
  firstName,
  cabinetName,
  initialPhone,
}: {
  token: string;
  firstName: string;
  cabinetName: string;
  /** Numéro déjà connu du cabinet (réservation, saisie du kiné), à confirmer ou corriger. */
  initialPhone: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"cgu" | "form">("cgu");
  const [accepted, setAccepted] = useState(false);
  const [form, setForm] = useState<FormState>({ ...EMPTY, phone: initialPhone });
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const phoneRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === "phone") setPhoneError(null);
  }

  function handleSubmit() {
    setError(null);
    // Le téléphone est obligatoire : pas d'envoi tant qu'il manque ou qu'il est invalide
    // (le serveur le revérifie).
    const problem = phoneProblem(form.phone);
    if (problem) {
      setPhoneError(problem);
      phoneRef.current?.focus();
      return;
    }
    startTransition(async () => {
      const result = await submitAccueilForm(token, { ...form, cguAccepted: true });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.replace("/accueil/merci");
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-center text-sm text-content-muted">Bonjour {firstName},</p>
      {step === "cgu" ? (
        <CguStep
          cabinetName={cabinetName}
          accepted={accepted}
          onAcceptedChange={setAccepted}
          onContinue={() => setStep("form")}
        />
      ) : (
        <FormStep
          form={form}
          set={set}
          phoneError={phoneError}
          phoneRef={phoneRef}
          onPhoneBlur={() => setPhoneError(phoneProblem(form.phone))}
          onBack={() => setStep("cgu")}
          onSubmit={handleSubmit}
          pending={pending}
          error={error}
        />
      )}
    </div>
  );
}
