import { formatDelta } from "@/lib/measures";

/**
 * Renders the before→after delta of a measurement as a neutral badge. Shared by
 * both measurement types (côtes du vélo and mesures du cycliste). Renders nothing
 * until both values exist. Colour is intentionally neutral — see formatDelta.
 */
export function MeasureDelta({
  before,
  after,
  unit,
  className = "",
}: {
  before: number | null | undefined;
  after: number | null | undefined;
  unit: string;
  className?: string;
}) {
  const text = formatDelta(before, after, unit);
  if (text == null) return null;
  return (
    <span
      className={`inline-flex items-center rounded-md bg-surface-muted px-1.5 py-0.5 text-xs font-medium tabular-nums text-content-muted ${className}`}
    >
      {text}
    </span>
  );
}
