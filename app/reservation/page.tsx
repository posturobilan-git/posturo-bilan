import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isReservationEnabled } from "@/lib/env";
import { ReservationEmbed } from "./ReservationEmbed";

export const metadata: Metadata = {
  title: "Réserver mon étude posturale",
};

const CABINET = process.env.CABINET_NAME || "Posturo Vélo";

export default function ReservationPage() {
  if (!isReservationEnabled()) redirect("/");

  return (
    <main className="min-h-screen bg-canvas px-4 py-8">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-6 text-center">
          <p className="text-sm font-semibold text-brand-600">{CABINET}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-content">
            Réserver mon étude posturale
          </h1>
          <p className="mt-1.5 text-sm text-content-muted">
            Choisissez le créneau qui vous convient. Vous recevrez ensuite un
            email pour préparer votre rendez-vous.
          </p>
        </header>
        <div className="h-[calc(100vh-12rem)] min-h-[600px] overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <ReservationEmbed />
        </div>
      </div>
    </main>
  );
}
