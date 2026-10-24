# Prompt 28 — Retours du kiné (premiers tests)

> Lis CLAUDE.md. Trois ajustements de code indépendants, commit entre chaque.

---

## 1. Tronc commun réordonnable librement

Remplace le point 4 du prompt 21 (tronc commun global, toujours affiché en premier).

- Dans la configuration d'un type de vélo, les éléments du tronc commun sont dans la
  **même liste ordonnée** que les éléments spécifiques et peuvent être placés n'importe où.
  Drag and drop + flèches haut/bas.
- L'ordre devient propre à chaque type de vélo (ordre par type de vélo × élément, tronc
  commun inclus). Un élément commun reste toujours présent sur tous les types — on ne peut
  pas le retirer, seule sa position change. Badge "Commun" pour le distinguer.
- Migration : initialiser l'ordre de chaque type de vélo depuis l'ordre global actuel, pour
  que rien ne bouge tant que l'admin ne réordonne pas. Nouvel élément commun → ajouté en
  fin de liste de chaque type. Nouveau type de vélo → part de l'ordre par défaut actuel.
- S'applique aux mesures du vélo, mesures du cycliste et tests physio (pour les tests :
  ordre au sein de chaque section). Formulaire d'étude, récap, dossier patient et PDF
  lisent tous cet ordre unique.

---

## 2. Gestion des catégories d'exercices

- `ExerciseCategory` passe d'enum à entité (name, order, isActive), avec CRUD admin dans
  l'onglet Exercices de la bibliothèque : ajouter, renommer, réordonner, désactiver.
  Suppression uniquement si aucun exercice rattaché, sinon proposer de les réaffecter.
- Migration sans perte : une ligne par valeur d'enum existante (Souplesse, Renforcement,
  Mobilité, Proprioception, Autre), exercices existants rattachés.
- Adapter filtres, sélecteur d'exercices de l'étude, stats, PDF et seed.
- Vérifier que le CRUD exercice est complet (création, modification, désactivation,
  suppression si jamais prescrit) et compléter si besoin.

---

## 3. Téléphone obligatoire

- Zod : `phone` requis, validé et normalisé (France par défaut, `libphonenumber-js`,
  stockage en E.164) sur la création et l'édition patient, ainsi que dans le formulaire
  d'accueil `/accueil/[token]` (soumission impossible sans téléphone). Astérisque dans
  les modales.
- **La colonne reste nullable en base** : un patient créé par le webhook Cal.com n'a pas
  forcément de téléphone au départ, et des patients existants n'en ont pas. Le webhook
  récupère le téléphone s'il est présent dans la réservation (ne pas supposer sa présence),
  sinon c'est le formulaire d'accueil qui le collecte.
- Patients existants sans téléphone : aucun blocage, mais indicateur "Téléphone manquant"
  dans le dossier, et champ exigé à la prochaine modification.

---

## Validation

- npx tsc --noEmit
- Un élément commun peut être placé au milieu des éléments spécifiques d'un type de vélo,
  sans effet sur les autres types ; le formulaire d'étude respecte cet ordre
- L'admin crée, renomme et désactive une catégorie d'exercices ; les exercices existants
  sont intacts après migration
- Création d'un patient sans téléphone → refusée ; formulaire d'accueil sans téléphone → refusé
