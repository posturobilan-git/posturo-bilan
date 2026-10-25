/**
 * Pastille « Téléphone manquant » du dossier patient. Un patient peut ne pas avoir
 * de numéro (réservation sans téléphone, dossier antérieur à l'obligation) : aucun
 * blocage, mais le champ sera exigé à sa prochaine modification.
 */
export function MissingPhoneNotice() {
  return (
    <span
      title="Aucun numéro de téléphone enregistré. Il sera exigé à la prochaine modification du patient."
      className="inline-flex items-center gap-1.5 rounded-full bg-warning-50 px-2.5 py-0.5 text-xs font-medium text-warning-700"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-warning-600" aria-hidden="true" />
      Téléphone manquant
    </span>
  );
}
