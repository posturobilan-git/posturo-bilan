/**
 * Navigation vers les valeurs obligatoires manquantes (côté navigateur).
 *
 * Les formulaires de l'étude marquent :
 *  - la ligne d'un champ en alerte avec `missingRowProps(true)` : c'est elle qu'on
 *    amène au centre de l'écran ;
 *  - chaque contrôle obligatoire vide avec `missingControlProps(true)` : c'est lui
 *    qui reçoit le focus, et chacun est une étape du bouton « suivante ».
 * On retrouve ici « le premier » et « le suivant » dans l'ordre réel du DOM,
 * c'est-à-dire celui de l'écran, quelle que soit la façon dont les lignes ont
 * été triées par les formulaires.
 */

const MISSING_ROW_ATTR = "data-missing-row";
const MISSING_CONTROL_ATTR = "data-missing-control";

/** À étaler sur la ligne d'un champ dont au moins une valeur obligatoire est vide. */
export function missingRowProps(invalid: boolean): Record<string, string> {
  return invalid ? { [MISSING_ROW_ATTR]: "" } : {};
}

/** À étaler sur un contrôle (input, 1er bouton d'un groupe…) dont la valeur obligatoire est vide. */
export function missingControlProps(invalid: boolean): Record<string, string> {
  return invalid ? { [MISSING_CONTROL_ATTR]: "" } : {};
}

/** Contrôles en alerte sous `root`, dans l'ordre d'affichage. */
export function getMissingControls(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(`[${MISSING_CONTROL_ATTR}]`));
}

/**
 * Premier contrôle situé après `after` dans le document, en repartant du début
 * après le dernier. `after` peut être n'importe quel élément (champ focalisé,
 * contrôle déjà atteint) ; sans repère valide, on prend le premier.
 */
export function pickNextControl(
  controls: readonly HTMLElement[],
  after: Element | null
): HTMLElement | undefined {
  if (after?.isConnected) {
    const next = controls.find(
      (control) => after.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_FOLLOWING
    );
    if (next) return next;
  }
  return controls[0];
}

/**
 * Sur un téléphone très étroit, la grille avant/après d'une ligne est plus large que
 * son cadre, qui défile alors horizontalement : un contrôle peut y être rogné. Le
 * ramène à l'écran dans le premier conteneur qui défile ainsi. (Le centrage vertical
 * se fait sur la ligne, qui, elle, ne déborde pas ; et le focus est donné sans
 * défilement, donc le navigateur ne le fait pas non plus.)
 */
function revealHorizontally(control: HTMLElement, behavior: ScrollBehavior): void {
  for (let el = control.parentElement; el; el = el.parentElement) {
    if (el.scrollWidth <= el.clientWidth) continue;
    if (!/(auto|scroll)/.test(getComputedStyle(el).overflowX)) continue;
    const margin = 12;
    const box = control.getBoundingClientRect();
    const view = el.getBoundingClientRect();
    if (box.right > view.right - margin) {
      el.scrollBy({ left: box.right - view.right + margin, behavior });
    } else if (box.left < view.left + margin) {
      el.scrollBy({ left: box.left - view.left - margin, behavior });
    }
    return;
  }
}

/**
 * Amène la ligne du contrôle au milieu de la zone de défilement (ce qui la garde
 * hors de la barre mobile fixe et du bandeau collant, quelle que soit leur
 * hauteur), puis focalise le contrôle. Défilement instantané si l'utilisateur
 * préfère moins d'animations.
 */
export function revealControl(control: HTMLElement): void {
  const behavior: ScrollBehavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
  const row = control.closest<HTMLElement>(`[${MISSING_ROW_ATTR}]`) ?? control;
  row.scrollIntoView({ behavior, block: "center" });
  revealHorizontally(control, behavior);
  // preventScroll : le focus ne doit ni couper l'animation ni sauter à l'arrivée.
  control.focus({ preventScroll: true });
}
