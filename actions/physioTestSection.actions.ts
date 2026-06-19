"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { requireKine, requireAdmin } from "@/lib/auth";
import { ok, fail, formatZodError, type ActionResult } from "@/lib/action-result";
import {
  physioTestSectionSchema,
  type PhysioTestSectionInput,
} from "@/lib/validations/physioTestSection.schema";
import { Prisma, type PhysioTestSection } from "@prisma/client";

export type PhysioTestSectionWithCount = PhysioTestSection & {
  _count: { physioTests: number };
};

// ─── Queries ────────────────────────────────────────────────────────────────────

/** All sections, in display order. Available to every kiné (read-only for non-admins). */
export async function getPhysioTestSections(): Promise<PhysioTestSectionWithCount[]> {
  await requireKine();
  return prisma.physioTestSection.findMany({
    include: { _count: { select: { physioTests: true } } },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
}

// ─── Mutations (ADMIN only) ─────────────────────────────────────────────────────

/** Next free display order for a section appended at the end of the list. */
async function nextOrder(): Promise<number> {
  const last = await prisma.physioTestSection.findFirst({
    orderBy: { order: "desc" },
    select: { order: true },
  });
  return (last?.order ?? -1) + 1;
}

export async function createPhysioTestSection(
  data: PhysioTestSectionInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = physioTestSectionSchema.safeParse(data);
  if (!parsed.success) return fail(formatZodError(parsed.error));

  try {
    const admin = await requireAdmin();
    const section = await prisma.physioTestSection.create({
      data: { name: parsed.data.name, order: await nextOrder(), createdById: admin.id },
    });
    await logAudit({
      userId: admin.id,
      action: "CREATE",
      entity: "physioTestSection",
      entityId: section.id,
    });
    revalidatePath("/dashboard/configuration");
    return ok({ id: section.id });
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    console.error("createPhysioTestSection failed:", e);
    return fail("Impossible de créer la section. Réessayez.");
  }
}

export async function updatePhysioTestSection(
  id: string,
  data: PhysioTestSectionInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = physioTestSectionSchema.safeParse(data);
  if (!parsed.success) return fail(formatZodError(parsed.error));

  try {
    const admin = await requireAdmin();
    await prisma.physioTestSection.update({ where: { id }, data: { name: parsed.data.name } });
    await logAudit({
      userId: admin.id,
      action: "UPDATE",
      entity: "physioTestSection",
      entityId: id,
    });
    revalidatePath("/dashboard/configuration");
    return ok({ id });
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return fail("Section introuvable.");
    }
    console.error("updatePhysioTestSection failed:", e);
    return fail("Impossible de modifier la section. Réessayez.");
  }
}

export async function deletePhysioTestSection(id: string): Promise<ActionResult<void>> {
  try {
    const admin = await requireAdmin();
    // Les tests liés repassent simplement « sans section » (FK onDelete: SetNull).
    await prisma.physioTestSection.delete({ where: { id } });
    await logAudit({
      userId: admin.id,
      action: "DELETE",
      entity: "physioTestSection",
      entityId: id,
    });
    revalidatePath("/dashboard/configuration");
    return ok(undefined);
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return fail("Section introuvable.");
    }
    console.error("deletePhysioTestSection failed:", e);
    return fail("Impossible de supprimer la section. Réessayez.");
  }
}

/** Persists the global section order from an ordered list of ids (top to bottom). */
export async function reorderPhysioTestSections(
  orderedIds: string[]
): Promise<ActionResult<void>> {
  try {
    const admin = await requireAdmin();
    await prisma.$transaction(
      orderedIds.map((id, order) =>
        prisma.physioTestSection.update({ where: { id }, data: { order } })
      )
    );
    await logAudit({
      userId: admin.id,
      action: "UPDATE",
      entity: "physioTestSection",
      entityId: "reorder",
      metadata: { count: orderedIds.length },
    });
    revalidatePath("/dashboard/configuration");
    return ok(undefined);
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    console.error("reorderPhysioTestSections failed:", e);
    return fail("Impossible de réordonner les sections. Réessayez.");
  }
}
