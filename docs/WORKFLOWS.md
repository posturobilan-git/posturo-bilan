# Workflows — Automatisation native

Toute l'automatisation est gérée **nativement par l'application** (aucune
dépendance externe d'orchestration). Les entrées viennent du webhook Cal.com et
d'un Vercel Cron ; les sorties sont les emails transactionnels Resend.

## Phase 1 — Réservation & accueil patient

Le patient réserve depuis la page `/reservation` (embed Cal.com). Cal.com notifie
l'app par webhook.

```
Cal.com (nouvelle réservation)
  │  triggerEvent "BOOKING_CREATED"
  ▼
POST /api/webhooks/cal?kineId=<uuid>
  ├── Vérifie la signature (header x-cal-signature-256 + CAL_WEBHOOK_SECRET)
  ├── Lit le kineId dans le query param (un Event Type Cal.com par kiné)
  ├── Extrait email, nom (→ prénom/nom), uid de réservation depuis l'attendee
  ├── Upsert du patient (email = clé de déduplication), génère son inviteToken
  └── sendIntakeEmail(patientId) → email avec lien /accueil/[token]
        │
        ▼
  Patient ouvre /accueil/[token] (public)
    ├── Étape 1 : CGU + consentement RGPD (obligatoire)
    └── Étape 2 : formulaire → PatientIntake enregistré, lien invalidé
```

**Configuration Cal.com :** créer un Event Type par kiné et y ajouter un webhook
`BOOKING_CREATED` pointant vers `/api/webhooks/cal?kineId=<uuid-du-kiné>`. Le
`kineId` n'est donc pas dans le payload mais dans l'URL du webhook.

## Phase 4 — Suivi J+30

> Le cycle de vie est porté par chaque **étude** (`Study.status`). L'éligibilité
> au suivi se calcule sur les études en statut `report_sent`.

```
Vercel Cron (vercel.json — tous les jours à 08:00 UTC)
  ▼
GET /api/cron/followup        (Authorization: Bearer CRON_SECRET)
  ├── Sélectionne les études status=report_sent
  │     ET reportSentAt entre J-31 et J-29 (fenêtre ~J+30)
  └── Pour chaque étude : sendFollowupEmail(studyId)
        ├── génère followupToken, email avec lien /suivi/[token]
        └── statut report_sent → followup_pending
              │
              ▼
  Patient ouvre /suivi/[token] (public)
    └── Formulaire (douleur, confort, satisfaction, fréquence, commentaire)
          → Followup enregistré, statut étude → followup_completed, lien invalidé
```

## Emails sortants — `lib/emails/index.ts`

Toutes les fonctions d'envoi sont consolidées dans ce module. Chacune récupère
ses données, rend le template Resend, envoie, et écrit un audit log.

| Fonction | Déclencheur | Contenu |
|----------|-------------|---------|
| `sendIntakeEmail(patientId)` | webhook Cal.com, bouton BO | lien `/accueil/[token]` |
| `sendReportEmail(studyId)` | action BO (rapport) | PDF en pièce jointe |
| `sendFollowupEmail(studyId)` | cron J+30 | lien `/suivi/[token]` |

**Gating local :** en l'absence de `RESEND_API_KEY`, l'envoi est ignoré (le lien
est loggé) en environnement local, mais échoue en déploiement — voir
`lib/env.ts` et `deliver()` dans `lib/emails/index.ts`.

## Variables d'environnement

| Variable | Rôle |
|----------|------|
| `NEXT_PUBLIC_CAL_LINK` | Event type Cal.com embarqué sur `/reservation` |
| `CAL_WEBHOOK_SECRET` | Signature du webhook Cal.com |
| `CRON_SECRET` | Bearer attendu par `/api/cron/followup` |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | Envoi des emails |
| `NEXT_PUBLIC_APP_URL` | Base des liens (`/accueil`, `/suivi`) dans les emails |
