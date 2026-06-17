# Prompt 21 — Ajustements tests physio & mesures

> Lis CLAUDE.md. S'applique aux entités `Measurement` et `PhysioTest`
> (prompts 14 et 17) et à leurs interfaces de configuration.

## 1. Sections pour les tests physio

Ajouter une notion de section/catégorie aux tests physio (ex : Genou, Hanche,
Tests dynamiques, Tronc commun...).

- Nouvelle entité `PhysioTestSection` (ou simple enum si la liste reste fixe — à toi de juger selon le besoin de personnalisation par l'admin) : name, order
- Chaque `PhysioTest` appartient à une section
- Dans le formulaire d'étude, regrouper les tests par section avec un titre de groupe
- Dans la bibliothèque/configuration, permettre de filtrer ou grouper par section

## 2. Output positif/négatif pour les tests physio

Ajouter une nouvelle valeur à l'enum `outputType` : `POSITIVE_NEGATIVE`
(distinct de `YES_NO` — sémantique clinique différente, ex: test positif = signe clinique présent).
Afficher ce choix comme deux boutons toggle "Positif" / "Négatif" dans le formulaire,
avant/après comme les autres outputs.

## 3. Accordéon pour les commentaires

Dans le formulaire d'étude, pour chaque test physio ayant un commentaire
(qu'il soit du type `COMMENT` ou qu'un champ commentaire optionnel soit ajouté
à tous les types de test), afficher le champ commentaire dans un accordéon
repliable par défaut ("Ajouter un commentaire ▾") plutôt que toujours visible.
Si un commentaire existe déjà, l'accordéon s'ouvre par défaut.

## 4. Drag and drop sur le tronc commun

Actuellement le tronc commun (mesures et tests communs à tous les types de vélo)
n'est pas réordonnable. Étendre l'interface de configuration (prompt 16, point 1)
pour permettre le drag and drop également sur les côtes/tests du tronc commun,
pas seulement sur ceux spécifiques à un type de vélo. L'ordre du tronc commun
doit être global (pas par type de vélo) et s'appliquer en premier dans le formulaire,
avant les côtes/tests spécifiques.

## 5. Mesures et tests obligatoires

Ajouter un champ `isRequired` (boolean) sur `Measurement` et `PhysioTest`,
configurable dans l'interface admin (toggle dans la configuration de chaque côte/test).
Dans le formulaire d'étude :

- Les champs marqués obligatoires affichent un astérisque
- Validation Zod dynamique : impossible de soumettre l'étude si une mesure/test
  obligatoire n'a pas de valeur (au moins le champ "avant" — "après" reste optionnel
  tant que l'étude n'est pas en cours de suivi)
- Message d'erreur explicite listant les champs manquants

## Validation

- npx tsc --noEmit
- Les tests physio sont groupés par section dans le formulaire
- Un test en POSITIVE_NEGATIVE affiche les deux boutons toggle
- Les commentaires sont dans un accordéon fermé par défaut (ouvert si déjà rempli)
- Le tronc commun est réordonnable par drag and drop, son ordre est respecté en premier
- Une étude avec une mesure obligatoire vide ne peut pas être soumise
- Le seed reflète les sections, le isRequired et au moins un test POSITIVE_NEGATIVE
