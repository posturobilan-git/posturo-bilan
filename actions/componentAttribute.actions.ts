"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { requireKine, requireAdmin } from "@/lib/auth";
import { ok, fail, formatZodError, type ActionResult } from "@/lib/action-result";
import {
  componentAttributeSchema,
  type ComponentAttributeInput,
} from "@/lib/validations/componentAttribute.schema";
import { Prisma, type ComponentAttribute } from "@prisma/client";

export type ComponentAttributeWithCount = ComponentAttribute & {
  _count: { values: number };
};

// ─── Queries ────────────────────────────────────────────────────────────────────

export async function getComponentAttributes(categoryId: string): Promise<ComponentAttributeWithCount[]> {
  const kine = await requireKine();
  return prisma.componentAttribute.findMany({
    where: {
      categoryId,
      ...(kine.role !== "ADMIN" && { isActive: true }),
    },
    include: { _count: { select: { values: true } } },
    orderBy: { order: "asc" },
  });
}

/** All active attributes, grouped by categoryId — feeds the dynamic component form,
 * the library's attribute filters, and the manager modal in one shared fetch. */
export async function getAttributesByCategory(): Promise<Record<string, ComponentAttribute[]>> {
  await requireKine();
  const [categories, attributes] = await Promise.all([
    prisma.componentCategory.findMany({ select: { id: true } }),
    prisma.componentAttribute.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
    }),
  ]);

  const grouped: Record<string, ComponentAttribute[]> = Object.fromEntries(
    categories.map((c) => [c.id, []])
  );
  for (const attr of attributes) (grouped[attr.categoryId] ??= []).push(attr);
  return grouped;
}

// ─── Mutations (ADMIN only) ─────────────────────────────────────────────────────

function sanitizeKey(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "") // accents (é → e, etc.)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Next free display order for an attribute appended at the end of a category's list. */
async function nextOrderFor(categoryId: string): Promise<number> {
  const last = await prisma.componentAttribute.findFirst({
    where: { categoryId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  return (last?.order ?? -1) + 1;
}

/** Rejects a duplicate active name within the category (CSV import matches columns
 * by name, so a collision would make that ambiguous). */
async function assertNameAvailable(
  categoryId: string,
  name: string,
  excludeId?: string
): Promise<boolean> {
  const existing = await prisma.componentAttribute.findFirst({
    where: {
      categoryId,
      isActive: true,
      name: { equals: name.trim(), mode: "insensitive" },
      ...(excludeId && { id: { not: excludeId } }),
    },
    select: { id: true },
  });
  return !existing;
}

export async function createComponentAttribute(
  categoryId: string,
  data: ComponentAttributeInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = componentAttributeSchema.safeParse(data);
  if (!parsed.success) return fail(formatZodError(parsed.error));

  try {
    const admin = await requireAdmin();

    if (!(await assertNameAvailable(categoryId, parsed.data.name))) {
      return fail(`Un attribut nommé « ${parsed.data.name} » existe déjà pour cette catégorie.`);
    }

    const attribute = await prisma.componentAttribute.create({
      data: {
        ...parsed.data,
        key: sanitizeKey(parsed.data.key || parsed.data.name),
        categoryId,
        order: await nextOrderFor(categoryId),
        createdById: admin.id,
      },
    });
    await logAudit({ userId: admin.id, action: "CREATE", entity: "componentAttribute", entityId: attribute.id });
    revalidatePath("/dashboard/bibliotheque");
    return ok({ id: attribute.id });
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return fail("Cette clé technique existe déjà pour cette catégorie.");
    }
    console.error("createComponentAttribute failed:", e);
    return fail("Impossible de créer l'attribut. Réessayez.");
  }
}

export async function updateComponentAttribute(
  id: string,
  categoryId: string,
  data: ComponentAttributeInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = componentAttributeSchema.safeParse(data);
  if (!parsed.success) return fail(formatZodError(parsed.error));

  try {
    const admin = await requireAdmin();

    if (!(await assertNameAvailable(categoryId, parsed.data.name, id))) {
      return fail(`Un attribut nommé « ${parsed.data.name} » existe déjà pour cette catégorie.`);
    }

    // Changer le type alors que des valeurs existent les rendrait orphelines :
    // elles restent stockées dans l'ancienne colonne typée (ex : valueNumber) que
    // plus rien ne relit une fois le type changé (l'export, l'affichage et les
    // filtres ne lisent que la colonne du type courant) — perte silencieuse.
    const current = await prisma.componentAttribute.findUnique({
      where: { id },
      select: { type: true, _count: { select: { values: true } } },
    });
    if (!current) return fail("Attribut introuvable.");
    if (current.type !== parsed.data.type && current._count.values > 0) {
      return fail(
        `Impossible de changer le type : ${current._count.values} valeur(s) sont déjà enregistrées pour cet attribut. Supprimez-le et recréez-le si besoin.`
      );
    }

    await prisma.componentAttribute.update({
      where: { id },
      data: { ...parsed.data, key: sanitizeKey(parsed.data.key || parsed.data.name) },
    });
    await logAudit({ userId: admin.id, action: "UPDATE", entity: "componentAttribute", entityId: id });
    revalidatePath("/dashboard/bibliotheque");
    return ok({ id });
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return fail("Cette clé technique existe déjà pour cette catégorie.");
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return fail("Attribut introuvable.");
    }
    console.error("updateComponentAttribute failed:", e);
    return fail("Impossible de modifier l'attribut. Réessayez.");
  }
}

export async function deleteComponentAttribute(id: string): Promise<ActionResult<void>> {
  try {
    const admin = await requireAdmin();
    // Cascade: supprime aussi les ComponentAttributeValue liées (perte de données
    // réelle, contrairement à une section de test physio) — la confirmation dans
    // l'UI doit avertir en amont via le compteur _count.values.
    await prisma.componentAttribute.delete({ where: { id } });
    await logAudit({ userId: admin.id, action: "DELETE", entity: "componentAttribute", entityId: id });
    revalidatePath("/dashboard/bibliotheque");
    return ok(undefined);
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return fail("Attribut introuvable.");
    }
    console.error("deleteComponentAttribute failed:", e);
    return fail("Impossible de supprimer l'attribut. Réessayez.");
  }
}

export async function toggleComponentAttribute(id: string): Promise<ActionResult<{ isActive: boolean }>> {
  try {
    const admin = await requireAdmin();
    const current = await prisma.componentAttribute.findUnique({ where: { id }, select: { isActive: true } });
    if (!current) return fail("Attribut introuvable.");

    const updated = await prisma.componentAttribute.update({
      where: { id },
      data: { isActive: !current.isActive },
    });
    await logAudit({
      userId: admin.id,
      action: "UPDATE",
      entity: "componentAttribute",
      entityId: id,
      metadata: { isActive: updated.isActive },
    });
    revalidatePath("/dashboard/bibliotheque");
    return ok({ isActive: updated.isActive });
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    console.error("toggleComponentAttribute failed:", e);
    return fail("Impossible de modifier l'attribut. Réessayez.");
  }
}

/** Persists the display order for one category's attribute list (top to bottom). */
export async function reorderComponentAttributes(
  categoryId: string,
  orderedIds: string[]
): Promise<ActionResult<void>> {
  try {
    const admin = await requireAdmin();

    // Garde-fou : les attributs sont scoped par catégorie (contrairement aux
    // sections de tests physio, qui n'ont pas cette dimension), donc on vérifie
    // que tous les ids soumis appartiennent bien à `categoryId` avant d'écrire.
    const count = await prisma.componentAttribute.count({ where: { id: { in: orderedIds }, categoryId } });
    if (count !== orderedIds.length) {
      return fail("Certains attributs ne correspondent pas à cette catégorie.");
    }

    await prisma.$transaction(
      orderedIds.map((id, order) => prisma.componentAttribute.update({ where: { id }, data: { order } }))
    );
    await logAudit({
      userId: admin.id,
      action: "UPDATE",
      entity: "componentAttribute",
      entityId: "reorder",
      metadata: { categoryId, count: orderedIds.length },
    });
    revalidatePath("/dashboard/bibliotheque");
    return ok(undefined);
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    console.error("reorderComponentAttributes failed:", e);
    return fail("Impossible de réordonner les attributs. Réessayez.");
  }
}
