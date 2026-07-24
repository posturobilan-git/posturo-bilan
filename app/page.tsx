import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { isReservationEnabled } from "@/lib/env";

const CABINET = process.env.CABINET_NAME || "PosturoBilan";

export const metadata: Metadata = {
  title: `${CABINET} — Étude posturale vélo`,
  description:
    "Optimisez votre position sur le vélo grâce à une étude posturale réalisée par un kinésithérapeute. Confort, performance et prévention des blessures.",
};

/**
 * Public marketing landing page (route "/").
 *
 * The primary call to action sends visitors to the booking flow; a quieter
 * "Espace kiné" link leads to sign-in. Already-authenticated kinés are sent
 * straight to their dashboard so they never sit on the marketing page.
 */
export default async function LandingPage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <Steps />
        <Benefits />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}

/* ─── Header ──────────────────────────────────────────────────────────────── */

function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-canvas/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-content">
          <Image
            src="/logo-posturovelo-1-1.png"
            alt={CABINET}
            width={36}
            height={36}
            className="h-9 w-9"
            priority
          />
          {CABINET}
        </Link>

        <nav className="flex items-center gap-2 sm:gap-4">
          {/* Quiet, secondary entry point for practitioners. */}
          <Link
            href="/sign-in"
            className="rounded-lg px-3 py-2 text-sm font-medium text-content-muted transition-colors hover:bg-surface-muted hover:text-content"
          >
            Espace kiné
          </Link>
          <PrimaryLink href="/reservation" size="sm">
            Réserver
          </PrimaryLink>
        </nav>
      </div>
    </header>
  );
}

/* ─── Hero ────────────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-accent-50 px-3 py-1 text-xs font-semibold text-accent-700">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-600" />
            Étude posturale vélo
          </span>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-content sm:text-5xl">
            Trouvez votre position idéale sur le vélo
          </h1>
          <p className="mt-5 max-w-xl text-lg text-content-muted">
            {/* Placeholder — texte marketing à finaliser. */}
            Texte d&apos;exemple : une étude posturale complète menée par un
            kinésithérapeute pour gagner en confort, en puissance et prévenir les
            douleurs. Mesures précises, ajustements personnalisés et suivi à 30
            jours.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <PrimaryLink href="/reservation" size="lg">
              Réserver une étude posturale
            </PrimaryLink>
            <Link
              href="#etapes"
              className="text-sm font-medium text-content-muted underline-offset-4 hover:text-content hover:underline"
            >
              Comment ça se passe ?
            </Link>
          </div>

          <p className="mt-6 text-sm text-content-subtle">
            Sans engagement · Rapport détaillé remis par email · Suivi inclus
          </p>
        </div>

        <ImagePlaceholder
          label="Visuel hero à venir"
          className="aspect-[4/3] w-full"
        />
      </div>
    </section>
  );
}

/* ─── Steps ───────────────────────────────────────────────────────────────── */

const STEPS = [
  {
    title: "Réservation",
    body: "Texte d'exemple : choisissez un créneau en ligne en quelques clics.",
  },
  {
    title: "Étude en cabinet",
    body: "Texte d'exemple : mesures et tests réalisés par votre kinésithérapeute.",
  },
  {
    title: "Rapport personnalisé",
    body: "Texte d'exemple : recevez par email votre bilan et vos réglages.",
  },
  {
    title: "Suivi à 30 jours",
    body: "Texte d'exemple : un point d'étape pour valider les bénéfices.",
  },
];

function Steps() {
  return (
    <section id="etapes" className="border-t border-border bg-surface-muted">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight text-content">
            Comment ça se passe
          </h2>
          <p className="mt-3 text-content-muted">
            Texte d&apos;exemple : un parcours simple, de la prise de rendez-vous
            au suivi.
          </p>
        </div>

        <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              className="rounded-2xl border border-border bg-surface p-6 shadow-sm"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">
                {i + 1}
              </span>
              <h3 className="mt-4 font-semibold text-content">{step.title}</h3>
              <p className="mt-2 text-sm text-content-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ─── Benefits ────────────────────────────────────────────────────────────── */

const BENEFITS = [
  {
    title: "Plus de confort",
    body: "Texte d'exemple : réduisez les points de pression et les tensions.",
  },
  {
    title: "Plus de performance",
    body: "Texte d'exemple : optimisez votre transfert de puissance.",
  },
  {
    title: "Moins de blessures",
    body: "Texte d'exemple : prévenez les douleurs au dos, aux genoux et aux cervicales.",
  },
];

function Benefits() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
        <ImagePlaceholder
          label="Visuel cabinet à venir"
          className="order-last aspect-[4/3] w-full lg:order-first"
        />
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-content">
            Pensée pour les cyclistes exigeants
          </h2>
          <p className="mt-3 text-content-muted">
            Texte d&apos;exemple : une approche clinique et mesurée, adaptée à
            votre pratique, du loisir à la compétition.
          </p>
          <ul className="mt-8 space-y-5">
            {BENEFITS.map((b) => (
              <li key={b.title} className="flex gap-4">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-700">
                  <CheckIcon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-semibold text-content">{b.title}</h3>
                  <p className="mt-1 text-sm text-content-muted">{b.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ─── Final CTA ───────────────────────────────────────────────────────────── */

function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
      <div className="overflow-hidden rounded-2xl bg-brand-700 px-6 py-14 text-center shadow-lg sm:px-12">
        <h2 className="text-3xl font-semibold tracking-tight text-white">
          Prêt à optimiser votre position ?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-brand-100">
          Texte d&apos;exemple : réservez votre étude posturale dès maintenant.
        </p>
        <div className="mt-8 flex justify-center">
          <Link
            href="/reservation"
            className="inline-flex h-12 items-center justify-center rounded-lg bg-white px-6 text-base font-medium text-brand-700 shadow-xs transition-colors hover:bg-brand-50"
          >
            Réserver une étude posturale
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─── Footer ──────────────────────────────────────────────────────────────── */

function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-content-subtle sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          © {new Date().getFullYear()} {CABINET}. Texte d&apos;exemple — mentions
          légales à venir.
        </p>
        <nav className="flex items-center gap-5">
          <Link href="/reservation" className="hover:text-content">
            Réserver
          </Link>
          <Link href="/sign-in" className="hover:text-content">
            Espace kiné
          </Link>
        </nav>
      </div>
    </footer>
  );
}

/* ─── Shared bits ─────────────────────────────────────────────────────────── */

function PrimaryLink({
  href,
  size = "md",
  children,
}: {
  href: string;
  size?: "sm" | "lg" | "md";
  children: React.ReactNode;
}) {
  const sizes = {
    sm: "h-9 px-4 text-sm",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-6 text-base",
  };
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center rounded-lg bg-brand-600 font-medium text-white shadow-xs transition-colors hover:bg-brand-700 active:bg-brand-800 ${sizes[size]}`}
    >
      {children}
    </Link>
  );
}

/** Neutral placeholder standing in for a real photo/illustration. */
function ImagePlaceholder({ label, className = "" }: { label: string; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center rounded-2xl border border-dashed border-border-strong bg-gradient-to-br from-brand-50 to-accent-50 ${className}`}
    >
      <span className="flex flex-col items-center gap-2 text-content-subtle">
        <ImageIcon className="h-8 w-8" />
        <span className="text-sm font-medium">{label}</span>
      </span>
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
    </svg>
  );
}

function ImageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 15-5-5L5 21" />
    </svg>
  );
}
