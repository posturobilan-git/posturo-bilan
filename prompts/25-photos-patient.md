# Prompt 25 — Upload de photos patient avant/après (palier 2)

> Lis CLAUDE.md. Ce prompt couvre uniquement l'upload et l'affichage des photos,
> pas l'estimation automatique d'angles sur la photo (voir prompt 26 — plus ambitieux,
> à valider séparément).

## Objectif

Permettre au kiné d'ajouter des photos du patient sur le vélo (avant et après réglage)
dans une étude. Pas de calcul automatique à ce stade — uniquement stockage et affichage
côte à côte.

## Modèle de données

Nouvelle entité `StudyPhoto`, liée à `Study` (one-to-many) :

- `url` (string) — Vercel Blob
- `phase` (enum : `BEFORE | AFTER`)
- `angle` (enum : `SIDE | FRONT | BACK`, optionnel — utile pour comparer le même angle)
- `caption` (string, optionnel)
- `order` (int)

## Upload

- Composant `components/study/PhotoUpload.tsx` — upload direct vers Vercel Blob
  depuis le navigateur (signed upload, éviter de transiter par le serveur Next.js
  pour des fichiers lourds)
- Accepter JPEG/PNG/HEIC, limiter à 10 Mo par fichier, redimensionner côté client
  avant upload si l'image dépasse 2000px de large (économie de stockage)
- Multi-upload (plusieurs photos à la fois)

## Étape dans le formulaire d'étude

Ajouter une étape "Photos" (avant les mesures ou en fin de formulaire — cohérent
avec le flux temporel avant/après déjà en place pour les mesures vélo).
Deux zones de dépôt : "Photos avant réglage" / "Photos après réglage".

## Affichage comparatif

- Dans le dossier patient et le récap de l'étude (prompt 23) : affichage côte à
  côte avant/après
- Dans le rapport PDF : insérer les photos avant/après dans la section bilan

## RGPD

Les photos sont des données personnelles sensibles. S'assurer que :

- L'anonymisation RGPD (prompt 06) supprime aussi les photos du patient
- Les URLs Vercel Blob ne sont pas publiques par défaut (accès signé ou via l'app uniquement)

## Validation

- npx tsc --noEmit
- Upload de plusieurs photos avant et après dans une étude
- Affichage côte à côte dans le dossier patient
- Photos présentes dans le PDF généré
- Anonymisation d'un patient supprime ses photos
