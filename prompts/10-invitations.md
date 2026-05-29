# Prompt 10 — Système d'invitations

> Lis CLAUDE.md avant de commencer.
> Nécessite que le mode "Restricted to invited users only" soit activé dans Clerk Dashboard → Configure → Restrictions.

---

## Principe

L'ADMIN envoie une invitation depuis `/parametres/equipe`.
Clerk envoie un email avec un lien signé valable 48h.
L'utilisateur clique, crée son compte, et **arrive directement avec le rôle
`KINE`** — sans passer par `PENDING` — car le rôle est injecté dans les
métadonnées Clerk au moment de l'invitation.

```
Admin → inviteKine(email) → Clerk envoie email
Invité → clique sur lien → crée compte (sign-up restreint)
       → syncAndGetCurrentUser()
       → rôle lu depuis Clerk metadata → KINE directement
       → /dashboard (pas de pending)
```

---

## Étape 1 — Lire le rôle depuis Clerk dans syncAndGetCurrentUser()

Modifier `lib/auth.ts` pour que les utilisateurs invités ne passent pas par
`PENDING` si Clerk a déjà un rôle dans leurs métadonnées :

```typescript
export async function syncAndGetCurrentUser() {
  const { userId } = await auth();
  if (!userId) return null;

  const clerkUser = await clerkClient.users.getUser(userId);

  // Si Clerk a un rôle dans les métadonnées (utilisateur invité),
  // l'utiliser directement plutôt que PENDING
  const clerkRole = clerkUser.publicMetadata?.role as
    | "ADMIN"
    | "KINE"
    | undefined;

  const user = await prisma.user.upsert({
    where: { clerkId: userId },
    create: {
      clerkId: userId,
      email: clerkUser.emailAddresses[0].emailAddress,
      name: `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim(),
      role: clerkRole ?? "PENDING", // ← utilise le rôle Clerk si disponible
    },
    update: {
      email: clerkUser.emailAddresses[0].emailAddress,
      name: `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim(),
    },
  });

  return user;
}
```

---

## Étape 2 — Server Actions

Ajouter dans `actions/user.actions.ts` :

```typescript
export async function inviteKine(email: string) {
  const admin = await requireAdmin();

  // Vérifier que l'email n'est pas déjà en DB
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("Un utilisateur avec cet email existe déjà.");

  // Créer l'invitation Clerk avec le rôle pré-assigné dans les métadonnées
  await clerkClient.invitations.createInvitation({
    emailAddress: email,
    publicMetadata: { role: "KINE" },
    redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
    notify: true, // Clerk envoie l'email automatiquement
  });

  await logAudit({
    userId: admin.id,
    action: "CREATE",
    entity: "invitation",
    entityId: email,
    metadata: { email, role: "KINE" },
  });

  revalidatePath("/parametres/equipe");
  return { success: true };
}

export async function revokeInvitation(invitationId: string) {
  await requireAdmin();
  await clerkClient.invitations.revokeInvitation(invitationId);
  revalidatePath("/parametres/equipe");
}
```

---

## Étape 3 — UI dans EquipeClient

Ajouter dans `components/parametres/EquipeClient.tsx` :

**Bouton dans le header de la page :**

```tsx
<Button onClick={() => setInviteOpen(true)}>+ Inviter un kiné</Button>
```

**Modale d'invitation :**

```tsx
<Modal
  open={inviteOpen}
  onClose={() => setInviteOpen(false)}
  title="Inviter un kiné"
>
  <form
    action={async (formData) => {
      const email = formData.get("email") as string;
      try {
        await inviteKine(email);
        toast.success(`Invitation envoyée à ${email}`);
        setInviteOpen(false);
      } catch (e: any) {
        toast.error(e.message);
      }
    }}
  >
    <label>
      Email du kiné
      <input type="email" name="email" required placeholder="kiné@cabinet.fr" />
    </label>
    <p style={{ fontSize: 12, color: "gray" }}>
      Un email d'invitation sera envoyé automatiquement par Clerk. Le kiné aura
      48h pour créer son compte.
    </p>
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
      <Button variant="secondary" onClick={() => setInviteOpen(false)}>
        Annuler
      </Button>
      <Button type="submit">Envoyer l'invitation</Button>
    </div>
  </form>
</Modal>
```

---

## Étape 4 — Afficher les invitations en attente

Ajouter dans `app/(dashboard)/parametres/equipe/page.tsx` :

```typescript
const pendingInvitations = await clerkClient.invitations.getInvitationList({
  status: "pending",
});

return (
  <EquipeClient
    pendingUsers={pendingUsers}
    activeUsers={activeUsers}
    pendingInvitations={pendingInvitations.data} // ← nouveau
  />
);
```

Dans `EquipeClient`, ajouter une **troisième section "Invitations envoyées"** :

Table avec colonnes : Email, Date d'envoi, Expire dans, Actions.

Action disponible : **"Révoquer"** → appelle `revokeInvitation(id)`.

---

## Checklist de vérification

```bash
npx tsc --noEmit

# 1. En tant qu'ADMIN : inviter une adresse email de test
# 2. Vérifier que l'invitation apparaît dans "Invitations envoyées"
# 3. Ouvrir l'email → cliquer sur le lien d'invitation
# 4. Créer le compte → arriver directement sur /dashboard (pas /pending)
# 5. Révoquer une invitation → elle disparaît de la liste
# 6. Tenter de créer un compte sans invitation → refusé par Clerk
```
