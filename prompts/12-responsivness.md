# Prompt 12 — Design responsive

> Lis CLAUDE.md avant de commencer.

---

## Règle absolue

Le design desktop ne doit pas changer. Ajouter uniquement des classes Tailwind
responsives sans préfixe ou `md:` — ne jamais modifier une classe `lg:` existante.

---

## Consignes générales à appliquer sur toute l'application

**Sidebar**
Cachée sur mobile. Remplacée par une topbar avec bouton hamburger qui ouvre
un drawer latéral avec overlay. Fermeture au clic sur l'overlay ou sur un lien nav.

**Grilles**

- `grid-cols-4` → `grid-cols-2 lg:grid-cols-4`
- `grid-cols-3` → `grid-cols-1 md:grid-cols-3`
- `grid-cols-2` → `grid-cols-1 md:grid-cols-2`

**Tables**
Remplacées par des cartes empilées sur mobile (`hidden md:block` pour la table,
`block md:hidden` pour les cartes). Les cartes affichent les informations essentielles
avec les actions en bas.

**Modales**
Bottom sheet sur mobile (ancrée en bas, `rounded-t-2xl`, `max-h-[90vh]`).
Modale centrée classique sur desktop (`sm:rounded-xl sm:max-w-lg`).

**Formulaires multi-colonnes**
Passer en colonne unique sur mobile. Les sidebars de référence (ex: fiche patient)
passent en accordéon collapsible au-dessus du formulaire.

**Padding et spacing**
Réduire sur mobile : `p-3 lg:p-5`, `gap-2 lg:gap-4`, `px-3 lg:px-5`.

**Texte et boutons**
Les boutons d'action dans les headers passent en pleine largeur sur mobile (`w-full sm:w-auto`).
Les titres longs tronqués avec `truncate`.

---

## Validation

Tester aux breakpoints 375px, 768px et desktop.
Aucune scrollbar horizontale ne doit apparaître sur mobile.
