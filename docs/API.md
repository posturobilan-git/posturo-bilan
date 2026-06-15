# API Reference — VéloBilan

## Principes

- Toutes les routes API sont dans `app/api/`
- Les mutations côté app passent par des **Server Actions** (pas des routes API)
- Les routes API servent aux **entrées externes** (webhook Cal.com), au
  **scheduler** (Vercel Cron) et aux endpoints **RGPD** / **stream PDF**
- Chaque route porte sa propre auth (signature, bearer, ou session Clerk)
- Les formulaires patients (`/accueil`, `/suivi`) sont des **pages publiques**
  à token, pas des routes API

---

## Entrée externe — Cal.com

### POST `/api/webhooks/cal?kineId=<uuid>`

Reçoit les événements Cal.com (réservation). Seul `BOOKING_CREATED` crée un
patient ; les autres events sont acquittés sans effet. Un Event Type Cal.com par
kiné : le `kineId` est passé en **query param** de l'URL du webhook.

**Auth :** signature `x-cal-signature-256` vérifiée avec `CAL_WEBHOOK_SECRET`
(HMAC-SHA256 sur le corps brut). En local sans secret, les appels non signés
sont acceptés pour faciliter les tests.

**Body (extrait consommé) :**
```json
{
  "triggerEvent": "BOOKING_CREATED",
  "payload": {
    "uid": "string? (id de réservation)",
    "startTime": "string?",
    "attendees": [{ "email": "string (required)", "name": "string?" }]
  }
}
```

**Comportement :**
- Lit `kineId` dans le query param (400 si absent)
- Upsert du patient (email = clé de déduplication), génération de l'`inviteToken`
- `sendIntakeEmail(patientId)` → email du lien `/accueil/[token]`
- Réponse `{ success: true, patientId: "uuid" }` (207 si l'email échoue)

---

## Scheduler — Vercel Cron

### GET `/api/cron/followup`

Job quotidien (cf. `vercel.json`, `0 8 * * *`) qui envoie le suivi J+30.

**Auth :** `Authorization: Bearer ${CRON_SECRET}`

**Comportement :**
- Sélectionne les études `report_sent` dont `reportSentAt` est dans la fenêtre
  J-31 → J-29
- Pour chacune : `sendFollowupEmail(studyId)` (envoi + statut → `followup_pending`)
- Réponse `{ eligible, sent, failed }`

---

## Formulaires patients (pages publiques à token)

| Page | Token | Soumission |
|------|-------|------------|
| `/accueil/[token]` | `Patient.inviteToken` | `PatientIntake` + consentement RGPD |
| `/suivi/[token]` | `Study.followupToken` | `Followup` + étude → `followup_completed` |

Soumission via Server Actions publiques (`submitAccueilForm`,
`submitFollowupForm`) — autorisées par la possession du token, sans session.

---

## Endpoints RGPD

### GET `/api/gdpr/export/[patientId]`

Export complet des données d'un patient en JSON.

**Auth :** Clerk session + rôle `ADMIN`

**Réponse :** JSON avec toutes les données du patient (intake, studies, followups).

---

### DELETE `/api/gdpr/anonymize/[patientId]`

Anonymise les données personnelles d'un patient.

**Auth :** Clerk session + rôle `ADMIN`

**Comportement :**
- Remplace `email`, `firstName`, `lastName`, `phone` par des valeurs anonymes
- Supprime les données de `PatientIntake` (données personnelles)
- Conserve les mesures posturales (données métier sans PII)
- Passe `isAnonymized = true`
- Crée un `AuditLog` avec action `ANONYMIZE`

---

## Server Actions (mutations côté app)

Ces fonctions sont appelées depuis les composants React. Elles ne sont pas des routes HTTP.

| Action | Fichier | Description |
|--------|---------|-------------|
| `createPatient` | `patient.actions.ts` | Créer un patient manuellement |
| `getStudies` | `study.actions.ts` | Lister toutes les études (vue `/etudes`) |
| `submitStudy` | `study.actions.ts` | Soumettre le formulaire d'étude (avance `study_completed`) |
| `updateStudyStatus` | `study.actions.ts` | Transition stricte du statut d'une étude |
| `generateReport` / `sendReport` | `report.actions.ts` | Générer le PDF / l'envoyer (avance `report_sent`) |
| `sendIntakeEmail` | `intake.actions.ts` | Envoyer le formulaire d'accueil (bouton BO) |
| `submitAccueilForm` | `accueil.actions.ts` | Soumission publique du formulaire d'accueil (token) |
| `submitFollowupForm` | `followup.actions.ts` | Soumission publique du suivi J+30 (token) |
| `createExercise` | `exercise.actions.ts` | Créer un exercice (ADMIN) |
| `createComponent` | `component.actions.ts` | Créer un composant (ADMIN) |
| `createBikeType` | `bikeType.actions.ts` | Créer un type de vélo (ADMIN) |

---

## Emails transactionnels — `lib/emails/index.ts`

Toutes les fonctions d'envoi sont consolidées ici (`sendIntakeEmail`,
`sendReportEmail`, `sendFollowupEmail`). Chacune récupère ses données, rend le
template Resend, envoie, et écrit un audit log. Voir `docs/WORKFLOWS.md`.
