"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { requireKine, requireAdmin } from "@/lib/auth";
import { ok, fail, formatZodError, type ActionResult } from "@/lib/action-result";
import { bikeTypeSchema, configIdsSchema, type BikeTypeInput } from "@/lib/validations/bikeType.schema";
import { PHYSIO_OUTPUT_TYPE_LABELS } from "@/lib/labels";
import {
  compareConfigured,
  comparePhysioConfigured,
  finalConfigOrder,
  type SectionRef,
} from "@/lib/study/config-order";
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
  /** Tronc commun : présent sur tous les types de vélo, jamais retirable — seule sa position change. */
  isCommon: boolean;
  /**
   * Regroupement d'affichage (section d'un test physio) : l'ordre ne compte
   * qu'au sein d'un groupe. `undefined` = pas de regroupement, `null` = sans section.
   */
  group?: SectionRef | null;
}

/** The two columns of a transfer list. */
export interface ConfigLists {
  /** Tout ce qui s'applique au type de vélo, tronc commun compris, dans l'ordre d'affichage. */
  assigned: ConfigItem[];
  /** Éléments spécifiques pas encore affectés à ce type de vélo. */
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

/** Full configuration of a bike type's study form (three transfer lists). */
export async function getBikeTypeConfig(bikeTypeId: string): Promise<BikeTypeConfig | null> {
  await requireKine();

  const bikeType = await prisma.bikeType.findUnique({
    where: { id: bikeTypeId },
    select: { id: true, name: true },
  });
  if (!bikeType) return null;

  // Applicable = commun (toujours) ou lié à ce type. On ne charge que le lien de
  // CE type : c'est lui qui donne la position, via le même comparateur que le
  // formulaire d'étude.
  const applicable = {
    isActive: true,
    OR: [{ isCommon: true }, { bikeTypeLinks: { some: { bikeTypeId } } }],
  };
  const ownLink = { where: { bikeTypeId }, select: { bikeTypeId: true, order: true } };
  const notAssigned = { isActive: true, isCommon: false, bikeTypeLinks: { none: { bikeTypeId } } };

  const [mAssigned, mOthers, rmAssigned, rmOthers, pAssigned, pOthers] = await Promise.all([
    prisma.measurement.findMany({
      where: applicable,
      select: { id: true, name: true, unit: true, isCommon: true, commonOrder: true, bikeTypeLinks: ownLink },
    }),
    prisma.measurement.findMany({
      where: notAssigned,
      select: { id: true, name: true, unit: true },
      orderBy: { name: "asc" },
    }),
    prisma.riderMeasurement.findMany({
      where: applicable,
      select: { id: true, name: true, unit: true, isCommon: true, commonOrder: true, bikeTypeLinks: ownLink },
    }),
    prisma.riderMeasurement.findMany({
      where: notAssigned,
      select: { id: true, name: true, unit: true },
      orderBy: { name: "asc" },
    }),
    prisma.physioTest.findMany({
      where: applicable,
      select: {
        id: true,
        name: true,
        unit: true,
        outputType: true,
        isCommon: true,
        commonOrder: true,
        bikeTypeLinks: ownLink,
        section: { select: { id: true, name: true, order: true } },
      },
    }),
    prisma.physioTest.findMany({
      where: notAssigned,
      select: {
        id: true,
        name: true,
        unit: true,
        outputType: true,
        section: { select: { id: true, name: true, order: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const asMeasure = (m: { id: string; name: string; unit: string; isCommon?: boolean }): ConfigItem => ({
    id: m.id,
    name: m.name,
    hint: m.unit,
    isCommon: m.isCommon ?? false,
  });
  const asPhysio = (t: {
    id: string;
    name: string;
    unit: string | null;
    outputType: PhysioOutputType;
    isCommon?: boolean;
    section: SectionRef | null;
  }): ConfigItem => ({
    id: t.id,
    name: t.name,
    hint: physioHint(t),
    isCommon: t.isCommon ?? false,
    group: t.section,
  });

  return {
    bikeType,
    measurements: {
      assigned: mAssigned.sort(compareConfigured(bikeTypeId)).map(asMeasure),
      available: mOthers.map(asMeasure),
    },
    riderMeasurements: {
      assigned: rmAssigned.sort(compareConfigured(bikeTypeId)).map(asMeasure),
      available: rmOthers.map(asMeasure),
    },
    physioTests: {
      // Ordre global (sections puis position) : au sein d'une section, c'est la
      // position enregistrée ; l'écran de config regroupe par section.
      assigned: pAssigned.sort(comparePhysioConfigured(bikeTypeId)).map(asPhysio),
      available: pOthers.map(asPhysio),
    },
  };
}

/**
 * Replaces the ordered list of côtes configured for a bike type. The given list
 * is the exact right-column content, top to bottom, common trunk included — a
 * common côte can be placed anywhere but never removed: any active common côte
 * missing from the list is appended at the end. Links of deactivated côtes are
 * left alone so reactivating one restores its place.
 */
export async function setBikeTypeMeasurements(
  bikeTypeId: string,
  measurementIds: string[]
): Promise<ActionResult<void>> {
  const requested = configIdsSchema.safeParse(measurementIds);
  if (!requested.success) return fail("Liste d'éléments invalide.");

  try {
    const admin = await requireAdmin();

    const bikeType = await prisma.bikeType.findUnique({
      where: { id: bikeTypeId },
      select: { id: true },
    });
    if (!bikeType) return fail("Type de vélo introuvable.");

    const [active, common] = await Promise.all([
      prisma.measurement.findMany({ where: { isActive: true }, select: { id: true } }),
      prisma.measurement.findMany({
        where: { isActive: true, isCommon: true },
        select: { id: true },
        orderBy: [{ commonOrder: "asc" }, { name: "asc" }],
      }),
    ]);
    const activeIds = new Set(active.map((m) => m.id));
    const ordered = finalConfigOrder(requested.data, activeIds, common.map((m) => m.id));

    await prisma.$transaction([
      // Only the links of elements seen at read time: one created or reactivated
      // meanwhile keeps its own link instead of being wiped.
      prisma.bikeTypeMeasurement.deleteMany({ where: { bikeTypeId, measurementId: { in: [...activeIds] } } }),
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
 * Replaces the ordered list of mesures du cycliste configured for a bike type.
 * Mirrors setBikeTypeMeasurements (common mesures: any position, never removed).
 */
export async function setBikeTypeRiderMeasurements(
  bikeTypeId: string,
  riderMeasurementIds: string[]
): Promise<ActionResult<void>> {
  const requested = configIdsSchema.safeParse(riderMeasurementIds);
  if (!requested.success) return fail("Liste d'éléments invalide.");

  try {
    const admin = await requireAdmin();

    const bikeType = await prisma.bikeType.findUnique({
      where: { id: bikeTypeId },
      select: { id: true },
    });
    if (!bikeType) return fail("Type de vélo introuvable.");

    const [active, common] = await Promise.all([
      prisma.riderMeasurement.findMany({ where: { isActive: true }, select: { id: true } }),
      prisma.riderMeasurement.findMany({
        where: { isActive: true, isCommon: true },
        select: { id: true },
        orderBy: [{ commonOrder: "asc" }, { name: "asc" }],
      }),
    ]);
    const activeIds = new Set(active.map((m) => m.id));
    const ordered = finalConfigOrder(requested.data, activeIds, common.map((m) => m.id));

    await prisma.$transaction([
      // Only the links of elements seen at read time: one created or reactivated
      // meanwhile keeps its own link instead of being wiped.
      prisma.bikeTypeRiderMeasurement.deleteMany({ where: { bikeTypeId, riderMeasurementId: { in: [...activeIds] } } }),
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
 * Replaces the ordered list of physio tests configured for a bike type. Mirrors
 * setBikeTypeMeasurements (common tests: any position, never removed). The list
 * is flat; the form shows it section by section, so the order that matters is
 * the one within each section.
 */
export async function setBikeTypePhysioTests(
  bikeTypeId: string,
  physioTestIds: string[]
): Promise<ActionResult<void>> {
  const requested = configIdsSchema.safeParse(physioTestIds);
  if (!requested.success) return fail("Liste d'éléments invalide.");

  try {
    const admin = await requireAdmin();

    const bikeType = await prisma.bikeType.findUnique({
      where: { id: bikeTypeId },
      select: { id: true },
    });
    if (!bikeType) return fail("Type de vélo introuvable.");

    const [active, common] = await Promise.all([
      prisma.physioTest.findMany({ where: { isActive: true }, select: { id: true } }),
      prisma.physioTest.findMany({
        where: { isActive: true, isCommon: true },
        select: { id: true },
        orderBy: [{ commonOrder: "asc" }, { name: "asc" }],
      }),
    ]);
    const activeIds = new Set(active.map((t) => t.id));
    const ordered = finalConfigOrder(requested.data, activeIds, common.map((t) => t.id));

    await prisma.$transaction([
      // Only the links of elements seen at read time: one created or reactivated
      // meanwhile keeps its own link instead of being wiped.
      prisma.bikeTypePhysioTest.deleteMany({ where: { bikeTypeId, physioTestId: { in: [...activeIds] } } }),
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

// ─── Mutations (ADMIN only) ─────────────────────────────────────────────────────

export async function createBikeType(data: BikeTypeInput): Promise<ActionResult<{ id: string }>> {
  const parsed = bikeTypeSchema.safeParse(data);
  if (!parsed.success) return fail(formatZodError(parsed.error));

  try {
    const admin = await requireAdmin();

    // Un nouveau type part de l'ordre par défaut du tronc commun (commonOrder) :
    // les éléments communs — actifs ou non, pour qu'une réactivation les retrouve —
    // sont liés d'emblée, dans cet ordre. Le tout dans la même écriture.
    const defaultOrder = [{ commonOrder: "asc" as const }, { name: "asc" as const }];
    const [mCommon, rmCommon, pCommon] = await Promise.all([
      prisma.measurement.findMany({ where: { isCommon: true }, select: { id: true }, orderBy: defaultOrder }),
      prisma.riderMeasurement.findMany({ where: { isCommon: true }, select: { id: true }, orderBy: defaultOrder }),
      prisma.physioTest.findMany({ where: { isCommon: true }, select: { id: true }, orderBy: defaultOrder }),
    ]);

    const bikeType = await prisma.bikeType.create({
      data: {
        ...parsed.data,
        createdById: admin.id,
        measurementLinks: { create: mCommon.map((m, order) => ({ measurementId: m.id, order })) },
        riderMeasurementLinks: {
          create: rmCommon.map((m, order) => ({ riderMeasurementId: m.id, order })),
        },
        physioTestLinks: { create: pCommon.map((t, order) => ({ physioTestId: t.id, order })) },
      },
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
