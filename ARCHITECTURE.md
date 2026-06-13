# Architecture — PosturoBilan

Application Next.js (App Router) de bilan postural vélo pour kinésithérapeutes.
**Toute l'automatisation est native** : aucune dépendance d'orchestration externe.

## Stack

| Couche | Outil |
|--------|-------|
| Framework | Next.js (App Router) |
| Langage | TypeScript (strict) |
| ORM / DB | Prisma / PostgreSQL (Neon) |
| Auth | Clerk |
| Email | Resend |
| PDF | @react-pdf/renderer |
| Stockage PDF | Vercel Blob (privé) ou FS local en dev |
| Scheduler | Vercel Cron |
| Validation | Zod |

## Cycle de vie

L'intake (formulaire d'accueil) est **au niveau patient** ; le cycle de vie
clinique est porté par chaque **étude** (`Study.status`) — un patient peut avoir
plusieurs études (un vélo = une étude).

```
Patient  ──(accueil)──►  Étude(s)  ──study_completed──►  report_sent
                                                            │ (cron J+30)
                                                            ▼
                                              followup_pending ──►  followup_completed
```

## Flux d'automatisation

1. **Calendly → Accueil.** `POST /api/webhooks/calendly` (signature) upsert le
   patient et appelle `sendIntakeEmail`. Le patient remplit `/accueil/[token]`
   (CGU + consentement RGPD → `PatientIntake`).
2. **Étude & rapport.** Le kiné saisit l'étude (BO), génère et envoie le PDF
   (`report.actions` / `sendReportEmail`) → `report_sent`.
3. **Suivi J+30.** Vercel Cron `GET /api/cron/followup` (bearer) sélectionne les
   études `report_sent` à ~30 jours et appelle `sendFollowupEmail`. Le patient
   remplit `/suivi/[token]` → `Followup` + `followup_completed`.

Détails : `docs/WORKFLOWS.md`. Contrats HTTP : `docs/API.md`.

## Organisation du code

```
app/
  (auth)/                 routes publiques Clerk (sign-in/up)
  (dashboard)/            back-office protégé (layout garde le rôle)
  accueil/[token]/        formulaire d'accueil patient (public, token)
  suivi/[token]/          formulaire de suivi J+30 (public, token)
  api/
    webhooks/calendly/    entrée Calendly (signature)
    cron/followup/        scheduler J+30 (bearer)
    reports/[studyId]/    stream PDF (session Clerk, store privé)
    gdpr/                 export / anonymisation (ADMIN)
actions/                  Server Actions (mutations BO + soumissions publiques)
lib/
  emails/                 templates + envois consolidés (index.ts)
  validations/            schémas Zod
  db, auth, audit, storage, calendly, legal, env, app-url …
prisma/                   schema + migrations
```

## Sécurité

- **Back-office** : Clerk + garde de rôle dans le layout `(dashboard)`. Les
  Server Actions revérifient l'auth et l'appartenance patient (`requireKine`,
  ownership scoping).
- **Pages publiques** (`/accueil`, `/suivi`) : autorisées par la possession d'un
  **token unique** (UUID) ; les soumissions vérifient token + expiration +
  non-complétion. Aucune session.
- **Entrées machine** : webhook Calendly (signature HMAC), cron (bearer
  `CRON_SECRET`). `proxy.ts` (middleware) déclare ces routes publiques côté
  Clerk et les rate-limite par IP.
- **RGPD** : audit log sur les mutations, consentement horodaté/versionné,
  anonymisation (effacement des PII, conservation des données métier).
