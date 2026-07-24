"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { requireKine, requireAdmin } from "@/lib/auth";
import { ok, fail, formatZodError, type ActionResult } from "@/lib/action-result";
import { componentSchema } from "@/lib/validations/component.schema";
import { Prisma, type BikeComponent, type BikeType } from "@prisma/client";
import type { ListResult, PageQuery, SortDir } from "@/lib/pagination";
import { toSkipTake } from "@/lib/pagination";
import { z } from "zod";
import { coerceAttributeValue, isEmptyAttributeValue, type AttributeValueTriple } from "@/lib/csv/componentAttributeCoercion";

export type ComponentWithCount = BikeComponent & {
  _count: { studies: number };
  bikeTypes: Pick<BikeType, "id" | "name">[];
  category: { name: string };
  attributeValues: Array<{
    attributeId: string;
    valueText: string | null;
    valueNumber: number | null;
    valueBoolean: boolean | null;
  }>;
};

export interface AttributeFilterOption {
  attributeId: string;
  name: string;
  values: string[]; // valeurs distinctes déjà utilisées, prêtes à afficher/soumettre
}

// ─── Query ────────────────────────────────────────────────────────────────────

function componentOrderBy(sort: string, dir: SortDir): Prisma.BikeComponentOrderByWithRelationInput[] {
  const primary: Prisma.BikeComponentOrderByWithRelationInput =
    sort === "createdAt" ? { createdAt: dir } : sort === "category" ? { category: { name: dir } } : { name: dir };
  return [{ isActive: "desc" }, primary];
}

export async function getComponents(filters?: {
  search?: string;
  categoryId?: string;
  /** Une entrée par attribut filtré ; combinées en ET (voir la note ci-dessous). */
  attributeFilters?: Array<{ attributeId: string; value: string }>;
  page?: PageQuery;
}): Promise<ListResult<ComponentWithCount>> {
  const kine = await requireKine();

  // Chaque filtre d'attribut est sa propre entrée du tableau `AND`, chacune avec
  // son propre `some`. Une ligne ComponentAttributeValue n'appartient qu'à UN
  // attribut : mettre plusieurs conditions d'attribut dans un même `some`
  // demanderait à une seule ligne de matcher plusieurs attributs à la fois — ce
  // qui ne renverrait jamais rien dès que deux filtres sont actifs en même temps
  // (ex : largeur=145 ET profil=Plate).
  const attributeAnd: Prisma.BikeComponentWhereInput[] = (filters?.attributeFilters ?? []).map((f) => ({
    attributeValues: {
      some: {
        attributeId: f.attributeId,
        OR: [{ valueText: f.value }, { valueNumber: Number(f.value) }, { valueBoolean: f.value === "true" }],
      },
    },
  }));

  const where: Prisma.BikeComponentWhereInput = {
    ...(kine.role !== "ADMIN" && { isActive: true }),
    ...(filters?.categoryId && { categoryId: filters.categoryId }),
    ...(filters?.search && {
      OR: [
        { name: { contains: filters.search, mode: "insensitive" } },
        { brand: { contains: filters.search, mode: "insensitive" } },
        { model: { contains: filters.search, mode: "insensitive" } },
      ],
    }),
    ...(attributeAnd.length > 0 && { AND: attributeAnd }),
  };

  const page = filters?.page;
  const [items, total] = await Promise.all([
    prisma.bikeComponent.findMany({
      where,
      include: {
        _count: { select: { studies: true } },
        bikeTypes: { select: { id: true, name: true } },
        category: { select: { name: true } },
        attributeValues: { select: { attributeId: true, valueText: true, valueNumber: true, valueBoolean: true } },
      },
      orderBy: page ? componentOrderBy(page.sort, page.dir) : [{ isActive: "desc" }, { name: "asc" }],
      ...(page ? toSkipTake(page) : {}),
    }),
    prisma.bikeComponent.count({ where }),
  ]);

  return { items, total };
}

// ─── Mutations (ADMIN only) ─────────────────────────────────────────────────────

/**
 * Coerces+validates the form's raw attributeValues against the category's
 * authoritative ComponentAttribute rows (never trust a client-asserted type).
 * Unlike CSV import, a missing/invalid required attribute BLOCKS here — this is
 * the direct create/edit form, not a lenient bulk-import row.
 */
async function resolveAttributeValues(
  categoryId: string,
  submitted: Array<{ attributeId: string; value: string }>
): Promise<
  | { ok: true; activeAttributeIds: string[]; values: Array<{ attributeId: string } & AttributeValueTriple> }
  | { ok: false; error: string }
> {
  const attributes = await prisma.componentAttribute.findMany({ where: { categoryId, isActive: true } });
  const rawByAttributeId = new Map(submitted.map((s) => [s.attributeId, s.value]));

  const values: Array<{ attributeId: string } & AttributeValueTriple> = [];
  for (const attribute of attributes) {
    const raw = rawByAttributeId.get(attribute.id) ?? "";
    const coerced = coerceAttributeValue(attribute, raw);
    if (!coerced.ok) return { ok: false, error: coerced.error };
    if (isEmptyAttributeValue(coerced.value)) {
      if (attribute.isRequired) return { ok: false, error: `« ${attribute.name} » est obligatoire.` };
      continue;
    }
    values.push({ attributeId: attribute.id, ...coerced.value });
  }
  return { ok: true, activeAttributeIds: attributes.map((a) => a.id), values };
}

export async function createComponent(
  data: z.infer<typeof componentSchema>
): Promise<ActionResult<{ id: string }>> {
  const parsed = componentSchema.safeParse(data);
  if (!parsed.success) return fail(formatZodError(parsed.error));

  try {
    const admin = await requireAdmin();
    const { bikeTypeIds, attributeValues, ...fields } = parsed.data;

    const resolved = await resolveAttributeValues(fields.categoryId, attributeValues);
    if (!resolved.ok) return fail(resolved.error);

    const component = await prisma.bikeComponent.create({
      data: {
        ...fields,
        createdById: admin.id,
        bikeTypes: { connect: bikeTypeIds.map((id) => ({ id })) },
        attributeValues: { create: resolved.values },
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
    const { bikeTypeIds, attributeValues, ...fields } = parsed.data;

    const existing = await prisma.bikeComponent.findUnique({ where: { id }, select: { categoryId: true } });
    const resolved = await resolveAttributeValues(fields.categoryId, attributeValues);
    if (!resolved.ok) return fail(resolved.error);

    // Remplacement complet des valeurs des attributs ACTIFS de la catégorie (pas
    // de diff) : elles n'ont ni ordre ni identité propre à préserver, un replace
    // est donc plus simple et tout aussi correct. Scope explicitement à
    // activeAttributeIds (pas un deleteMany sans filtre) : un attribut désactivé
    // n'est jamais présenté dans le formulaire et sa valeur stockée ne doit donc
    // jamais être effacée par l'édition d'un composant. Si la catégorie change,
    // en revanche, TOUTES les valeurs de l'ancienne catégorie sont orphelines
    // (aucun de ses attributs ne s'applique plus) et doivent être effacées.
    const categoryChanged = existing !== null && existing.categoryId !== fields.categoryId;
    await prisma.$transaction([
      prisma.bikeComponent.update({
        where: { id },
        data: { ...fields, bikeTypes: { set: bikeTypeIds.map((bid) => ({ id: bid })) } },
      }),
      prisma.componentAttributeValue.deleteMany({
        where: categoryChanged
          ? { componentId: id }
          : { componentId: id, attributeId: { in: resolved.activeAttributeIds } },
      }),
      ...(resolved.values.length
        ? [prisma.componentAttributeValue.createMany({ data: resolved.values.map((v) => ({ ...v, componentId: id })) })]
        : []),
    ]);
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

/**
 * Filter options for the library's attribute-filter row: for each active
 * NUMBER/BOOLEAN/SELECT attribute of the category (TEXT excluded — free text
 * isn't a picklist), the distinct values currently in use across ALL active
 * components in that category. Deliberately a separate, non-paginated query
 * from getComponents — options must reflect the whole category, not just
 * whatever page of results happens to be showing.
 */
export async function getComponentAttributeFilterOptions(
  categoryId: string
): Promise<AttributeFilterOption[]> {
  await requireKine();

  const attributes = await prisma.componentAttribute.findMany({
    where: { categoryId, isActive: true, type: { in: ["NUMBER", "BOOLEAN", "SELECT"] } },
    orderBy: { order: "asc" },
  });

  const options = await Promise.all(
    attributes.map(async (attribute) => {
      const rows = await prisma.componentAttributeValue.findMany({
        where: { attributeId: attribute.id, component: { categoryId, isActive: true } },
        distinct: ["valueText", "valueNumber", "valueBoolean"],
        select: { valueText: true, valueNumber: true, valueBoolean: true },
      });
      const values = rows
        .map((r) =>
          attribute.type === "NUMBER"
            ? r.valueNumber != null
              ? String(r.valueNumber)
              : null
            : attribute.type === "BOOLEAN"
              ? r.valueBoolean != null
                ? String(r.valueBoolean)
                : null
              : r.valueText
        )
        .filter((v): v is string => v != null)
        .sort((a, b) => (attribute.type === "NUMBER" ? Number(a) - Number(b) : a.localeCompare(b)));
      return { attributeId: attribute.id, name: attribute.name, values };
    })
  );

  return options.filter((o) => o.values.length > 0);
}
