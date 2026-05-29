"use client";

import { useEffect } from "react";

// Last-resort boundary: catches errors that escape segment-level error.tsx
// files (notably errors thrown inside a layout, which a sibling error.tsx
// cannot catch). Without this, such errors render a blank page.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error boundary:", error);
  }, [error]);

  return (
    <html lang="fr">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <h2 className="text-lg font-semibold">Une erreur est survenue</h2>
        <p className="max-w-md text-sm text-gray-500">
          Quelque chose s&apos;est mal passé. Veuillez réessayer.
        </p>
        <button
          onClick={reset}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white"
        >
          Réessayer
        </button>
      </body>
    </html>
  );
}
