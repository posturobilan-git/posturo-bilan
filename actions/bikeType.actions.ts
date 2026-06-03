"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { requireKine, requireAdmin } from "@/lib/auth";
import { ok, fail, formatZodError, type ActionResult } from "@/lib/action-result";
import { bikeTypeSchema, type BikeTypeInput } from "@/lib/validations/bikeType.schema";
import { Prisma, type BikeType } from "@prisma/client";

export type BikeTypeWithCount = BikeType & { _count: { studies: number } };

// ─── Query ────────────────────────────────────────────────────────────────────

export async function getBikeTypes(filters?: {
  search?: string;
}): Promise<BikeTypeWithCount[]> {
  const kine = await requireKine();

  return prisma.bikeType.findMany({
    where: {
      // Non-admins only see the active library.
      ...(kine.role !== "ADMIN" && { isActive: true }),
      ...(filters?.search && {
        name: { contains: filters.search, mode: "insensitive" },
      }),
    },
    include: { _count: { select: { studies: true } } },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
}

/** Active bike types only — used to populate the study creation step. */
export async function getActiveBikeTypes(): Promise<BikeType[]> {
  await requireKine();
  return prisma.bikeType.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
}

// ─── Study configuration (côtes per bike type) ──────────────────────────────────

export interface BikeTypeConfig {
  bikeType: Pick<BikeType, "id" | "name">;
  /** Common trunk côtes — always applied, shown but not editable in the config. */
  common: { id: string; name: string; unit: string }[];
  /** Côtes configured for this bike type, in display order. */
  assigned: { id: string; name: string; unit: string }[];
  /** Remaining (non-common) côtes available to add. */
  available: { id: string; name: string; unit: string }[];
}

/** Full configuration of a bike type's study form (two-column transfer list). */
export async function getBikeTypeConfig(bikeTypeId: string): Promise<BikeTypeConfig | null> {
  await requireKine();

  const bikeType = await prisma.bikeType.findUnique({
    where: { id: bikeTypeId },
    select: { id: true, name: true },
  });
  if (!bikeType) return null;

  const [common, links, others] = await Promise.all([
    prisma.measurement.findMany({
      where: { isActive: true, isCommon: true },
      select: { id: true, name: true, unit: true },
      orderBy: { name: "asc" },
    }),
    prisma.bikeTypeMeasurement.findMany({
      where: { bikeTypeId, measurement: { isActive: true, isCommon: false } },
      include: { measurement: { select: { id: true, name: true, unit: true } } },
      orderBy: { order: "asc" },
    }),
    prisma.measurement.findMany({
      where: {
        isActive: true,
        isCommon: false,
        bikeTypeLinks: { none: { bikeTypeId } },
      },
      select: { id: true, name: true, unit: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    bikeType,
    common,
    assigned: links.map((l) => l.measurement),
    available: others,
  };
}

/**
 * Replaces the ordered set of (non-common) côtes configured for a bike type.
 * The given list is the exact right-column content, top to bottom. Common côtes
 * are implicit and never passed here.
 */
export async function setBikeTypeMeasurements(
  bikeTypeId: string,
  measurementIds: string[]
): Promise<ActionResult<void>> {
  try {
    const admin = await requireAdmin();

    const bikeType = await prisma.bikeType.findUnique({
      where: { id: bikeTypeId },
      select: { id: true },
    });
    if (!bikeType) return fail("Type de vélo introuvable.");

    // Ignore any common côtes that slipped in — they apply to all bike types and
    // must never be stored as explicit links.
    const valid = await prisma.measurement.findMany({
      where: { id: { in: measurementIds }, isCommon: false },
      select: { id: true },
    });
    const validIds = new Set(valid.map((m) => m.id));
    const ordered = measurementIds.filter((id) => validIds.has(id));

    await prisma.$transaction([
      prisma.bikeTypeMeasurement.deleteMany({ where: { bikeTypeId } }),
      ...(ordered.length
        ? [
            prisma.bikeTypeMeasurement.createMany({
              data: ordered.map((measurementId, order) => ({ bikeTypeId, measurementId, order })),
            }),
          ]
        : []),
    ]);

    await logAudit({
      userId: admin.id,
      action: "UPDATE",
      entity: "bikeType",
      entityId: bikeTypeId,
      metadata: { config: "measurements", count: ordered.length },
    });
    revalidatePath(`/configuration/${bikeTypeId}`);
    revalidatePath("/configuration");
    return ok(undefined);
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    console.error("setBikeTypeMeasurements failed:", e);
    return fail("Impossible d'enregistrer la configuration. Réessayez.");
  }
}

// ─── Mutations (ADMIN only) ─────────────────────────────────────────────────────

export async function createBikeType(data: BikeTypeInput): Promise<ActionResult<{ id: string }>> {
  const parsed = bikeTypeSchema.safeParse(data);
  if (!parsed.success) return fail(formatZodError(parsed.error));

  try {
    const admin = await requireAdmin();
    const bikeType = await prisma.bikeType.create({
      data: { ...parsed.data, createdById: admin.id },
    });
    await logAudit({ userId: admin.id, action: "CREATE", entity: "bikeType", entityId: bikeType.id });
    revalidatePath("/configuration");
    return ok({ id: bikeType.id });
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    console.error("createBikeType failed:", e);
    return fail("Impossible de créer le type de vélo. Réessayez.");
  }
}

export async function updateBikeType(
  id: string,
  data: BikeTypeInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = bikeTypeSchema.safeParse(data);
  if (!parsed.success) return fail(formatZodError(parsed.error));

  try {
    const admin = await requireAdmin();
    await prisma.bikeType.update({ where: { id }, data: parsed.data });
    await logAudit({ userId: admin.id, action: "UPDATE", entity: "bikeType", entityId: id });
    revalidatePath("/configuration");
    return ok({ id });
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    console.error("updateBikeType failed:", e);
    return fail("Impossible de modifier le type de vélo. Réessayez.");
  }
}

export async function deleteBikeType(id: string): Promise<ActionResult<void>> {
  try {
    const admin = await requireAdmin();

    // A study's bikeType is a required relation — refuse to delete a type that
    // is still in use (that would corrupt those studies). Suggest deactivation.
    const studyCount = await prisma.study.count({ where: { bikeTypeId: id } });
    if (studyCount > 0) {
      return fail(
        `Impossible de supprimer : ${studyCount} étude(s) utilisent ce type de vélo. Désactivez-le plutôt.`
      );
    }

    // No study references it; côte/component links cascade via the join tables.
    await prisma.bikeType.delete({ where: { id } });
    await logAudit({ userId: admin.id, action: "DELETE", entity: "bikeType", entityId: id });
    revalidatePath("/configuration");
    return ok(undefined);
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return fail("Type de vélo introuvable.");
    }
    console.error("deleteBikeType failed:", e);
    return fail("Impossible de supprimer le type de vélo. Réessayez.");
  }
}

export async function toggleBikeType(id: string): Promise<ActionResult<{ isActive: boolean }>> {
  try {
    const admin = await requireAdmin();
    const current = await prisma.bikeType.findUnique({ where: { id }, select: { isActive: true } });
    if (!current) return fail("Type de vélo introuvable.");

    const updated = await prisma.bikeType.update({
      where: { id },
      data: { isActive: !current.isActive },
    });
    await logAudit({
      userId: admin.id,
      action: "UPDATE",
      entity: "bikeType",
      entityId: id,
      metadata: { isActive: updated.isActive },
    });
    revalidatePath("/configuration");
    return ok({ isActive: updated.isActive });
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    console.error("toggleBikeType failed:", e);
    return fail("Impossible de modifier le type de vélo. Réessayez.");
  }
}
