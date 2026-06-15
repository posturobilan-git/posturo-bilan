"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { requireKine, requireAdmin } from "@/lib/auth";
import { ok, fail, formatZodError, type ActionResult } from "@/lib/action-result";
import { componentSchema } from "@/lib/validations/component.schema";
import { ComponentCategory, Prisma, type BikeComponent, type BikeType } from "@prisma/client";
import type { ListResult, PageQuery, SortDir } from "@/lib/pagination";
import { toSkipTake } from "@/lib/pagination";
import { z } from "zod";

export type ComponentWithCount = BikeComponent & {
  _count: { studies: number };
  bikeTypes: Pick<BikeType, "id" | "name">[];
};

// ─── Query ────────────────────────────────────────────────────────────────────

function componentOrderBy(sort: string, dir: SortDir): Prisma.BikeComponentOrderByWithRelationInput[] {
  const primary: Prisma.BikeComponentOrderByWithRelationInput =
    sort === "createdAt" ? { createdAt: dir } : sort === "category" ? { category: dir } : { name: dir };
  return [{ isActive: "desc" }, primary];
}

export async function getComponents(filters?: {
  search?: string;
  category?: ComponentCategory;
  page?: PageQuery;
}): Promise<ListResult<ComponentWithCount>> {
  const kine = await requireKine();

  const where: Prisma.BikeComponentWhereInput = {
    ...(kine.role !== "ADMIN" && { isActive: true }),
    ...(filters?.category && { category: filters.category }),
    ...(filters?.search && {
      OR: [
        { name: { contains: filters.search, mode: "insensitive" } },
        { brand: { contains: filters.search, mode: "insensitive" } },
        { model: { contains: filters.search, mode: "insensitive" } },
      ],
    }),
  };

  const page = filters?.page;
  const [items, total] = await Promise.all([
    prisma.bikeComponent.findMany({
      where,
      include: {
        _count: { select: { studies: true } },
        bikeTypes: { select: { id: true, name: true } },
      },
      orderBy: page ? componentOrderBy(page.sort, page.dir) : [{ isActive: "desc" }, { name: "asc" }],
      ...(page ? toSkipTake(page) : {}),
    }),
    prisma.bikeComponent.count({ where }),
  ]);

  return { items, total };
}

// ─── Mutations (ADMIN only) ─────────────────────────────────────────────────────

export async function createComponent(
  data: z.infer<typeof componentSchema>
): Promise<ActionResult<{ id: string }>> {
  const parsed = componentSchema.safeParse(data);
  if (!parsed.success) return fail(formatZodError(parsed.error));

  try {
    const admin = await requireAdmin();
    const { bikeTypeIds, ...fields } = parsed.data;
    const component = await prisma.bikeComponent.create({
      data: {
        ...fields,
        createdById: admin.id,
        bikeTypes: { connect: bikeTypeIds.map((id) => ({ id })) },
      },
    });
    await logAudit({ userId: admin.id, action: "CREATE", entity: "component", entityId: component.id });
    revalidatePath("/dashboard/bibliotheque");
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
    const { bikeTypeIds, ...fields } = parsed.data;
    await prisma.bikeComponent.update({
      where: { id },
      data: { ...fields, bikeTypes: { set: bikeTypeIds.map((bid) => ({ id: bid })) } },
    });
    await logAudit({ userId: admin.id, action: "UPDATE", entity: "component", entityId: id });
    revalidatePath("/dashboard/bibliotheque");
    return ok({ id });
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    console.error("updateComponent failed:", e);
    return fail("Impossible de modifier le composant. Réessayez.");
  }
}

export async function deleteComponent(id: string): Promise<ActionResult<void>> {
  try {
    const admin = await requireAdmin();
    // The implicit Study↔Component relation cascades, so the component is simply
    // removed from any studies that used it — those studies are preserved.
    await prisma.bikeComponent.delete({ where: { id } });
    await logAudit({ userId: admin.id, action: "DELETE", entity: "component", entityId: id });
    revalidatePath("/dashboard/bibliotheque");
    return ok(undefined);
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return fail("Composant introuvable.");
    }
    console.error("deleteComponent failed:", e);
    return fail("Impossible de supprimer le composant. Réessayez.");
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
    revalidatePath("/dashboard/bibliotheque");
    return ok({ isActive: updated.isActive });
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    console.error("toggleComponent failed:", e);
    return fail("Impossible de modifier le composant. Réessayez.");
  }
}
