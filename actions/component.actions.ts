"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { requireKine, requireAdmin } from "@/lib/auth";
import { ok, fail, formatZodError, type ActionResult } from "@/lib/action-result";
import { componentSchema } from "@/lib/validations/component.schema";
import { ComponentCategory, type BikeComponent } from "@prisma/client";
import { z } from "zod";

export type ComponentWithCount = BikeComponent & { _count: { studies: number } };

// ─── Query ────────────────────────────────────────────────────────────────────

export async function getComponents(filters?: {
  search?: string;
  category?: ComponentCategory;
}): Promise<ComponentWithCount[]> {
  const kine = await requireKine();

  return prisma.bikeComponent.findMany({
    where: {
      ...(kine.role !== "ADMIN" && { isActive: true }),
      ...(filters?.category && { category: filters.category }),
      ...(filters?.search && {
        OR: [
          { name: { contains: filters.search, mode: "insensitive" } },
          { brand: { contains: filters.search, mode: "insensitive" } },
          { model: { contains: filters.search, mode: "insensitive" } },
        ],
      }),
    },
    include: { _count: { select: { studies: true } } },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
}

// ─── Mutations (ADMIN only) ─────────────────────────────────────────────────────

export async function createComponent(
  data: z.infer<typeof componentSchema>
): Promise<ActionResult<{ id: string }>> {
  const parsed = componentSchema.safeParse(data);
  if (!parsed.success) return fail(formatZodError(parsed.error));

  try {
    const admin = await requireAdmin();
    const component = await prisma.bikeComponent.create({
      data: { ...parsed.data, createdById: admin.id },
    });
    await logAudit({ userId: admin.id, action: "CREATE", entity: "component", entityId: component.id });
    revalidatePath("/bibliotheque");
    return ok({ id: component.id });
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    console.error("createComponent failed:", e);
    return fail("Impossible de créer le composant. Réessayez.");
  }
}

export async function updateComponent(
  id: string,
  data: z.infer<typeof componentSchema>
): Promise<ActionResult<{ id: string }>> {
  const parsed = componentSchema.safeParse(data);
  if (!parsed.success) return fail(formatZodError(parsed.error));

  try {
    const admin = await requireAdmin();
    await prisma.bikeComponent.update({ where: { id }, data: parsed.data });
    await logAudit({ userId: admin.id, action: "UPDATE", entity: "component", entityId: id });
    revalidatePath("/bibliotheque");
    return ok({ id });
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    console.error("updateComponent failed:", e);
    return fail("Impossible de modifier le composant. Réessayez.");
  }
}

export async function toggleComponent(id: string): Promise<ActionResult<{ isActive: boolean }>> {
  try {
    const admin = await requireAdmin();
    const current = await prisma.bikeComponent.findUnique({ where: { id }, select: { isActive: true } });
    if (!current) return fail("Composant introuvable.");

    const updated = await prisma.bikeComponent.update({
      where: { id },
      data: { isActive: !current.isActive },
    });
    await logAudit({
      userId: admin.id,
      action: "UPDATE",
      entity: "component",
      entityId: id,
      metadata: { isActive: updated.isActive },
    });
    revalidatePath("/bibliotheque");
    return ok({ isActive: updated.isActive });
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    console.error("toggleComponent failed:", e);
    return fail("Impossible de modifier le composant. Réessayez.");
  }
}
