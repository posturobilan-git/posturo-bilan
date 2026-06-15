"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { requireKine, requireAdmin } from "@/lib/auth";
import { ok, fail, formatZodError, type ActionResult } from "@/lib/action-result";
import { measurementSchema, type MeasurementInput } from "@/lib/validations/measurement.schema";
import { Prisma, type Measurement, type BikeType } from "@prisma/client";

export type MeasurementWithTypes = Measurement & {
  bikeTypes: Pick<BikeType, "id" | "name">[];
};

// ─── Queries ────────────────────────────────────────────────────────────────────

export async function getMeasurements(filters?: {
  search?: string;
}): Promise<MeasurementWithTypes[]> {
  const kine = await requireKine();

  const rows = await prisma.measurement.findMany({
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
 * Active côtes applicable to a study of the given bike type, in display order:
 * the common trunk first (alphabetical), then those explicitly configured for
 * this bike type in their configured order.
 */
export async function getMeasurementsForBikeType(bikeTypeId: string): Promise<Measurement[]> {
  await requireKine();

  const [common, links] = await Promise.all([
    prisma.measurement.findMany({
      where: { isActive: true, isCommon: true },
      orderBy: { name: "asc" },
    }),
    prisma.bikeTypeMeasurement.findMany({
      where: { bikeTypeId, measurement: { isActive: true, isCommon: false } },
      include: { measurement: true },
      orderBy: { order: "asc" },
    }),
  ]);

  return [...common, ...links.map((l) => l.measurement)];
}

// ─── Mutations (ADMIN only) ─────────────────────────────────────────────────────

function relationData(input: MeasurementInput) {
  return {
    name: input.name,
    unit: input.unit,
    category: input.category,
    isCommon: input.isCommon,
    // A common measurement applies to all bike types, so it carries no explicit links.
    bikeTypeIds: input.isCommon ? [] : input.bikeTypeIds,
  };
}

/** Next free display order for a côte appended to a given bike type's config. */
async function nextOrderFor(bikeTypeId: string): Promise<number> {
  const last = await prisma.bikeTypeMeasurement.findFirst({
    where: { bikeTypeId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  return (last?.order ?? -1) + 1;
}

export async function createMeasurement(
  data: MeasurementInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = measurementSchema.safeParse(data);
  if (!parsed.success) return fail(formatZodError(parsed.error));

  try {
    const admin = await requireAdmin();
    const { bikeTypeIds, ...fields } = relationData(parsed.data);

    // New côtes are appended to the end of each bike type's configuration.
    const links = await Promise.all(
      bikeTypeIds.map(async (bikeTypeId) => ({ bikeTypeId, order: await nextOrderFor(bikeTypeId) }))
    );

    const measurement = await prisma.measurement.create({
      data: {
        ...fields,
        createdById: admin.id,
        bikeTypeLinks: { create: links },
      },
    });
    await logAudit({ userId: admin.id, action: "CREATE", entity: "measurement", entityId: measurement.id });
    revalidatePath("/dashboard/configuration");
    return ok({ id: measurement.id });
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    console.error("createMeasurement failed:", e);
    return fail("Impossible de créer la côte. Réessayez.");
  }
}

export async function updateMeasurement(
  id: string,
  data: MeasurementInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = measurementSchema.safeParse(data);
  if (!parsed.success) return fail(formatZodError(parsed.error));

  try {
    const admin = await requireAdmin();
    const { bikeTypeIds, ...fields } = relationData(parsed.data);

    // Reconcile bike-type links without disturbing the configured order of the
    // ones that stay: drop the removed links, append any newly-added ones.
    const existing = await prisma.bikeTypeMeasurement.findMany({
      where: { measurementId: id },
      select: { bikeTypeId: true },
    });
    const existingIds = new Set(existing.map((l) => l.bikeTypeId));
    const keep = new Set(bikeTypeIds);
    const toRemove = [...existingIds].filter((b) => !keep.has(b));
    const toAdd = bikeTypeIds.filter((b) => !existingIds.has(b));
    const added = await Promise.all(
      toAdd.map(async (bikeTypeId) => ({
        measurementId: id,
        bikeTypeId,
        order: await nextOrderFor(bikeTypeId),
      }))
    );

    await prisma.$transaction([
      prisma.measurement.update({ where: { id }, data: fields }),
      prisma.bikeTypeMeasurement.deleteMany({
        where: { measurementId: id, bikeTypeId: { in: toRemove } },
      }),
      ...(added.length ? [prisma.bikeTypeMeasurement.createMany({ data: added })] : []),
    ]);
    await logAudit({ userId: admin.id, action: "UPDATE", entity: "measurement", entityId: id });
    revalidatePath("/dashboard/configuration");
    return ok({ id });
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    console.error("updateMeasurement failed:", e);
    return fail("Impossible de modifier la côte. Réessayez.");
  }
}

export async function deleteMeasurement(id: string): Promise<ActionResult<void>> {
  try {
    const admin = await requireAdmin();
    // Studies store côte values as JSON (no FK). Any value referencing a deleted
    // côte is simply ignored when rendering, so studies stay intact.
    await prisma.measurement.delete({ where: { id } });
    await logAudit({ userId: admin.id, action: "DELETE", entity: "measurement", entityId: id });
    revalidatePath("/dashboard/configuration");
    return ok(undefined);
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return fail("Côte introuvable.");
    }
    console.error("deleteMeasurement failed:", e);
    return fail("Impossible de supprimer la côte. Réessayez.");
  }
}

export async function toggleMeasurement(id: string): Promise<ActionResult<{ isActive: boolean }>> {
  try {
    const admin = await requireAdmin();
    const current = await prisma.measurement.findUnique({ where: { id }, select: { isActive: true } });
    if (!current) return fail("Côte introuvable.");

    const updated = await prisma.measurement.update({
      where: { id },
      data: { isActive: !current.isActive },
    });
    await logAudit({
      userId: admin.id,
      action: "UPDATE",
      entity: "measurement",
      entityId: id,
      metadata: { isActive: updated.isActive },
    });
    revalidatePath("/dashboard/configuration");
    return ok({ isActive: updated.isActive });
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    console.error("toggleMeasurement failed:", e);
    return fail("Impossible de modifier la côte. Réessayez.");
  }
}
