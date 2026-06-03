# Prompt 13 — Type de vélo & multi-études (refacto structurel)

> Lis CLAUDE.md avant de commencer. Refacto important du modèle de données.
> Préserve les données existantes si possible, sinon drop tout et recrée un seed propre.
> Mets à jour CLAUDE.md, ARCHITECTURE.md, le seed et les docs après le refacto.

## Objectif

Un patient peut avoir plusieurs vélos donc plusieurs études. Le statut du cycle
de vie passe du patient vers l'étude.

## Modèle de données cible

**Nouvelle entité `BikeType`** (gérée par l'admin, CRUD comme les exercices)

- name (Route, VTT, Gravel, Triathlon...), isActive
- L'admin peut ajouter/modifier/désactiver des types depuis une nouvelle page bibliothèque

**`Study`** (renommer/restructurer l'actuel PostureStudy)

- Relation : un Patient → plusieurs Study
- Chaque Study a un `bikeType` (relation vers BikeType)
- Chaque Study porte son propre `status` : study_pending → study_completed → report_sent → followup_pending → followup_completed
- Conserve measures (JSON), composants, exercices, reportUrl

**`Patient`**

- Supprimer le champ `status`
- Garde la relation `intake` (données de la personne, remplies une fois)
- La vue patient affiche désormais le nombre d'études, plus de statut

## Changements applicatifs

1. **Vue patients** (`/patients`) — retirer le statut, ajouter une colonne "Nombre d'études"
2. **Nouvelle vue études** (`/etudes`) — liste de toutes les études tous patients confondus, avec leur statut, type de vélo, patient associé, filtrable par statut. Ajouter l'entrée dans la sidebar.
3. **Dossier patient** — afficher la liste des études du patient (une carte par étude avec son vélo et son statut), bouton "Nouvelle étude"
4. **Création d'étude** — sélection du type de vélo en première étape
5. Adapter dashboard, stats, machine à états, Server Actions et docs/API.md en conséquence

## Migration

Tente de préserver les données : créer les BikeType de base, migrer chaque patient
ayant une étude vers le nouveau modèle. Si la migration est trop risquée, drop la base
et régénère un seed propre avec types de vélo, quelques patients et études d'exemple
cohérentes.

## Validation

- npx tsc --noEmit
- Un patient peut avoir 2+ études avec des vélos différents
- La vue /etudes liste toutes les études avec leur statut
- La vue /patients montre le nombre d'études sans statut
