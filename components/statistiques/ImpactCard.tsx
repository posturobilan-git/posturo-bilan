import { Card } from "@/components/ui/Card";

function Gauge({
  label,
  score,
  positive,
}: {
  label: string;
  score: number | null;
  /** true = higher is better (comfort), false = lower is better (pain) */
  positive: boolean;
}) {
  if (score === null) {
    return (
      <div>
        <div className="flex justify-between text-sm">
          <span className="text-content-muted">{label}</span>
          <span className="text-content-subtle">—</span>
        </div>
        <p className="mt-1 text-xs italic text-content-subtle">Données insuffisantes</p>
      </div>
    );
  }

  const pct = (score / 10) * 100;
  // For "positive" metrics a high score is good; for pain, a low score is good.
  const good = positive ? score >= 7 : score <= 3;
  const mid = positive ? score >= 4 : score <= 6;
  const color = good ? "bg-success-600" : mid ? "bg-warning-600" : "bg-danger-500";

  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="text-content-muted">{label}</span>
        <span className="font-semibold text-content">{score.toFixed(1)}/10</span>
      </div>
      <div className="mt-1.5 h-2.5 w-full rounded-full bg-surface-muted">
        <div className={`h-2.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

interface Props {
  avgPainLevel: number | null;
  avgComfortScore: number | null;
  avgSatisfactionScore: number | null;
  followupCount: number;
}

export function ImpactCard({ avgPainLevel, avgComfortScore, avgSatisfactionScore, followupCount }: Props) {
  return (
    <Card>
      <h3 className="mb-1 text-base font-semibold text-content">Impact clinique (J+30)</h3>
      <p className="mb-4 text-xs text-content-subtle">
        Sur {followupCount} suivi{followupCount !== 1 ? "s" : ""} reçu{followupCount !== 1 ? "s" : ""}
      </p>
      <div className="space-y-4">
        <Gauge label="Douleur résiduelle" score={avgPainLevel} positive={false} />
        <Gauge label="Confort" score={avgComfortScore} positive />
        <Gauge label="Satisfaction" score={avgSatisfactionScore} positive />
      </div>
    </Card>
  );
}
