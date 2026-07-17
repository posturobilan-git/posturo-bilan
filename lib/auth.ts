import { auth, currentUser } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { encryptFields, decryptFields, hashEmail } from "@/lib/crypto";
import { USER_ENCRYPTED_FIELDS } from "@/lib/crypto.constants";

/**
 * Returns the app User for the current Clerk session, syncing from Clerk on
 * first visit (no webhook). New accounts start as PENDING and must be approved
 * by an ADMIN from /dashboard/parametres/equipe — except the very first account in the
 * database, which is bootstrapped as ADMIN so the cabinet founder can log in.
 *
 * Wrapped in React `cache()` so the layout and the page of a dashboard route
 * (both of which call this) share a single execution per request. Without it
 * those concurrent renders would both run the lazy create on a brand-new
 * account, and one would throw a unique-constraint error out of the layout —
 * which no error boundary catches, producing a blank page.
 */
export const getCurrentKine = cache(async () => {
  const { userId } = await auth();
  if (!userId) return null;

  const existingRaw = await prisma.user.findUnique({ where: { clerkId: userId } });
  // email/name sont chiffrés en base — déchiffrer avant toute comparaison avec
  // les valeurs en clair renvoyées par Clerk, et avant de renvoyer l'utilisateur
  // à l'appelant (déchiffrement transparent, voir lib/crypto.ts).
  const existing = existingRaw && decryptFields(existingRaw, USER_ENCRYPTED_FIELDS);

  const clerkUser = await currentUser();
  if (!clerkUser) return existing;

  const email =
    clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)
      ?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;
  if (!email) return existing;

  const name =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() || email;

  if (existing) {
    // Keep email/name in sync with Clerk; never touch the role here.
    if (existing.email !== email || existing.name !== name) {
      const updated = await prisma.user.update({
        where: { clerkId: userId },
        data: { ...encryptFields({ email, name }, USER_ENCRYPTED_FIELDS), emailHash: hashEmail(email) },
      });
      return decryptFields(updated, USER_ENCRYPTED_FIELDS);
    }
    return existing;
  }

  // Role resolution for a brand-new account:
  //  - first account ever → ADMIN (bootstrap)
  //  - invited via Clerk → role pre-assigned in publicMetadata (skips PENDING)
  //  - otherwise → PENDING (awaits admin validation)
  const clerkRole = clerkUser.publicMetadata?.role as "ADMIN" | "KINE" | undefined;
  const userCount = await prisma.user.count();
  const role = userCount === 0 ? "ADMIN" : clerkRole ?? "PENDING";

  try {
    const created = await prisma.user.create({
      data: {
        clerkId: userId,
        ...encryptFields({ email, name }, USER_ENCRYPTED_FIELDS),
        emailHash: hashEmail(email),
        role,
      },
    });
    return decryptFields(created, USER_ENCRYPTED_FIELDS);
  } catch (e) {
    // A concurrent request may have created the record between our findUnique
    // and create — re-read instead of failing.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const found = await prisma.user.findUnique({ where: { clerkId: userId } });
      return found && decryptFields(found, USER_ENCRYPTED_FIELDS);
    }
    throw e;
  }
});

/**
 * Throwing guards for Server Actions. Pages/layout enforce PENDING/admin via
 * getCurrentKine + redirect (see the dashboard layout) — actions can't redirect
 * because they wrap these in try/catch, which would swallow NEXT_REDIRECT.
 */
export async function requireAdmin() {
  const kine = await getCurrentKine();
  if (!kine) throw new Error("Non authentifié");
  if (kine.role !== "ADMIN") throw new Error("Accès refusé");
  return kine;
}

export async function requireKine() {
  const kine = await getCurrentKine();
  if (!kine) throw new Error("Non authentifié");
  if (kine.role === "PENDING") throw new Error("Compte en attente de validation");
  return kine;
}

/**
 * Ownership guard for patient mutations. A KINE may only touch their own
 * patients; an ADMIN may touch any. Throws on failure — call sites in Server
 * Actions wrap this in try/catch and surface the message via ActionResult.
 */
export async function requirePatientOwnership(patientId: string) {
  const user = await requireKine();

  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { id: true, kineId: true, email: true },
  });

  if (!patient) throw new Error("Patient introuvable.");

  if (user.role !== "ADMIN" && patient.kineId !== user.id) {
    throw new Error("Accès refusé — ce patient ne vous est pas assigné.");
  }

  return { user, patient };
}
