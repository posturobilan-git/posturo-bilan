# Prompt 20 — Intégration Cal.com

> Lis CLAUDE.md.
> Supprimer toute référence à Calendly dans le code, les docs et `.env.example`.

## Installation

```bash
npm install @calcom/embed-react
```

## Page de réservation — `app/(dashboard)/reservation/page.tsx`

Page accessible à tous les rôles. Entrée dans la sidebar.
Composant obligatoirement Client Component (`"use client"`) sinon l'embed ne monte pas.

```tsx
"use client";
import Cal, { getCalApi } from "@calcom/embed-react";
import { useEffect } from "react";

export default function ReservationPage() {
  useEffect(() => {
    (async () => {
      const cal = await getCalApi({ namespace: "etude-posturale" });
      cal("ui", { hideEventTypeDetails: false, layout: "month_view" });
    })();
  }, []);

  return (
    <Cal
      namespace="etude-posturale"
      calLink={process.env.NEXT_PUBLIC_CAL_LINK!}
      style={{ width: "100%", height: "100%", minHeight: 600 }}
      config={{ layout: "month_view" }}
    />
  );
}
```

## Webhook — `app/api/webhooks/cal/route.ts`

Le `kineId` est passé en query param dans l'URL du webhook — un Event Type Cal.com
par kiné, chacun avec son propre lien webhook :
`https://ton-app.vercel.app/api/webhooks/cal?kineId=uuid-du-kiné`

```typescript
import { createHmac } from "crypto";

function verifySignature(payload: string, signature: string): boolean {
  const hmac = createHmac("sha256", process.env.CAL_WEBHOOK_SECRET!);
  return hmac.update(payload).digest("hex") === signature;
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-cal-signature-256") ?? "";

  if (!verifySignature(rawBody, signature)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { triggerEvent, payload } = JSON.parse(rawBody);
  if (triggerEvent !== "BOOKING_CREATED")
    return new Response("OK", { status: 200 });

  const kineId = new URL(req.url).searchParams.get("kineId");
  if (!kineId) return new Response("kineId manquant", { status: 400 });

  const { attendee } = payload;

  // upsert patient + sendIntakeEmail(patientId)
  // même logique que le prompt 19
}
```

## Variables d'environnement

Ajouter dans `.env.example`, supprimer `CALENDLY_WEBHOOK_SECRET` :

```bash
NEXT_PUBLIC_CAL_LINK="ton-username/etude-posturale"
CAL_WEBHOOK_SECRET="secret_depuis_cal_com"
```

## Validation

- npx tsc --noEmit
- La page /reservation affiche le calendrier Cal.com
- POST sur /api/webhooks/cal?kineId=uuid avec payload BOOKING_CREATED → patient créé
- Signature invalide → 401
- kineId absent → 400
- Aucune référence à Calendly dans le code ou les docs
