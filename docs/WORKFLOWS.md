# Workflows n8n — Spécifications

## Phase 1 — Intake patient

```
Trigger: Calendly (nouveau RDV confirmé)
  │
  ├── Extraire: nom, email, date RDV, kine_id (metadata Calendly)
  │
  ├── Envoyer email au patient avec lien Google Form
  │     Sujet: "Préparez votre étude posturale — [Prénom]"
  │     Corps: lien vers Google Form pré-rempli (email, nom)
  │
  └── On submit Google Form:
        POST https://app.velobile.fr/api/intake/receive
        Headers: x-api-key: {{ $env.N8N_API_KEY }}
        Body: { patient: {...formData}, kineId: "...", calendlyEventId: "..." }
```

**Champs Google Form à créer :**
- Prénom (texte court, requis)
- Nom (texte court, requis)
- Email (email, requis)
- Téléphone (texte court)
- Taille en cm (nombre)
- Poids en kg (nombre)
- Type de vélo (choix: Route / VTT / Gravel / Triathlon / Autre)
- Niveau de pratique (choix: Loisir / Sportif / Compétiteur)
- Heures de pratique par semaine (nombre)
- Années de pratique (nombre)
- Douleurs actuelles (texte long)
- Objectifs de l'étude (texte long)
- Notes médicales (texte long, optionnel)

---

## Phase 4 — Suivi J+30

> **Note (refacto multi-études) :** le statut du cycle de vie est désormais porté
> par chaque **étude** (`Study.status`), plus par le patient. Un patient peut avoir
> plusieurs études (un vélo = une étude). L'éligibilité au suivi J+30 se calcule
> donc sur les études en statut `report_sent`.

```
Trigger: Cron / Schedule
  │
  ├── Condition: study.status === "report_sent"
  │             AND NOW() >= study.reportSentAt + 30 jours
  │
  ├── Récupérer liste études éligibles
  │     GET https://app.velobile.fr/api/followup/eligible
  │     (endpoint à créer — retourne les patientIds éligibles)
  │
  ├── Pour chaque étude éligible:
  │     Envoyer email avec lien Google Form de suivi
  │     Mettre study.status → followup_pending
  │
  └── On submit Google Form suivi:
        POST https://app.velobile.fr/api/followup/receive
        Headers: x-api-key: {{ $env.N8N_API_KEY }}
        Body: { patientId: "...", responses: {...formData} }
        → l'app marque l'étude la plus récente (report_sent / followup_pending)
          du patient en followup_completed
```

**Champs Google Form suivi à créer :**
- Niveau de douleur actuel 0-10 (nombre)
- Confort global sur le vélo 0-10 (nombre)
- Satisfaction globale 0-10 (nombre)
- Fréquence de pratique actuelle (texte court)
- Avez-vous repris la compétition/sport ? (oui/non)
- Commentaires libres (texte long)

---

## Variables d'environnement n8n

| Variable | Valeur |
|----------|--------|
| `N8N_API_KEY` | Même valeur que dans `.env` de l'app |
| `APP_BASE_URL` | `https://app.velobile.fr` |
| `RESEND_API_KEY` | Pour envoi d'emails depuis n8n si besoin |

---

## Notes d'implémentation

- Le `kineId` doit être passé en metadata lors de la création du RDV Calendly (champ custom)
- Le lien Google Form doit être pré-rempli avec l'email du patient pour déduplication
- En cas d'échec du webhook, n8n doit retenter 3 fois avec backoff exponentiel
- Les réponses Google Forms doivent inclure un champ caché `patient_id` pour le suivi J+30
