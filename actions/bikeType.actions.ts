"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { requireKine, requireAdmin } from "@/lib/auth";
import { ok, fail, formatZodError, type ActionResult } from "@/lib/action-result";
import { bikeTypeSchema, type BikeTypeInput } from "@/lib/validations/bikeType.schema";
import type { BikeType } from "@prisma/client";

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
    revalidatePath("/bibliotheque");
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
    revalidatePath("/bibliotheque");
    return ok({ id });
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    console.error("updateBikeType failed:", e);
    return fail("Impossible de modifier le type de vélo. Réessayez.");
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
    revalidatePath("/bibliotheque");
    return ok({ isActive: updated.isActive });
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    console.error("toggleBikeType failed:", e);
    return fail("Impossible de modifier le type de vélo. Réessayez.");
  }
}
