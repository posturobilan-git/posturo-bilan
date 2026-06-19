"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { requireKine, requireAdmin } from "@/lib/auth";
import { ok, fail, formatZodError, type ActionResult } from "@/lib/action-result";
import { bikeTypeSchema, type BikeTypeInput } from "@/lib/validations/bikeType.schema";
import { PHYSIO_OUTPUT_TYPE_LABELS } from "@/lib/labels";
import { Prisma, type BikeType, type PhysioOutputType } from "@prisma/client";

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

// ─── Study configuration (côtes & physio tests per bike type) ────────────────────

/** A transfer-list item; `hint` is a small parenthetical (unit / result type). */
export interface ConfigItem {
  id: string;
  name: string;
  hint?: string;
}

/** The three columns of a transfer list: pinned trunk, selected, and available. */
export interface ConfigLists {
  common: ConfigItem[];
  assigned: ConfigItem[];
  available: ConfigItem[];
}

export interface BikeTypeConfig {
  bikeType: Pick<BikeType, "id" | "name">;
  measurements: ConfigLists;
  riderMeasurements: ConfigLists;
  physioTests: ConfigLists;
}

function physioHint(t: { outputType: PhysioOutputType; unit: string | null }): string {
  return t.outputType === "VALUE" ? t.unit ?? "valeur" : PHYSIO_OUTPUT_TYPE_LABELS[t.outputType];
}

/** Full configuration of a bike type's study form (two transfer lists). */
export async function getBikeTypeConfig(bikeTypeId: string): Promise<BikeTypeConfig | null> {
  await requireKine();

  const bikeType = await prisma.bikeType.findUnique({
    where: { id: bikeTypeId },
    select: { id: true, name: true },
  });
  if (!bikeType) return null;

  const [
    mCommon,
    mLinks,
    mOthers,
    rmCommon,
    rmLinks,
    rmOthers,
    pCommon,
    pLinks,
    pOthers,
  ] = await Promise.all([
    prisma.measurement.findMany({
      where: { isActive: true, isCommon: true },
      select: { id: true, name: true, unit: true },
      orderBy: [{ commonOrder: "asc" }, { name: "asc" }],
    }),
    prisma.bikeTypeMeasurement.findMany({
      where: { bikeTypeId, measurement: { isActive: true, isCommon: false } },
      include: { measurement: { select: { id: true, name: true, unit: true } } },
      orderBy: { order: "asc" },
    }),
    prisma.measurement.findMany({
      where: { isActive: true, isCommon: false, bikeTypeLinks: { none: { bikeTypeId } } },
      select: { id: true, name: true, unit: true },
      orderBy: { name: "asc" },
    }),
    prisma.riderMeasurement.findMany({
      where: { isActive: true, isCommon: true },
      select: { id: true, name: true, unit: true },
      orderBy: [{ commonOrder: "asc" }, { name: "asc" }],
    }),
    prisma.bikeTypeRiderMeasurement.findMany({
      where: { bikeTypeId, riderMeasurement: { isActive: true, isCommon: false } },
      include: { riderMeasurement: { select: { id: true, name: true, unit: true } } },
      orderBy: { order: "asc" },
    }),
    prisma.riderMeasurement.findMany({
      where: { isActive: true, isCommon: false, bikeTypeLinks: { none: { bikeTypeId } } },
      select: { id: true, name: true, unit: true },
      orderBy: { name: "asc" },
    }),
    prisma.physioTest.findMany({
      where: { isActive: true, isCommon: true },
      select: { id: true, name: true, unit: true, outputType: true },
      orderBy: [{ commonOrder: "asc" }, { name: "asc" }],
    }),
    prisma.bikeTypePhysioTest.findMany({
      where: { bikeTypeId, physioTest: { isActive: true, isCommon: false } },
      include: { physioTest: { select: { id: true, name: true, unit: true, outputType: true } } },
      orderBy: { order: "asc" },
    }),
    prisma.physioTest.findMany({
      where: { isActive: true, isCommon: false, bikeTypeLinks: { none: { bikeTypeId } } },
      select: { id: true, name: true, unit: true, outputType: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const asMeasure = (m: { id: string; name: string; unit: string }): ConfigItem => ({
    id: m.id,
    name: m.name,
    hint: m.unit,
  });
  const asPhysio = (t: {
    id: string;
    name: string;
    unit: string | null;
    outputType: PhysioOutputType;
  }): ConfigItem => ({ id: t.id, name: t.name, hint: physioHint(t) });

  return {
    bikeType,
    measurements: {
      common: mCommon.map(asMeasure),
      assigned: mLinks.map((l) => asMeasure(l.measurement)),
      available: mOthers.map(asMeasure),
    },
    riderMeasurements: {
      common: rmCommon.map(asMeasure),
      assigned: rmLinks.map((l) => asMeasure(l.riderMeasurement)),
      available: rmOthers.map(asMeasure),
    },
    physioTests: {
      common: pCommon.map(asPhysio),
      assigned: pLinks.map((l) => asPhysio(l.physioTest)),
      available: pOthers.map(asPhysio),
    },
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
    revalidatePath(`/dashboard/configuration/${bikeTypeId}`);
    revalidatePath("/dashboard/configuration");
    return ok(undefined);
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    console.error("setBikeTypeMeasurements failed:", e);
    return fail("Impossible d'enregistrer la configuration. Réessayez.");
  }
}

/**
 * Replaces the ordered set of (non-common) mesures du cycliste configured for a
 * bike type. Mirrors setBikeTypeMeasurements; common mesures are implicit.
 */
export async function setBikeTypeRiderMeasurements(
  bikeTypeId: string,
  riderMeasurementIds: string[]
): Promise<ActionResult<void>> {
  try {
    const admin = await requireAdmin();

    const bikeType = await prisma.bikeType.findUnique({
      where: { id: bikeTypeId },
      select: { id: true },
    });
    if (!bikeType) return fail("Type de vélo introuvable.");

    // Ignore any common mesures that slipped in — they apply to all bike types.
    const valid = await prisma.riderMeasurement.findMany({
      where: { id: { in: riderMeasurementIds }, isCommon: false },
      select: { id: true },
    });
    const validIds = new Set(valid.map((m) => m.id));
    const ordered = riderMeasurementIds.filter((id) => validIds.has(id));

    await prisma.$transaction([
      prisma.bikeTypeRiderMeasurement.deleteMany({ where: { bikeTypeId } }),
      ...(ordered.length
        ? [
            prisma.bikeTypeRiderMeasurement.createMany({
              data: ordered.map((riderMeasurementId, order) => ({ bikeTypeId, riderMeasurementId, order })),
            }),
          ]
        : []),
    ]);

    await logAudit({
      userId: admin.id,
      action: "UPDATE",
      entity: "bikeType",
      entityId: bikeTypeId,
      metadata: { config: "riderMeasurements", count: ordered.length },
    });
    revalidatePath(`/dashboard/configuration/${bikeTypeId}`);
    revalidatePath("/dashboard/configuration");
    return ok(undefined);
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    console.error("setBikeTypeRiderMeasurements failed:", e);
    return fail("Impossible d'enregistrer la configuration. Réessayez.");
  }
}

/**
 * Replaces the ordered set of (non-common) physio tests configured for a bike
 * type. Mirrors setBikeTypeMeasurements; common tests are implicit.
 */
export async function setBikeTypePhysioTests(
  bikeTypeId: string,
  physioTestIds: string[]
): Promise<ActionResult<void>> {
  try {
    const admin = await requireAdmin();

    const bikeType = await prisma.bikeType.findUnique({
      where: { id: bikeTypeId },
      select: { id: true },
    });
    if (!bikeType) return fail("Type de vélo introuvable.");

    const valid = await prisma.physioTest.findMany({
      where: { id: { in: physioTestIds }, isCommon: false },
      select: { id: true },
    });
    const validIds = new Set(valid.map((t) => t.id));
    const ordered = physioTestIds.filter((id) => validIds.has(id));

    await prisma.$transaction([
      prisma.bikeTypePhysioTest.deleteMany({ where: { bikeTypeId } }),
      ...(ordered.length
        ? [
            prisma.bikeTypePhysioTest.createMany({
              data: ordered.map((physioTestId, order) => ({ bikeTypeId, physioTestId, order })),
            }),
          ]
        : []),
    ]);

    await logAudit({
      userId: admin.id,
      action: "UPDATE",
      entity: "bikeType",
      entityId: bikeTypeId,
      metadata: { config: "physioTests", count: ordered.length },
    });
    revalidatePath(`/dashboard/configuration/${bikeTypeId}`);
    revalidatePath("/dashboard/configuration");
    return ok(undefined);
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    console.error("setBikeTypePhysioTests failed:", e);
    return fail("Impossible d'enregistrer la configuration. Réessayez.");
  }
}

/**
 * Persists the global display order of the common-trunk côtes from an ordered
 * list of ids (top to bottom). Non-common ids are ignored. This order is global
 * (shared by every bike type) and applies first in the study form.
 */
export async function setCommonMeasurementOrder(
  measurementIds: string[]
): Promise<ActionResult<void>> {
  try {
    const admin = await requireAdmin();
    const valid = await prisma.measurement.findMany({
      where: { id: { in: measurementIds }, isCommon: true },
      select: { id: true },
    });
    const validIds = new Set(valid.map((m) => m.id));
    const ordered = measurementIds.filter((id) => validIds.has(id));

    await prisma.$transaction(
      ordered.map((id, commonOrder) =>
        prisma.measurement.update({ where: { id }, data: { commonOrder } })
      )
    );

    await logAudit({
      userId: admin.id,
      action: "UPDATE",
      entity: "measurement",
      entityId: "commonOrder",
      metadata: { count: ordered.length },
    });
    revalidatePath("/dashboard/configuration");
    return ok(undefined);
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    console.error("setCommonMeasurementOrder failed:", e);
    return fail("Impossible d'enregistrer l'ordre du tronc commun. Réessayez.");
  }
}

/** Mirrors setCommonMeasurementOrder for the common-trunk mesures du cycliste. */
export async function setCommonRiderMeasurementOrder(
  riderMeasurementIds: string[]
): Promise<ActionResult<void>> {
  try {
    const admin = await requireAdmin();
    const valid = await prisma.riderMeasurement.findMany({
      where: { id: { in: riderMeasurementIds }, isCommon: true },
      select: { id: true },
    });
    const validIds = new Set(valid.map((m) => m.id));
    const ordered = riderMeasurementIds.filter((id) => validIds.has(id));

    await prisma.$transaction(
      ordered.map((id, commonOrder) =>
        prisma.riderMeasurement.update({ where: { id }, data: { commonOrder } })
      )
    );

    await logAudit({
      userId: admin.id,
      action: "UPDATE",
      entity: "riderMeasurement",
      entityId: "commonOrder",
      metadata: { count: ordered.length },
    });
    revalidatePath("/dashboard/configuration");
    return ok(undefined);
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    console.error("setCommonRiderMeasurementOrder failed:", e);
    return fail("Impossible d'enregistrer l'ordre du tronc commun. Réessayez.");
  }
}

/** Mirrors setCommonMeasurementOrder for the common-trunk physio tests. */
export async function setCommonPhysioTestOrder(
  physioTestIds: string[]
): Promise<ActionResult<void>> {
  try {
    const admin = await requireAdmin();
    const valid = await prisma.physioTest.findMany({
      where: { id: { in: physioTestIds }, isCommon: true },
      select: { id: true },
    });
    const validIds = new Set(valid.map((t) => t.id));
    const ordered = physioTestIds.filter((id) => validIds.has(id));

    await prisma.$transaction(
      ordered.map((id, commonOrder) =>
        prisma.physioTest.update({ where: { id }, data: { commonOrder } })
      )
    );

    await logAudit({
      userId: admin.id,
      action: "UPDATE",
      entity: "physioTest",
      entityId: "commonOrder",
      metadata: { count: ordered.length },
    });
    revalidatePath("/dashboard/configuration");
    return ok(undefined);
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    console.error("setCommonPhysioTestOrder failed:", e);
    return fail("Impossible d'enregistrer l'ordre du tronc commun. Réessayez.");
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
    revalidatePath("/dashboard/configuration");
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
    revalidatePath("/dashboard/configuration");
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
    revalidatePath("/dashboard/configuration");
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
    revalidatePath("/dashboard/configuration");
    return ok({ isActive: updated.isActive });
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    console.error("toggleBikeType failed:", e);
    return fail("Impossible de modifier le type de vélo. Réessayez.");
  }
}
