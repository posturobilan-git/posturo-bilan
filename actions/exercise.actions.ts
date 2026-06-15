"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { requireKine, requireAdmin } from "@/lib/auth";
import { ok, fail, formatZodError, type ActionResult } from "@/lib/action-result";
import { exerciseSchema } from "@/lib/validations/exercise.schema";
import { ExerciseCategory, Prisma, type Exercise } from "@prisma/client";
import type { ListResult, PageQuery, SortDir } from "@/lib/pagination";
import { toSkipTake } from "@/lib/pagination";
import { z } from "zod";

export type ExerciseWithCount = Exercise & { _count: { studies: number } };

// ─── Query ────────────────────────────────────────────────────────────────────

function exerciseOrderBy(sort: string, dir: SortDir): Prisma.ExerciseOrderByWithRelationInput[] {
  const primary: Prisma.ExerciseOrderByWithRelationInput =
    sort === "createdAt" ? { createdAt: dir } : { name: dir };
  // Keep deactivated items at the bottom of the admin library regardless of sort.
  return [{ isActive: "desc" }, primary];
}

export async function getExercises(filters?: {
  search?: string;
  category?: ExerciseCategory;
  page?: PageQuery;
}): Promise<ListResult<ExerciseWithCount>> {
  const kine = await requireKine();

  const where: Prisma.ExerciseWhereInput = {
    // Non-admins only see the active library.
    ...(kine.role !== "ADMIN" && { isActive: true }),
    ...(filters?.category && { category: filters.category }),
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
      include: { _count: { select: { studies: true } } },
      orderBy: page ? exerciseOrderBy(page.sort, page.dir) : [{ isActive: "desc" }, { name: "asc" }],
      ...(page ? toSkipTake(page) : {}),
    }),
    prisma.exercise.count({ where }),
  ]);

  return { items, total };
}

// ─── Mutations (ADMIN only) ─────────────────────────────────────────────────────

export async function createExercise(
  data: z.infer<typeof exerciseSchema>
): Promise<ActionResult<{ id: string }>> {
  const parsed = exerciseSchema.safeParse(data);
  if (!parsed.success) return fail(formatZodError(parsed.error));

  try {
    const admin = await requireAdmin();
    const exercise = await prisma.exercise.create({
      data: { ...parsed.data, createdById: admin.id },
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
  data: z.infer<typeof exerciseSchema>
): Promise<ActionResult<{ id: string }>> {
  const parsed = exerciseSchema.safeParse(data);
  if (!parsed.success) return fail(formatZodError(parsed.error));

  try {
    const admin = await requireAdmin();
    await prisma.exercise.update({ where: { id }, data: parsed.data });
    await logAudit({ userId: admin.id, action: "UPDATE", entity: "exercise", entityId: id });
    revalidatePath("/dashboard/bibliotheque");
    return ok({ id });
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    console.error("updateExercise failed:", e);
    return fail("Impossible de modifier l'exercice. Réessayez.");
  }
}

export async function deleteExercise(id: string): Promise<ActionResult<void>> {
  try {
    const admin = await requireAdmin();
    // The implicit Study↔Exercise relation cascades, so the exercise is simply
    // removed from any studies that prescribed it — those studies are preserved.
    await prisma.exercise.delete({ where: { id } });
    await logAudit({ userId: admin.id, action: "DELETE", entity: "exercise", entityId: id });
    revalidatePath("/dashboard/bibliotheque");
    return ok(undefined);
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return fail("Exercice introuvable.");
    }
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
