# Workflows — Automatisation native

Toute l'automatisation est gérée **nativement par l'application** (aucune
dépendance externe d'orchestration). Les entrées viennent du webhook Calendly et
d'un Vercel Cron ; les sorties sont les emails transactionnels Resend.

## Phase 1 — Accueil patient

```
Calendly (nouveau RDV confirmé)
  │  event "invitee.created"
  ▼
POST /api/webhooks/calendly
  ├── Vérifie la signature (header calendly-webhook-signature + CALENDLY_WEBHOOK_SECRET)
  ├── Extrait email, prénom, nom, date du RDV, et kineId (custom field Calendly)
  ├── Upsert du patient (email = clé de déduplication), génère son inviteToken
  └── sendIntakeEmail(patientId) → email avec lien /accueil/[token]
        │
        ▼
  Patient ouvre /accueil/[token] (public)
    ├── Étape 1 : CGU + consentement RGPD (obligatoire)
    └── Étape 2 : formulaire → PatientIntake enregistré, lien invalidé
```

**Champ custom Calendly requis :** le `kineId` (uuid du kiné) doit être passé
soit dans une question custom contenant « kiné » / « kine », soit dans le
paramètre de tracking `utm_content` du lien de réservation.

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
| `sendIntakeEmail(patientId)` | webhook Calendly, bouton BO | lien `/accueil/[token]` |
| `sendReportEmail(studyId)` | action BO (rapport) | PDF en pièce jointe |
| `sendFollowupEmail(studyId)` | cron J+30 | lien `/suivi/[token]` |

**Gating local :** en l'absence de `RESEND_API_KEY`, l'envoi est ignoré (le lien
est loggé) en environnement local, mais échoue en déploiement — voir
`lib/env.ts` et `deliver()` dans `lib/emails/index.ts`.

## Variables d'environnement

| Variable | Rôle |
|----------|------|
| `CALENDLY_WEBHOOK_SECRET` | Signature du webhook Calendly |
| `CRON_SECRET` | Bearer attendu par `/api/cron/followup` |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | Envoi des emails |
| `NEXT_PUBLIC_APP_URL` | Base des liens (`/accueil`, `/suivi`) dans les emails |
