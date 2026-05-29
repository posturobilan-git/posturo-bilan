# Prompt 02 — Pipeline patient & Dashboard

> Utiliser après le prompt 01. Lis CLAUDE.md avant de commencer.

---

## Contexte

Le projet est initialisé. Tu dois maintenant implémenter :
1. Le webhook d'intake patient (Phase 1)
2. Le tableau de bord avec la liste des patients
3. La page dossier patient

## Ce que tu dois construire

### 1. Webhook intake — `app/api/intake/receive/route.ts`

Implémente le endpoint POST selon le contrat dans `docs/API.md`.
- Valider le body avec Zod (schema dans `lib/validations/intake.schema.ts`)
- Upsert le patient (déduplication par email)
- Créer le `PatientIntake` associé
- Mettre à jour le statut → `intake_completed`
- Créer un audit log

### 2. Schema de validation — `lib/validations/intake.schema.ts`

Crée le schéma Zod complet pour les données d'intake (voir `docs/API.md` pour les champs).

### 3. Server Actions patient — `actions/patient.actions.ts`

Implémente :
- `getPatients(filters?)` — Liste patients du kiné connecté (ou tous si ADMIN)
- `getPatientDossier(id)` — Dossier complet avec include (intake, studies, followups)
- `updatePatientStatus(id, status)` — Machine à états (voir CLAUDE.md section 7)

### 4. Dashboard — `app/(dashboard)/dashboard/page.tsx`

Page Server Component qui affiche :
- 4 stat cards : patients actifs, études en cours, rapports envoyés, suivis réalisés
- Table des patients récents avec colonnes : nom, kiné assigné, date, statut, actions
- Le statut doit utiliser le composant `Badge` avec la bonne couleur par statut

### 5. Liste patients — `app/(dashboard)/patients/page.tsx`

Page avec :
- Barre de recherche (filtre par nom ou email)
- Filtre par statut
- Table complète des patients
- Bouton "Nouveau patient" (ADMIN uniquement)

### 6. Dossier patient — `app/(dashboard)/patients/[id]/page.tsx`

Page avec les 3 panneaux (voir mockup slide 5) :
- **Amont** : données intake
- **Bilan** : dernière étude posturale (composants + exercices)
- **Suivi** : dernier followup
- Table d'évolution amont → followups (toutes les métriques comparées)
- Actions : télécharger PDF, renvoyer rapport, déclencher relance manuelle

### Règles

- Tous les fetches dans les Server Components (pas de `useEffect`)
- Un kiné ne voit QUE ses propres patients (vérifier `kineId`)
- Les ADMIN voient tous les patients
- Gérer les états loading / empty / error

### Validation finale

```bash
npx tsc --noEmit
# Naviguer vers /dashboard → doit afficher les stats (vides si DB vide)
# Naviguer vers /patients → doit afficher la table
```
