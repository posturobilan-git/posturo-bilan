"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import {
  createPatientSchema,
  updatePatientSchema,
  type CreatePatientInput,
  type UpdatePatientInput,
} from "@/lib/validations/patient.schema";
import { logAudit } from "@/lib/audit";
import { requireKine, requirePatientOwnership } from "@/lib/auth";
import { ok, fail, formatZodError, type ActionResult } from "@/lib/action-result";
import { Prisma, type Patient } from "@prisma/client";

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getPatients(filters?: { search?: string }) {
  const kine = await requireKine();

  return prisma.patient.findMany({
    where: {
      ...(kine.role !== "ADMIN" && { kineId: kine.id }),
      ...(filters?.search && {
        OR: [
          { firstName: { contains: filters.search, mode: "insensitive" } },
          { lastName: { contains: filters.search, mode: "insensitive" } },
          { email: { contains: filters.search, mode: "insensitive" } },
        ],
      }),
    },
    include: { kine: { select: { name: true } }, _count: { select: { studies: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getPatientDossier(id: string) {
  const kine = await requireKine();

  const patient = await prisma.patient.findUnique({
    where: {
      id,
      ...(kine.role !== "ADMIN" && { kineId: kine.id }),
    },
    include: {
      kine: { select: { name: true } },
      intake: true,
      studies: {
        include: { bikeType: true, componentsUsed: true, exercisesPrescribed: true },
        orderBy: { createdAt: "desc" },
      },
      followups: { orderBy: { submittedAt: "asc" } },
    },
  });

  if (patient) {
    await logAudit({
      userId: kine.id,
      action: "VIEW_SENSITIVE",
      entity: "patient",
      entityId: id,
    });
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

    const patient = await prisma.patient.create({
      data: { ...fields, kineId: assignedKineId },
    });

    await logAudit({ userId: kine.id, action: "CREATE", entity: "patient", entityId: patient.id });
    revalidatePath("/patients");
    return ok(patient);
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
      data: parsed.data,
    });

    await logAudit({
      userId: user.id,
      action: "UPDATE",
      entity: "patient",
      entityId: patientId,
      metadata: { fields: Object.keys(parsed.data) },
    });
    revalidatePath("/patients");
    revalidatePath(`/patients/${patientId}`);
    return ok(updated);
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
    revalidatePath("/patients");
    return ok(undefined);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Accès refusé")) return fail(e.message);
    if (e instanceof Error && e.message === "Patient introuvable.") return fail(e.message);
    console.error("deletePatient failed:", e);
    return fail("Impossible de supprimer le patient. Réessayez.");
  }
}
