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
        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        Exporter
      </a>

      {isAnonymized ? (
        <span className="rounded-md bg-gray-100 px-3 py-1.5 text-sm text-gray-400">Anonymisé</span>
      ) : (
        <button
          onClick={() => setConfirmOpen(true)}
          className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
        >
          Anonymiser
        </button>
      )}

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmOpen(false); }}
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-xl">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Anonymiser ce patient ?</h2>
            </div>
            <div className="space-y-3 px-6 py-5 text-sm text-gray-600">
              <p>
                Vous êtes sur le point d&apos;anonymiser <strong>{patientName}</strong>. Cette
                action est <strong className="text-red-600">irréversible</strong>.
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Nom, email et téléphone seront effacés</li>
                <li>Les données d&apos;intake (morphologie, douleurs, notes médicales) seront supprimées</li>
                <li>Les études et suivis (données métier anonymes) seront conservés</li>
              </ul>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
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
