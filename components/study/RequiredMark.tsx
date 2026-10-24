/**
 * Teinte d'alerte derrière la ligne d'un champ obligatoire resté vide. C'est un
 * pseudo-élément qui déborde de 0,75 rem de chaque côté : aucun effet sur la mise
 * en page, donc rien ne bouge quand on remplit le champ et que l'alerte disparaît.
 * Chaque formulaire ajoute le débord vertical qui lui convient (`before:inset-y-*`).
 */
export const INVALID_ROW_BASE =
  "relative isolate before:absolute before:-inset-x-3 before:-z-10 before:rounded-lg before:border before:border-danger-500/40 before:bg-danger-50";

/**
 * Pastille « Obligatoire » : rend l'obligation lisible sans dépendre d'une simple
 * étoile ni de la seule couleur. Discrète au repos, pleine quand une valeur du
 * champ est encore vide après un passage bloqué (voir MissingFieldsBanner).
 */
export function RequiredMark({ invalid = false }: { invalid?: boolean }) {
  return (
    <span
      className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 align-middle text-[11px] font-semibold uppercase leading-none tracking-wide ${
        invalid ? "bg-danger-600 text-white" : "bg-danger-50 text-danger-700"
      }`}
    >
      Obligatoire
    </span>
  );
}
