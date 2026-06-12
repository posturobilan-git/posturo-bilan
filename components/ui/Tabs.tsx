"use client";

import { useState, type ReactNode } from "react";

export interface TabItem {
  id: string;
  label: string;
  /** Optional count badge next to the label. */
  count?: number;
  content: ReactNode;
}

interface Props {
  tabs: TabItem[];
  /** Tab to open initially (defaults to the first). */
  defaultTab?: string;
  /** When set, reflects the active tab in the URL (?param=id) without navigating. */
  paramName?: string;
}

export function Tabs({ tabs, defaultTab, paramName }: Props) {
  const [active, setActive] = useState(
    defaultTab && tabs.some((t) => t.id === defaultTab) ? defaultTab : tabs[0]?.id
  );

  function select(id: string) {
    setActive(id);
    if (paramName) {
      const url = new URL(window.location.href);
      url.searchParams.set(paramName, id);
      window.history.replaceState(null, "", url);
    }
  }

  return (
    <div>
      <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((t) => {
          const isActive = t.id === active;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => select(t.id)}
              className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "border-brand-600 text-brand-700"
                  : "border-transparent text-content-muted hover:border-border-strong hover:text-content"
              }`}
            >
              {t.label}
              {t.count != null && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    isActive ? "bg-brand-50 text-brand-700" : "bg-surface-muted text-content-subtle"
                  }`}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Panels stay mounted (hidden, not unmounted) so per-tab state — saisies,
          drag & drop non enregistré — survives tab switches. */}
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" hidden={t.id !== active} className="pt-6">
          {t.content}
        </div>
      ))}
    </div>
  );
}
