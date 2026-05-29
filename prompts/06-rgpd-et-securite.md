# Prompt 06 — RGPD & Sécurité

> À implémenter avant la mise en production.

---

## Ce que tu dois construire

### 1. Endpoints RGPD

**`app/api/gdpr/export/[patientId]/route.ts`**

```typescript
// GET — Export complet données patient
// Auth: Clerk session + role ADMIN
// Retourne: JSON avec patient + intake + studies + followups
// Headers: Content-Disposition: attachment; filename="export-[id].json"
// Audit log: action EXPORT
```

**`app/api/gdpr/anonymize/[patientId]/route.ts`**

```typescript
// DELETE — Anonymisation
// Auth: Clerk session + role ADMIN
// Actions:
//   - patient: email → "anonymized@velobile.fr", firstName → "Anonymisé", lastName → "Patient", phone → null
//   - patientIntake: delete (ou null tous les champs personnels)
//   - isAnonymized: true
// NE PAS supprimer: studies (mesures = données métier), followups (scores = données métier)
// Audit log: action ANONYMIZE
```

### 2. Middleware de rate limiting

Protéger les endpoints API publics (webhooks n8n) contre les abus :

```typescript
// middleware.ts — Ajouter rate limiting sur /api/*
// Utiliser: @upstash/ratelimit + @upstash/redis (si dispo)
// Ou: solution simple en mémoire pour MVP
// Limite: 100 req/min par IP sur les webhooks
```

### 3. Validation de l'origine n8n

```typescript
// lib/n8n.ts
export function verifyN8nRequest(req: NextRequest): boolean {
  const apiKey = req.headers.get("x-api-key");
  const expectedKey = process.env.N8N_API_KEY;
  
  if (!apiKey || !expectedKey) return false;
  
  // Comparaison en temps constant (évite timing attacks)
  const encoder = new TextEncoder();
  const a = encoder.encode(apiKey);
  const b = encoder.encode(expectedKey);
  
  if (a.length !== b.length) return false;
  
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a[i] ^ b[i];
  return result === 0;
}
```

### 4. Page paramètres RGPD — `app/(dashboard)/parametres/rgpd/page.tsx`

Interface ADMIN pour :
- Rechercher un patient
- Voir ses données (aperçu, pas le détail)
- Bouton "Exporter les données" → télécharge le JSON
- Bouton "Anonymiser" → confirmation modal avant action
- Liste des 20 dernières actions RGPD (depuis AuditLog)

### 5. Bannière de consentement

Dans le formulaire Google Form (géré côté n8n, pas dans l'app), s'assurer qu'une case de consentement est présente.

Dans l'app, ajouter dans le layout une note légale discrète sur le traitement des données.

### Règles

- Les endpoints RGPD ne sont accessibles qu'aux ADMIN
- Toute action RGPD doit créer un AuditLog
- L'anonymisation est irréversible — afficher une confirmation claire
- Les exports doivent être loggés même s'ils ne modifient pas les données
