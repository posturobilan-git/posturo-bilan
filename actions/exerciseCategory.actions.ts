"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { requireKine, requireAdmin } from "@/lib/auth";
import { ok, fail, formatZodError, type ActionResult } from "@/lib/action-result";
import {
  exerciseCategorySchema,
  type ExerciseCategoryInput,
} from "@/lib/validations/exerciseCategory.schema";
import { Prisma, type ExerciseCategory } from "@prisma/client";

export type ExerciseCategoryWithCount = ExerciseCategory & {
  _count: { exercises: number };
};

// ─── Queries ────────────────────────────────────────────────────────────────────

/** Admins see every category (to manage them); other kinés only the active ones. */
export async function getExerciseCategories(): Promise<ExerciseCategoryWithCount[]> {
  const kine = await requireKine();
  return prisma.exerciseCategory.findMany({
    where: { ...(kine.role !== "ADMIN" && { isActive: true }) },
    include: { _count: { select: { exercises: true } } },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
}

/** Active categories only, for populating dropdowns/pickers. */
export async function getActiveExerciseCategories(): Promise<ExerciseCategory[]> {
  await requireKine();
  return prisma.exerciseCategory.findMany({
    where: { isActive: true },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
}

// ─── Mutations (ADMIN only) ─────────────────────────────────────────────────────

/** Next free display order for a category appended at the end of the list. */
async function nextOrder(): Promise<number> {
  const last = await prisma.exerciseCategory.findFirst({
    orderBy: { order: "desc" },
    select: { order: true },
  });
  return (last?.order ?? -1) + 1;
}

export async function createExerciseCategory(
  data: ExerciseCategoryInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = exerciseCategorySchema.safeParse(data);
  if (!parsed.success) return fail(formatZodError(parsed.error));

  try {
    const admin = await requireAdmin();
    const category = await prisma.exerciseCategory.create({
      data: { name: parsed.data.name, order: await nextOrder(), createdById: admin.id },
    });
    await logAudit({ userId: admin.id, action: "CREATE", entity: "exerciseCategory", entityId: category.id });
    revalidatePath("/dashboard/bibliotheque");
    return ok({ id: category.id });
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return fail("Une catégorie porte déjà ce nom.");
    }
    console.error("createExerciseCategory failed:", e);
    return fail("Impossible de créer la catégorie. Réessayez.");
  }
}

export async function updateExerciseCategory(
  id: string,
  data: ExerciseCategoryInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = exerciseCategorySchema.safeParse(data);
  if (!parsed.success) return fail(formatZodError(parsed.error));

  try {
    const admin = await requireAdmin();
    await prisma.exerciseCategory.update({ where: { id }, data: { name: parsed.data.name } });
    await logAudit({ userId: admin.id, action: "UPDATE", entity: "exerciseCategory", entityId: id });
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
    console.error("updateExerciseCategory failed:", e);
    return fail("Impossible de modifier la catégorie. Réessayez.");
  }
}

/**
 * Deletes a category — only when no exercise is attached. When some are, the
 * caller must say where they go (`reassignToId`, another ACTIVE category): they
 * are moved there and the category is deleted in the same transaction. Without
 * `reassignToId` the refusal reports how many exercises block the deletion, so
 * the UI can offer the reassignment (or deactivation).
 */
export async function deleteExerciseCategory(
  id: string,
  reassignToId?: string
): Promise<ActionResult<{ reassigned: number }>> {
  try {
    const admin = await requireAdmin();

    const category = await prisma.exerciseCategory.findUnique({
      where: { id },
      select: { id: true, _count: { select: { exercises: true } } },
    });
    if (!category) return fail("Catégorie introuvable.");

    const count = category._count.exercises;
    if (count > 0 && !reassignToId) {
      return fail(
        `Impossible de supprimer : ${count} exercice(s) utilisent cette catégorie. Réaffectez-les à une autre catégorie, ou désactivez celle-ci.`
      );
    }

    if (reassignToId) {
      if (reassignToId === id) return fail("Choisissez une autre catégorie pour les exercices.");
      const target = await prisma.exerciseCategory.findUnique({
        where: { id: reassignToId },
        select: { isActive: true },
      });
      if (!target?.isActive) return fail("Catégorie de destination introuvable ou désactivée.");
    }

    // Réaffectation + suppression atomiques : un exercice créé entre-temps dans
    // la catégorie fait échouer la contrainte FK (ON DELETE RESTRICT) et annule tout.
    const reassigned = await prisma.$transaction(async (tx) => {
      const moved = reassignToId
        ? await tx.exercise.updateMany({ where: { categoryId: id }, data: { categoryId: reassignToId } })
        : { count: 0 };
      await tx.exerciseCategory.delete({ where: { id } });
      return moved.count;
    });

    await logAudit({
      userId: admin.id,
      action: "DELETE",
      entity: "exerciseCategory",
      entityId: id,
      metadata: reassignToId ? { reassignedTo: reassignToId, reassigned } : undefined,
    });
    revalidatePath("/dashboard/bibliotheque");
    return ok({ reassigned });
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return fail("Catégorie introuvable.");
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      return fail("Impossible de supprimer : cette catégorie est encore utilisée. Réessayez.");
    }
    console.error("deleteExerciseCategory failed:", e);
    return fail("Impossible de supprimer la catégorie. Réessayez.");
  }
}

export async function toggleExerciseCategory(id: string): Promise<ActionResult<{ isActive: boolean }>> {
  try {
    const admin = await requireAdmin();
    const current = await prisma.exerciseCategory.findUnique({ where: { id }, select: { isActive: true } });
    if (!current) return fail("Catégorie introuvable.");

    const updated = await prisma.exerciseCategory.update({
      where: { id },
      data: { isActive: !current.isActive },
    });
    await logAudit({
      userId: admin.id,
      action: "UPDATE",
      entity: "exerciseCategory",
      entityId: id,
      metadata: { isActive: updated.isActive },
    });
    revalidatePath("/dashboard/bibliotheque");
    return ok({ isActive: updated.isActive });
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    console.error("toggleExerciseCategory failed:", e);
    return fail("Impossible de modifier la catégorie. Réessayez.");
  }
}

/**
 * Persists the display order from an ordered list of ids (top to bottom). A
 * category missing from the list (created meanwhile by another admin) keeps its
 * relative place after the listed ones, so positions stay unique.
 */
export async function reorderExerciseCategories(orderedIds: string[]): Promise<ActionResult<void>> {
  try {
    const admin = await requireAdmin();

    // Refuse an unknown or duplicated id rather than write an inconsistent order.
    const count = await prisma.exerciseCategory.count({ where: { id: { in: orderedIds } } });
    if (count !== orderedIds.length) {
      return fail("Certaines catégories sont introuvables.");
    }

    const others = await prisma.exerciseCategory.findMany({
      where: { id: { notIn: orderedIds } },
      select: { id: true },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    });
    const all = [...orderedIds, ...others.map((c) => c.id)];

    await prisma.$transaction(
      all.map((id, order) => prisma.exerciseCategory.update({ where: { id }, data: { order } }))
    );
    await logAudit({
      userId: admin.id,
      action: "UPDATE",
      entity: "exerciseCategory",
      entityId: "reorder",
      metadata: { count: all.length },
    });
    revalidatePath("/dashboard/bibliotheque");
    return ok(undefined);
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    console.error("reorderExerciseCategories failed:", e);
    return fail("Impossible de réordonner les catégories. Réessayez.");
  }
}
