"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/stores/toastStore";

interface Props {
  patientId: string;
  patientName: string;
  isAnonymized: boolean;
}

export function RgpdActions({ patientId, patientName, isAnonymized }: Props) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleAnonymize() {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/gdpr/anonymize/${patientId}`, { method: "DELETE" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          toast.error(body.error ?? "Échec de l'anonymisation.");
          return;
        }
        toast.success("Patient anonymisé.");
        setConfirmOpen(false);
        router.refresh();
      } catch {
        toast.error("Échec de l'anonymisation.");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      {/* Export is a GET with Content-Disposition → anchor triggers download */}
      <a
        href={`/api/gdpr/export/${patientId}`}
        className="rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm font-medium text-content hover:bg-surface-muted"
      >
        Exporter
      </a>

      {isAnonymized ? (
        <span className="rounded-md bg-surface-muted px-3 py-1.5 text-sm text-content-subtle">Anonymisé</span>
      ) : (
        <button
          onClick={() => setConfirmOpen(true)}
          className="rounded-md border border-danger-500 bg-surface px-3 py-1.5 text-sm font-medium text-danger-700 hover:bg-danger-50"
        >
          Anonymiser
        </button>
      )}

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmOpen(false); }}
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-surface shadow-2xl sm:rounded-xl">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold text-content">Anonymiser ce patient ?</h2>
            </div>
            <div className="space-y-3 px-6 py-5 text-sm text-content-muted">
              <p>
                Vous êtes sur le point d&apos;anonymiser <strong>{patientName}</strong>. Cette
                action est <strong className="text-danger-600">irréversible</strong>.
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Nom, email et téléphone seront effacés</li>
                <li>Les données d&apos;intake (morphologie, douleurs, notes médicales) seront supprimées</li>
                <li>Les études et suivis (données métier anonymes) seront conservés</li>
              </ul>
            </div>
            <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
              <Button variant="secondary" onClick={() => setConfirmOpen(false)}>Annuler</Button>
              <Button variant="danger" onClick={handleAnonymize} loading={pending}>
                Anonymiser définitivement
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
