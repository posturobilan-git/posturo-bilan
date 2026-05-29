"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/stores/toastStore";
import {
  approveUser,
  changeUserRole,
  deactivateUser,
  refuseUser,
  inviteKine,
  revokeInvitation,
} from "@/actions/user.actions";

interface PendingUser {
  id: string;
  name: string;
  email: string;
  createdAt: string | Date;
}

interface ActiveUser extends PendingUser {
  role: "ADMIN" | "KINE";
  _count: { patients: number };
}

export interface PendingInvitation {
  id: string;
  emailAddress: string;
  createdAt: number; // epoch ms
}

interface Props {
  pendingUsers: PendingUser[];
  activeUsers: ActiveUser[];
  pendingInvitations: PendingInvitation[];
  currentUserId: string;
}

function fmtDate(d: string | Date | number) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

const INVITE_VALID_DAYS = 2;

function expiresIn(createdAtMs: number): string {
  const expiry = createdAtMs + INVITE_VALID_DAYS * 86_400_000;
  const hoursLeft = Math.round((expiry - Date.now()) / 3_600_000);
  if (hoursLeft <= 0) return "Expirée";
  if (hoursLeft < 24) return `${hoursLeft} h`;
  return `${Math.round(hoursLeft / 24)} j`;
}

export function EquipeClient({ pendingUsers, activeUsers, pendingInvitations, currentUserId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmRefuse, setConfirmRefuse] = useState<PendingUser | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) return toast.error(result.error ?? "Erreur.");
      toast.success(success);
      setConfirmRefuse(null);
      router.refresh();
    });
  }

  function handleInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "");
    setInviteError(null);
    startTransition(async () => {
      const result = await inviteKine(email);
      if (!result.ok) {
        setInviteError(result.error);
        return;
      }
      toast.success(`Invitation envoyée à ${email}.`);
      setInviteOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      {/* Header action */}
      <div className="flex justify-end">
        <Button className="w-full sm:w-auto" onClick={() => { setInviteError(null); setInviteOpen(true); }}>
          + Inviter un kiné
        </Button>
      </div>

      {/* Active */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-content">Utilisateurs actifs</h2>
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead>
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-content-subtle">Nom</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-content-subtle">Email</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-content-subtle">Rôle</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-content-subtle">Patients</th>
                <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wide text-content-subtle">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {activeUsers.map((u) => {
                const isSelf = u.id === currentUserId;
                return (
                  <tr key={u.id}>
                    <td className="px-5 py-3 font-medium text-content">
                      {u.name}
                      {isSelf && <span className="ml-2 text-xs text-content-subtle">(vous)</span>}
                    </td>
                    <td className="px-5 py-3 text-content-muted">{u.email}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        u.role === "ADMIN" ? "bg-brand-50 text-brand-700" : "bg-surface-muted text-content-muted"
                      }`}>
                        {u.role === "ADMIN" ? "Admin" : "Kiné"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-content-muted">{u._count.patients}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <select
                          value={u.role}
                          disabled={isSelf || pending}
                          onChange={(e) =>
                            run(
                              () => changeUserRole(u.id, e.target.value as "KINE" | "ADMIN"),
                              `Rôle de ${u.name} mis à jour.`
                            )
                          }
                          className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-content disabled:opacity-50"
                        >
                          <option value="KINE">Kiné</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                        <button
                          disabled={isSelf || pending}
                          onClick={() => run(() => deactivateUser(u.id), `${u.name} désactivé.`)}
                          className="rounded-md border border-border px-3 py-1 text-sm font-medium text-content-muted transition-colors hover:bg-surface-muted disabled:opacity-40"
                        >
                          Désactiver
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Invitations sent */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-content">Invitations envoyées</h2>
        {pendingInvitations.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-content-subtle">
            Aucune invitation en attente.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead>
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-content-subtle">Email</th>
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-content-subtle">Envoyée</th>
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-content-subtle">Expire dans</th>
                  <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wide text-content-subtle">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pendingInvitations.map((inv) => (
                  <tr key={inv.id}>
                    <td className="px-5 py-3 font-medium text-content">{inv.emailAddress}</td>
                    <td className="px-5 py-3 text-content-muted">{fmtDate(inv.createdAt)}</td>
                    <td className="px-5 py-3 text-content-muted">{expiresIn(inv.createdAt)}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end">
                        <button
                          disabled={pending}
                          onClick={() => run(() => revokeInvitation(inv.id), "Invitation révoquée.")}
                          className="rounded-md border border-border px-3 py-1 text-sm font-medium text-danger-600 transition-colors hover:bg-danger-50 disabled:opacity-40"
                        >
                          Révoquer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Pending — edge case (Clerk-direct sign-ups or deactivated accounts) */}
      <section className="space-y-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-content">En attente de validation</h2>
            {pendingUsers.length > 0 && (
              <span className="rounded-full bg-danger-100 px-2 py-0.5 text-xs font-semibold text-danger-700">
                {pendingUsers.length}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-content-subtle">
            Comptes créés hors invitation (directement dans Clerk) ou désactivés. Le flux
            normal passe par une invitation.
          </p>
        </div>

        {pendingUsers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-content-subtle">
            Aucun compte en attente.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead>
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-content-subtle">Nom</th>
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-content-subtle">Email</th>
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-content-subtle">Inscription</th>
                  <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wide text-content-subtle">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pendingUsers.map((u) => (
                  <tr key={u.id}>
                    <td className="px-5 py-3 font-medium text-content">{u.name}</td>
                    <td className="px-5 py-3 text-content-muted">{u.email}</td>
                    <td className="px-5 py-3 text-content-subtle">{fmtDate(u.createdAt)}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" disabled={pending}
                          onClick={() => run(() => approveUser(u.id, "KINE"), `${u.name} validé comme Kiné.`)}>
                          Valider comme Kiné
                        </Button>
                        <Button size="sm" variant="secondary" disabled={pending}
                          onClick={() => run(() => approveUser(u.id, "ADMIN"), `${u.name} validé comme Admin.`)}>
                          Admin
                        </Button>
                        <Button size="sm" variant="danger" disabled={pending}
                          onClick={() => setConfirmRefuse(u)}>
                          Refuser
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Invite modal */}
      {inviteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setInviteOpen(false); }}
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-surface shadow-2xl sm:rounded-xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold text-content">Inviter un kiné</h2>
              <button onClick={() => setInviteOpen(false)} className="rounded-md p-1 text-content-subtle hover:bg-surface-muted" aria-label="Fermer">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleInvite} className="space-y-4 px-6 py-5">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-content">Email du kiné</span>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="kine@cabinet.fr"
                  className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-content focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </label>
              <p className="text-xs text-content-subtle">
                Un email d&apos;invitation sera envoyé automatiquement par Clerk. Le kiné aura
                48&nbsp;h pour créer son compte et arrivera directement avec le rôle Kiné.
              </p>
              {inviteError && <p className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-700">{inviteError}</p>}
              <div className="flex justify-end gap-3 pt-1">
                <Button type="button" variant="secondary" onClick={() => setInviteOpen(false)}>Annuler</Button>
                <Button type="submit" loading={pending}>Envoyer l&apos;invitation</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Refuse confirmation */}
      {confirmRefuse && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmRefuse(null); }}
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-surface shadow-2xl sm:rounded-xl">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold text-content">Refuser ce compte ?</h2>
            </div>
            <div className="px-6 py-5 text-sm text-content-muted">
              <p>
                Le compte de <strong>{confirmRefuse.name}</strong> ({confirmRefuse.email}) sera
                <strong className="text-danger-600"> supprimé définitivement</strong> — côté
                application et côté authentification (Clerk).
              </p>
            </div>
            <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
              <Button variant="secondary" onClick={() => setConfirmRefuse(null)}>Annuler</Button>
              <Button variant="danger" loading={pending}
                onClick={() => run(() => refuseUser(confirmRefuse.id), "Compte refusé.")}>
                Refuser définitivement
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
