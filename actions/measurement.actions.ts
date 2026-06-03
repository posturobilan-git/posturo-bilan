"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { requireKine, requireAdmin } from "@/lib/auth";
import { ok, fail, formatZodError, type ActionResult } from "@/lib/action-result";
import { measurementSchema, type MeasurementInput } from "@/lib/validations/measurement.schema";
import type { Measurement, BikeType } from "@prisma/client";

export type MeasurementWithTypes = Measurement & {
  bikeTypes: Pick<BikeType, "id" | "name">[];
};

// ─── Queries ────────────────────────────────────────────────────────────────────

export async function getMeasurements(filters?: {
  search?: string;
}): Promise<MeasurementWithTypes[]> {
  const kine = await requireKine();

  return prisma.measurement.findMany({
    where: {
      ...(kine.role !== "ADMIN" && { isActive: true }),
      ...(filters?.search && {
        name: { contains: filters.search, mode: "insensitive" },
      }),
    },
    include: { bikeTypes: { select: { id: true, name: true } } },
    orderBy: [{ isActive: "desc" }, { isCommon: "desc" }, { order: "asc" }, { name: "asc" }],
  });
}

/**
 * Active côtes applicable to a study of the given bike type: the common trunk
 * plus those explicitly linked to this bike type, ordered for display.
 */
export async function getMeasurementsForBikeType(bikeTypeId: string): Promise<Measurement[]> {
  await requireKine();
  return prisma.measurement.findMany({
    where: {
      isActive: true,
      OR: [{ isCommon: true }, { bikeTypes: { some: { id: bikeTypeId } } }],
    },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
}

// ─── Mutations (ADMIN only) ─────────────────────────────────────────────────────

function relationData(input: MeasurementInput) {
  return {
    name: input.name,
    unit: input.unit,
    category: input.category,
    order: input.order,
    isCommon: input.isCommon,
    // A common measurement applies to all bike types, so it carries no explicit links.
    bikeTypeIds: input.isCommon ? [] : input.bikeTypeIds,
  };
}

export async function createMeasurement(
  data: MeasurementInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = measurementSchema.safeParse(data);
  if (!parsed.success) return fail(formatZodError(parsed.error));

  try {
    const admin = await requireAdmin();
    const { bikeTypeIds, ...fields } = relationData(parsed.data);
    const measurement = await prisma.measurement.create({
      data: {
        ...fields,
        createdById: admin.id,
        bikeTypes: { connect: bikeTypeIds.map((id) => ({ id })) },
      },
    });
    await logAudit({ userId: admin.id, action: "CREATE", entity: "measurement", entityId: measurement.id });
    revalidatePath("/bibliotheque");
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
    await prisma.measurement.update({
      where: { id },
      data: { ...fields, bikeTypes: { set: bikeTypeIds.map((bid) => ({ id: bid })) } },
    });
    await logAudit({ userId: admin.id, action: "UPDATE", entity: "measurement", entityId: id });
    revalidatePath("/bibliotheque");
    return ok({ id });
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    console.error("updateMeasurement failed:", e);
    return fail("Impossible de modifier la côte. Réessayez.");
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
    revalidatePath("/bibliotheque");
    return ok({ isActive: updated.isActive });
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    console.error("toggleMeasurement failed:", e);
    return fail("Impossible de modifier la côte. Réessayez.");
  }
}
