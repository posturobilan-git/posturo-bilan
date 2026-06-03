# Prompt 16 — Améliorations UX

> Lis CLAUDE.md. Applique chaque point sur toute l'application.

## 1. Configuration des études par type de vélo

Remplacer le système de "position" par une interface de configuration visuelle :

- Page dédiée à la configuration d'un type de vélo (accessible depuis la bibliothèque)
- Afficher deux colonnes : "Côtes disponibles" (bibliothèque complète) et "Côtes de cette étude" (sélectionnées)
- Le tronc commun est toujours visible et non modifiable dans la colonne de droite
- Drag and drop entre les deux colonnes pour ajouter/retirer des côtes, avec boutons +/− en fallback pour mobile
- L'ordre dans la colonne de droite détermine l'ordre d'affichage dans le formulaire — drag and drop pour réordonner
- Supprimer complètement le champ "position" de l'entité Measurement, remplacé par l'ordre défini dans la configuration

## 2. Bibliothèque — regroupement des onglets

Fusionner les onglets "Types de vélo" et "Côtes" en une seule vue cohérente :

- Un seul onglet "Configuration des études" qui liste les types de vélo
- Cliquer sur un type de vélo ouvre sa configuration (point 1)
- Les côtes ne sont plus un onglet séparé mais un panneau accessible depuis la configuration

## 3. Recherche — corriger le placeholder

Remplacer "Rechercher par nom ou email" par un placeholder contextuel selon la page :

- Patients : "Rechercher un patient..."
- Études : "Rechercher une étude..."
- Exercices : "Rechercher un exercice..."
- Composants : "Rechercher un composant..."
- Côtes : "Rechercher une côte..."
  Appliquer sur tous les champs de recherche de l'application.

## 4. Tables — pagination et tri

Appliquer sur toutes les tables de l'application (patients, études, exercices, composants) :

**Pagination**

- 10 résultats par page par défaut
- Contrôles : précédent / suivant + numéros de page + sélecteur "X par page" (10, 25, 50)
- Côté serveur (query Prisma avec `skip` et `take`)

**Tri**

- Colonnes triables : cliquer sur l'en-tête alterne asc/desc, affiche une flèche indicatrice
- Colonnes à rendre triables par défaut : date de création, nom, statut
- État de tri dans l'URL (searchParams) pour que le lien soit partageable

## Validation

- npx tsc --noEmit
- Tester le drag and drop sur desktop et les boutons +/− sur mobile (375px)
- Vérifier que la pagination fonctionne avec un grand dataset (seed 50+ entrées si besoin)
- Aucune mention de "position" ne doit subsister dans l'UI
