"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { PatientStatus } from "@prisma/client";

const STATUS_LABELS: Record<PatientStatus, string> = {
  intake_pending: "En attente",
  intake_completed: "Intake complété",
  study_pending: "Étude à faire",
  study_completed: "Étude terminée",
  report_sent: "Rapport envoyé",
  followup_pending: "Suivi en attente",
  followup_completed: "Suivi complété",
};

export function StatusFilter({ defaultValue = "" }: { defaultValue?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    if (e.target.value) {
      params.set("status", e.target.value);
    } else {
      params.delete("status");
    }
    startTransition(() => router.replace(`${pathname}?${params.toString()}`));
  }

  return (
    <select
      defaultValue={defaultValue}
      onChange={handleChange}
      className="h-10 rounded-lg border border-border-strong bg-surface pl-3 pr-8 text-sm text-content shadow-xs focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
    >
      <option value="">Tous les statuts</option>
      {Object.entries(STATUS_LABELS).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}
