"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { submitFollowupForm } from "@/actions/followup.actions";

interface FormState {
  painLevel: number | undefined;
  comfortScore: number | undefined;
  satisfactionScore: number | undefined;
  ridingFrequency: string | undefined;
  generalFeedback: string | undefined;
}

const EMPTY: FormState = {
  painLevel: undefined,
  comfortScore: undefined,
  satisfactionScore: undefined,
  ridingFrequency: undefined,
  generalFeedback: undefined,
};

function ScoreField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-content">{label}</span>
        <span className="text-sm font-semibold text-brand-600">
          {value ?? "—"}<span className="text-xs text-content-subtle">/10</span>
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={10}
        step={1}
        value={value ?? 0}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="w-full accent-brand-600"
      />
      <p className="text-xs text-content-subtle">{hint}</p>
    </div>
  );
}

export function SuiviForm({
  token,
  firstName,
  cabinetName,
}: {
  token: string;
  firstName: string;
  cabinetName: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await submitFollowupForm(token, form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.replace("/suivi/merci");
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-center text-sm text-content-muted">Bonjour {firstName},</p>
      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-xl border border-border bg-surface p-6 shadow-sm sm:p-8"
      >
        <div>
          <p className="text-sm font-semibold text-brand-600">{cabinetName}</p>
          <h1 className="mt-1 text-xl font-semibold text-content">Suivi à 30 jours</h1>
          <p className="mt-1 text-sm text-content-muted">
            Un mois après votre étude posturale, dites-nous comment vous vous
            sentez sur le vélo. Tout est facultatif.
          </p>
        </div>

        <fieldset className="space-y-5 rounded-lg border border-border p-5">
          <legend className="px-1 text-sm font-semibold text-content">Vos ressentis</legend>
          <ScoreField
            label="Niveau de douleur"
            hint="0 = aucune douleur, 10 = douleur maximale"
            value={form.painLevel}
            onChange={(v) => set("painLevel", v)}
          />
          <ScoreField
            label="Confort sur le vélo"
            hint="0 = très inconfortable, 10 = parfaitement confortable"
            value={form.comfortScore}
            onChange={(v) => set("comfortScore", v)}
          />
          <ScoreField
            label="Satisfaction globale"
            hint="0 = pas du tout satisfait, 10 = pleinement satisfait"
            value={form.satisfactionScore}
            onChange={(v) => set("satisfactionScore", v)}
          />
        </fieldset>

        <fieldset className="space-y-4 rounded-lg border border-border p-5">
          <legend className="px-1 text-sm font-semibold text-content">Pratique &amp; commentaires</legend>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-content-muted">Fréquence de pratique actuelle</span>
            <input
              type="text"
              maxLength={200}
              value={form.ridingFrequency ?? ""}
              onChange={(e) => set("ridingFrequency", e.target.value || undefined)}
              placeholder="Ex : 3 sorties par semaine"
              className="rounded-md border border-border-strong px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-content-muted">Commentaire libre</span>
            <textarea
              rows={4}
              maxLength={2000}
              value={form.generalFeedback ?? ""}
              onChange={(e) => set("generalFeedback", e.target.value || undefined)}
              placeholder="Évolution des douleurs, ressenti général, questions…"
              className="rounded-md border border-border-strong px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </label>
        </fieldset>

        {error && (
          <p className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>
        )}

        <div className="flex justify-end">
          <Button type="submit" loading={pending}>
            Envoyer mon suivi
          </Button>
        </div>
      </form>
    </div>
  );
}
