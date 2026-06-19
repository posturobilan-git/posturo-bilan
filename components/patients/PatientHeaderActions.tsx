"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/stores/toastStore";
import { updatePatient, deletePatient, hardDeletePatient } from "@/actions/patient.actions";

interface PatientFields {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
}

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: string;
}

function Field({ label, name, ...props }: FieldProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-content">{label}</span>
      <input
        name={name}
        className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-content focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        {...props}
      />
    </label>
  );
}

export function PatientHeaderActions({
  patient,
  studyCount,
  isAnonymized,
}: {
  patient: PatientFields;
  studyCount: number;
  isAnonymized: boolean;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const fullName = `${patient.firstName} ${patient.lastName}`;
  const hasStudies = studyCount > 0;
  const nameMatches = confirmation.trim() === fullName;

  function openDelete() {
    setError(null);
    setConfirmation("");
    setDeleteOpen(true);
  }

  function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const phone = fd.get("phone") as string;

    setError(null);
    startTransition(async () => {
      const result = await updatePatient(patient.id, {
        firstName: fd.get("firstName") as string,
        lastName: fd.get("lastName") as string,
        email: fd.get("email") as string,
        phone: phone || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Patient mis à jour.");
      setEditOpen(false);
      router.refresh();
    });
  }

  // No studies → straightforward permanent delete of the patient record.
  function handleSafeDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deletePatient(patient.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Patient supprimé.");
      router.push("/dashboard/patients");
      router.refresh();
    });
  }

  // Studies exist, RGPD route → wipe PII, keep the (anonymous) clinical studies.
  function handleAnonymize() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/gdpr/anonymize/${patient.id}`, { method: "DELETE" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? "Échec de l'anonymisation.");
          return;
        }
        toast.success("Patient anonymisé.");
        setDeleteOpen(false);
        router.refresh();
      } catch {
        setError("Échec de l'anonymisation.");
      }
    });
  }

  // Studies exist, hard-delete route → remove the patient AND every study/report.
  function handleHardDelete() {
    if (!nameMatches) return;
    setError(null);
    startTransition(async () => {
      const result = await hardDeletePatient(patient.id, confirmation);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Patient et données associées supprimés définitivement.");
      router.push("/dashboard/patients");
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => { setError(null); setEditOpen(true); }}>
        Modifier
      </Button>
      <Button variant="danger" size="sm" onClick={openDelete}>
        Supprimer
      </Button>

      {/* Edit modal */}
      {editOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setEditOpen(false); }}
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-surface shadow-2xl sm:rounded-xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold text-content">Modifier le patient</h2>
              <button
                onClick={() => setEditOpen(false)}
                className="rounded-md p-1 text-content-subtle hover:bg-surface-muted hover:text-content"
                aria-label="Fermer"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleEdit} className="space-y-4 px-6 py-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Prénom" name="firstName" defaultValue={patient.firstName} required autoComplete="given-name" />
                <Field label="Nom" name="lastName" defaultValue={patient.lastName} required autoComplete="family-name" />
              </div>
              <Field label="Email" name="email" type="email" defaultValue={patient.email} required autoComplete="email" />
              <Field label="Téléphone" name="phone" type="tel" defaultValue={patient.phone ?? ""} placeholder="Optionnel" autoComplete="tel" />

              {error && (
                <p className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setEditOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" loading={pending}>
                  Enregistrer
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete modal — branches on whether the patient has studies */}
      {deleteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setDeleteOpen(false); }}
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-surface shadow-2xl sm:rounded-xl">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold text-content">Supprimer ce patient ?</h2>
            </div>

            {!hasStudies ? (
              /* ── No studies: simple permanent delete ── */
              <>
                <div className="space-y-3 px-6 py-5 text-sm text-content-muted">
                  <p>
                    Le dossier de <strong className="text-content">{fullName}</strong> sera
                    <strong className="text-danger-600"> supprimé définitivement</strong>. Ce patient
                    n&apos;a aucune étude. Cette action est irréversible.
                  </p>
                  {error && (
                    <p className="rounded-md bg-danger-50 px-3 py-2 text-danger-700">{error}</p>
                  )}
                </div>
                <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
                  <Button variant="secondary" onClick={() => setDeleteOpen(false)}>Annuler</Button>
                  <Button variant="danger" loading={pending} onClick={handleSafeDelete}>
                    Supprimer définitivement
                  </Button>
                </div>
              </>
            ) : (
              /* ── Studies exist: choose anonymisation (RGPD) or hard delete ── */
              <div className="space-y-4 px-6 py-5">
                <p className="text-sm text-content-muted">
                  Ce patient a <strong className="text-content">{studyCount} étude{studyCount > 1 ? "s" : ""}</strong>.
                  Choisissez comment procéder.
                </p>

                {!isAnonymized && (
                  <div className="rounded-lg border border-border bg-surface-muted/40 p-4">
                    <h3 className="text-sm font-semibold text-content">Anonymisation RGPD <span className="font-normal text-content-subtle">— recommandé</span></h3>
                    <p className="mt-1 text-sm text-content-muted">
                      Efface les données personnelles (nom, email, téléphone, accueil) mais
                      <strong> conserve les études</strong> de façon anonyme.
                    </p>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="mt-3"
                      loading={pending}
                      onClick={handleAnonymize}
                    >
                      Anonymiser
                    </Button>
                  </div>
                )}

                <div className="rounded-lg border border-danger-500/40 bg-danger-50/40 p-4">
                  <h3 className="text-sm font-semibold text-danger-700">Suppression définitive</h3>
                  <p className="mt-1 text-sm text-content-muted">
                    Supprime le patient <strong>et ses {studyCount} étude{studyCount > 1 ? "s" : ""}</strong>{" "}
                    (rapports inclus). <strong className="text-danger-600">Irréversible.</strong>
                  </p>
                  <label className="mt-3 flex flex-col gap-1.5">
                    <span className="text-sm text-content-muted">
                      Pour confirmer, tapez <strong className="select-all text-content">{fullName}</strong> :
                    </span>
                    <input
                      value={confirmation}
                      onChange={(e) => setConfirmation(e.target.value)}
                      autoComplete="off"
                      placeholder={fullName}
                      className="rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-content focus:border-danger-500 focus:outline-none focus:ring-1 focus:ring-danger-500"
                    />
                  </label>
                  <Button
                    variant="danger"
                    size="sm"
                    className="mt-3"
                    disabled={!nameMatches}
                    loading={pending}
                    onClick={handleHardDelete}
                  >
                    Supprimer définitivement
                  </Button>
                </div>

                {error && (
                  <p className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>
                )}

                <div className="flex justify-end border-t border-border pt-4">
                  <Button variant="secondary" onClick={() => setDeleteOpen(false)}>Annuler</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
