interface ReportEmailProps {
  patientFirstName: string;
  kineName: string;
  exercises: string[];
  adjustments: string[];
  cabinetName: string;
}

const TEAL = "#1D9E75";

export function ReportEmail({
  patientFirstName,
  kineName,
  exercises,
  adjustments,
  cabinetName,
}: ReportEmailProps) {
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
            Votre rapport d&apos;étude posturale est prêt. Vous y retrouverez le détail
            de vos mesures, les ajustements réalisés sur votre vélo et votre plan
            d&apos;exercices personnalisé.
          </p>

          {adjustments.length > 0 && (
            <>
              <h2 style={{ fontSize: "15px", color: TEAL, margin: "24px 0 8px" }}>
                Principaux ajustements
              </h2>
              <ul style={{ fontSize: "14px", lineHeight: 1.6, color: "#374151", paddingLeft: "18px", margin: 0 }}>
                {adjustments.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </>
          )}

          {/* Le rapport complet est joint à cet email en pièce jointe (PDF). */}
          <div
            style={{
              textAlign: "center",
              margin: "32px 0",
              padding: "16px",
              backgroundColor: "#f0fdf9",
              border: `1px solid ${TEAL}`,
              borderRadius: "8px",
              fontSize: "14px",
              color: "#374151",
            }}
          >
            📎 Votre rapport complet est <strong>joint à cet email</strong> au format PDF.
          </div>

          {exercises.length > 0 && (
            <>
              <h2 style={{ fontSize: "15px", color: TEAL, margin: "24px 0 8px" }}>
                Vos exercices prescrits
              </h2>
              <ul style={{ fontSize: "14px", lineHeight: 1.6, color: "#374151", paddingLeft: "18px", margin: 0 }}>
                {exercises.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </>
          )}

          <p style={{ fontSize: "14px", lineHeight: 1.6, color: "#374151", marginTop: "32px" }}>
            Prenez soin de vous,
            <br />
            <strong>{kineName}</strong>
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
          {cabinetName} — Ce message et son rapport sont confidentiels.
        </div>
      </div>
    </div>
  );
}
