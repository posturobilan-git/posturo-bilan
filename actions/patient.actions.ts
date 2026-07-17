"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import {
  createPatientSchema,
  updatePatientSchema,
  type CreatePatientInput,
  type UpdatePatientInput,
} from "@/lib/validations/patient.schema";
import { randomUUID } from "node:crypto";
import { logAudit } from "@/lib/audit";
import { inviteExpiryFromNow } from "@/lib/legal";
import { deleteBlob } from "@/lib/storage";
import { requireKine, requirePatientOwnership } from "@/lib/auth";
import { ok, fail, formatZodError, type ActionResult } from "@/lib/action-result";
import { Prisma, type Patient } from "@prisma/client";
import type { ListResult, PageQuery } from "@/lib/pagination";
import { encryptFields, decryptFields, hashEmail } from "@/lib/crypto";
import { PATIENT_ENCRYPTED_FIELDS, INTAKE_ENCRYPTED_FIELDS } from "@/lib/crypto.constants";

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * firstName/lastName/email sont chiffrés en base — ni le tri ni la recherche
 * ne peuvent plus se faire en SQL sur ces colonnes. On charge le périmètre du
 * kiné (borné par patient de toute façon), on déchiffre, puis on filtre/trie/
 * pagine en mémoire.
 */
export async function getPatients(filters?: {
  search?: string;
  page?: PageQuery;
}) {
  const kine = await requireKine();

  const raw = await prisma.patient.findMany({
    where: kine.role !== "ADMIN" ? { kineId: kine.id } : undefined,
    include: { kine: { select: { name: true } }, _count: { select: { studies: true } } },
  });

  let items = raw.map((p) => ({
    ...decryptFields(p, PATIENT_ENCRYPTED_FIELDS),
    kine: decryptFields(p.kine, ["name"] as const),
  }));

  if (filters?.search) {
    const q = filters.search.toLowerCase();
    items = items.filter(
      (p) =>
        p.firstName.toLowerCase().includes(q) ||
        p.lastName.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q)
    );
  }

  const total = items.length;

  const page = filters?.page;
  const dir = page?.dir === "asc" ? 1 : -1;
  items = items.sort((a, b) => {
    if (page?.sort === "name") {
      const an = `${a.lastName} ${a.firstName}`.toLowerCase();
      const bn = `${b.lastName} ${b.firstName}`.toLowerCase();
      return an < bn ? -dir : an > bn ? dir : 0;
    }
    return a.createdAt < b.createdAt ? -dir : a.createdAt > b.createdAt ? dir : 0;
  });

  if (page) {
    const start = (page.page - 1) * page.perPage;
    items = items.slice(start, start + page.perPage);
  }

  return { items, total } satisfies ListResult<(typeof items)[number]>;
}

export async function getPatientDossier(id: string) {
  const kine = await requireKine();

  const raw = await prisma.patient.findUnique({
    where: {
      id,
      ...(kine.role !== "ADMIN" && { kineId: kine.id }),
    },
    include: {
      kine: { select: { name: true } },
      intake: true,
      studies: {
        include: {
          bikeType: true,
          componentsUsed: true,
          exercisesPrescribed: true,
          pains: { orderBy: { order: "asc" } },
          photos: { orderBy: [{ phase: "asc" }, { order: "asc" }] },
        },
        orderBy: { createdAt: "desc" },
      },
      followups: { orderBy: { submittedAt: "asc" } },
    },
  });

  const patient = raw && {
    ...decryptFields(raw, PATIENT_ENCRYPTED_FIELDS),
    kine: decryptFields(raw.kine, ["name"] as const),
    intake: raw.intake ? decryptFields(raw.intake, INTAKE_ENCRYPTED_FIELDS) : null,
  };

  // Only record an actual view, not Next.js prefetches/cache-warming renders —
  // otherwise opening the patients list would log VIEW_SENSITIVE for every row.
  if (patient) {
    const h = await headers();
    const isPrefetch =
      h.get("next-router-prefetch") === "1" || h.get("purpose") === "prefetch";
    if (!isPrefetch) {
      await logAudit({
        userId: kine.id,
        action: "VIEW_SENSITIVE",
        entity: "patient",
        entityId: id,
      });
    }
  }

  return patient;
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createPatient(
  data: CreatePatientInput
): Promise<ActionResult<Patient>> {
  const parsed = createPatientSchema.safeParse(data);
  if (!parsed.success) return fail(formatZodError(parsed.error));

  try {
    const kine = await requireKine();
    const { kineId, ...fields } = parsed.data;

    // Un KINE ne crée que pour lui-même. Un ADMIN peut assigner à un autre kiné.
    let assignedKineId = kine.id;
    if (kine.role === "ADMIN" && kineId) {
      const target = await prisma.user.findFirst({
        where: { id: kineId, role: { in: ["ADMIN", "KINE"] } },
        select: { id: true },
      });
      if (!target) return fail("Kiné assigné introuvable ou inactif.");
      assignedKineId = target.id;
    }

    // Generate the accueil-form invite token at creation so the patient can be
    // sent their tokenised link straight away (valid 30 days).
    const patient = await prisma.patient.create({
      data: {
        ...encryptFields(fields, PATIENT_ENCRYPTED_FIELDS),
        emailHash: hashEmail(fields.email),
        kineId: assignedKineId,
        inviteToken: randomUUID(),
        inviteExpiresAt: inviteExpiryFromNow(),
      },
    });

    await logAudit({ userId: kine.id, action: "CREATE", entity: "patient", entityId: patient.id });
    revalidatePath("/dashboard/patients");
    return ok(decryptFields(patient, PATIENT_ENCRYPTED_FIELDS));
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return fail("Un patient avec cet email existe déjà.");
    }
    console.error("createPatient failed:", e);
    return fail("Impossible de créer le patient. Réessayez.");
  }
}

export async function updatePatient(
  patientId: string,
  data: UpdatePatientInput
): Promise<ActionResult<Patient>> {
  const parsed = updatePatientSchema.safeParse(data);
  if (!parsed.success) return fail(formatZodError(parsed.error));

  try {
    const { user } = await requirePatientOwnership(patientId);

    const updated = await prisma.patient.update({
      where: { id: patientId },
      data: {
        ...encryptFields(parsed.data, PATIENT_ENCRYPTED_FIELDS),
        ...(parsed.data.email && { emailHash: hashEmail(parsed.data.email) }),
      },
    });

    await logAudit({
      userId: user.id,
      action: "UPDATE",
      entity: "patient",
      entityId: patientId,
      metadata: { fields: Object.keys(parsed.data) },
    });
    revalidatePath("/dashboard/patients");
    revalidatePath(`/dashboard/patients/${patientId}`);
    return ok(decryptFields(updated, PATIENT_ENCRYPTED_FIELDS));
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return fail("Un patient avec cet email existe déjà.");
    }
    if (e instanceof Error && e.message.startsWith("Accès refusé")) return fail(e.message);
    if (e instanceof Error && e.message === "Patient introuvable.") return fail(e.message);
    console.error("updatePatient failed:", e);
    return fail("Impossible de modifier le patient. Réessayez.");
  }
}

export async function deletePatient(patientId: string): Promise<ActionResult<void>> {
  try {
    const { user } = await requirePatientOwnership(patientId);

    // Bloquer la suppression si une étude posturale existe — les données
    // cliniques ne doivent pas être perdues. Orienter vers l'anonymisation RGPD.
    const studyCount = await prisma.study.count({ where: { patientId } });
    if (studyCount > 0) {
      return fail(
        `Impossible de supprimer ce patient — ${studyCount} étude(s) posturale(s) associée(s). Utilisez l'anonymisation RGPD à la place.`
      );
    }

    // L'intake casse en cascade ; les followups n'ont pas de règle onDelete,
    // on les retire explicitement (il ne peut y en avoir sans étude, mais on
    // reste défensif) dans la même transaction.
    await prisma.$transaction([
      prisma.followup.deleteMany({ where: { patientId } }),
      prisma.patient.delete({ where: { id: patientId } }),
    ]);

    await logAudit({
      userId: user.id,
      action: "DELETE",
      entity: "patient",
      entityId: patientId,
    });
    revalidatePath("/dashboard/patients");
    return ok(undefined);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Accès refusé")) return fail(e.message);
    if (e instanceof Error && e.message === "Patient introuvable.") return fail(e.message);
    console.error("deletePatient failed:", e);
    return fail("Impossible de supprimer le patient. Réessayez.");
  }
}

/**
 * Suppression définitive (hard delete) d'un patient ET de toutes ses données
 * liées : études (+ rapports PDF), suivis, accueil. Contourne volontairement le
 * garde-fou RGPD de `deletePatient` — réservé au kiné propriétaire ou à un ADMIN,
 * exige une confirmation tapée (nom complet du patient) et est tracé.
 * Action IRRÉVERSIBLE.
 */
export async function hardDeletePatient(
  patientId: string,
  confirmation: string
): Promise<ActionResult<void>> {
  try {
    const { user, patient: owned } = await requirePatientOwnership(patientId);

    const patient = await prisma.patient.findUnique({
      where: { id: owned.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        studies: {
          select: { id: true, reportUrl: true, photos: { select: { url: true } } },
        },
      },
    });
    if (!patient) return fail("Patient introuvable.");

    // Confirmation tapée : doit correspondre exactement au nom complet affiché.
    const { firstName, lastName } = decryptFields(patient, ["firstName", "lastName"] as const);
    const expected = `${firstName} ${lastName}`;
    if (confirmation.trim() !== expected) {
      return fail(`La confirmation ne correspond pas. Tapez exactement « ${expected} ».`);
    }

    const studyCount = patient.studies.length;

    // Supprime d'abord les enfants qui référencent le patient (Restrict), puis le
    // patient (l'accueil casse en cascade). Les liaisons m2m des études (composants
    // / exercices) sont nettoyées automatiquement à la suppression des études.
    await prisma.$transaction([
      prisma.study.deleteMany({ where: { patientId } }),
      prisma.followup.deleteMany({ where: { patientId } }),
      prisma.patient.delete({ where: { id: patientId } }),
    ]);

    // Nettoyage best-effort des blobs stockés — PDF de rapport + photos patient
    // (ne bloque jamais la suppression).
    const blobKeys = [
      ...patient.studies.map((s) => s.reportUrl).filter((url): url is string => Boolean(url)),
      ...patient.studies.flatMap((s) => s.photos.map((p) => p.url)),
    ];
    await Promise.all(blobKeys.map((key) => deleteBlob(key)));

    await logAudit({
      userId: user.id,
      action: "DELETE",
      entity: "patient",
      entityId: patientId,
      metadata: { hardDelete: true, studyCount },
    });
    revalidatePath("/dashboard/patients");
    return ok(undefined);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Accès refusé")) return fail(e.message);
    if (e instanceof Error && e.message === "Patient introuvable.") return fail(e.message);
    console.error("hardDeletePatient failed:", e);
    return fail("Impossible de supprimer définitivement le patient. Réessayez.");
  }
}
