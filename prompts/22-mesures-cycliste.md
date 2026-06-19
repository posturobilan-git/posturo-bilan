# Prompt 22 — Mesures du cycliste sur vélo & renommage

> Lis CLAUDE.md. S'applique à l'entité `Measurement` (prompt 14) et à son
> intégration dans le formulaire d'étude.

## Renommage des mesures existantes

Les mesures actuelles (hauteur de selle, recul, etc. — mesures prises sur le vélo
seul, avant/après réglage) sont à clarifier dans tout le code et l'affichage :

- Entité `Measurement` → renommer en affichage "Mesure du vélo" partout dans l'UI
  (labels, titres de section, placeholders). Le nom technique en DB peut rester
  `Measurement` ou devenir `BikeMeasurement` selon ce qui est le plus clair pour
  la suite — à toi de choisir mais sois cohérent dans tout le renommage.
- Les champs `before`/`after` de cette entité restent "Avant" / "Après réglage"

## Nouvelle entité — Mesures du cycliste sur vélo

Nouvelle entité distincte, **même structure de configuration que `Measurement`**
(CRUD admin, tronc commun, association à un ou plusieurs types de vélo, ordre,
drag and drop, `isRequired` — reprendre tout ce qui a été fait dans les prompts
14, 16 et 21 pour cette nouvelle entité).

- Nommer l'entité `RiderMeasurement` (affichage UI : "Mesure du cycliste sur vélo")
- Exemples de mesures : KOPS (Knee Over Pedal Spindle), angle genou en bas de
  pédalage, angle de tronc, etc. (unit en mm, cm, degrés comme les autres)
- **Différence clé avec `Measurement`** : avant et après sont saisis sur la
  **même page/étape du formulaire**, pas sur deux pages différentes. Probablement
  deux colonnes "Avant réglage" / "Après réglage" côte à côte pour chaque mesure,
  plutôt que deux étapes séparées du stepper.

## Formulaire d'étude — nouvelle étape

Ajouter "Mesure du cycliste sur vélo" comme étape distincte du stepper, après
"Mesure du vélo". Afficher chaque mesure avec ses deux champs avant/après
alignés horizontalement (ou en grille à deux colonnes), filtrées par tronc
commun + type de vélo sélectionné, dans l'ordre configuré, avec les mesures
obligatoires marquées d'un astérisque.

## Affichage du delta avant/après

Sur les deux types de mesures (`Measurement` et `RiderMeasurement`), une fois
les deux valeurs (avant et après) saisies, afficher le delta calculé :

- Format : `+5mm` ou `-3°` (signe explicite, unité de la mesure)
- Couleur neutre par défaut — pas de vert/rouge car une augmentation n'est pas
  forcément "positive" ou "négative" selon la mesure (à la différence d'un score
  de douleur par exemple)
- Affichage :
  - Sur la page "Mesure du cycliste sur vélo" : delta visible directement à côté
    de chaque ligne avant/après, puisque les deux sont saisis sur la même page
  - Sur la page "Mesure du vélo" : le delta n'a de sens qu'une fois "après" rempli,
    donc afficher dans la vue lecture (dossier patient, résumé de l'étude) plutôt
    que dans le formulaire de saisie lui-même si les deux étapes sont temporellement
    séparées — sinon directement si les deux champs sont sur le même écran
- Réutiliser le même composant d'affichage du delta pour les deux types de mesure

## Dossier patient et rapport PDF

Ajouter la section "Mesures du cycliste sur vélo" avec son tableau avant/après/delta,
à la suite de la section mesures du vélo existante.

## Seed

Ajouter un jeu de mesures cycliste réaliste (KOPS, angle genou, angle de tronc,
flexion coude...) avec tronc commun + quelques mesures spécifiques par type de vélo.

## Validation

- npx tsc --noEmit
- "Mesure du vélo" est bien identifiée comme distincte de "Mesure du cycliste sur vélo"
  partout dans l'UI
- La page "Mesure du cycliste sur vélo" affiche avant/après côte à côte sur le même écran
- Le delta s'affiche correctement avec signe et unité dès que les deux valeurs existent
- L'admin peut configurer les mesures cycliste de la même manière que les mesures vélo
  (tronc commun, types de vélo, ordre, obligatoire)
