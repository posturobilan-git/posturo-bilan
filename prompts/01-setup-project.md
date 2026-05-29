# Prompt 01 — Initialisation du projet

> Coller ce prompt dans Claude Code après avoir créé le repo Next.js vide.

---

Lis **CLAUDE.md** et **ARCHITECTURE.md** en entier avant de commencer.

## Ta mission

Scaffolde la base complète du projet VéloBilan. Voici ce que tu dois créer dans l'ordre :

### Étape 1 — Dépendances

Installe toutes les dépendances du projet :

```bash
npm install @clerk/nextjs @prisma/client prisma zod resend @vercel/blob @react-pdf/renderer zustand
npm install -D @types/node typescript tailwindcss @tailwindcss/forms
```

### Étape 2 — Structure de dossiers

Crée la structure complète décrite dans CLAUDE.md section 3 (répertoires vides avec `.gitkeep` si nécessaire).

### Étape 3 — Configuration Prisma

Copie le contenu de `prisma/schema.prisma` (déjà présent dans le repo) et lance :
```bash
npx prisma generate
```

### Étape 4 — Fichiers de base à créer

Crée les fichiers suivants avec leur contenu complet :

**`lib/db.ts`** — Singleton Prisma
```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["query"] : [] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

**`lib/auth.ts`** — Helpers Clerk (voir CLAUDE.md section 8)

**`lib/audit.ts`** — Fonction logAudit (voir CLAUDE.md section 9)

**`lib/email.ts`** — Client Resend
```typescript
import { Resend } from "resend";
export const resend = new Resend(process.env.RESEND_API_KEY);
```

**`lib/blob.ts`** — Client Vercel Blob (juste le re-export)

**`types/index.ts`** — Tous les types TypeScript du domaine (StudyMeasures, PatientWithRelations, etc.)

**`middleware.ts`** — Middleware Clerk à la racine du projet

### Étape 5 — Layout et pages de base

Crée :
- `app/layout.tsx` — Root layout avec ClerkProvider
- `app/(auth)/sign-in/[[...sign-in]]/page.tsx` — Page Clerk sign-in
- `app/(auth)/sign-up/[[...sign-up]]/page.tsx` — Page Clerk sign-up
- `app/(dashboard)/layout.tsx` — Layout protégé avec sidebar
- `app/(dashboard)/dashboard/page.tsx` — Page dashboard (placeholder)

### Étape 6 — Composants UI de base

Crée dans `components/ui/` :
- `Badge.tsx` — Badge statut patient (avec variantes par status)
- `Button.tsx` — Bouton primaire/secondaire
- `Card.tsx` — Carte conteneur
- `Sidebar.tsx` — Sidebar navigation (voir mockup dans la présentation)
- `PageHeader.tsx` — En-tête de page avec titre + action

### Validation

À la fin, lance :
```bash
npx tsc --noEmit
npm run lint
npm run dev
```

L'app doit démarrer sans erreur sur `localhost:3000`.
