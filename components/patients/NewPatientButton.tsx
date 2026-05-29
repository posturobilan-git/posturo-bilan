"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { createPatient } from "@/actions/patient.actions";
import { toast } from "@/lib/stores/toastStore";

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: string;
  required?: boolean;
}

function Field({ label, name, required, ...props }: FieldProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-content">
        {label}
        {required && <span className="ml-0.5 text-danger-600">*</span>}
      </span>
      <input
        name={name}
        required={required}
        className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-content focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        {...props}
      />
    </label>
  );
}

interface KineOption {
  id: string;
  name: string;
}

export function NewPatientButton({
  currentUserRole,
  currentUserId,
  kines = [],
}: {
  currentUserRole: Role;
  currentUserId: string;
  kines?: KineOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const isAdmin = currentUserRole === "ADMIN";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const phone = fd.get("phone") as string;
    const kineId = fd.get("kineId") as string | null;

    setError(null);
    startTransition(async () => {
      const result = await createPatient({
        firstName: fd.get("firstName") as string,
        lastName: fd.get("lastName") as string,
        email: fd.get("email") as string,
        phone: phone || undefined,
        kineId: isAdmin && kineId ? kineId : undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Patient créé avec succès.");
      setOpen(false);
      formRef.current?.reset();
      router.refresh();
    });
  }

  return (
    <>
      <Button className="w-full sm:w-auto" onClick={() => { setError(null); setOpen(true); }}>
        + Nouveau patient
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-surface shadow-2xl sm:rounded-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold text-content">Nouveau patient</h2>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-content-subtle hover:bg-surface-muted hover:text-content"
                aria-label="Fermer"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Form */}
            <form ref={formRef} onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Prénom" name="firstName" required autoComplete="given-name" />
                <Field label="Nom" name="lastName" required autoComplete="family-name" />
              </div>
              <Field label="Email" name="email" type="email" required autoComplete="email" />
              <Field label="Téléphone" name="phone" type="tel" placeholder="Optionnel" autoComplete="tel" />

              {/* Sélecteur de kiné — ADMIN uniquement */}
              {isAdmin && kines.length > 0 && (
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-content">Assigner à</span>
                  <select
                    name="kineId"
                    defaultValue={currentUserId}
                    className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-content focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    {kines.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.name}
                        {k.id === currentUserId ? " (moi)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {error && (
                <p className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" loading={pending}>
                  Créer le patient
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
