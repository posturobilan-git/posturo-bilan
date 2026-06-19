import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { formatDelta } from "@/lib/measures";
import type { StudyForReport } from "@/types";

export interface ReportMeasureRow {
  name: string;
  unit: string;
  before: number | null;
  after: number | null;
}

/** Physio test row — the value is pre-formatted (Oui/Non, Positif/Négatif, valeur + unité). */
export interface ReportPhysioRow {
  name: string;
  value: string;
  /** Optional free-text note entered by the kiné during the study. */
  comment?: string | null;
}

// ─── Palette ──────────────────────────────────────────────────────────────────

const TEAL = "#1D9E75";
const LIGHT = "#E5E7EB";
const GRAY = "#6B7280";
const DARK = "#111827";

const styles = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 56,
    paddingHorizontal: 56, // ~20mm
    fontFamily: "Helvetica",
    fontSize: 10,
    color: DARK,
    lineHeight: 1.5,
  },
  // Header band
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: TEAL,
    paddingBottom: 12,
    marginBottom: 20,
  },
  brand: { fontSize: 18, fontFamily: "Helvetica-Bold", color: TEAL },
  cabinet: { fontSize: 9, color: GRAY },
  pageTag: { fontSize: 9, color: GRAY, textTransform: "uppercase" },

  sectionTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: TEAL,
    marginBottom: 8,
    marginTop: 16,
  },
  // key/value rows
  row: { flexDirection: "row", paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: LIGHT },
  rowLabel: { width: "45%", color: GRAY },
  rowValue: { width: "55%", fontFamily: "Helvetica-Bold" },

  // measures table (côte / avant / après)
  tHead: { flexDirection: "row", backgroundColor: "#F3F4F6", paddingVertical: 4, paddingHorizontal: 6 },
  tRow: { flexDirection: "row", paddingVertical: 4, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: LIGHT },
  tColName: { width: "50%", color: DARK },
  tComment: { color: GRAY, fontSize: 8, marginTop: 1 },
  tColNameHead: { width: "50%", color: GRAY, fontSize: 9, textTransform: "uppercase" },
  tColVal: { width: "25%", textAlign: "right", fontFamily: "Helvetica-Bold" },
  tColValHead: { width: "25%", textAlign: "right", color: GRAY, fontSize: 9, textTransform: "uppercase" },

  // two-column grid
  grid: { flexDirection: "row", flexWrap: "wrap" },
  gridCell: { width: "50%", paddingVertical: 3 },
  cellLabel: { color: GRAY, fontSize: 9 },
  cellValue: { fontFamily: "Helvetica-Bold", fontSize: 11 },

  chip: {
    backgroundColor: "#FEF2F2",
    color: "#B91C1C",
    fontSize: 9,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 8,
    marginRight: 4,
    marginBottom: 4,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },

  para: { marginTop: 4, color: DARK },

  // pain card
  painCard: {
    borderWidth: 0.5,
    borderColor: LIGHT,
    borderRadius: 4,
    padding: 8,
    marginBottom: 6,
  },
  painName: { fontFamily: "Helvetica-Bold", fontSize: 10 },
  painMeta: { color: GRAY, fontSize: 9, marginTop: 2 },
  painFactor: { color: DARK, fontSize: 9, marginTop: 2 },

  // exercise card
  exerciseCard: {
    borderWidth: 0.5,
    borderColor: LIGHT,
    borderRadius: 4,
    padding: 10,
    marginBottom: 8,
  },
  exerciseName: { fontFamily: "Helvetica-Bold", fontSize: 11 },
  exerciseMeta: { color: TEAL, fontSize: 9, marginTop: 2 },
  exerciseDesc: { color: DARK, fontSize: 9, marginTop: 4 },

  notesBox: {
    borderWidth: 0.5,
    borderColor: LIGHT,
    borderRadius: 4,
    height: 90,
    marginTop: 8,
  },

  footer: {
    position: "absolute",
    bottom: 28,
    left: 56,
    right: 56,
    borderTopWidth: 0.5,
    borderTopColor: LIGHT,
    paddingTop: 6,
    fontSize: 8,
    color: GRAY,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

// ─── Reusable bits ──────────────────────────────────────────────────────────

const CABINET = process.env.CABINET_NAME || "PosturoBilan";

function Header({ tag }: { tag: string }) {
  return (
    <View style={styles.header} fixed>
      <View>
        <Text style={styles.brand}>{CABINET}</Text>
        <Text style={styles.cabinet}>Étude posturale vélo</Text>
      </View>
      <Text style={styles.pageTag}>{tag}</Text>
    </View>
  );
}

function Footer() {
  return (
    <View style={styles.footer} fixed>
      <Text>{CABINET} — Rapport confidentiel</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function KV({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{String(value)}</Text>
    </View>
  );
}

function Cell({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <View style={styles.gridCell}>
      <Text style={styles.cellLabel}>{label}</Text>
      <Text style={styles.cellValue}>{String(value)}</Text>
    </View>
  );
}

// ─── Document ─────────────────────────────────────────────────────────────────

function fmtVal(value: number | null, unit: string): string {
  return value == null ? "—" : `${value} ${unit}`;
}

/** Avant / après / delta table shared by both measurement types. */
function MeasureTable({ rows }: { rows: ReportMeasureRow[] }) {
  return (
    <>
      <View style={styles.tHead}>
        <Text style={[styles.tColNameHead, { width: "40%" }]}>Mesure</Text>
        <Text style={[styles.tColValHead, { width: "20%" }]}>Avant</Text>
        <Text style={[styles.tColValHead, { width: "20%" }]}>Après</Text>
        <Text style={[styles.tColValHead, { width: "20%" }]}>Delta</Text>
      </View>
      {rows.map((r, i) => (
        <View key={i} style={styles.tRow}>
          <Text style={[styles.tColName, { width: "40%" }]}>{r.name}</Text>
          <Text style={[styles.tColVal, { width: "20%" }]}>{fmtVal(r.before, r.unit)}</Text>
          <Text style={[styles.tColVal, { width: "20%" }]}>{fmtVal(r.after, r.unit)}</Text>
          <Text style={[styles.tColVal, { width: "20%", color: GRAY }]}>
            {formatDelta(r.before, r.after, r.unit) ?? "—"}
          </Text>
        </View>
      ))}
    </>
  );
}

export function ReportTemplate({
  study,
  measureRows,
  riderMeasureRows,
  physioRows,
}: {
  study: StudyForReport;
  measureRows: ReportMeasureRow[];
  riderMeasureRows: ReportMeasureRow[];
  physioRows: ReportPhysioRow[];
}) {
  const { patient, kine } = study;
  const intake = patient.intake;
  const studyDate = new Date(study.createdAt).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <Document
      title={`Rapport étude posturale — ${patient.firstName} ${patient.lastName}`}
      author={CABINET}
    >
      {/* PAGE 1 — Informations patient */}
      <Page size="A4" style={styles.page}>
        <Header tag="Informations patient" />

        <Text style={styles.sectionTitle}>Patient</Text>
        <KV label="Nom" value={`${patient.firstName} ${patient.lastName}`} />
        <KV label="Email" value={patient.email} />
        <KV label="Date de l'étude" value={studyDate} />
        <KV label="Kinésithérapeute" value={kine.name} />

        {intake && (
          <>
            <Text style={styles.sectionTitle}>Morphologie & pratique</Text>
            <View style={styles.grid}>
              <Cell label="Taille" value={intake.heightCm ? `${intake.heightCm} cm` : null} />
              <Cell label="Poids" value={intake.weightKg ? `${intake.weightKg} kg` : null} />
              <Cell label="Type de vélo" value={intake.bikeType} />
              <Cell label="Niveau" value={intake.ridingLevel} />
              <Cell label="Heures / semaine" value={intake.weeklyHours} />
              <Cell label="Années de pratique" value={intake.yearsRiding} />
            </View>

            {intake.injuries.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Douleurs initiales déclarées</Text>
                <View style={styles.chipRow}>
                  {intake.injuries.map((injury, i) => (
                    <Text key={i} style={styles.chip}>{injury}</Text>
                  ))}
                </View>
              </>
            )}

            {intake.goals && (
              <>
                <Text style={styles.sectionTitle}>Objectifs</Text>
                <Text style={styles.para}>{intake.goals}</Text>
              </>
            )}
          </>
        )}

        <Footer />
      </Page>

      {/* PAGE 2 — Mesures posturales */}
      <Page size="A4" style={styles.page}>
        <Header tag="Mesures posturales" />

        <KV label="Type de vélo" value={study.bikeType.name} />

        {study.pains.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Douleurs évaluées</Text>
            {study.pains.map((p) => {
              const meta = [
                p.type,
                p.intensity ? `${p.intensity}/10` : null,
                p.restAtRest ? "présente au repos" : null,
                p.activity,
                p.duration,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <View key={p.id} style={styles.painCard} wrap={false}>
                  <Text style={styles.painName}>{p.location}</Text>
                  {meta ? <Text style={styles.painMeta}>{meta}</Text> : null}
                  {p.aggravatingFactors ? (
                    <Text style={styles.painFactor}>↑ {p.aggravatingFactors}</Text>
                  ) : null}
                  {p.relievingFactors ? (
                    <Text style={styles.painFactor}>↓ {p.relievingFactors}</Text>
                  ) : null}
                </View>
              );
            })}
          </>
        )}

        <Text style={styles.sectionTitle}>Mesures du vélo (avant / après / delta)</Text>
        {measureRows.length === 0 ? (
          <Text style={styles.para}>Aucune mesure du vélo renseignée.</Text>
        ) : (
          <MeasureTable rows={measureRows} />
        )}

        {riderMeasureRows.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Mesures du cycliste sur vélo (avant / après / delta)</Text>
            <MeasureTable rows={riderMeasureRows} />
          </>
        )}

        {physioRows.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Tests physiologiques</Text>
            <View style={styles.tHead}>
              <Text style={styles.tColNameHead}>Test</Text>
              <Text style={[styles.tColValHead, { width: "50%" }]}>Résultat</Text>
            </View>
            {physioRows.map((r, i) => (
              <View key={i} style={styles.tRow}>
                <View style={{ width: "50%" }}>
                  <Text style={{ color: DARK }}>{r.name}</Text>
                  {r.comment ? <Text style={styles.tComment}>{r.comment}</Text> : null}
                </View>
                <Text style={[styles.tColVal, { width: "50%" }]}>{r.value}</Text>
              </View>
            ))}
          </>
        )}

        {study.componentsUsed.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Composants modifiés</Text>
            {study.componentsUsed.map((c) => (
              <KV
                key={c.id}
                label={c.category}
                value={[c.name, c.brand, c.model].filter(Boolean).join(" — ")}
              />
            ))}
          </>
        )}

        {study.observations && (
          <>
            <Text style={styles.sectionTitle}>Observations du kiné</Text>
            <Text style={styles.para}>{study.observations}</Text>
          </>
        )}

        {study.summary && (
          <>
            <Text style={styles.sectionTitle}>Bilan</Text>
            <Text style={styles.para}>{study.summary}</Text>
          </>
        )}

        {study.recommendations && (
          <>
            <Text style={styles.sectionTitle}>Recommandations</Text>
            <Text style={styles.para}>{study.recommendations}</Text>
          </>
        )}

        <Footer />
      </Page>

      {/* PAGE 3 — Plan d'exercices */}
      <Page size="A4" style={styles.page}>
        <Header tag="Plan d'exercices" />

        <Text style={styles.sectionTitle}>Exercices prescrits</Text>
        {study.exercisesPrescribed.length === 0 ? (
          <Text style={styles.para}>Aucun exercice prescrit.</Text>
        ) : (
          study.exercisesPrescribed.map((e) => (
            <View key={e.id} style={styles.exerciseCard} wrap={false}>
              <Text style={styles.exerciseName}>{e.name}</Text>
              <Text style={styles.exerciseMeta}>
                {[e.category, e.frequency, e.duration].filter(Boolean).join(" · ")}
              </Text>
              {e.description ? <Text style={styles.exerciseDesc}>{e.description}</Text> : null}
            </View>
          ))
        )}

        <Text style={styles.sectionTitle}>Notes du patient</Text>
        <View style={styles.notesBox} />

        <Footer />
      </Page>
    </Document>
  );
}
