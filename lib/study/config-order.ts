/**
 * Ordre d'affichage des côtes, mesures du cycliste et tests physio pour un type
 * de vélo — l'unique source de vérité lue par la configuration, le formulaire
 * d'étude, le récapitulatif, le dossier patient et le PDF.
 *
 * Chaque type de vélo porte sa propre liste ordonnée (tables de liaison
 * BikeTypeMeasurement / BikeTypeRiderMeasurement / BikeTypePhysioTest, colonne
 * `order`). Le tronc commun y figure comme n'importe quel autre élément, à la
 * position choisie par l'admin ; il reste présent sur tous les types.
 *
 * Module pur (aucune dépendance React / Prisma) : importable côté serveur comme
 * côté client.
 */

/** Ce qu'il faut savoir d'un élément configurable pour le ranger. */
export interface ConfigOrderable {
  name: string;
  isCommon: boolean;
  /**
   * Ordre par défaut du tronc commun : point de départ d'un nouveau type de vélo,
   * et départage un élément commun qui n'a pas (encore) de position propre sur
   * ce type. Sans effet sur un élément qui en a une.
   */
  commonOrder: number;
  bikeTypeLinks: { bikeTypeId: string; order: number }[];
}

/** Section d'un test physio (regroupement dans le formulaire). */
export interface SectionRef {
  id: string;
  name: string;
  order: number;
}

export interface PhysioConfigOrderable extends ConfigOrderable {
  section: SectionRef | null;
}

/** Un élément s'applique au type de vélo s'il est commun ou lié à ce type. */
export function appliesToBikeType(
  def: { isCommon: boolean; bikeTypeLinks: { bikeTypeId: string }[] },
  bikeTypeId: string | null
): boolean {
  return def.isCommon || def.bikeTypeLinks.some((l) => l.bikeTypeId === bikeTypeId);
}

/**
 * Rang d'un élément pour un type de vélo : [palier, position, ordre par défaut].
 *  - palier 0 : position propre à ce type (cas normal, y compris le tronc commun) ;
 *  - palier 1 : commun sans position propre (n'arrive pas si la config est
 *    saine) → après les positionnés, dans l'ordre par défaut ;
 *  - palier 2 : non configuré pour ce type (ajouté à la volée pour une étude, ou
 *    retiré de la config depuis) → en dernier.
 */
function rank(def: ConfigOrderable, bikeTypeId: string | null): readonly [number, number, number] {
  const link =
    bikeTypeId == null ? undefined : def.bikeTypeLinks.find((l) => l.bikeTypeId === bikeTypeId);
  if (link) return [0, link.order, 0];
  if (def.isCommon) return [1, 0, def.commonOrder];
  return [2, 0, 0];
}

/**
 * Comparateur « ordre configuré du type de vélo ». Valable pour tout élément,
 * configuré ou non : les éléments non configurés viennent après, par nom.
 */
export function compareConfigured(bikeTypeId: string | null) {
  return (a: ConfigOrderable, b: ConfigOrderable): number => {
    const ra = rank(a, bikeTypeId);
    const rb = rank(b, bikeTypeId);
    return ra[0] - rb[0] || ra[1] - rb[1] || ra[2] - rb[2] || a.name.localeCompare(b.name);
  };
}

/**
 * Comparateur des tests physio : par section (ordre de la section, les tests
 * sans section en dernier), puis dans l'ordre configuré au sein de la section.
 * C'est l'ordre visuel du formulaire, repris tel quel par les vues en lecture.
 */
export function comparePhysioConfigured(bikeTypeId: string | null) {
  const byConfig = compareConfigured(bikeTypeId);
  return (a: PhysioConfigOrderable, b: PhysioConfigOrderable): number =>
    (a.section?.order ?? Number.MAX_SAFE_INTEGER) - (b.section?.order ?? Number.MAX_SAFE_INTEGER) ||
    (a.section?.name ?? "").localeCompare(b.section?.name ?? "") ||
    (a.section?.id ?? "").localeCompare(b.section?.id ?? "") ||
    byConfig(a, b);
}

/**
 * Liste finale (ordonnée) d'un type de vélo à enregistrer : les ids demandés par
 * l'admin, dédoublonnés, limités aux éléments actifs — plus les éléments communs
 * actifs absents de la demande, ajoutés en fin de liste. Un élément commun ne se
 * retire pas : seule sa position change.
 *
 * @param commonIds éléments communs actifs, dans leur ordre par défaut.
 */
export function finalConfigOrder(
  requestedIds: readonly string[],
  activeIds: ReadonlySet<string>,
  commonIds: readonly string[]
): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const id of [...requestedIds.filter((i) => activeIds.has(i)), ...commonIds]) {
    if (seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
  }
  return ordered;
}
