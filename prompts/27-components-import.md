# Prompt 27 — Attributs de composants & import/export

> Lis CLAUDE.md.
> Même logique de configuration que les côtes (prompt 14) et les tests physio
> (prompt 17), appliquée aux attributs de composants.

## Partie A — Attributs configurables par catégorie

### Modèle de données

**Nouvelle entité `ComponentAttribute`** — gérée par l'admin

- `name` (ex: "Largeur constructeur"), `key` (slug technique, ex: `largeur_constructeur`)
- `category` — relation vers `ComponentCategory` : les attributs sont définis
  par catégorie de composant (Selle, Potence, Cintre...)
- `type` : enum `NUMBER | TEXT | BOOLEAN | SELECT`
- `unit` (optionnel, pour NUMBER — mm, cm, degrés...)
- `options` (string[], pour SELECT — ex: ["T", "V"] ou ["Plate", "Hamac"])
- `order`, `isRequired`, `isActive`

**Valeurs sur `BikeComponent`**

- Stocker les valeurs d'attributs en JSON (`attributes`) ou via une table de liaison
  `ComponentAttributeValue` — choisir selon ce qui rend le filtrage le plus simple
  (voir partie C : le filtrage par attribut est un besoin explicite)
- `brand` et `model` restent des champs de premier niveau sur `BikeComponent`,
  communs à toutes les catégories — pas des attributs

### Interface admin

Dans la bibliothèque, pour chaque catégorie de composant, une vue de configuration
des attributs (CRUD, réordonnable par drag and drop comme les côtes).

### Formulaire de composant

Le formulaire de création/édition d'un composant affiche dynamiquement les champs
selon les attributs configurés pour sa catégorie, avec le bon type d'input.

---

## Partie B — Import / export CSV

### Export

Bouton "Exporter" par catégorie de composant. Génère un CSV avec :

- Colonne `id` en première position — remplie pour les composants existants
- `marque`, `modele`
- `types_velo` — noms des `BikeType` associés, séparés par virgule
- Une colonne par attribut configuré pour cette catégorie, dans l'ordre défini
- Les valeurs SELECT et BOOLEAN exportées en texte lisible (ex: "Plate", "oui")

### Import

Deux modes d'entrée dans la même interface :

- Upload d'un fichier CSV
- Zone de collage (textarea) acceptant du contenu tab-séparé collé depuis
  Google Sheets ou Excel — souvent plus fluide que l'export/upload de fichier

**Règles de traitement**

- `id` présent et existant en base → mise à jour du composant
- `id` vide → création d'un nouveau composant
- `id` absent de la colonne (colonne supprimée par l'utilisateur) → fallback sur
  la clé naturelle `marque` + `modele` pour détecter les doublons
- **Aucune suppression sur import** — un composant présent en base mais absent du
  fichier reste en base. La suppression reste une action explicite dans l'interface
- Les lignes incomplètes (attributs manquants) sont acceptées avec un avertissement,
  pas rejetées — les attributs `isRequired` génèrent un warning, pas une erreur bloquante
- `types_velo` : rattacher aux `BikeType` existants par nom ; signaler en warning
  les noms inconnus sans bloquer l'import

### Écran de prévisualisation

Obligatoire avant validation. Afficher :

- Le nombre de lignes à créer / mettre à jour / ignorer
- Un tableau des lignes parsées avec les warnings signalés visuellement
- Possibilité d'exclure des lignes individuellement avant de valider
- Bouton de confirmation explicite

---

## Partie C — Filtrage par attribut

Dans la bibliothèque et dans l'étape sélection de composants du formulaire d'étude,
permettre de filtrer par valeurs d'attributs (ex: selles de largeur 145, profil Plate).
Les filtres disponibles se génèrent dynamiquement depuis les attributs configurés
de la catégorie affichée.

---

## Partie D — Seed initial : catégorie Selle

Pré-configurer la catégorie Selle avec ces attributs :

| name                 | key                    | type    | unit | options      |
| -------------------- | ---------------------- | ------- | ---- | ------------ |
| Largeur constructeur | `largeur_constructeur` | NUMBER  | mm   | —            |
| Largeur mesurée      | `largeur_mesuree`      | NUMBER  | mm   | —            |
| Longueur             | `longueur`             | NUMBER  | mm   | —            |
| Forme                | `forme`                | SELECT  | —    | T, V         |
| Profil               | `profil`               | SELECT  | —    | Plate, Hamac |
| Évasée               | `evasee`               | BOOLEAN | —    | —            |
| Épaisseur            | `epaisseur`            | SELECT  | —    | +, ++, +++   |
| Commentaire          | `commentaire`          | TEXT    | —    | —            |

Ajouter quelques selles d'exemple dans le seed (Fizik Vento, Selle Italia Flite Boost,
SMP Well5...) avec leurs valeurs d'attributs et leurs types de vélo associés,
pour que l'export produise un fichier non vide dès le premier test.

Les autres catégories (potence, cintre...) seront configurées plus tard par l'admin —
ne pas les pré-remplir.

---

## Validation

- npx tsc --noEmit
- L'admin peut ajouter un attribut à la catégorie Selle et le voir apparaître
  dans le formulaire de création de composant
- Export de la catégorie Selle → CSV avec la colonne id et les 8 attributs
- Réimport du même fichier sans modification → 0 création, N mises à jour
- Ajout d'une ligne sans id dans le fichier → 1 création après réimport
- Suppression d'une ligne du fichier → le composant reste en base
- Le collage depuis Google Sheets fonctionne comme l'upload CSV
- Filtrage par largeur et profil fonctionne dans la bibliothèque
