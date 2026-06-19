"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { requireKine, requireAdmin } from "@/lib/auth";
import { ok, fail, formatZodError, type ActionResult } from "@/lib/action-result";
import {
  riderMeasurementSchema,
  type RiderMeasurementInput,
} from "@/lib/validations/riderMeasurement.schema";
import { Prisma, type RiderMeasurement, type BikeType } from "@prisma/client";

export type RiderMeasurementWithTypes = RiderMeasurement & {
  bikeTypes: Pick<BikeType, "id" | "name">[];
};

// ─── Queries ────────────────────────────────────────────────────────────────────

export async function getRiderMeasurements(filters?: {
  search?: string;
}): Promise<RiderMeasurementWithTypes[]> {
  const kine = await requireKine();

  const rows = await prisma.riderMeasurement.findMany({
    where: {
      ...(kine.role !== "ADMIN" && { isActive: true }),
      ...(filters?.search && {
        name: { contains: filters.search, mode: "insensitive" },
      }),
    },
    include: { bikeTypeLinks: { include: { bikeType: { select: { id: true, name: true } } } } },
    orderBy: [{ isActive: "desc" }, { isCommon: "desc" }, { name: "asc" }],
  });

  // Flatten the join rows back into the simple `bikeTypes` shape the UI expects.
  return rows.map(({ bikeTypeLinks, ...m }) => ({
    ...m,
    bikeTypes: bikeTypeLinks.map((l) => l.bikeType),
  }));
}

/**
 * Active mesures du cycliste applicable to a study of the given bike type, in
 * display order: the common trunk first, then those configured for this bike
 * type in their configured order. Mirrors getMeasurementsForBikeType.
 */
export async function getRiderMeasurementsForBikeType(
  bikeTypeId: string
): Promise<RiderMeasurement[]> {
  await requireKine();

  const [common, links] = await Promise.all([
    prisma.riderMeasurement.findMany({
      where: { isActive: true, isCommon: true },
      orderBy: [{ commonOrder: "asc" }, { name: "asc" }],
    }),
    prisma.bikeTypeRiderMeasurement.findMany({
      where: { bikeTypeId, riderMeasurement: { isActive: true, isCommon: false } },
      include: { riderMeasurement: true },
      orderBy: { order: "asc" },
    }),
  ]);

  return [...common, ...links.map((l) => l.riderMeasurement)];
}

// ─── Mutations (ADMIN only) ─────────────────────────────────────────────────────

function relationData(input: RiderMeasurementInput) {
  return {
    name: input.name,
    unit: input.unit,
    category: input.category,
    isCommon: input.isCommon,
    isRequired: input.isRequired,
    // A common measurement applies to all bike types, so it carries no explicit links.
    bikeTypeIds: input.isCommon ? [] : input.bikeTypeIds,
  };
}

/** Next free display order for a mesure appended to a given bike type's config. */
async function nextOrderFor(bikeTypeId: string): Promise<number> {
  const last = await prisma.bikeTypeRiderMeasurement.findFirst({
    where: { bikeTypeId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  return (last?.order ?? -1) + 1;
}

export async function createRiderMeasurement(
  data: RiderMeasurementInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = riderMeasurementSchema.safeParse(data);
  if (!parsed.success) return fail(formatZodError(parsed.error));

  try {
    const admin = await requireAdmin();
    const { bikeTypeIds, ...fields } = relationData(parsed.data);

    const links = await Promise.all(
      bikeTypeIds.map(async (bikeTypeId) => ({ bikeTypeId, order: await nextOrderFor(bikeTypeId) }))
    );

    const measurement = await prisma.riderMeasurement.create({
      data: {
        ...fields,
        createdById: admin.id,
        bikeTypeLinks: { create: links },
      },
    });
    await logAudit({ userId: admin.id, action: "CREATE", entity: "riderMeasurement", entityId: measurement.id });
    revalidatePath("/dashboard/configuration");
    return ok({ id: measurement.id });
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    console.error("createRiderMeasurement failed:", e);
    return fail("Impossible de créer la mesure. Réessayez.");
  }
}

export async function updateRiderMeasurement(
  id: string,
  data: RiderMeasurementInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = riderMeasurementSchema.safeParse(data);
  if (!parsed.success) return fail(formatZodError(parsed.error));

  try {
    const admin = await requireAdmin();
    const { bikeTypeIds, ...fields } = relationData(parsed.data);

    // Reconcile bike-type links without disturbing the configured order of the
    // ones that stay: drop the removed links, append any newly-added ones.
    const existing = await prisma.bikeTypeRiderMeasurement.findMany({
      where: { riderMeasurementId: id },
      select: { bikeTypeId: true },
    });
    const existingIds = new Set(existing.map((l) => l.bikeTypeId));
    const keep = new Set(bikeTypeIds);
    const toRemove = [...existingIds].filter((b) => !keep.has(b));
    const toAdd = bikeTypeIds.filter((b) => !existingIds.has(b));
    const added = await Promise.all(
      toAdd.map(async (bikeTypeId) => ({
        riderMeasurementId: id,
        bikeTypeId,
        order: await nextOrderFor(bikeTypeId),
      }))
    );

    await prisma.$transaction([
      prisma.riderMeasurement.update({ where: { id }, data: fields }),
      prisma.bikeTypeRiderMeasurement.deleteMany({
        where: { riderMeasurementId: id, bikeTypeId: { in: toRemove } },
      }),
      ...(added.length ? [prisma.bikeTypeRiderMeasurement.createMany({ data: added })] : []),
    ]);
    await logAudit({ userId: admin.id, action: "UPDATE", entity: "riderMeasurement", entityId: id });
    revalidatePath("/dashboard/configuration");
    return ok({ id });
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    console.error("updateRiderMeasurement failed:", e);
    return fail("Impossible de modifier la mesure. Réessayez.");
  }
}

export async function deleteRiderMeasurement(id: string): Promise<ActionResult<void>> {
  try {
    const admin = await requireAdmin();
    // Studies store values as JSON (no FK). Any value referencing a deleted
    // mesure is simply ignored when rendering, so studies stay intact.
    await prisma.riderMeasurement.delete({ where: { id } });
    await logAudit({ userId: admin.id, action: "DELETE", entity: "riderMeasurement", entityId: id });
    revalidatePath("/dashboard/configuration");
    return ok(undefined);
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return fail("Mesure introuvable.");
    }
    console.error("deleteRiderMeasurement failed:", e);
    return fail("Impossible de supprimer la mesure. Réessayez.");
  }
}

export async function toggleRiderMeasurement(id: string): Promise<ActionResult<{ isActive: boolean }>> {
  try {
    const admin = await requireAdmin();
    const current = await prisma.riderMeasurement.findUnique({ where: { id }, select: { isActive: true } });
    if (!current) return fail("Mesure introuvable.");

    const updated = await prisma.riderMeasurement.update({
      where: { id },
      data: { isActive: !current.isActive },
    });
    await logAudit({
      userId: admin.id,
      action: "UPDATE",
      entity: "riderMeasurement",
      entityId: id,
      metadata: { isActive: updated.isActive },
    });
    revalidatePath("/dashboard/configuration");
    return ok({ isActive: updated.isActive });
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    console.error("toggleRiderMeasurement failed:", e);
    return fail("Impossible de modifier la mesure. Réessayez.");
  }
}
