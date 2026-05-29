const STEPS = [
  { n: 1, label: "Mesures" },
  { n: 2, label: "Composants" },
  { n: 3, label: "Exercices" },
] as const;

export function StudyStepper({ current }: { current: 1 | 2 | 3 }) {
  return (
    <nav aria-label="Étapes de l'étude" className="flex items-center gap-0">
      {STEPS.map(({ n, label }, i) => {
        const done = n < current;
        const active = n === current;
        return (
          <div key={n} className="flex items-center">
            {i > 0 && (
              <div className={`h-0.5 w-12 transition-colors ${done ? "bg-brand-600" : "bg-border"}`} />
            )}
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                  active
                    ? "bg-brand-600 text-white shadow-xs ring-4 ring-brand-100"
                    : done
                    ? "bg-brand-100 text-brand-700"
                    : "bg-surface-muted text-content-subtle"
                }`}
              >
                {done ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  n
                )}
              </div>
              <span
                className={`text-xs font-medium ${
                  active ? "text-brand-700" : done ? "text-brand-600" : "text-content-subtle"
                }`}
              >
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </nav>
  );
}
