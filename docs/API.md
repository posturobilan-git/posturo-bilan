# API Reference — VéloBilan

## Principes

- Toutes les routes API sont dans `app/api/`
- Les mutations côté app passent par des **Server Actions** (pas des routes API)
- Les routes API servent uniquement aux **webhooks externes** (n8n) et aux endpoints **RGPD**
- Toutes les routes API vérifient une `x-api-key` header

---

## Webhooks n8n

### POST `/api/intake/receive`

Reçoit les données patient après soumission du formulaire Google Form (Phase 1).

**Auth :** `x-api-key: N8N_API_KEY`

**Body :**
```json
{
  "source": "google_forms",
  "calendlyEventId": "string",
  "patient": {
    "email": "string (required)",
    "firstName": "string (required)",
    "lastName": "string (required)",
    "phone": "string?",
    "heightCm": "number?",
    "weightKg": "number?",
    "bikeType": "string?",
    "ridingLevel": "string?",
    "weeklyHours": "number?",
    "injuries": "string[]",
    "goals": "string?",
    "medicalNotes": "string?"
  },
  "kineId": "string (uuid — id du kiné lié au RDV Calendly)"
}
```

**Comportement :**
- Upsert du patient (email comme clé de déduplication)
- Création du `PatientIntake` associé
- Mise à jour du statut → `intake_completed`
- Réponse `{ success: true, patientId: "uuid" }`

---

### POST `/api/followup/receive`

Reçoit les réponses au formulaire de suivi J+30 (Phase 4).

**Auth :** `x-api-key: N8N_API_KEY`

**Body :**
```json
{
  "patientId": "string (uuid)",
  "source": "google_forms",
  "responses": {
    "painLevel": "number 0-10",
    "comfortScore": "number 0-10",
    "satisfactionScore": "number 0-10",
    "ridingFrequency": "string?",
    "returningToSport": "boolean?",
    "generalFeedback": "string?"
  },
  "rawResponses": "object (réponses brutes Google Forms)"
}
```

**Comportement :**
- Création d'un `Followup` lié au patient
- Mise à jour du statut → `followup_completed`
- Réponse `{ success: true, followupId: "uuid" }`

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
| `updatePatientStatus` | `patient.actions.ts` | Changer le statut pipeline |
| `submitStudy` | `study.actions.ts` | Soumettre le formulaire d'étude |
| `generateReport` | `report.actions.ts` | Générer PDF + envoyer par email |
| `createExercise` | `exercise.actions.ts` | Créer un exercice (ADMIN) |
| `createComponent` | `component.actions.ts` | Créer un composant (ADMIN) |

---

## Contrat d'interface n8n ↔ App

L'app est indépendante de n8n. Le contrat est :
- n8n appelle `/api/intake/receive` ou `/api/followup/receive`
- L'app ne sait pas que c'est n8n qui appelle
- Demain, Google Forms peut être remplacé par un formulaire custom sans changer l'API
- La clé `source` indique l'origine pour debug
