import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Merci",
  robots: { index: false, follow: false },
};

const CABINET = process.env.CABINET_NAME || "Posturo Vélo";

export default function MerciPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-100">
          <svg className="h-6 w-6 text-success-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="mt-4 text-sm font-semibold text-brand-600">{CABINET}</p>
        <h1 className="mt-1 text-xl font-semibold text-content">Formulaire bien reçu</h1>
        <p className="mt-3 text-sm text-content-muted">
          Merci d&apos;avoir complété votre formulaire d&apos;accueil. Vos
          informations nous aideront à préparer votre étude posturale. Vous
          pouvez fermer cette page.
        </p>
      </div>
    </main>
  );
}
