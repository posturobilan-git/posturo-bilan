# Prompt 19 — Automatisation native (sans n8n)

> Lis CLAUDE.md. Supprimer toute référence à n8n dans le code et la doc.
> Tout est géré nativement par l'application.

## Entrées externes

**Webhook Calendly — `POST /api/webhooks/calendly`**

- Vérification de la signature Calendly (header `calendly-webhook-signature`)
- Extraire email, nom, prénom, date du RDV, et le `kineId` depuis les custom fields Calendly
- Upsert du patient en base
- Appel `sendIntakeEmail(patientId)`
- Ajouter `CALENDLY_WEBHOOK_SECRET` dans `.env.example`

## Scheduler — Suivi J+30

Utiliser les **Vercel Cron Jobs** (natif, sans dépendance externe).

**`app/api/cron/followup/route.ts`**

- Route GET protégée par `Authorization: Bearer CRON_SECRET`
- Requête : études avec statut `report_sent` et `reportSentAt` entre J+29 et J+31
- Pour chaque étude éligible : `sendFollowupEmail(studyId)` + statut → `followup_pending`

**`vercel.json`**

```json
{
  "crons": [
    {
      "path": "/api/cron/followup",
      "schedule": "0 8 * * *"
    }
  ]
}
```

Ajouter `CRON_SECRET` dans `.env.example` et dans les variables Vercel.

## Sorties emails

Consolider toutes les fonctions d'envoi dans `lib/emails/index.ts` :

- `sendIntakeEmail(patientId)` — lien formulaire d'accueil avec token
- `sendReportEmail(studyId)` — rapport PDF en pièce jointe
- `sendFollowupEmail(studyId)` — formulaire de suivi J+30

Chaque fonction : fetch des données nécessaires, rendu du template Resend, envoi, audit log.

## Page de suivi J+30 — `/suivi/[token]`

Même pattern que `/accueil/[token]` : page publique avec token unique par étude.
Champs : niveau de douleur, confort, satisfaction, fréquence de pratique, commentaire libre.
Soumission → enregistrement `Followup` + statut étude → `followup_completed` + token invalidé.

## Nettoyage

- Auditer `/api/intake/receive` et `/api/followup/receive` avant de les supprimer
- Si elles ne sont plus appelées nulle part, les supprimer
- Sinon, les conserver et noter pourquoi dans un commentaire
- Supprimer uniquement `N8N_API_KEY` et toute référence à n8n dans le code et `.env.example`
- Mettre à jour `ARCHITECTURE.md` et `docs/WORKFLOWS.md`

## Validation

- npx tsc --noEmit
- Simuler un appel Calendly webhook → patient créé + email intake envoyé
- Simuler l'appel cron manuellement → études éligibles reçoivent l'email J+30
- Les trois fonctions d'envoi email fonctionnent indépendamment
- Aucune référence à n8n dans le code
