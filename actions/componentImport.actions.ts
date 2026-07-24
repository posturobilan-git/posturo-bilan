"use server";

import Papa from "papaparse";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { ok, fail, formatZodError, type ActionResult } from "@/lib/action-result";
import { confirmComponentImportSchema, type ImportRowInput } from "@/lib/validations/componentImport.schema";
import { coerceAttributeValue, isEmptyAttributeValue, type AttributeValueTriple } from "@/lib/csv/componentAttributeCoercion";
import type { ComponentAttribute } from "@prisma/client";

export interface ImportRowPreview {
  /** 1-based, header = row 1, data starts at row 2 — matches the spreadsheet's own row numbers. */
  rowNumber: number;
  action: "create" | "update";
  componentId: string | null;
  /** Default checkbox state — false for ambiguous/ unresolved matches, never guessed at. */
  included: boolean;
  raw: Record<string, string>;
  resolved: {
    /** Synthesized (create) or the existing component's current name (update, display only). */
    name: string;
    brand: string;
    model: string;
    bikeTypeIds: string[];
    bikeTypeNames: string[];
    attributeValues: Array<{ attributeId: string; value: string }>;
  };
  warnings: string[];
}

export interface ImportPreviewResult {
  categoryId: string;
  rows: ImportRowPreview[];
  /** Attribute names matched as columns, in display order — for the preview table header. */
  attributeNames: string[];
  /** Attribute ids whose column was present in the header — see confirmComponentImport
   * for why this must round-trip back on confirm. */
  presentAttributeIds: string[];
}

function naturalKey(brand: string, model: string): string | null {
  const b = brand.trim().toLowerCase();
  const m = model.trim().toLowerCase();
  if (!b && !m) return null;
  return `${b}|${m}`;
}

export async function previewComponentImport(
  categoryId: string,
  rawText: string
): Promise<ActionResult<ImportPreviewResult>> {
  if (!rawText.trim()) return fail("Le contenu est vide.");

  try {
    await requireAdmin();

    const parsed = Papa.parse<Record<string, string>>(rawText.trim(), {
      header: true,
      skipEmptyLines: true,
      delimiter: "", // auto-détection : virgule (fichier CSV) ou tabulation (collé depuis un tableur)
    });
    if (parsed.data.length === 0) {
      return fail("Impossible de lire ce contenu. Vérifiez le format (CSV ou collé depuis un tableur).");
    }

    const headers = parsed.meta.fields ?? [];
    const hasIdColumn = headers.includes("id");

    const [attributes, bikeTypes, existingComponents] = await Promise.all([
      prisma.componentAttribute.findMany({ where: { categoryId, isActive: true }, orderBy: { order: "asc" } }),
      prisma.bikeType.findMany(), // actifs ET inactifs : ne pas perdre silencieusement une référence désactivée
      prisma.bikeComponent.findMany({
        where: { categoryId },
        select: { id: true, name: true, brand: true, model: true },
      }),
    ]);

    // Colonne d'attribut entièrement absente du fichier (par opposition à une
    // cellule vide dans une colonne présente) : ne doit jamais toucher aux
    // valeurs déjà en base pour cet attribut — voir confirmComponentImport.
    const presentAttributeIds = attributes.filter((a) => headers.includes(a.name)).map((a) => a.id);

    const componentById = new Map(existingComponents.map((c) => [c.id, c]));
    const naturalKeyMatches = new Map<string, string[]>();
    for (const c of existingComponents) {
      const key = naturalKey(c.brand ?? "", c.model ?? "");
      if (!key) continue;
      naturalKeyMatches.set(key, [...(naturalKeyMatches.get(key) ?? []), c.id]);
    }
    const bikeTypeByName = new Map(bikeTypes.map((b) => [b.name.toLowerCase(), b]));

    const rows: ImportRowPreview[] = parsed.data.map((raw, index) => {
      const rowNumber = index + 2;
      const warnings: string[] = [];
      const brand = (raw.marque ?? "").trim();
      const model = (raw.modele ?? "").trim();

      // ── id / action ──
      let action: "create" | "update" = "create";
      let componentId: string | null = null;
      let included = true;

      if (hasIdColumn) {
        const rawId = (raw.id ?? "").trim();
        if (rawId) {
          const existing = componentById.get(rawId);
          if (!existing) {
            warnings.push("Identifiant inconnu — ligne ignorée par défaut.");
            included = false;
          } else {
            action = "update";
            componentId = rawId;
          }
        }
      } else {
        const key = naturalKey(brand, model);
        const matches = key ? naturalKeyMatches.get(key) : undefined;
        if (matches?.length === 1) {
          action = "update";
          componentId = matches[0];
        } else if (matches && matches.length > 1) {
          warnings.push("Plusieurs composants existants correspondent (marque + modèle) — ligne ignorée par défaut.");
          included = false;
        }
      }

      // Une ligne de création sans marque ni modèle ne peut jamais correspondre à
      // un composant existant (aucune clé naturelle) — plutôt que de créer un
      // composant nommé « — », on l'ignore par défaut et on prévient l'admin.
      if (action === "create" && !brand && !model) {
        warnings.push("Aucune marque ni modèle — ligne ignorée par défaut.");
        included = false;
      }

      // ── types_velo ──
      const bikeTypeIds: string[] = [];
      const bikeTypeNames: string[] = [];
      const rawTypes = (raw.types_velo ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      for (const name of rawTypes) {
        const bt = bikeTypeByName.get(name.toLowerCase());
        if (!bt) {
          warnings.push(`Type de vélo inconnu : « ${name} ».`);
          continue;
        }
        bikeTypeIds.push(bt.id);
        bikeTypeNames.push(bt.name);
      }

      // ── attributs ──
      const attributeValues: Array<{ attributeId: string; value: string }> = [];
      for (const attribute of attributes) {
        const cell = (raw[attribute.name] ?? "").trim();
        if (!cell) {
          if (attribute.isRequired) warnings.push(`Attribut requis manquant : « ${attribute.name} ».`);
          continue;
        }
        const coerced = coerceAttributeValue(attribute, cell);
        if (!coerced.ok) {
          warnings.push(coerced.error);
          continue;
        }
        attributeValues.push({ attributeId: attribute.id, value: cell });
      }

      const existing = componentId ? componentById.get(componentId) : undefined;

      return {
        rowNumber,
        action,
        componentId,
        included,
        raw,
        resolved: {
          name: existing?.name ?? ([brand, model].filter(Boolean).join(" ") || "—"),
          brand,
          model,
          bikeTypeIds,
          bikeTypeNames,
          attributeValues,
        },
        warnings,
      };
    });

    return ok({ categoryId, rows, attributeNames: attributes.map((a) => a.name), presentAttributeIds });
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    console.error("previewComponentImport failed:", e);
    return fail("Impossible d'analyser le fichier. Réessayez.");
  }
}

/** Best-effort coercion for confirm: preview already warned about anything invalid
 * or missing, and inclusion is the admin's explicit call at that point — so
 * unlike the direct create/edit form, nothing here blocks the whole import. */
function coerceRowAttributeValues(
  attributes: ComponentAttribute[],
  submitted: Array<{ attributeId: string; value: string }>
): Array<{ attributeId: string } & AttributeValueTriple> {
  const rawByAttributeId = new Map(submitted.map((s) => [s.attributeId, s.value]));
  const values: Array<{ attributeId: string } & AttributeValueTriple> = [];
  for (const attribute of attributes) {
    const raw = rawByAttributeId.get(attribute.id);
    if (raw == null) continue;
    const coerced = coerceAttributeValue(attribute, raw);
    if (!coerced.ok || isEmptyAttributeValue(coerced.value)) continue;
    values.push({ attributeId: attribute.id, ...coerced.value });
  }
  return values;
}

export interface ConfirmComponentImportResult {
  created: number;
  updated: number;
  failed: Array<{ rowNumber: number; error: string }>;
}

export async function confirmComponentImport(
  categoryId: string,
  rows: ImportRowInput[],
  presentAttributeIds: string[]
): Promise<ActionResult<ConfirmComponentImportResult>> {
  const parsed = confirmComponentImportSchema.safeParse({ categoryId, rows, presentAttributeIds });
  if (!parsed.success) return fail(formatZodError(parsed.error));

  try {
    const admin = await requireAdmin();
    const attributes = await prisma.componentAttribute.findMany({ where: { categoryId, isActive: true } });

    let created = 0;
    let updated = 0;
    const failed: Array<{ rowNumber: number; error: string }> = [];

    // Un $transaction par ligne (pas un seul pour tout le fichier) : borne la
    // durée des verrous Postgres et évite qu'une ligne en échec (ex : composant
    // supprimé entre la prévisualisation et la confirmation) n'annule tout ce qui
    // a déjà été validé à l'écran de prévisualisation.
    for (const row of parsed.data.rows) {
      try {
        const resolvedValues = coerceRowAttributeValues(attributes, row.attributeValues);

        if (row.action === "create") {
          const name = row.name.trim() || [row.brand, row.model].filter(Boolean).join(" ") || "Composant";
          const component = await prisma.bikeComponent.create({
            data: {
              name,
              brand: row.brand || null,
              model: row.model || null,
              categoryId,
              createdById: admin.id,
              bikeTypes: { connect: row.bikeTypeIds.map((id) => ({ id })) },
              attributeValues: { create: resolvedValues },
            },
          });
          await logAudit({ userId: admin.id, action: "CREATE", entity: "component", entityId: component.id });
          created++;
        } else {
          const componentId = row.componentId!;
          await prisma.$transaction([
            // `name`/`notes`/`isActive` ne sont pas dans le CSV : jamais touchés
            // sur mise à jour (pas de synthèse écrasant un nom saisi à la main).
            // `categoryId` dans le where : un componentId qui ne correspond pas à
            // cette catégorie échoue (P2025) plutôt que de réassigner silencieusement
            // un composant d'une autre catégorie.
            prisma.bikeComponent.update({
              where: { id: componentId, categoryId },
              data: {
                brand: row.brand || null,
                model: row.model || null,
                bikeTypes: { set: row.bikeTypeIds.map((id) => ({ id })) },
              },
            }),
            // Ne supprime que les valeurs des attributs dont la colonne était
            // présente dans le fichier : une colonne absente (import partiel,
            // explicitement permis par le prompt) ne doit jamais effacer une
            // valeur déjà en base pour cet attribut.
            prisma.componentAttributeValue.deleteMany({
              where: { componentId, attributeId: { in: parsed.data.presentAttributeIds } },
            }),
            ...(resolvedValues.length
              ? [prisma.componentAttributeValue.createMany({ data: resolvedValues.map((v) => ({ ...v, componentId })) })]
              : []),
          ]);
          await logAudit({ userId: admin.id, action: "UPDATE", entity: "component", entityId: componentId });
          updated++;
        }
      } catch (e) {
        console.error("confirmComponentImport row failed:", e);
        failed.push({ rowNumber: row.rowNumber, error: e instanceof Error ? e.message : "Erreur inconnue" });
      }
    }

    revalidatePath("/dashboard/bibliotheque");
    return ok({ created, updated, failed });
  } catch (e) {
    if (e instanceof Error && e.message === "Accès refusé") return fail("Réservé aux administrateurs.");
    console.error("confirmComponentImport failed:", e);
    return fail("Impossible d'importer les composants. Réessayez.");
  }
}
