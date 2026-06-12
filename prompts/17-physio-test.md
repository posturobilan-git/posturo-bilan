# Prompt 17 — Tests physiologiques

> Lis CLAUDE.md. Reprendre exactement la même structure que les côtes (Measurement)
> et leur intégration dans les études — appliquer le même pattern de bout en bout.

## Modèle de données

**Nouvelle entité `PhysioTest`** — gérée par l'admin, CRUD identique aux côtes

- name, description?, isCommon, isActive
- `outputType` : enum `YES_NO | COMMENT | VALUE`
- Si `VALUE` : unit (mm, cm, degrés...), champs before/after comme les côtes
- Si `YES_NO` : résultat boolean avant/après
- Si `COMMENT` : champ texte libre avant/après
- Relation many-to-many avec `BikeType` (même logique que les côtes)

## Configuration par type de vélo

Même interface que les côtes : deux colonnes, drag and drop, tronc commun non modifiable.
Intégrer les tests physio dans la même page de configuration que les côtes
(section séparée dans la même vue, pas un nouvel onglet).

## Formulaire d'étude

Ajouter une étape "Tests physio" dans le stepper, après les mesures.
Afficher les tests selon le type de vélo sélectionné (tronc commun + spécifiques),
avec le bon champ de saisie selon l'outputType de chaque test.

## Rapport PDF et dossier patient

Afficher les résultats des tests dans le dossier patient et dans le rapport PDF,
dans la même logique avant/après que les côtes.

## Seed

Ajouter quelques tests physio d'exemple réalistes (ex : test de flexibilité,
mobilité de hanche, test genou/orteil).

## Validation

- npx tsc --noEmit
- Les 3 types d'output s'affichent correctement dans le formulaire
- Un test commun apparaît sur tous les types de vélo
- Les résultats sont visibles dans le dossier patient et le PDF
