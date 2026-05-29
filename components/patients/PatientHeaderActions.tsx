"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/stores/toastStore";
import { updatePatient, deletePatient } from "@/actions/patient.actions";

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

export function PatientHeaderActions({ patient }: { patient: PatientFields }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deletePatient(patient.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Patient supprimé.");
      router.push("/patients");
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => { setError(null); setEditOpen(true); }}>
        Modifier
      </Button>
      <Button variant="danger" size="sm" onClick={() => { setError(null); setConfirmDelete(true); }}>
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

      {/* Delete confirmation */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmDelete(false); }}
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-surface shadow-2xl sm:rounded-xl">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold text-content">Supprimer ce patient ?</h2>
            </div>
            <div className="space-y-3 px-6 py-5 text-sm text-content-muted">
              <p>
                Le dossier de <strong className="text-content">{patient.firstName} {patient.lastName}</strong> sera
                <strong className="text-danger-600"> supprimé définitivement</strong>. Cette action est
                irréversible.
              </p>
              <p className="text-content-subtle">
                Si une étude posturale existe, la suppression sera bloquée — utilisez plutôt
                l&apos;anonymisation RGPD.
              </p>
              {error && (
                <p className="rounded-md bg-danger-50 px-3 py-2 text-danger-700">{error}</p>
              )}
            </div>
            <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
              <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
                Annuler
              </Button>
              <Button variant="danger" loading={pending} onClick={handleDelete}>
                Supprimer définitivement
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
