"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { requireKine, requireAdmin } from "@/lib/auth";
import { ok, fail, formatZodError, type ActionResult } from "@/lib/action-result";
import { physioTestSchema, type PhysioTestInput } from "@/lib/validations/physioTest.schema";
import { Prisma, type PhysioTest, type BikeType } from "@prisma/client";

export type PhysioTestWithTypes = PhysioTest & {
  bikeTypes: Pick<BikeType, "id" | "name">[];
};

// ─── Queries ────────────────────────────────────────────────────────────────────

export async function getPhysioTests(filters?: {
  search?: string;
}): Promise<PhysioTestWithTypes[]> {
  const kine = await requireKine();

  const rows = await prisma.physioTest.findMany({
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
  return rows.map(({ bikeTypeLinks, ...t }) => ({
    ...t,
    bikeTypes: bikeTypeLinks.map((l) => l.bikeType),
  }));
}

/**
 * Active physio tests applicable to a study of the given bike type, in display
 * order: the common trunk first (alphabetical), then those explicitly configured
 * for this bike type in their configured order.
 */
export async function getPhysioTestsForBikeType(bikeTypeId: string): Promise<PhysioTest[]> {
  await requireKine();

  const [common, links] = await Promise.all([
    prisma.physioTest.findMany({
      where: { isActive: true, isCommon: true },
      orderBy: { name: "asc" },
    }),
    prisma.bikeTypePhysioTest.findMany({
      where: { bikeTypeId, physioTest: { isActive: true, isCommon: false } },
      include: { physioTest: true },
      orderBy: { order: "asc" },
    }),
  ]);

  return [...common, ...links.map((l) => l.physioTest)];
}

// ─── Mutations (ADMIN only) ─────────────────────────────────────────────────────

function relationData(input: PhysioTestInput) {
  return {
    name: input.name,
    description: input.description?.trim() || null,
    outputType: input.outputType,
    // Unit is only meaningful for a numeric (VALUE) result.
    unit: input.outputType === "VALUE" ? input.unit ?? null : null,
    isCommon: input.isCommon,
    // A common test applies to all bike types, so it carries no explicit links.
    bikeTypeIds: input.isCommon ? [] : input.bikeTypeIds,
  };
}

/** Next free display order for a test appended to a given bike type's config. */
async function nextOrderFor(bikeTypeId: string): Promise<number> {
  const last = await prisma.bikeTypePhysioTest.findFirst({
    where: { bikeTypeId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  return (last?.order ?? -1) + 1;
}

export async function createPhysioTest(
  data: PhysioTestInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = physioTestSchema.safeParse(data);
  if (!parsed.success) return fail(formatZodError(parsed.error));

  try {
    const admin = await requireAdmin();
    const { bikeTypeIds, ...fields } = relationData(parsed.data);

    // New tests are appended to the end of each bike type's configuration.
    const links = await Promise.all(
      bikeTypeIds.map(async (bikeTypeId) => ({ bikeTypeId, order: await nextOrderFor(bikeTypeId) }))
    );

    const test = await prisma.physioTest.create({
      data: { ...fields, createdById: admin.id, bikeTypeLinks: { create: links } },
    });
    await logAudit({ userId: admin.id, action: "CREATE", entity: "physioTest", entityId: test.id });
    revalidatePath("/dashboard/configuration");
    return ok({ id: test.id });
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    console.error("createPhysioTest failed:", e);
    return fail("Impossible de créer le test physio. Réessayez.");
  }
}

export async function updatePhysioTest(
  id: string,
  data: PhysioTestInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = physioTestSchema.safeParse(data);
  if (!parsed.success) return fail(formatZodError(parsed.error));

  try {
    const admin = await requireAdmin();
    const { bikeTypeIds, ...fields } = relationData(parsed.data);

    // Reconcile bike-type links without disturbing the configured order of the
    // ones that stay: drop the removed links, append any newly-added ones.
    const existing = await prisma.bikeTypePhysioTest.findMany({
      where: { physioTestId: id },
      select: { bikeTypeId: true },
    });
    const existingIds = new Set(existing.map((l) => l.bikeTypeId));
    const keep = new Set(bikeTypeIds);
    const toRemove = [...existingIds].filter((b) => !keep.has(b));
    const toAdd = bikeTypeIds.filter((b) => !existingIds.has(b));
    const added = await Promise.all(
      toAdd.map(async (bikeTypeId) => ({
        physioTestId: id,
        bikeTypeId,
        order: await nextOrderFor(bikeTypeId),
      }))
    );

    await prisma.$transaction([
      prisma.physioTest.update({ where: { id }, data: fields }),
      prisma.bikeTypePhysioTest.deleteMany({
        where: { physioTestId: id, bikeTypeId: { in: toRemove } },
      }),
      ...(added.length ? [prisma.bikeTypePhysioTest.createMany({ data: added })] : []),
    ]);
    await logAudit({ userId: admin.id, action: "UPDATE", entity: "physioTest", entityId: id });
    revalidatePath("/dashboard/configuration");
    return ok({ id });
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    console.error("updatePhysioTest failed:", e);
    return fail("Impossible de modifier le test physio. Réessayez.");
  }
}

export async function deletePhysioTest(id: string): Promise<ActionResult<void>> {
  try {
    const admin = await requireAdmin();
    // Studies store results as JSON (no FK). Any value referencing a deleted test
    // is simply ignored when rendering, so studies stay intact.
    await prisma.physioTest.delete({ where: { id } });
    await logAudit({ userId: admin.id, action: "DELETE", entity: "physioTest", entityId: id });
    revalidatePath("/dashboard/configuration");
    return ok(undefined);
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return fail("Test physio introuvable.");
    }
    console.error("deletePhysioTest failed:", e);
    return fail("Impossible de supprimer le test physio. Réessayez.");
  }
}

export async function togglePhysioTest(id: string): Promise<ActionResult<{ isActive: boolean }>> {
  try {
    const admin = await requireAdmin();
    const current = await prisma.physioTest.findUnique({ where: { id }, select: { isActive: true } });
    if (!current) return fail("Test physio introuvable.");

    const updated = await prisma.physioTest.update({
      where: { id },
      data: { isActive: !current.isActive },
    });
    await logAudit({
      userId: admin.id,
      action: "UPDATE",
      entity: "physioTest",
      entityId: id,
      metadata: { isActive: updated.isActive },
    });
    revalidatePath("/dashboard/configuration");
    return ok({ isActive: updated.isActive });
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    console.error("togglePhysioTest failed:", e);
    return fail("Impossible de modifier le test physio. Réessayez.");
  }
}
