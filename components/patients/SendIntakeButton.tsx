"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/stores/toastStore";
import { sendIntakeEmail } from "@/actions/intake.actions";

/**
 * BO action to email the patient their "formulaire d'accueil" link. Shown only
 * while the accueil is still pending (no intake yet). Confirms before sending.
 */
export function SendIntakeButton({
  patientId,
  patientEmail,
}: {
  patientId: string;
  patientEmail: string;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSend() {
    setError(null);
    startTransition(async () => {
      const result = await sendIntakeEmail(patientId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Formulaire d'accueil envoyé au patient.");
      setConfirmOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        variant="primary"
        size="sm"
        onClick={() => { setError(null); setConfirmOpen(true); }}
      >
        Envoyer le formulaire d&apos;accueil
      </Button>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmOpen(false); }}
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-surface shadow-2xl sm:rounded-xl">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold text-content">Envoyer le formulaire d&apos;accueil ?</h2>
            </div>
            <div className="space-y-3 px-6 py-5 text-sm text-content-muted">
              <p>
                Un email contenant un lien personnel sera envoyé à{" "}
                <strong className="text-content">{patientEmail}</strong>. Le lien
                expire dès que le patient soumet le formulaire ou après 30 jours.
              </p>
              {error && (
                <p className="rounded-md bg-danger-50 px-3 py-2 text-danger-700">{error}</p>
              )}
            </div>
            <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
              <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={pending}>
                Annuler
              </Button>
              <Button loading={pending} onClick={handleSend}>
                Envoyer
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
