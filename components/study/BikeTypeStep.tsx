"use client";

import { Button } from "@/components/ui/Button";
import type { BikeType } from "@prisma/client";

interface Props {
  bikeTypes: BikeType[];
  selected: string | null;
  onSelect: (id: string) => void;
  onNext: () => void;
  saving: boolean;
}

export function BikeTypeStep({ bikeTypes, selected, onSelect, onNext, saving }: Props) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-content-muted">
        Sélectionnez le type de vélo concerné par cette étude.
      </p>

      {bikeTypes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-strong py-8 text-center">
          <p className="text-sm text-content-subtle">Aucun type de vélo actif.</p>
          <p className="mt-1 text-xs text-content-subtle">
            Un administrateur peut en ajouter depuis la Bibliothèque.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {bikeTypes.map((bt) => {
            const active = selected === bt.id;
            return (
              <button
                key={bt.id}
                type="button"
                onClick={() => onSelect(bt.id)}
                aria-pressed={active}
                className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-all ${
                  active
                    ? "border-brand-500 bg-brand-50 ring-2 ring-brand-100"
                    : "border-border bg-surface hover:border-brand-300 hover:bg-surface-muted"
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    active ? "bg-brand-600 text-white" : "bg-surface-muted text-content-muted"
                  }`}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <circle cx="6" cy="17" r="3.5" strokeWidth={1.8} />
                    <circle cx="18" cy="17" r="3.5" strokeWidth={1.8} />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 17l4-7h5l3 7M10 10l-1.5-3H6.5M13 7h3.5" />
                  </svg>
                </span>
                <span className={`text-sm font-medium ${active ? "text-brand-900" : "text-content"}`}>
                  {bt.name}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button onClick={onNext} disabled={!selected} loading={saving}>
          Étape suivante →
        </Button>
      </div>
    </div>
  );
}
