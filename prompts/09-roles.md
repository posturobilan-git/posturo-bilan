# Prompt 09 — Rôles & Permissions

> Lis CLAUDE.md avant de commencer.
> Version simplifiée — pas de webhook Clerk.

---

## Principe

1. L'utilisateur crée son compte via la page Clerk `/sign-up`
2. À sa première connexion, l'app crée automatiquement une entrée DB avec le rôle `PENDING`
3. Il voit un écran d'attente — il ne peut rien faire
4. Un ADMIN valide son compte depuis `/parametres/equipe` et lui affecte un rôle (`KINE` ou `ADMIN`)
5. À la prochaine connexion, l'utilisateur a accès à l'app

---

## Étape 1 — Mise à jour du schéma Prisma

Ajouter `PENDING` à l'enum `Role` :

```prisma
enum Role {
  PENDING   // ← nouveau — compte créé, pas encore validé
  ADMIN
  KINE
}
```

```bash
npx prisma migrate dev --name add-pending-role
npx prisma generate
```

---

## Étape 2 — Synchronisation lazy (sans webhook)

Au lieu d'un webhook, on synchronise l'utilisateur à sa première visite dans le layout protégé.

### `lib/auth.ts` — Version complète

```typescript
import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

// Récupère ou crée l'utilisateur en DB depuis la session Clerk
export async function syncAndGetCurrentUser() {
  const { userId } = await auth();
  if (!userId) return null;

  const clerkUser = await clerkClient.users.getUser(userId);

  // Upsert — crée l'entrée si elle n'existe pas encore
  const user = await prisma.user.upsert({
    where: { clerkId: userId },
    create: {
      clerkId: userId,
      email: clerkUser.emailAddresses[0].emailAddress,
      name: `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim(),
      role: "PENDING", // tout nouveau compte commence en attente
    },
    update: {
      // Mettre à jour email/nom si changé dans Clerk
      email: clerkUser.emailAddresses[0].emailAddress,
      name: `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim(),
    },
  });

  return user;
}

export async function requireKine() {
  const user = await syncAndGetCurrentUser();
  if (!user) redirect("/sign-in");
  if (user.role === "PENDING") redirect("/pending");
  return user;
}

export async function requireAdmin() {
  const user = await syncAndGetCurrentUser();
  if (!user) redirect("/sign-in");
  if (user.role === "PENDING") redirect("/pending");
  if (user.role !== "ADMIN") redirect("/dashboard?error=unauthorized");
  return user;
}

export function patientWhereClause(user: { id: string; role: string }) {
  return user.role === "ADMIN"
    ? { isAnonymized: false }
    : { kineId: user.id, isAnonymized: false };
}
```

---

## Étape 3 — Page d'attente

### `app/(auth)/pending/page.tsx`

```tsx
export default function PendingPage() {
  return (
    <div
      style={
        {
          /* centré, sobre */
        }
      }
    >
      <h1>Compte en attente de validation</h1>
      <p>
        Votre compte a bien été créé. Un administrateur va valider votre accès
        et vous affecter un rôle. Vous recevrez un email dès que votre compte
        sera activé.
      </p>
      <p style={{ color: "gray", fontSize: 13 }}>
        Si vous pensez qu'il y a une erreur, contactez votre administrateur.
      </p>
      <SignOutButton /> {/* Bouton Clerk pour se déconnecter */}
    </div>
  );
}
```

Cette page est accessible sans rôle — ne pas la protéger dans le middleware.

---

## Étape 4 — Middleware

### `middleware.ts`

```typescript
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/pending", // ← accessible sans rôle
  "/api/intake/receive",
  "/api/followup/receive",
]);

const isAdminRoute = createRouteMatcher([
  "/statistiques(.*)",
  "/parametres/equipe(.*)",
  "/parametres/rgpd(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return NextResponse.next();

  // Toutes les autres routes nécessitent d'être connecté
  await auth.protect();

  return NextResponse.next();
  // Note : la vérification PENDING et ADMIN se fait dans requireKine() / requireAdmin()
  // dans chaque page — le middleware vérifie juste que l'utilisateur est connecté
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico)).*)",
  ],
};
```

---

## Étape 5 — Page gestion de l'équipe (ADMIN)

### `app/(dashboard)/parametres/equipe/page.tsx`

```typescript
export default async function EquipePage() {
  await requireAdmin();

  const [pendingUsers, activeUsers] = await Promise.all([
    prisma.user.findMany({
      where: { role: "PENDING" },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findMany({
      where: { role: { in: ["ADMIN", "KINE"] } },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { patients: true } } },
    }),
  ]);

  return <EquipeClient pendingUsers={pendingUsers} activeUsers={activeUsers} />;
}
```

### `components/parametres/EquipeClient.tsx`

**Section "En attente de validation"** (badge rouge avec le count) :

Table avec colonnes : Nom, Email, Date d'inscription, Actions.

Actions disponibles :

- **"Valider comme Kiné"** → bouton principal vert
- **"Valider comme Admin"** → bouton secondaire
- **"Refuser"** → supprime l'entrée DB + révoque le compte Clerk

**Section "Utilisateurs actifs"** :

Table avec colonnes : Nom, Email, Rôle (badge), Patients assignés, Actions.

Actions disponibles :

- **Changer le rôle** → dropdown `KINE` / `ADMIN`
- **Désactiver** → passe en `PENDING` (bloque l'accès sans supprimer les données)

---

## Étape 6 — Server Actions

### `actions/user.actions.ts`

```typescript
"use server";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

export async function approveUser(userId: string, role: "KINE" | "ADMIN") {
  const admin = await requireAdmin();

  await prisma.user.update({
    where: { id: userId },
    data: { role },
  });

  await logAudit({
    userId: admin.id,
    action: "UPDATE",
    entity: "user",
    entityId: userId,
    metadata: { action: "approve", newRole: role },
  });

  revalidatePath("/parametres/equipe");
}

export async function changeUserRole(
  userId: string,
  newRole: "KINE" | "ADMIN",
) {
  const admin = await requireAdmin();

  // Empêcher de modifier son propre rôle
  if (userId === admin.id)
    throw new Error("Impossible de modifier son propre rôle");

  await prisma.user.update({
    where: { id: userId },
    data: { role: newRole },
  });

  await logAudit({
    userId: admin.id,
    action: "UPDATE",
    entity: "user",
    entityId: userId,
    metadata: { newRole },
  });

  revalidatePath("/parametres/equipe");
}

export async function deactivateUser(userId: string) {
  const admin = await requireAdmin();
  if (userId === admin.id)
    throw new Error("Impossible de se désactiver soi-même");

  await prisma.user.update({
    where: { id: userId },
    data: { role: "PENDING" }, // bloque l'accès sans supprimer les données
  });

  await logAudit({
    userId: admin.id,
    action: "UPDATE",
    entity: "user",
    entityId: userId,
    metadata: { action: "deactivate" },
  });

  revalidatePath("/parametres/equipe");
}

export async function refuseUser(userId: string) {
  const admin = await requireAdmin();

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("Utilisateur introuvable");

  // Révoquer le compte Clerk
  await clerkClient.users.deleteUser(user.clerkId);

  // Supprimer de la DB
  await prisma.user.delete({ where: { id: userId } });

  await logAudit({
    userId: admin.id,
    action: "DELETE",
    entity: "user",
    entityId: userId,
    metadata: { action: "refuse", email: user.email },
  });

  revalidatePath("/parametres/equipe");
}
```

---

## Étape 7 — UI conditionnelle

### Hook — `hooks/useRole.ts`

```typescript
"use client";
import { useUser } from "@clerk/nextjs";

// Récupère le rôle depuis les métadonnées Clerk
// Note: le rôle Clerk n'est pas synchronisé ici — on fait confiance à la DB
// Pour l'UI conditionnelle légère, on peut stocker le rôle dans un cookie après login
// Pour l'instant : passer le rôle en prop depuis les Server Components

export function useIsAdmin(role: string) {
  return role === "ADMIN";
}
```

**Pattern recommandé — passer le rôle en prop :**

```tsx
// Dans le layout protégé, récupérer le rôle une seule fois
// app/(dashboard)/layout.tsx
export default async function DashboardLayout({ children }) {
  const user = await requireKine(); // redirect si PENDING
  return (
    <div>
      <Sidebar role={user.role} /> {/* passe le rôle aux composants client */}
      {children}
    </div>
  );
}

// Dans Sidebar.tsx (Client Component)
export function Sidebar({ role }: { role: string }) {
  const isAdmin = role === "ADMIN";
  return (
    <nav>
      <NavItem href="/dashboard" label="Tableau de bord" />
      <NavItem href="/patients" label="Patients" />
      <NavItem href="/bibliotheque" label="Bibliothèque" />
      {isAdmin && <NavItem href="/statistiques" label="Statistiques" />}
      {isAdmin && <NavItem href="/parametres/equipe" label="Équipe" />}
    </nav>
  );
}
```

---

## Étape 8 — Premier ADMIN (setup unique)

Un script à exécuter une seule fois après le premier déploiement.
Le fondateur du cabinet crée son compte via Clerk, puis :

```bash
# scripts/setup-admin.ts
npx ts-node scripts/setup-admin.ts email@cabinet.fr
```

```typescript
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  if (!email)
    throw new Error("Usage: npx ts-node scripts/setup-admin.ts email");

  const updated = await prisma.user.update({
    where: { email },
    data: { role: "ADMIN" },
  });

  console.log(`✅ ${updated.name} est maintenant ADMIN`);
  console.log(
    "Il peut maintenant valider les autres comptes depuis /parametres/equipe",
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

---

## Checklist de vérification

```bash
npx prisma migrate dev --name add-pending-role
npx tsc --noEmit

# Tests à faire :
# 1. Créer un compte via /sign-up → voir l'écran /pending
# 2. En tant qu'ADMIN, aller sur /parametres/equipe → voir le compte en attente
# 3. Valider le compte comme KINE → l'utilisateur peut se connecter
# 4. KINE ne voit pas /statistiques ni /parametres/equipe dans la sidebar
# 5. Accès direct à /statistiques en tant que KINE → redirect /dashboard
# 6. Désactiver un KINE → il voit à nouveau l'écran /pending
```
