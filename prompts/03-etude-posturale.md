# Prompt 03 — Formulaire d'étude posturale

> Utiliser après le prompt 02. Lis CLAUDE.md avant de commencer.

---

## Contexte

Le pipeline patient est en place. Tu dois maintenant construire le formulaire d'étude posturale — c'est le cœur de l'application.

## Ce que tu dois construire

### 1. Schema Zod — `lib/validations/study.schema.ts`

```typescript
// Mesures posturales (toutes les valeurs métier)
export const studyMeasuresSchema = z.object({
  // Selle
  saddleHeight: z.number().min(50).max(120),         // cm
  saddleSetback: z.number().min(0).max(200),          // mm
  saddleAngle: z.number().min(-10).max(10).optional(), // degrés
  saddleModel: z.string().optional(),

  // Cintre / potence
  handlebarHeight: z.number().optional(),             // cm (relatif à la selle)
  stemLength: z.number().optional(),                  // mm
  stemAngle: z.number().optional(),                   // degrés
  handlebarWidth: z.number().optional(),              // mm

  // Position corps
  effectiveReach: z.number().optional(),              // mm
  trunkAngle: z.number().optional(),                  // degrés
  kneeAngle: z.number().optional(),                   // degrés (en bas de pédale)

  // Cale-pieds
  cleatAngle: z.number().min(-15).max(15).optional(), // degrés
  cleatPosition: z.string().optional(),               // "neutre", "avant", "arrière"

  // Manivelles
  crankLength: z.number().optional(),                 // mm

  // Observations libres
  observations: z.string().max(3000).optional(),
});

export const studySchema = z.object({
  patientId: z.string().uuid(),
  measures: studyMeasuresSchema,
  componentIds: z.array(z.string().uuid()),           // composants utilisés
  exerciseIds: z.array(z.string().uuid()),             // exercices prescrits
});
```

### 2. Server Actions — `actions/study.actions.ts`

- `submitStudy(data)` — Créer l'étude, mettre à jour statut → `study_completed`, déclencher `generateReport`
- `saveDraftStudy(data)` — Sauvegarder sans soumettre (statut reste `study_pending`)
- `getStudy(id)` — Récupérer une étude avec ses relations

### 3. Page formulaire — `app/(dashboard)/patients/[id]/etude/page.tsx`

**Structure en 3 étapes** (stepper) :

**Étape 1 — Mesures**
- Afficher la fiche patient dans une sidebar (données intake pour référence)
- Formulaire avec les groupes de champs : Selle, Cintre/Potence, Position corps, Cale-pieds, Manivelles
- Champ observations texte libre
- Boutons : "Sauvegarder brouillon" / "Étape suivante"

**Étape 2 — Composants modifiés**
- Liste des composants de la bibliothèque (filtrables par catégorie)
- Checkbox pour sélectionner ceux utilisés pendant l'étude
- Boutons : "Étape précédente" / "Étape suivante"

**Étape 3 — Exercices recommandés**
- Liste des exercices de la bibliothèque (filtrables par catégorie)
- Checkbox pour sélectionner ceux prescrits
- Résumé de toutes les étapes avant soumission
- Boutons : "Étape précédente" / "Soumettre l'étude"

### 4. Composants — `components/study/`

- `StudyStepper.tsx` — Indicateur d'étapes (1, 2, 3)
- `MeasuresForm.tsx` — Formulaire des mesures (Client Component avec state local)
- `ComponentPicker.tsx` — Sélecteur de composants avec search
- `ExercisePicker.tsx` — Sélecteur d'exercices avec search
- `PatientSidebar.tsx` — Sidebar avec les données patient

### Règles

- L'état du formulaire multi-étapes est géré avec Zustand dans un store `useStudyStore`
- À chaque changement d'étape, sauvegarder en draft automatiquement
- Vérifier que le kiné connecté est bien assigné à ce patient
- Après soumission : redirect vers `/patients/[id]` avec toast de succès
