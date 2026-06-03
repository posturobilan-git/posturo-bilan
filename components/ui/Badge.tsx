import type { StudyStatus } from "@/types";
import { STUDY_STATUS_LABELS } from "@/lib/labels";

// Each study status maps to a token-driven {background, text, dot} triplet.
const statusStyles: Record<StudyStatus, { chip: string; dot: string }> = {
  study_pending: { chip: "bg-warning-50 text-warning-700", dot: "bg-warning-600" },
  study_completed: { chip: "bg-accent-50 text-accent-700", dot: "bg-accent-600" },
  report_sent: { chip: "bg-success-50 text-success-700", dot: "bg-success-600" },
  followup_pending: { chip: "bg-brand-50 text-brand-700", dot: "bg-brand-500" },
  followup_completed: { chip: "bg-surface-muted text-content-muted", dot: "bg-content-subtle" },
};

interface BadgeProps {
  status: StudyStatus;
  className?: string;
}

export function Badge({ status, className = "" }: BadgeProps) {
  const style = statusStyles[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${style.chip} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {STUDY_STATUS_LABELS[status]}
    </span>
  );
}
