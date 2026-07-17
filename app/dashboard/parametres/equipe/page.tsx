import { redirect } from "next/navigation";
import { clerkClient } from "@clerk/nextjs/server";
import { getCurrentKine } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { EquipeClient, type PendingInvitation } from "@/components/parametres/EquipeClient";
import { decryptFields } from "@/lib/crypto";
import { USER_ENCRYPTED_FIELDS } from "@/lib/crypto.constants";

async function getPendingInvitations(): Promise<PendingInvitation[]> {
  try {
    const clerk = await clerkClient();
    const list = await clerk.invitations.getInvitationList({
      status: "pending",
      orderBy: "-created_at",
    });
    return list.data.map((inv) => ({
      id: inv.id,
      emailAddress: inv.emailAddress,
      createdAt: inv.createdAt,
    }));
  } catch (e) {
    // Clerk may not have invitations enabled — degrade gracefully.
    console.error("getInvitationList failed:", e);
    return [];
  }
}

export default async function EquipePage() {
  const kine = await getCurrentKine();
  if (!kine) redirect("/sign-in");
  if (kine.role === "PENDING") redirect("/pending");
  if (kine.role !== "ADMIN") redirect("/dashboard");

  const [pendingUsersRaw, activeUsersRaw, pendingInvitations] = await Promise.all([
    prisma.user.findMany({
      where: { role: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, createdAt: true },
    }),
    prisma.user.findMany({
      where: { role: { in: ["ADMIN", "KINE"] } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        role: true,
        _count: { select: { patients: true } },
      },
    }),
    getPendingInvitations(),
  ]);
  const pendingUsers = pendingUsersRaw.map((u) => decryptFields(u, USER_ENCRYPTED_FIELDS));
  const activeUsers = activeUsersRaw.map((u) => decryptFields(u, USER_ENCRYPTED_FIELDS));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestion de l'équipe"
        description="Invitez des kinés, validez les comptes et gérez les rôles (réservé aux administrateurs)"
      />
      <EquipeClient
        pendingUsers={pendingUsers}
        activeUsers={activeUsers.map((u) => ({ ...u, role: u.role as "ADMIN" | "KINE" }))}
        pendingInvitations={pendingInvitations}
        currentUserId={kine.id}
      />
    </div>
  );
}
