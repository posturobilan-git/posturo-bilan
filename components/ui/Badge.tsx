import type { PatientStatus } from "@/types";

const statusLabels: Record<PatientStatus, string> = {
  intake_pending: "En attente",
  intake_completed: "Intake complété",
  study_pending: "Étude à faire",
  study_completed: "Étude terminée",
  report_sent: "Rapport envoyé",
  followup_pending: "Suivi en attente",
  followup_completed: "Suivi complété",
};

// Each status maps to a token-driven {background, text, dot} triplet.
const statusStyles: Record<PatientStatus, { chip: string; dot: string }> = {
  intake_pending: { chip: "bg-warning-50 text-warning-700", dot: "bg-warning-600" },
  intake_completed: { chip: "bg-brand-50 text-brand-700", dot: "bg-brand-500" },
  study_pending: { chip: "bg-warning-50 text-warning-700", dot: "bg-warning-600" },
  study_completed: { chip: "bg-accent-50 text-accent-700", dot: "bg-accent-600" },
  report_sent: { chip: "bg-success-50 text-success-700", dot: "bg-success-600" },
  followup_pending: { chip: "bg-accent-50 text-accent-700", dot: "bg-accent-500" },
  followup_completed: { chip: "bg-surface-muted text-content-muted", dot: "bg-content-subtle" },
};

interface BadgeProps {
  status: PatientStatus;
  className?: string;
}

export function Badge({ status, className = "" }: BadgeProps) {
  const style = statusStyles[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${style.chip} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {statusLabels[status]}
    </span>
  );
}
