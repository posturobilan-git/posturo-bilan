# Prompt 05 — Bibliothèque exercices & composants

> Utiliser en parallèle du prompt 03 (pas de dépendance).

---

## Ce que tu dois construire

### 1. Server Actions — `actions/exercise.actions.ts`

- `getExercises(filters?)` — Liste avec filtre par catégorie + search
- `createExercise(data)` — ADMIN uniquement
- `updateExercise(id, data)` — ADMIN uniquement
- `toggleExercise(id)` — Activer/désactiver — ADMIN uniquement

### 2. Server Actions — `actions/component.actions.ts`

Mêmes fonctions pour les composants vélo.

### 3. Page bibliothèque — `app/(dashboard)/bibliotheque/page.tsx`

Deux onglets :
- **Exercices** — Grid de cartes avec nom, catégorie, description, fréquence, compteur "utilisé X fois"
- **Composants** — Grid de cartes avec nom, marque, modèle, catégorie, compteur "utilisé X fois"

Le compteur "utilisé X fois" se calcule en comptant les relations dans `PostureStudy`.

**Permissions :**
- Tous les kinés voient la bibliothèque en lecture
- Seul l'ADMIN peut créer / modifier / désactiver

**Modale de création (ADMIN) :**
- Formulaire dans une modale
- Validation Zod côté client (react-hook-form + zod resolver)
- Server Action à la soumission

### 4. Composants — `components/bibliotheque/`

- `ExerciseCard.tsx`
- `ComponentCard.tsx`
- `CreateExerciseModal.tsx`
- `CreateComponentModal.tsx`
- `CategoryFilter.tsx`

### Seed de données

Crée un fichier `prisma/seed.ts` avec des données de base :
- 8 exercices classiques (psoas, gainage, mobilité thoracique, VMO, etc.)
- 10 composants courants (selles Fizik, Ergon, potences FSA, cales Shimano, etc.)

```bash
npx ts-node prisma/seed.ts
```
