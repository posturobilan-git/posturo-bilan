import type { StudyStep } from "@/lib/stores/studyStore";

const STEPS = [
  { n: 1, label: "Vélo" },
  { n: 2, label: "Tests physio" },
  { n: 3, label: "Mesures vélo · avant" },
  { n: 4, label: "Mesures cycliste" },
  { n: 5, label: "Mesures vélo · après" },
  { n: 6, label: "Composants" },
  { n: 7, label: "Exercices" },
] as const;

export function StudyStepper({
  current,
  onStepClick,
}: {
  current: StudyStep;
  /** When provided, steps become clickable to jump back/forth. */
  onStepClick?: (n: StudyStep) => void;
}) {
  return (
    <nav aria-label="Étapes de l'étude" className="flex items-center gap-0 overflow-x-auto pb-1">
      {STEPS.map(({ n, label }, i) => {
        const done = n < current;
        const active = n === current;
        // The connector sits to the LEFT of step n: fill it once we've reached
        // step n (i.e. the previous step is behind us), so the line runs all the
        // way up to the current step rather than stopping one short.
        const connectorFilled = n <= current;

        const circle = (
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
              active
                ? "bg-brand-600 text-white shadow-xs ring-4 ring-brand-100"
                : done
                ? "bg-brand-100 text-brand-700 group-hover:bg-brand-200"
                : "bg-surface-muted text-content-subtle group-hover:bg-border"
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
        );

        const labelEl = (
          <span
            className={`whitespace-nowrap text-xs font-medium ${
              active ? "text-brand-700" : done ? "text-brand-600" : "text-content-subtle"
            }`}
          >
            {label}
          </span>
        );

        return (
          <div key={n} className="flex shrink-0 items-center">
            {i > 0 && (
              <div className={`h-0.5 w-5 transition-colors sm:w-10 ${connectorFilled ? "bg-brand-600" : "bg-border"}`} />
            )}
            {onStepClick ? (
              <button
                type="button"
                onClick={() => onStepClick(n)}
                aria-current={active ? "step" : undefined}
                className="group flex flex-col items-center gap-1 rounded-lg px-1 py-0.5 transition-colors hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
              >
                {circle}
                {labelEl}
              </button>
            ) : (
              <div className="flex flex-col items-center gap-1 px-1 py-0.5">
                {circle}
                {labelEl}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
