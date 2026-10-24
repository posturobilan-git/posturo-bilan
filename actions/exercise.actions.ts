"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { requireKine, requireAdmin } from "@/lib/auth";
import { ok, fail, formatZodError, type ActionResult } from "@/lib/action-result";
import { exerciseSchema, type ExerciseInput } from "@/lib/validations/exercise.schema";
import { Prisma, type Exercise } from "@prisma/client";
import type { ListResult, PageQuery, SortDir } from "@/lib/pagination";
import { toSkipTake } from "@/lib/pagination";

export type ExerciseWithCount = Exercise & {
  _count: { studies: number };
  category: { id: string; name: string; isActive: boolean };
};

// ─── Query ────────────────────────────────────────────────────────────────────

function exerciseOrderBy(sort: string, dir: SortDir): Prisma.ExerciseOrderByWithRelationInput[] {
  const primary: Prisma.ExerciseOrderByWithRelationInput =
    sort === "createdAt" ? { createdAt: dir } : { name: dir };
  // Keep deactivated items at the bottom of the admin library regardless of sort.
  return [{ isActive: "desc" }, primary];
}

export async function getExercises(filters?: {
  search?: string;
  categoryId?: string;
  page?: PageQuery;
}): Promise<ListResult<ExerciseWithCount>> {
  const kine = await requireKine();

  const where: Prisma.ExerciseWhereInput = {
    // Non-admins only see the active library.
    ...(kine.role !== "ADMIN" && { isActive: true }),
    ...(filters?.categoryId && { categoryId: filters.categoryId }),
    ...(filters?.search && {
      OR: [
        { name: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
      ],
    }),
  };

  const page = filters?.page;
  const [items, total] = await Promise.all([
    prisma.exercise.findMany({
      where,
      include: {
        _count: { select: { studies: true } },
        category: { select: { id: true, name: true, isActive: true } },
      },
      orderBy: page ? exerciseOrderBy(page.sort, page.dir) : [{ isActive: "desc" }, { name: "asc" }],
      ...(page ? toSkipTake(page) : {}),
    }),
    prisma.exercise.count({ where }),
  ]);

  return { items, total };
}

// ─── Mutations (ADMIN only) ─────────────────────────────────────────────────────

/** Persisted fields: an emptied optional field is cleared (null), not left as it was. */
function fieldsFrom(input: ExerciseInput) {
  return {
    name: input.name,
    description: input.description,
    categoryId: input.categoryId,
    frequency: input.frequency?.trim() || null,
    duration: input.duration?.trim() || null,
    mediaUrl: input.mediaUrl?.trim() || null,
  };
}

/**
 * A category can receive an exercise only if it exists and is active — except the
 * one the exercise already belongs to (editing an exercise must not be blocked
 * because its category was deactivated since). Returns an error message, or null.
 */
async function categoryError(categoryId: string, keepCategoryId?: string): Promise<string | null> {
  if (categoryId === keepCategoryId) return null;
  const category = await prisma.exerciseCategory.findUnique({
    where: { id: categoryId },
    select: { isActive: true },
  });
  if (!category) return "Catégorie introuvable.";
  if (!category.isActive) return "Cette catégorie est désactivée.";
  return null;
}

export async function createExercise(data: ExerciseInput): Promise<ActionResult<{ id: string }>> {
  const parsed = exerciseSchema.safeParse(data);
  if (!parsed.success) return fail(formatZodError(parsed.error));

  try {
    const admin = await requireAdmin();
    const invalid = await categoryError(parsed.data.categoryId);
    if (invalid) return fail(invalid);

    const exercise = await prisma.exercise.create({
      data: { ...fieldsFrom(parsed.data), createdById: admin.id },
    });
    await logAudit({ userId: admin.id, action: "CREATE", entity: "exercise", entityId: exercise.id });
    revalidatePath("/dashboard/bibliotheque");
    return ok({ id: exercise.id });
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    console.error("createExercise failed:", e);
    return fail("Impossible de créer l'exercice. Réessayez.");
  }
}

export async function updateExercise(
  id: string,
  data: ExerciseInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = exerciseSchema.safeParse(data);
  if (!parsed.success) return fail(formatZodError(parsed.error));

  try {
    const admin = await requireAdmin();

    const current = await prisma.exercise.findUnique({ where: { id }, select: { categoryId: true } });
    if (!current) return fail("Exercice introuvable.");
    const invalid = await categoryError(parsed.data.categoryId, current.categoryId);
    if (invalid) return fail(invalid);

    await prisma.exercise.update({ where: { id }, data: fieldsFrom(parsed.data) });
    await logAudit({ userId: admin.id, action: "UPDATE", entity: "exercise", entityId: id });
    revalidatePath("/dashboard/bibliotheque");
    return ok({ id });
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    console.error("updateExercise failed:", e);
    return fail("Impossible de modifier l'exercice. Réessayez.");
  }
}

/**
 * Deletes an exercise — only one that was never prescribed. A prescribed exercise
 * is part of the history of the studies that use it: deactivate it instead (it
 * disappears from the study picker but stays on past studies and reports).
 */
export async function deleteExercise(id: string): Promise<ActionResult<void>> {
  try {
    const admin = await requireAdmin();

    const exercise = await prisma.exercise.findUnique({
      where: { id },
      select: { _count: { select: { studies: true } } },
    });
    if (!exercise) return fail("Exercice introuvable.");
    if (exercise._count.studies > 0) {
      return fail(
        `Impossible de supprimer : cet exercice est prescrit dans ${exercise._count.studies} étude(s). Désactivez-le plutôt.`
      );
    }

    // Conditional delete: if a study prescribes it between the check above and now,
    // nothing is deleted (the m2m link would otherwise be dropped silently).
    const { count } = await prisma.exercise.deleteMany({ where: { id, studies: { none: {} } } });
    if (count === 0) {
      return fail("Impossible de supprimer : cet exercice vient d'être prescrit. Désactivez-le plutôt.");
    }

    await logAudit({ userId: admin.id, action: "DELETE", entity: "exercise", entityId: id });
    revalidatePath("/dashboard/bibliotheque");
    return ok(undefined);
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    console.error("deleteExercise failed:", e);
    return fail("Impossible de supprimer l'exercice. Réessayez.");
  }
}

export async function toggleExercise(id: string): Promise<ActionResult<{ isActive: boolean }>> {
  try {
    const admin = await requireAdmin();
    const current = await prisma.exercise.findUnique({ where: { id }, select: { isActive: true } });
    if (!current) return fail("Exercice introuvable.");

    const updated = await prisma.exercise.update({
      where: { id },
      data: { isActive: !current.isActive },
    });
    await logAudit({
      userId: admin.id,
      action: "UPDATE",
      entity: "exercise",
      entityId: id,
      metadata: { isActive: updated.isActive },
    });
    revalidatePath("/dashboard/bibliotheque");
    return ok({ isActive: updated.isActive });
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    console.error("toggleExercise failed:", e);
    return fail("Impossible de modifier l'exercice. Réessayez.");
  }
}
