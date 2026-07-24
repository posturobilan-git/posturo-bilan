import { type NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { humanizeAttributeValue } from "@/lib/csv/componentAttributeCoercion";

/** Filename-safe slug: lowercase, no accents, non-alphanumerics collapsed to "-". */
function slugifyForFilename(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * CSV export for one component category — admin-only. A Route Handler (not a
 * Server Action) because it must return a file download, mirroring the
 * authenticated-file-serving pattern already used at /api/reports/[studyId].
 */
export async function GET(request: NextRequest) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (e) {
    const denied = e instanceof Error && e.message === "Accès refusé";
    return new NextResponse(denied ? "Accès refusé" : "Non authentifié", { status: denied ? 403 : 401 });
  }

  const categoryId = request.nextUrl.searchParams.get("category");
  const category = categoryId ? await prisma.componentCategory.findUnique({ where: { id: categoryId } }) : null;
  if (!category) {
    return new NextResponse("Catégorie invalide", { status: 400 });
  }

  const [attributes, components] = await Promise.all([
    prisma.componentAttribute.findMany({ where: { categoryId: category.id, isActive: true }, orderBy: { order: "asc" } }),
    // Tous les composants de la catégorie, actifs ou non — un admin qui fait de
    // l'édition en masse via tableur doit tout voir, pas seulement les actifs.
    prisma.bikeComponent.findMany({
      where: { categoryId: category.id },
      include: { bikeTypes: { select: { name: true } }, attributeValues: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const fields = ["id", "marque", "modele", "types_velo", ...attributes.map((a) => a.name)];
  const data = components.map((c) => {
    const valueByAttributeId = new Map(c.attributeValues.map((v) => [v.attributeId, v]));
    return [
      c.id,
      c.brand ?? "",
      c.model ?? "",
      c.bikeTypes.map((b) => b.name).join(", "),
      ...attributes.map((a) => {
        const value = valueByAttributeId.get(a.id);
        return value ? humanizeAttributeValue(a, value) : "";
      }),
    ];
  });

  const csv = Papa.unparse({ fields, data });

  await logAudit({
    userId: admin.id,
    action: "EXPORT",
    entity: "component",
    entityId: category.id,
    metadata: { category: category.name, count: components.length },
  });

  // BOM UTF-8 en tête : sans lui, Excel (Windows) affiche mal les caractères
  // accentués ("Épaisseur", "Évasée") à l'ouverture directe du CSV.
  const BOM = String.fromCharCode(0xfeff);
  return new NextResponse(`${BOM}${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="composants-${slugifyForFilename(category.name)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
