# Prompt 14 — Côtes dynamiques par type de vélo

> Lis CLAUDE.md. À faire après le prompt 13 (dépend de BikeType et Study).

## Objectif

Les côtes (mesures) à remplir dans une étude dépendent du type de vélo. Il existe
un tronc commun (côtes communes à tous les vélos) et des côtes spécifiques à
certains types. L'admin gère les côtes via une interface comme les exercices/pièces.

## Modèle de données

**Nouvelle entité `Measurement` (côte)** — gérée par l'admin (CRUD)

- name, unit (cm, mm, degrés...), category, order (ordre d'affichage), isActive
- `isCommon` (booléen) — si true, s'applique à tous les types de vélo (tronc commun)
- Relation many-to-many avec `BikeType` — si non commun, liée à un ou plusieurs types

**`Study`** — les valeurs de mesures stockent un avant/après par côte

- Structure : `{ measurementId, before, after }` (JSON ou table dédiée selon ce qui est le plus propre)

## Changements applicatifs

1. **Page bibliothèque** — nouvel onglet "Côtes" avec CRUD admin (nom, unité, tronc commun ou types de vélo associés, ordre)
2. **Formulaire d'étude** — l'étape mesures affiche dynamiquement les côtes : tronc commun + celles du type de vélo sélectionné, triées par `order`. Chaque côte a un champ avant et un champ après.
3. Le dossier patient et le rapport PDF affichent l'avant/après par côte
4. Adapter le seed avec un jeu de côtes réaliste (communes + spécifiques par type)

## Validation

- npx tsc --noEmit
- Changer le type de vélo dans une étude change les côtes affichées
- L'admin peut créer une côte spécifique Triathlon → elle n'apparaît que sur les études Triathlon
- L'avant/après est saisissable et visible dans le dossier
