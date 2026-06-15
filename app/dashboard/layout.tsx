import { redirect } from "next/navigation";
import { getCurrentKine } from "@/lib/auth";
import { Sidebar } from "@/components/ui/Sidebar";
import { Toaster } from "@/components/ui/Toaster";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const kine = await getCurrentKine();
  if (!kine) redirect("/sign-in");
  if (kine.role === "PENDING") redirect("/pending");

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      <Sidebar isAdmin={kine.role === "ADMIN"} />
      <main className="flex-1 overflow-y-auto pt-16 lg:pt-0">
        <div className="mx-auto max-w-7xl p-6 lg:p-10">{children}</div>
        <footer className="border-t border-border px-6 py-4 text-xs text-content-subtle lg:px-10">
          Les données patients sont traitées conformément au RGPD : finalité de
          suivi kinésithérapeutique, conservation limitée, et droit à
          l&apos;effacement via anonymisation. Accès restreint au praticien référent.
        </footer>
      </main>
      <Toaster />
    </div>
  );
}
