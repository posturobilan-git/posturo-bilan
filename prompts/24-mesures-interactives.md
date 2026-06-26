# Prompt 24 — Saisie sur schémas interactifs (palier 1)

> Lis CLAUDE.md. Ce prompt couvre uniquement la saisie sur schémas statiques
> (vélo et silhouette type), pas l'upload de photo patient (voir prompt 25).

## Objectif

Remplacer la liste de champs texte par une saisie visuelle : un schéma SVG
(vélo de profil, silhouette cycliste, pieds) avec des points cliquables
correspondant à chaque mesure existante. Cliquer un point ouvre un input
(avant/après) à côté ou dans une bulle, au lieu de faire défiler une longue liste.

## Modèle de données

Ajouter à `Measurement` et `RiderMeasurement` :

- `schemaX`, `schemaY` (float, optionnels) — position en pourcentage (0-100)
  du point sur le schéma de référence associé
- `schemaType` (enum : `BIKE_SIDE | RIDER_BODY | FOOT`) — quel schéma de référence
  utiliser pour positionner ce point

L'admin configure la position du point en plus du reste (unité, tronc commun,
types de vélo...) dans l'interface de configuration existante (prompts 14, 16).

## Composant schéma interactif — `components/study/InteractiveSchema.tsx`

- SVG de base par `schemaType` (vélo de profil, silhouette de cycliste sur vélo,
  empreintes de pieds — réutiliser/adapter le style des schémas vus en référence)
- Points cliquables positionnés en `absolute` selon `schemaX`/`schemaY` (%)
- Un point sans valeur saisie est visuellement neutre, un point rempli est mis
  en évidence (couleur, check)
- Clic sur un point → popover avec les champs avant/après pour cette mesure
- Vue tabulaire classique conservée en option (bouton toggle "Vue schéma / Vue liste")
  pour les kinés qui préfèrent saisir au clavier sans souris

## Interface admin — positionnement des points

Dans la configuration d'une côte (prompts 14/16), ajouter un mode "Positionner sur
le schéma" : afficher le schéma correspondant, l'admin clique à l'endroit voulu pour
définir `schemaX`/`schemaY`. Mesures sans position définie restent dans la vue liste
uniquement (fallback).

## Formulaire d'étude

Remplacer (ou proposer en alternative via toggle) l'étape de saisie des mesures
vélo et mesures cycliste par le schéma interactif correspondant.

## Validation

- npx tsc --noEmit
- L'admin peut positionner un point sur le schéma vélo pour une côte donnée
- Le kiné peut cliquer un point dans le formulaire d'étude et saisir avant/après
- Le toggle vue schéma / vue liste fonctionne
- Les mesures sans position définie restent accessibles en vue liste
