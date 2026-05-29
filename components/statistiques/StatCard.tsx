interface Props {
  label: string;
  value: string | number;
  deltaText?: string;
  deltaDir?: "up" | "down" | "neutral";
}

export function StatCard({ label, value, deltaText, deltaDir = "neutral" }: Props) {
  const deltaColor =
    deltaDir === "up"
      ? "text-success-700"
      : deltaDir === "down"
      ? "text-danger-600"
      : "text-content-subtle";

  const arrow = deltaDir === "up" ? "↑" : deltaDir === "down" ? "↓" : "";

  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <p className="text-sm font-medium text-content-muted">{label}</p>
      <p className="mt-2 text-3xl font-bold text-content">{value}</p>
      {deltaText && (
        <p className={`mt-1 text-xs font-medium ${deltaColor}`}>
          {arrow} {deltaText}
        </p>
      )}
    </div>
  );
}
