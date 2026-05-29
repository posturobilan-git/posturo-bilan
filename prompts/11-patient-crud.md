# Prompt 11 — Patient CRUD rework

> Lis CLAUDE.md avant de commencer.

---

## Règles métier

| Action               | KINE                              | ADMIN                                  |
| -------------------- | --------------------------------- | -------------------------------------- |
| Créer un patient     | ✅ assigné à lui-même             | ✅ peut assigner à n'importe quel kiné |
| Modifier un patient  | ✅ seulement ses propres patients | ✅ tous les patients                   |
| Supprimer un patient | ✅ seulement ses propres patients | ✅ tous les patients                   |
| Voir un patient      | ✅ seulement ses propres patients | ✅ tous les patients                   |

**Ownership check** : avant toute mutation, vérifier que `patient.kineId === currentUser.id` ou que `currentUser.role === "ADMIN"`. Lever une erreur si ce n'est pas le cas.

---

## Étape 1 — Helper d'ownership

Ajouter dans `lib/auth.ts` :

```typescript
// Vérifie que le kiné connecté peut modifier ce patient
// Lève une erreur sinon — à appeler dans chaque mutation patient
export async function requirePatientOwnership(patientId: string) {
  const user = await requireKine();

  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { id: true, kineId: true },
  });

  if (!patient) throw new Error("Patient introuvable.");

  if (user.role !== "ADMIN" && patient.kineId !== user.id) {
    throw new Error("Accès refusé — ce patient ne vous est pas assigné.");
  }

  return { user, patient };
}
```

---

## Étape 2 — Schéma Zod patient

Créer `lib/validations/patient.schema.ts` :

```typescript
import { z } from "zod";

export const createPatientSchema = z.object({
  firstName: z.string().min(1, "Prénom requis").max(100),
  lastName: z.string().min(1, "Nom requis").max(100),
  email: z.string().email("Email invalide"),
  phone: z.string().optional(),
  // Champ ADMIN uniquement — assigner à un autre kiné
  kineId: z.string().uuid().optional(),
});

export const updatePatientSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
```

---

## Étape 3 — Server Actions

Remplacer / compléter `actions/patient.actions.ts` :

```typescript
"use server";

import { requireKine, requirePatientOwnership } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import {
  createPatientSchema,
  updatePatientSchema,
} from "@/lib/validations/patient.schema";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// ─── CREATE ──────────────────────────────────────────────────────────────────

export async function createPatient(data: CreatePatientInput) {
  const user = await requireKine();

  const validated = createPatientSchema.parse(data);

  // Un KINE ne peut créer que pour lui-même
  // Un ADMIN peut spécifier un kineId différent
  const assignedKineId =
    user.role === "ADMIN" && validated.kineId ? validated.kineId : user.id;

  const patient = await prisma.patient.create({
    data: {
      firstName: validated.firstName,
      lastName: validated.lastName,
      email: validated.email,
      phone: validated.phone,
      kineId: assignedKineId,
      status: "intake_pending",
    },
  });

  await logAudit({
    userId: user.id,
    action: "CREATE",
    entity: "patient",
    entityId: patient.id,
  });

  revalidatePath("/patients");
  return patient;
}

// ─── UPDATE ──────────────────────────────────────────────────────────────────

export async function updatePatient(
  patientId: string,
  data: UpdatePatientInput,
) {
  const { user } = await requirePatientOwnership(patientId);

  const validated = updatePatientSchema.parse(data);

  const updated = await prisma.patient.update({
    where: { id: patientId },
    data: validated,
  });

  await logAudit({
    userId: user.id,
    action: "UPDATE",
    entity: "patient",
    entityId: patientId,
    metadata: { fields: Object.keys(validated) },
  });

  revalidatePath(`/patients/${patientId}`);
  revalidatePath("/patients");
  return updated;
}

// ─── DELETE ──────────────────────────────────────────────────────────────────

export async function deletePatient(patientId: string) {
  const { user, patient } = await requirePatientOwnership(patientId);

  // Bloquer la suppression si une étude posturale existe déjà
  // Les données cliniques ne doivent pas être perdues accidentellement
  const studyCount = await prisma.postureStudy.count({
    where: { patientId },
  });

  if (studyCount > 0) {
    throw new Error(
      `Impossible de supprimer ce patient — ${studyCount} étude(s) posturale(s) sont associées. Utilisez l'anonymisation RGPD à la place.`,
    );
  }

  // Suppression en cascade (intake + followups sans étude)
  await prisma.patient.delete({ where: { id: patientId } });

  await logAudit({
    userId: user.id,
    action: "DELETE",
    entity: "patient",
    entityId: patientId,
    metadata: { email: patient.id }, // ne pas logger l'email en clair
  });

  revalidatePath("/patients");
  redirect("/patients");
}
```

> **Note sur la suppression** : si le patient a des études posturales, la suppression est bloquée.
> Dans ce cas, orienter vers l'anonymisation RGPD (prompt 06). Cela protège les données cliniques
> tout en respectant la demande de suppression des données personnelles.

---

## Étape 4 — Modale de création patient

### `components/patients/CreatePatientModal.tsx`

Modale avec un formulaire simple. Accessible depuis la liste patients et le dashboard.

```tsx
"use client";

import { useTransition } from "react";
import { createPatient } from "@/actions/patient.actions";

export function CreatePatientModal({
  open,
  onClose,
  kines, // liste des kinés — passée uniquement si ADMIN
  currentUserRole,
}: {
  open: boolean;
  onClose: () => void;
  kines?: { id: string; name: string }[];
  currentUserRole: string;
}) {
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = {
      firstName: form.firstName.value,
      lastName: form.lastName.value,
      email: form.email.value,
      phone: form.phone.value || undefined,
      kineId: form.kineId?.value || undefined,
    };

    startTransition(async () => {
      try {
        await createPatient(data);
        onClose();
      } catch (err: any) {
        alert(err.message); // remplacer par toast
      }
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Nouveau patient">
      <form onSubmit={handleSubmit}>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          <Field name="firstName" label="Prénom *" required />
          <Field name="lastName" label="Nom *" required />
        </div>
        <Field name="email" label="Email *" type="email" required />
        <Field name="phone" label="Téléphone" type="tel" />

        {/* Sélecteur de kiné — ADMIN uniquement */}
        {currentUserRole === "ADMIN" && kines && (
          <div>
            <label>Assigner à</label>
            <select name="kineId">
              {kines.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            marginTop: 16,
          }}
        >
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Création..." : "Créer le patient"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
```

---

## Étape 5 — Modale d'édition patient

### `components/patients/EditPatientModal.tsx`

Même structure que la création mais pré-remplie avec les données actuelles.

```tsx
"use client";

export function EditPatientModal({
  patient,
  open,
  onClose,
}: {
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
  open: boolean;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    startTransition(async () => {
      try {
        await updatePatient(patient.id, {
          firstName: form.firstName.value,
          lastName: form.lastName.value,
          email: form.email.value,
          phone: form.phone.value || undefined,
        });
        onClose();
      } catch (err: any) {
        alert(err.message);
      }
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Modifier le patient">
      <form onSubmit={handleSubmit}>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          <Field
            name="firstName"
            label="Prénom *"
            defaultValue={patient.firstName}
            required
          />
          <Field
            name="lastName"
            label="Nom *"
            defaultValue={patient.lastName}
            required
          />
        </div>
        <Field
          name="email"
          label="Email *"
          type="email"
          defaultValue={patient.email}
          required
        />
        <Field
          name="phone"
          label="Téléphone"
          type="tel"
          defaultValue={patient.phone}
        />
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            marginTop: 16,
          }}
        >
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
```

---

## Étape 6 — Bouton de suppression avec confirmation

### `components/patients/DeletePatientButton.tsx`

```tsx
"use client";

export function DeletePatientButton({ patientId }: { patientId: string }) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (
      !confirm(
        "Supprimer ce patient ? Cette action est irréversible si aucune étude n'existe.",
      )
    )
      return;

    startTransition(async () => {
      try {
        await deletePatient(patientId);
      } catch (err: any) {
        alert(err.message); // affiche le message si étude existante
      }
    });
  };

  return (
    <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
      {isPending ? "Suppression..." : "Supprimer"}
    </Button>
  );
}
```

---

## Étape 7 — Intégration dans les pages existantes

### Dans `app/(dashboard)/patients/page.tsx`

```typescript
export default async function PatientsPage() {
  const user = await requireKine();
  const patients = await prisma.patient.findMany({
    where: patientWhereClause(user),
    orderBy: { createdAt: "desc" },
    include: { intake: true },
  });

  // Pour le sélecteur ADMIN uniquement
  const kines = user.role === "ADMIN"
    ? await prisma.user.findMany({ where: { role: { in: ["ADMIN", "KINE"] } } })
    : [];

  return (
    <PatientsClient
      patients={patients}
      currentUserRole={user.role}
      currentUserId={user.id}
      kines={kines}
    />
  );
}
```

### Dans la table patients — ajouter les actions par ligne

Afficher les boutons **Modifier** et **Supprimer** uniquement si :

```typescript
const canEdit = currentUserRole === "ADMIN" || patient.kineId === currentUserId;
```

### Dans `app/(dashboard)/patients/[id]/page.tsx`

Ajouter dans le header du dossier patient :

```tsx
{
  canEdit && (
    <>
      <Button onClick={() => setEditOpen(true)}>Modifier</Button>
      <DeletePatientButton patientId={patient.id} />
    </>
  );
}
```

---

## Checklist de vérification

```bash
npx tsc --noEmit

# 1. KINE crée un patient → assigné à lui-même, visible dans sa liste
# 2. KINE tente de modifier un patient d'un autre kiné → erreur "Accès refusé"
# 3. KINE supprime un patient sans étude → suppression OK, redirect /patients
# 4. KINE tente de supprimer un patient avec une étude → message d'erreur explicite
# 5. ADMIN crée un patient et l'assigne à un autre kiné → visible dans la liste du kiné
# 6. ADMIN peut modifier/supprimer n'importe quel patient
# 7. Vérifier les audit logs après chaque action
```
