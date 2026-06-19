# Prompt 23 — Étape douleurs & étape récap/bilan dans l'étude

> Lis CLAUDE.md.

## Contexte

Le formulaire d'intake patient capture déjà des douleurs déclarées en amont
(champ `injuries` sur `PatientIntake`, format string[] libre). On ajoute deux
nouvelles étapes au stepper de l'étude posturale :

1. Une étape "Douleurs" — évaluation subjective structurée, enrichie par le kiné
2. Une étape finale "Récapitulatif & bilan"

---

## 1. Nouvelle entité — Douleur structurée

Créer `StudyPain`, liée à `Study` (one-to-many — une étude peut avoir plusieurs
douleurs, comme dans le document de référence : Douleur 1, 2, 3...).

Champs (d'après la structure du document fourni) :

- `location` (string) — ex: "Hanches"
- `type` (string) — ex: "inflammatoires", "mécaniques"...
- `intensity` (string ou range) — ex: "4-5" sur une échelle /10. Stocker comme
  texte libre ou comme deux valeurs min/max selon ce qui est le plus simple à saisir
- `restAtRest` (boolean) — "Repos: oui/non" — la douleur est-elle présente au repos
- `activity` (string) — activité qui déclenche/affecte la douleur
- `duration` (string) — durée de la douleur
- `aggravatingFactors` (text) — "Ce qui ↑" — ce qui augmente la douleur
- `relievingFactors` (text) — "Ce qui ↓" — ce qui soulage la douleur
- `order` (int) — Douleur 1, 2, 3...

## 2. Étape "Douleurs" dans le stepper

Ajouter après l'étape intake/patient sidebar, avant les mesures (ou à l'endroit
le plus logique dans l'ordre actuel du stepper — à toi de juger selon le flux
existant).

**Pré-remplissage depuis l'intake**

- Si le patient a déclaré des douleurs dans `PatientIntake.injuries`, les
  pré-remplir comme première(s) douleur(s) structurée(s) (`location` rempli,
  reste à compléter par le kiné)
- Le kiné peut modifier ces douleurs pré-remplies et en ajouter de nouvelles

**UI**

- Pas de nombre de colonnes fixe — chaque douleur s'affiche comme une carte ou
  un bloc, l'agencement (colonnes, liste verticale, etc.) est laissé libre selon
  ce qui rend le mieux à l'usage, cohérent avec le responsive (prompt 12)
- Bouton "+ Ajouter une douleur" pour ajouter un bloc supplémentaire
- Bouton de suppression par douleur (sauf s'il n'en reste qu'une et qu'elle est vide)
- Tous les champs sont optionnels sauf `location`

## 3. Étape "Récapitulatif & bilan" (dernière étape du stepper)

**Section récap des côtes**

- Réutiliser le même composant d'affichage que la vue dossier patient pour les
  mesures du vélo et les mesures du cycliste sur vélo (avant/après/delta, prompts
  14 et 22) — lecture seule, pas de saisie à cette étape
- Inclure également un récap des tests physio renseignés (résultats + commentaires
  s'il y en a, prompt 17/21)

**Champs libres**

- `Study.summary` (text) — "Bilan" — synthèse libre du kiné
- `Study.recommendations` (text) — "Recommandations" — distinct des exercices
  prescrits (qui restent liés à la bibliothèque, prompt 03) ; ce champ est du
  texte libre pour des recommandations non standardisées

Cette étape précède la soumission finale de l'étude.

## 4. Dossier patient & rapport PDF

- Afficher la section douleurs structurées dans le dossier patient, à côté ou à
  la suite des données d'intake
- Ajouter la section douleurs + bilan + recommandations libres dans le rapport PDF

## Validation

- npx tsc --noEmit
- Les douleurs déclarées à l'intake apparaissent pré-remplies dans l'étape Douleurs
- Le kiné peut ajouter/modifier/supprimer des douleurs librement
- L'étape récap affiche les côtes, mesures cycliste et tests physio en lecture seule
- Les champs bilan et recommandations sont sauvegardés et visibles dans le dossier et le PDF
