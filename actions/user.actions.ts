"use server";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { clerkClient } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { ok, fail, formatZodError, type ActionResult } from "@/lib/action-result";
import { hashEmail } from "@/lib/crypto";
import { z } from "zod";

type ActiveRole = "KINE" | "ADMIN";

const emailSchema = z.string().email("Adresse email invalide.");

async function appBaseUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

/** Approves a PENDING account and assigns it a role. */
export async function approveUser(
  userId: string,
  role: ActiveRole
): Promise<ActionResult<void>> {
  try {
    const admin = await requireAdmin();
    await prisma.user.update({ where: { id: userId }, data: { role } });
    await logAudit({
      userId: admin.id,
      action: "UPDATE",
      entity: "user",
      entityId: userId,
      metadata: { action: "approve", newRole: role },
    });
    revalidatePath("/dashboard/parametres/equipe");
    return ok(undefined);
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    console.error("approveUser failed:", e);
    return fail("Impossible de valider ce compte. Réessayez.");
  }
}

/** Changes an active user's role. Cannot change your own. */
export async function changeUserRole(
  userId: string,
  newRole: ActiveRole
): Promise<ActionResult<void>> {
  try {
    const admin = await requireAdmin();
    if (userId === admin.id) return fail("Impossible de modifier son propre rôle.");

    await prisma.user.update({ where: { id: userId }, data: { role: newRole } });
    await logAudit({
      userId: admin.id,
      action: "UPDATE",
      entity: "user",
      entityId: userId,
      metadata: { action: "changeRole", newRole },
    });
    revalidatePath("/dashboard/parametres/equipe");
    return ok(undefined);
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    console.error("changeUserRole failed:", e);
    return fail("Impossible de modifier le rôle. Réessayez.");
  }
}

/** Suspends a user back to PENDING (keeps their data). Cannot suspend yourself. */
export async function deactivateUser(userId: string): Promise<ActionResult<void>> {
  try {
    const admin = await requireAdmin();
    if (userId === admin.id) return fail("Impossible de se désactiver soi-même.");

    await prisma.user.update({ where: { id: userId }, data: { role: "PENDING" } });
    await logAudit({
      userId: admin.id,
      action: "UPDATE",
      entity: "user",
      entityId: userId,
      metadata: { action: "deactivate" },
    });
    revalidatePath("/dashboard/parametres/equipe");
    return ok(undefined);
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    console.error("deactivateUser failed:", e);
    return fail("Impossible de désactiver ce compte. Réessayez.");
  }
}

/** Refuses a pending account: revokes the Clerk account and deletes the DB row. */
export async function refuseUser(userId: string): Promise<ActionResult<void>> {
  try {
    const admin = await requireAdmin();
    if (userId === admin.id) return fail("Impossible de se refuser soi-même.");

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return fail("Utilisateur introuvable.");

    // Block refusing an account that still owns patients (would orphan data).
    const patientCount = await prisma.patient.count({ where: { kineId: userId } });
    if (patientCount > 0) {
      return fail("Ce compte a des patients assignés — réaffectez-les avant de le refuser.");
    }

    const clerk = await clerkClient();
    await clerk.users.deleteUser(user.clerkId);
    await prisma.user.delete({ where: { id: userId } });

    await logAudit({
      userId: admin.id,
      action: "DELETE",
      entity: "user",
      entityId: userId,
      metadata: { action: "refuse", email: user.email },
    });
    revalidatePath("/dashboard/parametres/equipe");
    return ok(undefined);
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    console.error("refuseUser failed:", e);
    return fail("Impossible de refuser ce compte. Réessayez.");
  }
}

/**
 * Invites a kiné by email via Clerk. The KINE role is pre-assigned in the
 * invitation's publicMetadata, so the invitee skips PENDING on sign-up.
 * Requires "Restricted to invited users" + invitation emails enabled in Clerk.
 */
export async function inviteKine(email: string): Promise<ActionResult<void>> {
  const parsed = emailSchema.safeParse(email.trim());
  if (!parsed.success) return fail(formatZodError(parsed.error));
  const address = parsed.data;

  try {
    const admin = await requireAdmin();

    const existing = await prisma.user.findUnique({ where: { emailHash: hashEmail(address) } });
    if (existing) return fail("Un utilisateur avec cet email existe déjà.");

    const clerk = await clerkClient();
    // redirectUrl must render <SignUp /> so it can consume the __clerk_ticket
    // and create the account. The sign-up page then forwards to /dashboard.
    await clerk.invitations.createInvitation({
      emailAddress: address,
      publicMetadata: { role: "KINE" },
      redirectUrl: `${await appBaseUrl()}/sign-up`,
      expiresInDays: 2,
      notify: true,
      ignoreExisting: true,
    });

    await logAudit({
      userId: admin.id,
      action: "CREATE",
      entity: "invitation",
      entityId: address,
      metadata: { email: address, role: "KINE" },
    });

    revalidatePath("/dashboard/parametres/equipe");
    return ok(undefined);
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    // Clerk surfaces a duplicate-invitation error with a recognizable shape.
    console.error("inviteKine failed:", e);
    return fail("Impossible d'envoyer l'invitation. Vérifiez la configuration Clerk.");
  }
}

/** Revokes a pending Clerk invitation. */
export async function revokeInvitation(invitationId: string): Promise<ActionResult<void>> {
  try {
    const admin = await requireAdmin();
    const clerk = await clerkClient();
    await clerk.invitations.revokeInvitation(invitationId);

    await logAudit({
      userId: admin.id,
      action: "DELETE",
      entity: "invitation",
      entityId: invitationId,
      metadata: { action: "revoke" },
    });

    revalidatePath("/dashboard/parametres/equipe");
    return ok(undefined);
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    console.error("revokeInvitation failed:", e);
    return fail("Impossible de révoquer l'invitation. Réessayez.");
  }
}
