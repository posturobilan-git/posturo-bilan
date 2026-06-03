# Prompt 15 — Pièces filtrées par type de vélo

> Lis CLAUDE.md. À faire après le prompt 13.

## Objectif

Les composants sont spécifiques à un ou plusieurs types de vélo (ex : un composant
peut être partagé entre Gravel et Route). Dans le formulaire d'étude, n'afficher que
les composants compatibles avec le type de vélo de l'étude.

## Modèle de données

**`BikeComponent`** — ajouter une relation many-to-many avec `BikeType`

- Un composant peut être associé à plusieurs types de vélo
- Optionnel : un composant sans type associé est considéré comme universel

## Changements applicatifs

1. **Bibliothèque composants** — dans le formulaire de création/édition admin, ajouter
   la multi-sélection des types de vélo compatibles
2. **Formulaire d'étude** — l'étape composants ne liste que les pièces compatibles avec
   le type de vélo sélectionné pour l'étude
3. Adapter le seed pour associer les composants aux bons types de vélo

## Validation

- npx tsc --noEmit
- Une selle Route+Gravel apparaît sur les études Route et Gravel, pas sur VTT
- L'admin peut éditer les types compatibles d'un composant existant
