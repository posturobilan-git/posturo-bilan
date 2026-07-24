"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { requireKine, requireAdmin } from "@/lib/auth";
import { ok, fail, formatZodError, type ActionResult } from "@/lib/action-result";
import {
  componentCategorySchema,
  type ComponentCategoryInput,
} from "@/lib/validations/componentCategory.schema";
import { Prisma, type ComponentCategory } from "@prisma/client";

export type ComponentCategoryWithCount = ComponentCategory & {
  _count: { components: number; attributes: number };
};

// ─── Queries ────────────────────────────────────────────────────────────────────

export async function getCategories(filters?: { search?: string }): Promise<ComponentCategoryWithCount[]> {
  const kine = await requireKine();
  return prisma.componentCategory.findMany({
    where: {
      ...(kine.role !== "ADMIN" && { isActive: true }),
      ...(filters?.search && { name: { contains: filters.search, mode: "insensitive" } }),
    },
    include: { _count: { select: { components: true, attributes: true } } },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
}

/** Active categories only, for populating dropdowns/pickers. */
export async function getActiveCategories(): Promise<ComponentCategory[]> {
  await requireKine();
  return prisma.componentCategory.findMany({
    where: { isActive: true },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
}

// ─── Mutations (ADMIN only) ─────────────────────────────────────────────────────

/** Next free display order for a category appended at the end of the list. */
async function nextOrder(): Promise<number> {
  const last = await prisma.componentCategory.findFirst({
    orderBy: { order: "desc" },
    select: { order: true },
  });
  return (last?.order ?? -1) + 1;
}

export async function createCategory(data: ComponentCategoryInput): Promise<ActionResult<{ id: string }>> {
  const parsed = componentCategorySchema.safeParse(data);
  if (!parsed.success) return fail(formatZodError(parsed.error));

  try {
    const admin = await requireAdmin();
    const category = await prisma.componentCategory.create({
      data: { name: parsed.data.name, order: await nextOrder(), createdById: admin.id },
    });
    await logAudit({ userId: admin.id, action: "CREATE", entity: "componentCategory", entityId: category.id });
    revalidatePath("/dashboard/bibliotheque");
    return ok({ id: category.id });
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return fail("Une catégorie porte déjà ce nom.");
    }
    console.error("createCategory failed:", e);
    return fail("Impossible de créer la catégorie. Réessayez.");
  }
}

export async function updateCategory(
  id: string,
  data: ComponentCategoryInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = componentCategorySchema.safeParse(data);
  if (!parsed.success) return fail(formatZodError(parsed.error));

  try {
    const admin = await requireAdmin();
    await prisma.componentCategory.update({ where: { id }, data: { name: parsed.data.name } });
    await logAudit({ userId: admin.id, action: "UPDATE", entity: "componentCategory", entityId: id });
    revalidatePath("/dashboard/bibliotheque");
    return ok({ id });
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return fail("Une catégorie porte déjà ce nom.");
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return fail("Catégorie introuvable.");
    }
    console.error("updateCategory failed:", e);
    return fail("Impossible de modifier la catégorie. Réessayez.");
  }
}

export async function deleteCategory(id: string): Promise<ActionResult<void>> {
  try {
    const admin = await requireAdmin();

    // A component's / attribute's category is a required relation — refuse to
    // delete a category still in use (that would corrupt those rows). Same
    // guard-then-refuse pattern as deleteBikeType's study-count check.
    const [componentCount, attributeCount] = await Promise.all([
      prisma.bikeComponent.count({ where: { categoryId: id } }),
      prisma.componentAttribute.count({ where: { categoryId: id } }),
    ]);
    if (componentCount > 0 || attributeCount > 0) {
      return fail(
        `Impossible de supprimer : ${componentCount} composant(s) et ${attributeCount} attribut(s) utilisent cette catégorie. Désactivez-la plutôt.`
      );
    }

    await prisma.componentCategory.delete({ where: { id } });
    await logAudit({ userId: admin.id, action: "DELETE", entity: "componentCategory", entityId: id });
    revalidatePath("/dashboard/bibliotheque");
    return ok(undefined);
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return fail("Catégorie introuvable.");
    }
    // Course rare : un composant/attribut créé entre le comptage ci-dessus et
    // ce DELETE ferait échouer la contrainte FK (ON DELETE RESTRICT) — même
    // message que le refus explicite plutôt que l'erreur générique.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      return fail("Impossible de supprimer : cette catégorie est encore utilisée. Désactivez-la plutôt.");
    }
    console.error("deleteCategory failed:", e);
    return fail("Impossible de supprimer la catégorie. Réessayez.");
  }
}

export async function toggleCategory(id: string): Promise<ActionResult<{ isActive: boolean }>> {
  try {
    const admin = await requireAdmin();
    const current = await prisma.componentCategory.findUnique({ where: { id }, select: { isActive: true } });
    if (!current) return fail("Catégorie introuvable.");

    const updated = await prisma.componentCategory.update({
      where: { id },
      data: { isActive: !current.isActive },
    });
    await logAudit({
      userId: admin.id,
      action: "UPDATE",
      entity: "componentCategory",
      entityId: id,
      metadata: { isActive: updated.isActive },
    });
    revalidatePath("/dashboard/bibliotheque");
    return ok({ isActive: updated.isActive });
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    console.error("toggleCategory failed:", e);
    return fail("Impossible de modifier la catégorie. Réessayez.");
  }
}

/** Persists the global category order from an ordered list of ids (top to bottom). */
export async function reorderCategories(orderedIds: string[]): Promise<ActionResult<void>> {
  try {
    const admin = await requireAdmin();

    // Garde-fou : mêmes vérifications que reorderComponentAttributes — refuse
    // un id inconnu/dupliqué plutôt que d'écrire un ordre partiel ou incohérent.
    const count = await prisma.componentCategory.count({ where: { id: { in: orderedIds } } });
    if (count !== orderedIds.length) {
      return fail("Certaines catégories sont introuvables.");
    }

    await prisma.$transaction(
      orderedIds.map((id, order) => prisma.componentCategory.update({ where: { id }, data: { order } }))
    );
    await logAudit({
      userId: admin.id,
      action: "UPDATE",
      entity: "componentCategory",
      entityId: "reorder",
      metadata: { count: orderedIds.length },
    });
    revalidatePath("/dashboard/bibliotheque");
    return ok(undefined);
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    console.error("reorderCategories failed:", e);
    return fail("Impossible de réordonner les catégories. Réessayez.");
  }
}
