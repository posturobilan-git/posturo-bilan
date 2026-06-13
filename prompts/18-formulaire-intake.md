Prompt 18 — Formulaire d'accueil patient (renommer intake)

Lis CLAUDE.md.

Renommage

Remplacer tous les occurrences d'"intake" par "accueil" dans l'affichage de l'app
(labels, titres, statuts, messages). Conserver intake dans le code et la DB.

Page publique formulaire — /accueil/[token]

Page accessible sans authentification via un token unique par patient (UUID).
Stocker le token dans le modèle Patient (inviteToken, généré à la création).

Étape 1 — CGU
Texte succinct couvrant :

Objet de la collecte (préparation de l'étude posturale)
Traitement des données (conformité RGPD, durée de conservation)
Rappel de la politique d'annulation du cabinet
Case à cocher obligatoire avant de continuer. Le contenu des CGU est une constante
éditable dans lib/legal.ts.

Étape 2 — Formulaire
Reprendre les champs du modèle PatientIntake existant.
Soumission → enregistrement en base + statut patient → intake_completed + token invalidé.
Redirection vers une page de confirmation sobre.

Email au patient

Template Resend sobre avec bouton "Compléter mon dossier" → lien /accueil/[token].
Le lien expire après soumission (token invalidé) ou après 30 jours.

Déclenchement

Automatique (plus tard) : Calendly webhook → appel sendIntakeEmail(patientId)
Manuel depuis le BO : bouton "Envoyer le formulaire d'accueil" sur la fiche patient,
visible uniquement si statut intake_pending. Confirmation avant envoi.
Logger l'envoi dans l'audit log.

Validation

npx tsc --noEmit
Accéder à /accueil/[token] sans être connecté → affiche les CGU
Soumettre le formulaire → statut passe à intake_completed, token invalidé
Accéder à nouveau au même lien → page "Ce formulaire a déjà été complété"
Bouton manuel dans le BO envoie l'email et log l'action
