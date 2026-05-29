# Prompt 07 — Debug / Fix

> Template à compléter et copier dans Claude Code quand tu as un bug.

---

Lis **CLAUDE.md** avant de commencer.

## Contexte du bug

**Fichier concerné :** `[chemin/vers/fichier.ts]`

**Comportement attendu :**
[Décris ce qui devrait se passer]

**Comportement observé :**
[Décris ce qui se passe réellement]

**Message d'erreur (si applicable) :**
```
[Colle l'erreur ici]
```

**Étapes pour reproduire :**
1. [Étape 1]
2. [Étape 2]

## Contraintes

- Ne pas modifier le schéma Prisma sans m'en avertir d'abord
- Ne pas changer les interfaces Zod (ça casse les Server Actions)
- Respecter les patterns définis dans CLAUDE.md

## Ce que je veux

1. Identifier la cause racine du bug
2. Proposer un fix minimal
3. Vérifier avec `npx tsc --noEmit` après le fix
4. Me dire si d'autres parties du code pourraient avoir le même problème
