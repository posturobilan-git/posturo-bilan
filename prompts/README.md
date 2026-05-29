# Prompts Claude Code — Guide d'utilisation

## Comment ça marche

Ces prompts sont des instructions structurées à coller dans Claude Code pour lui donner une mission précise et autonome.

**Lancement :**
```bash
cd velobile/
claude  # Lance Claude Code dans le repo
```

Claude Code lira automatiquement `CLAUDE.md` au démarrage.

## Ordre d'utilisation

| Prompt | Mission | Durée estimée |
|--------|---------|---------------|
| `01-setup-project.md` | Structure, dépendances, fichiers de base | 30-45 min |
| `02-patient-pipeline.md` | Webhook intake, dashboard, dossier patient | 45-60 min |
| `03-etude-posturale.md` | Formulaire d'étude (cœur de l'app) | 60-90 min |
| `04-rapport-pdf.md` | Génération PDF + envoi email | 30-45 min |
| `05-bibliotheque.md` | Bibliothèque exercices & composants | 30-45 min |
| `06-rgpd-et-securite.md` | RGPD, anonymisation, rate limiting | 30-45 min |
| `07-debug-fix.md` | Template à compléter en cas de bug | — |

## Bonnes pratiques

**Avant chaque session Claude Code :**
1. Vérifier que les migrations Prisma sont à jour : `npx prisma migrate status`
2. Lancer un check TypeScript : `npx tsc --noEmit`
3. S'assurer que l'app tourne : `npm run dev`

**Pendant la session :**
- Si Claude Code propose une modification du schéma Prisma, reviewer avant d'accepter
- Les Server Actions ne doivent jamais être dans des fichiers `page.tsx`
- Demander une vérification TypeScript après chaque prompt : `npx tsc --noEmit`

**Après chaque session :**
```bash
git add -A
git commit -m "feat: [description de ce qui a été fait]"
```

## Commandes utiles Claude Code

```bash
# Dans Claude Code, tu peux dire :
"Lis CLAUDE.md et dis-moi ce qui manque dans la structure actuelle"
"Lance npx tsc --noEmit et corrige toutes les erreurs TypeScript"
"Vérifie que tous les endpoints API ont bien une vérification d'auth"
"Crée une migration Prisma pour [changement de schema]"
```
