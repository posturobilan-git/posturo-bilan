# Prompt 04 — Génération PDF & envoi email

> Utiliser après le prompt 03. Lis CLAUDE.md avant de commencer.

---

## Contexte

L'étude posturale peut être soumise. Tu dois maintenant implémenter la génération du rapport PDF et son envoi par email au patient (Phase 3).

## Ce que tu dois construire

### 1. Template PDF — `components/pdf/ReportTemplate.tsx`

Utilise `@react-pdf/renderer`. Le rapport doit contenir :

**Page 1 — En-tête et informations patient**
- Logo VéloBilan + nom du cabinet
- Informations patient (nom, date de l'étude, kiné)
- Résumé des données d'intake (morphologie, type de vélo, douleurs initiales)

**Page 2 — Mesures posturales**
- Tableau de toutes les mesures avec valeurs avant/après (si disponible)
- Composants modifiés pendant l'étude (liste avec marque et modèle)
- Observations du kiné

**Page 3 — Plan d'exercices**
- Liste des exercices prescrits avec description et fréquence
- Espace pour notes du patient

**Design :**
- Couleurs : teal `#1D9E75` pour les en-têtes, gris clair pour les séparateurs
- Police : Helvetica (intégrée dans @react-pdf/renderer, pas besoin d'import)
- Format A4, marges 20mm

### 2. Server Action — `actions/report.actions.ts`

```typescript
"use server";

export async function generateReport(studyId: string) {
  // 1. Récupérer l'étude avec toutes ses relations (patient, mesures, composants, exercices)
  // 2. Vérifier auth + permissions
  // 3. Générer le PDF avec @react-pdf/renderer (renderToBuffer)
  // 4. Uploader sur Vercel Blob
  //    import { put } from "@vercel/blob";
  //    const { url } = await put(`reports/${studyId}.pdf`, buffer, { access: "public" });
  // 5. Mettre à jour study.reportUrl + study.reportSentAt
  // 6. Envoyer email au patient via Resend (avec PDF en pièce jointe)
  // 7. Mettre à jour statut patient → "report_sent"
  // 8. Créer audit log
  // 9. Déclencher suivi J+30 dans n8n si configuré
  //    (optionnel MVP — peut être un cron n8n qui poll l'état)
}
```

### 3. Template email — `lib/emails/ReportEmail.tsx`

Email React (Resend supporte les composants React) :
- Objet : "Votre rapport d'étude posturale est disponible"
- Corps : message chaleureux, résumé des ajustements principaux
- Bouton "Télécharger mon rapport" → lien Vercel Blob
- Rappel des exercices prescrits (liste courte)
- Signature du kiné

### 4. Endpoint optionnel — `app/api/reports/generate/route.ts`

Route POST pour déclencher la génération depuis n8n si besoin.
Même logique que la Server Action mais accessible via HTTP.

### Règles

- Le PDF doit être généré côté serveur (pas côté client)
- Le lien Vercel Blob doit être public (le patient accède sans auth)
- En cas d'erreur de génération, le statut ne doit PAS changer
- Logger tout dans l'audit log

### Validation

```bash
# Créer une étude de test via Prisma Studio
# Déclencher generateReport(studyId) depuis un test
# Vérifier que le PDF apparaît dans Vercel Blob
# Vérifier que l'email est reçu
```
