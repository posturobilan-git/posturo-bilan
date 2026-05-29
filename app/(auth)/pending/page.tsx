import { redirect } from "next/navigation";
import { SignOutButton } from "@clerk/nextjs";
import { getCurrentKine } from "@/lib/auth";

export default async function PendingPage() {
  // If the account has already been approved, don't strand them here.
  const kine = await getCurrentKine();
  if (kine && kine.role !== "PENDING") redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-warning-100">
          <svg className="h-6 w-6 text-warning-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <h1 className="text-xl font-semibold text-content">Compte en attente de validation</h1>
        <p className="mt-3 text-sm leading-relaxed text-content-muted">
          Votre compte a bien été créé. Un administrateur va valider votre accès
          et vous affecter un rôle. Vous pourrez accéder à l&apos;application dès
          que votre compte sera activé.
        </p>
        <p className="mt-3 text-xs text-content-subtle">
          Si vous pensez qu&apos;il y a une erreur, contactez votre administrateur.
        </p>

        <div className="mt-6">
          <SignOutButton redirectUrl="/sign-in">
            <button className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-content transition-colors hover:bg-surface-muted">
              Se déconnecter
            </button>
          </SignOutButton>
        </div>
      </div>
    </div>
  );
}
