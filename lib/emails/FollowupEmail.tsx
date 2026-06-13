interface FollowupEmailProps {
  patientFirstName: string;
  cabinetName: string;
  formUrl: string;
}

const TEAL = "#1D9E75";

/**
 * Email sobre du suivi J+30 : invite le patient à remplir le formulaire de
 * suivi de son étude posturale via un lien à token unique.
 */
export function FollowupEmail({
  patientFirstName,
  cabinetName,
  formUrl,
}: FollowupEmailProps) {
  return (
    <div
      style={{
        fontFamily: "Helvetica, Arial, sans-serif",
        backgroundColor: "#f4f4f5",
        padding: "24px",
        color: "#111827",
      }}
    >
      <div
        style={{
          maxWidth: "560px",
          margin: "0 auto",
          backgroundColor: "#ffffff",
          borderRadius: "12px",
          overflow: "hidden",
          border: "1px solid #e5e7eb",
        }}
      >
        {/* Header */}
        <div style={{ backgroundColor: TEAL, padding: "24px 32px" }}>
          <span style={{ color: "#ffffff", fontSize: "20px", fontWeight: "bold" }}>
            {cabinetName}
          </span>
        </div>

        {/* Body */}
        <div style={{ padding: "32px" }}>
          <h1 style={{ fontSize: "20px", margin: "0 0 16px" }}>
            Bonjour {patientFirstName},
          </h1>
          <p style={{ fontSize: "14px", lineHeight: 1.6, color: "#374151" }}>
            Cela fait environ un mois que vous avez réalisé votre étude
            posturale. Pour mesurer les bénéfices des ajustements et adapter si
            besoin vos exercices, merci de prendre un instant pour répondre à
            quelques questions.
          </p>

          <div style={{ textAlign: "center", margin: "32px 0" }}>
            <a
              href={formUrl}
              style={{
                display: "inline-block",
                backgroundColor: TEAL,
                color: "#ffffff",
                fontSize: "15px",
                fontWeight: "bold",
                textDecoration: "none",
                padding: "12px 28px",
                borderRadius: "8px",
              }}
            >
              Répondre au suivi
            </a>
          </div>

          <p style={{ fontSize: "13px", lineHeight: 1.6, color: "#6b7280" }}>
            Si le bouton ne fonctionne pas, copiez ce lien dans votre
            navigateur :<br />
            <span style={{ color: TEAL, wordBreak: "break-all" }}>{formUrl}</span>
          </p>
        </div>

        {/* Footer */}
        <div
          style={{
            borderTop: "1px solid #e5e7eb",
            padding: "16px 32px",
            fontSize: "12px",
            color: "#9ca3af",
          }}
        >
          {cabinetName} — Vos données sont traitées conformément au RGPD.
        </div>
      </div>
    </div>
  );
}
