"use client";

import { Button } from "@/components/ui/Button";
import { AlertCircleIcon, CheckIcon } from "@/components/ui/icons";

// Pictogramme masqué sur les cartes étroites (téléphone) pour laisser la place au texte.
const ICON = "hidden h-5 w-5 shrink-0 @xs:block";

/**
 * Récapitulatif affiché après un passage bloqué par des champs obligatoires vides :
 * « N valeurs obligatoires manquantes » et un bouton pour aller à la suivante.
 * Il colle en haut de la zone de défilement pour rester visible pendant qu'on
 * parcourt les champs. Pas de décalage `top` à prévoir pour la barre mobile fixe :
 * un élément sticky se cale sur le bord du *contenu* de son conteneur de
 * défilement, et le `pt-16` du <main> du dashboard réserve déjà cette place.
 *
 * Sa hauteur ne doit jamais dépendre de l'état ni du nombre, sinon tout le contenu
 * sous lui saute quand on remplit une valeur (au doigt, la cible suivante bouge juste
 * après le toucher). D'où :
 * - à zéro il devient une confirmation plutôt que de disparaître ;
 * - la hauteur est dictée par le bouton (h-10 + padding + bordure = 3,625 rem, aussi
 *   le minimum de la confirmation) et les textes tiennent toujours sur 2 lignes
 *   au plus : sur carte étroite, la version courte (« N valeurs manquantes »,
 *   « Tout est renseigné ») ; « obligatoires » et la suite de la confirmation restent
 *   pour les lecteurs d'écran et réapparaissent à l'écran dès que la carte le permet.
 */
export function MissingFieldsBanner({ count, onNext }: { count: number; onNext: () => void }) {
  const done = count === 0;
  const plural = count > 1;

  return (
    // data-missing-nav : StudyForm ignore le focus venant d'ici pour mémoriser le
    // dernier champ visité (repère du bouton « suivante »). @container : le libellé
    // du bouton et le détail des textes suivent la largeur de la carte, pas de l'écran.
    <div data-missing-nav className="@container sticky top-0 z-10 bg-surface py-2">
      <div
        role="status"
        className={`flex min-h-[3.625rem] items-center gap-3 rounded-lg border px-3 py-2 shadow-sm ${
          done
            ? "border-success-600/30 bg-success-50 text-success-700"
            : "border-danger-500 bg-danger-50 text-danger-700"
        }`}
      >
        {done ? (
          <CheckIcon className={`${ICON} text-success-600`} />
        ) : (
          <AlertCircleIcon className={`${ICON} text-danger-600`} />
        )}

        <p className="min-w-0 flex-1 text-sm font-semibold">
          {done ? (
            <>
              Tout est renseigné
              <span className="sr-only @md:not-sr-only"> : vous pouvez passer à l&apos;étape suivante.</span>
            </>
          ) : (
            <>
              {count} {plural ? "valeurs" : "valeur"}{" "}
              <span className="sr-only @md:not-sr-only">{plural ? "obligatoires" : "obligatoire"} </span>
              {plural ? "manquantes" : "manquante"}
            </>
          )}
        </p>

        {!done && (
          // Le nom accessible commence par le texte visible (WCAG 2.5.3) ; le span masqué
          // (display:none) de l'autre largeur n'y entre pas, le suffixe lève l'ambiguïté
          // avec le bouton « Étape suivante » du bas.
          <Button variant="secondary" onClick={onNext} className="shrink-0">
            <span className="@md:hidden">{plural ? "Suivante" : "Voir"}</span>
            <span className="hidden @md:inline">{plural ? "Aller à la suivante" : "Aller au champ"}</span>
            <span aria-hidden="true">↓</span>
            <span className="sr-only"> (valeur obligatoire)</span>
          </Button>
        )}
      </div>
    </div>
  );
}
