/**
 * Texte des conditions générales d'utilisation (CGU) affiché au patient avant
 * le formulaire d'accueil. Éditable ici — c'est la source unique de vérité.
 *
 * Durée de conservation alignée sur la politique RGPD du cabinet (cf. footer du
 * tableau de bord et l'anonymisation RGPD).
 */

export interface LegalSection {
  title: string;
  body: string;
}

/**
 * Version des CGU, persistée avec le consentement du patient pour garder une
 * trace de ce qui a été accepté (RGPD). À incrémenter dès que le texte
 * ci-dessous change — un format date facilite le repérage dans l'historique git.
 */
export const INTAKE_CGU_VERSION = "2026-06-13";

/**
 * Phrase d'introduction des CGU. Prend le nom du cabinet en argument pour ne
 * pas dépendre d'une variable d'env serveur côté client.
 */
export function intakeCguIntro(cabinetName: string): string {
  return `Avant de remplir votre formulaire d'accueil, merci de prendre connaissance des informations ci-dessous. Elles encadrent la collecte de vos données dans le cadre de la préparation de votre étude posturale au sein du cabinet ${cabinetName}.`;
}

export const INTAKE_CGU: {
  sections: LegalSection[];
  consentLabel: string;
} = {
  sections: [
    {
      title: "Objet de la collecte",
      body: "Les informations demandées (morphologie, pratique du vélo, douleurs et antécédents) servent exclusivement à préparer votre étude posturale et à adapter les recommandations de votre kinésithérapeute. Elles ne sont utilisées à aucune autre fin.",
    },
    {
      title: "Traitement des données (RGPD)",
      body: "Vos données sont traitées conformément au Règlement général sur la protection des données. Elles sont accessibles uniquement à votre praticien référent, conservées pour la durée du suivi kinésithérapeutique puis anonymisées. Vous disposez d'un droit d'accès, de rectification et d'effacement, exerçable directement auprès du cabinet.",
    },
    {
      title: "Politique d'annulation",
      body: "Tout rendez-vous doit être annulé au moins 24 heures à l'avance. Passé ce délai, ou en cas d'absence, la séance pourra être facturée. Merci de prévenir le cabinet au plus tôt en cas d'empêchement.",
    },
  ],
  consentLabel:
    "J'ai lu et j'accepte les conditions ci-dessus et le traitement de mes données dans le cadre de la préparation de mon étude posturale.",
};

/** Durée de validité d'un lien d'accueil, en jours. */
export const INVITE_TTL_DAYS = 30;

/** Date d'expiration d'un lien d'accueil émis maintenant. */
export function inviteExpiryFromNow(now: Date = new Date()): Date {
  return new Date(now.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
}
