import { AlertCircleIcon } from "@/components/ui/icons";

/**
 * Message d'erreur court sous un champ ; `id` sert à `aria-describedby` du contrôle.
 *
 * `message` est le message courant (null quand la valeur est remplie). `reserve` est
 * le texte le plus long que la ligne pourra porter : tant qu'il est fourni, la ligne
 * garde sa hauteur même quand `message` disparaît, sinon toutes les lignes en
 * dessous remonteraient de ~22 px à chaque valeur saisie (et, au doigt sur
 * téléphone, la cible suivante bougerait juste après le toucher). Le message
 * s'affiche alors par-dessus un fantôme invisible de même texte, donc avec le même
 * retour à la ligne.
 */
export function FieldError({
  id,
  message,
  reserve,
}: {
  id: string;
  message: string | null;
  reserve?: string;
}) {
  if (message === null && reserve === undefined) return null;
  return (
    <div className="relative mt-1.5">
      {reserve !== undefined && (
        <p aria-hidden="true" className="invisible flex items-center gap-1.5 text-xs font-medium">
          <span className="h-3.5 w-3.5 shrink-0" />
          {reserve}
        </p>
      )}
      {message !== null && (
        <p
          id={id}
          className={`${
            reserve !== undefined ? "absolute inset-x-0 top-0 " : ""
          }flex items-center gap-1.5 text-xs font-medium text-danger-700`}
        >
          <AlertCircleIcon className="h-3.5 w-3.5 shrink-0" />
          {message}
        </p>
      )}
    </div>
  );
}
