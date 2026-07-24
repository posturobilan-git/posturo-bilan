import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { formatDelta } from "@/lib/measures";
import { LOGO_DATA_URI } from "@/components/pdf/logo";
import type { StudyForReport } from "@/types";

export interface ReportMeasureRow {
  name: string;
  unit: string;
  before: number | null;
  after: number | null;
}

/** A patient photo embedded in the report, as a base64 data URI (jpg/png). */
export interface ReportPhoto {
  dataUri: string;
  angle: string | null; // pre-formatted label
  caption: string | null;
}

/** A before/after pair sharing the same angle, aligned for the comparison. */
export interface ReportPhotoPair {
  before?: ReportPhoto;
  after?: ReportPhoto;
}

/** Physio test row — the value is pre-formatted (Oui/Non, Positif/Négatif, valeur + unité). */
export interface ReportPhysioRow {
  name: string;
  value: string;
  /** Optional free-text note entered by the kiné during the study. */
  comment?: string | null;
}

// ─── Palette ──────────────────────────────────────────────────────────────────
// Mirrors the app's design tokens (app/globals.css `@theme`) so the report
// feels like the same product, not a generic document.

const TEAL = "#326F45"; // brand-700
const BRAND_LIGHT = "#F2F6F3"; // brand-50 — tinted cards/backgrounds
const BRAND_BORDER = "#E0EBE3"; // brand-100 — border on tinted cards
const ACCENT = "#00958A"; // accent-600
const SURFACE_MUTED = "#F5F7F9";
const LIGHT = "#E3E5E8"; // border
const GRAY = "#5F646A"; // content-muted
const GRAY_SUBTLE = "#82868C"; // content-subtle
const DARK = "#15191D"; // content
const DANGER = "#BB0916"; // danger-700
const DANGER_BG = "#FFF0EE"; // danger-50
const DANGER_BORDER = "#FFDEDB"; // danger-100

const styles = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 56,
    paddingHorizontal: 56, // ~20mm
    fontFamily: "Helvetica",
    fontSize: 10,
    color: DARK,
  },
  // `lineHeight` lives here rather than on `page`: react-pdf/Yoga mis-measures
  // the page box when lineHeight is set at that level, which pushes `fixed`
  // absolutely-positioned children (the Footer) below the page and off-canvas.
  content: {
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
  headerLeft: { flexDirection: "row", alignItems: "center" },
  headerLogo: { width: 28, height: 28, marginRight: 8 },
  brand: { fontSize: 16, fontFamily: "Helvetica-Bold", color: TEAL },
  cabinet: { fontSize: 9, color: GRAY },
  pageTag: {
    fontSize: 8,
    color: TEAL,
    textTransform: "uppercase",
    backgroundColor: BRAND_LIGHT,
    borderWidth: 0.5,
    borderColor: BRAND_BORDER,
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },

  sectionTitle: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    marginTop: 16,
  },
  sectionBar: { width: 3, height: 11, backgroundColor: TEAL, marginRight: 6, borderRadius: 1.5 },
  sectionTitleText: { fontSize: 12, fontFamily: "Helvetica-Bold", color: TEAL },

  // cover card (page 1 — patient identity)
  coverCard: {
    backgroundColor: BRAND_LIGHT,
    borderWidth: 0.5,
    borderColor: BRAND_BORDER,
    borderRadius: 6,
    padding: 14,
    marginBottom: 4,
  },
  coverEyebrow: { fontSize: 9, color: ACCENT, textTransform: "uppercase", letterSpacing: 1 },
  coverName: { fontSize: 19, fontFamily: "Helvetica-Bold", color: DARK, marginTop: 3 },
  coverDivider: { height: 0.5, backgroundColor: BRAND_BORDER, marginTop: 10, marginBottom: 8 },
  coverStats: { flexDirection: "row" },
  coverStat: { width: "30%", paddingRight: 8 },
  coverStatWide: { width: "40%" },
  coverStatLabel: { fontSize: 7.5, color: GRAY_SUBTLE, textTransform: "uppercase", letterSpacing: 0.5 },
  coverStatValue: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: DARK, marginTop: 1 },

  // key/value rows
  row: { flexDirection: "row", paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: LIGHT },
  rowLabel: { width: "45%", color: GRAY },
  rowValue: { width: "55%", fontFamily: "Helvetica-Bold" },

  // two-column grid, boxed as a card
  gridCard: {
    borderWidth: 0.5,
    borderColor: LIGHT,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 2,
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  gridCell: { width: "33.33%", paddingVertical: 4 },
  cellLabel: { color: GRAY_SUBTLE, fontSize: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  cellValue: { fontFamily: "Helvetica-Bold", fontSize: 11, color: DARK, marginTop: 1 },

  // measures table (côte / avant / après)
  tHead: { flexDirection: "row", backgroundColor: SURFACE_MUTED, paddingVertical: 5, paddingHorizontal: 6, borderRadius: 3 },
  tRow: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: LIGHT },
  tRowAlt: { backgroundColor: SURFACE_MUTED },
  tColName: { width: "50%", color: DARK },
  tComment: { color: GRAY, fontSize: 8, marginTop: 1 },
  tColNameHead: { width: "50%", color: GRAY, fontSize: 8.5, textTransform: "uppercase", letterSpacing: 0.5 },
  tColVal: { width: "25%", textAlign: "right", fontFamily: "Helvetica-Bold" },
  tColValHead: { width: "25%", textAlign: "right", color: GRAY, fontSize: 8.5, textTransform: "uppercase", letterSpacing: 0.5 },
  deltaCell: { width: "20%", alignItems: "flex-end", justifyContent: "center" },
  deltaPill: {
    backgroundColor: BRAND_LIGHT,
    color: TEAL,
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    lineHeight: 1,
    paddingVertical: 2.5,
    paddingHorizontal: 6,
    borderRadius: 7,
  },
  deltaNone: { color: GRAY_SUBTLE, fontFamily: "Helvetica" },

  chip: {
    backgroundColor: DANGER_BG,
    color: DANGER,
    fontSize: 9,
    lineHeight: 1.3,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: DANGER_BORDER,
    marginRight: 4,
    marginBottom: 4,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },

  para: { marginTop: 4, color: DARK },
  hint: { fontSize: 8.5, color: GRAY_SUBTLE, fontFamily: "Helvetica-Oblique", marginTop: 8 },

  // photos avant / après (deux colonnes, paires alignées)
  photoHead: { flexDirection: "row", marginTop: 4 },
  photoHeadCell: { width: "50%", color: GRAY, fontSize: 8.5, textTransform: "uppercase", letterSpacing: 0.5 },
  photoRow: { flexDirection: "row", marginBottom: 8 },
  photoCell: { width: "50%", paddingRight: 6 },
  photoFrame: {
    borderWidth: 0.5,
    borderColor: LIGHT,
    borderRadius: 4,
    padding: 3,
    backgroundColor: "#FFFFFF",
  },
  photoImg: { width: "100%", height: 150, objectFit: "contain", borderRadius: 2 },
  photoCaption: { color: GRAY, fontSize: 8, marginTop: 3, textAlign: "center" },

  // pain card — danger accent bar flags patient discomfort at a glance
  painCard: {
    borderWidth: 0.5,
    borderColor: LIGHT,
    borderLeftWidth: 3,
    borderLeftColor: "#F14445",
    borderRadius: 4,
    padding: 8,
    marginBottom: 6,
  },
  painHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  painName: { fontFamily: "Helvetica-Bold", fontSize: 10 },
  painDots: { flexDirection: "row", alignItems: "center" },
  painDot: { width: 5, height: 5, borderRadius: 2.5, marginLeft: 2 },
  painDotOn: { backgroundColor: "#F14445" },
  painDotOff: { backgroundColor: LIGHT },
  painScore: { fontSize: 8, color: GRAY, marginLeft: 5, lineHeight: 1 },
  painMeta: { color: GRAY, fontSize: 9, marginTop: 2 },
  painFactor: { color: DARK, fontSize: 9, marginTop: 2 },
  painFactorAgg: { fontFamily: "Helvetica-Bold", color: DANGER },
  painFactorRel: { fontFamily: "Helvetica-Bold", color: TEAL },

  // exercise card — brand accent bar pairs visually with pain cards
  exerciseCard: {
    flexDirection: "row",
    borderWidth: 0.5,
    borderColor: LIGHT,
    borderLeftWidth: 3,
    borderLeftColor: TEAL,
    borderRadius: 4,
    padding: 10,
    marginBottom: 8,
  },
  exerciseBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: TEAL,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    marginTop: 1,
  },
  exerciseBadgeText: { color: "#FFFFFF", fontSize: 9, fontFamily: "Helvetica-Bold", lineHeight: 1 },
  exerciseBody: { flex: 1 },
  exerciseName: { fontFamily: "Helvetica-Bold", fontSize: 11 },
  exerciseMeta: { color: TEAL, fontSize: 9, marginTop: 2 },
  exerciseDesc: { color: DARK, fontSize: 9, marginTop: 4 },

  notesBox: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#D1D5D8", // border-strong
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
    alignItems: "center",
  },
  footerLeft: { flexDirection: "row", alignItems: "center" },
  footerLogo: { width: 11, height: 11, marginRight: 5 },
});

// ─── Reusable bits ──────────────────────────────────────────────────────────

const CABINET = process.env.CABINET_NAME || "PosturoBilan";

function Header({ tag }: { tag: string }) {
  return (
    <View style={styles.header} fixed>
      <View style={styles.headerLeft}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src={LOGO_DATA_URI} style={styles.headerLogo} />
        <View>
          <Text style={styles.brand}>{CABINET}</Text>
          <Text style={styles.cabinet}>Étude posturale vélo</Text>
        </View>
      </View>
      <Text style={styles.pageTag}>{tag}</Text>
    </View>
  );
}

function Footer() {
  return (
    <View style={styles.footer} fixed>
      <View style={styles.footerLeft}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src={LOGO_DATA_URI} style={styles.footerLogo} />
        <Text>{CABINET} — Rapport confidentiel</Text>
      </View>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <View style={styles.sectionTitle}>
      <View style={styles.sectionBar} />
      <Text style={styles.sectionTitleText}>{children}</Text>
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
      {rows.map((r, i) => {
        const delta = formatDelta(r.before, r.after, r.unit);
        return (
          <View key={i} style={i % 2 === 1 ? [styles.tRow, styles.tRowAlt] : styles.tRow}>
            <Text style={[styles.tColName, { width: "40%" }]}>{r.name}</Text>
            <Text style={[styles.tColVal, { width: "20%" }]}>{fmtVal(r.before, r.unit)}</Text>
            <Text style={[styles.tColVal, { width: "20%" }]}>{fmtVal(r.after, r.unit)}</Text>
            <View style={styles.deltaCell}>
              {delta ? (
                <Text style={styles.deltaPill}>{delta}</Text>
              ) : (
                <Text style={styles.deltaNone}>—</Text>
              )}
            </View>
          </View>
        );
      })}
    </>
  );
}

/** One before/after photo cell — an image with an optional angle/caption line. */
function PhotoCellPdf({ photo }: { photo?: ReportPhoto }) {
  if (!photo) return <View style={styles.photoCell} />;
  const meta = [photo.angle, photo.caption].filter(Boolean).join(" · ");
  return (
    <View style={styles.photoCell}>
      <View style={styles.photoFrame}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src={photo.dataUri} style={styles.photoImg} />
      </View>
      {meta ? <Text style={styles.photoCaption}>{meta}</Text> : null}
    </View>
  );
}

export function ReportTemplate({
  study,
  measureRows,
  riderMeasureRows,
  physioRows,
  photoPairs,
}: {
  study: StudyForReport;
  measureRows: ReportMeasureRow[];
  riderMeasureRows: ReportMeasureRow[];
  physioRows: ReportPhysioRow[];
  photoPairs: ReportPhotoPair[];
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
        <View style={styles.content}>

        <View style={styles.coverCard}>
          <Text style={styles.coverEyebrow}>Rapport d&apos;étude posturale</Text>
          <Text style={styles.coverName}>{patient.firstName} {patient.lastName}</Text>
          <View style={styles.coverDivider} />
          <View style={styles.coverStats}>
            <View style={styles.coverStat}>
              <Text style={styles.coverStatLabel}>Date de l&apos;étude</Text>
              <Text style={styles.coverStatValue}>{studyDate}</Text>
            </View>
            <View style={styles.coverStat}>
              <Text style={styles.coverStatLabel}>Kinésithérapeute</Text>
              <Text style={styles.coverStatValue}>{kine.name}</Text>
            </View>
            <View style={styles.coverStatWide}>
              <Text style={styles.coverStatLabel}>Email</Text>
              <Text style={styles.coverStatValue}>{patient.email}</Text>
            </View>
          </View>
        </View>

        {intake && (
          <>
            <SectionTitle>Morphologie & pratique</SectionTitle>
            <View style={[styles.grid, styles.gridCard]}>
              <Cell label="Taille" value={intake.heightCm ? `${intake.heightCm} cm` : null} />
              <Cell label="Poids" value={intake.weightKg ? `${intake.weightKg} kg` : null} />
              <Cell label="Type de vélo" value={intake.bikeType} />
              <Cell label="Niveau" value={intake.ridingLevel} />
              <Cell label="Heures / semaine" value={intake.weeklyHours} />
              <Cell label="Années de pratique" value={intake.yearsRiding} />
            </View>

            {intake.injuries.length > 0 && (
              <>
                <SectionTitle>Douleurs initiales déclarées</SectionTitle>
                <View style={styles.chipRow}>
                  {intake.injuries.map((injury, i) => (
                    <Text key={i} style={styles.chip}>{injury}</Text>
                  ))}
                </View>
              </>
            )}

            {intake.goals && (
              <>
                <SectionTitle>Objectifs</SectionTitle>
                <Text style={styles.para}>{intake.goals}</Text>
              </>
            )}
          </>
        )}

        </View>
        <Footer />
      </Page>

      {/* PAGE 2 — Mesures posturales */}
      <Page size="A4" style={styles.page}>
        <Header tag="Mesures posturales" />
        <View style={styles.content}>

        <KV label="Type de vélo" value={study.bikeType.name} />

        {study.pains.length > 0 && (
          <>
            <SectionTitle>Douleurs évaluées</SectionTitle>
            {study.pains.map((p) => {
              const meta = [
                p.type,
                p.restAtRest ? "présente au repos" : null,
                p.activity,
                p.duration,
              ]
                .filter(Boolean)
                .join(" · ");
              const parsed = p.intensity ? parseInt(p.intensity, 10) : NaN;
              const intensity = Number.isNaN(parsed) ? null : Math.min(10, Math.max(0, parsed));
              return (
                <View key={p.id} style={styles.painCard} wrap={false}>
                  <View style={styles.painHead}>
                    <Text style={styles.painName}>{p.location}</Text>
                    {intensity != null ? (
                      <View style={styles.painDots}>
                        {Array.from({ length: 10 }).map((_, i) => (
                          <View
                            key={i}
                            style={[styles.painDot, i < intensity ? styles.painDotOn : styles.painDotOff]}
                          />
                        ))}
                        <Text style={styles.painScore}>{intensity}/10</Text>
                      </View>
                    ) : null}
                  </View>
                  {meta ? <Text style={styles.painMeta}>{meta}</Text> : null}
                  {p.aggravatingFactors ? (
                    <Text style={styles.painFactor}>
                      <Text style={styles.painFactorAgg}>Aggravé par : </Text>
                      {p.aggravatingFactors}
                    </Text>
                  ) : null}
                  {p.relievingFactors ? (
                    <Text style={styles.painFactor}>
                      <Text style={styles.painFactorRel}>Soulagé par : </Text>
                      {p.relievingFactors}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </>
        )}

        <SectionTitle>Mesures du vélo (avant / après / delta)</SectionTitle>
        {measureRows.length === 0 ? (
          <Text style={styles.para}>Aucune mesure du vélo renseignée.</Text>
        ) : (
          <MeasureTable rows={measureRows} />
        )}

        {riderMeasureRows.length > 0 && (
          <>
            <SectionTitle>Mesures du cycliste sur vélo (avant / après / delta)</SectionTitle>
            <MeasureTable rows={riderMeasureRows} />
          </>
        )}

        {physioRows.length > 0 && (
          <>
            <SectionTitle>Tests physiologiques</SectionTitle>
            <View style={styles.tHead}>
              <Text style={styles.tColNameHead}>Test</Text>
              <Text style={[styles.tColValHead, { width: "50%" }]}>Résultat</Text>
            </View>
            {physioRows.map((r, i) => (
              <View key={i} style={i % 2 === 1 ? [styles.tRow, styles.tRowAlt] : styles.tRow}>
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
            <SectionTitle>Composants modifiés</SectionTitle>
            {study.componentsUsed.map((c) => (
              <KV
                key={c.id}
                label={c.category.name}
                value={[c.name, c.brand, c.model].filter(Boolean).join(" — ")}
              />
            ))}
          </>
        )}

        {study.observations && (
          <>
            <SectionTitle>Observations du kiné</SectionTitle>
            <Text style={styles.para}>{study.observations}</Text>
          </>
        )}

        {study.summary && (
          <>
            <SectionTitle>Bilan</SectionTitle>
            <Text style={styles.para}>{study.summary}</Text>
          </>
        )}

        {study.recommendations && (
          <>
            <SectionTitle>Recommandations</SectionTitle>
            <Text style={styles.para}>{study.recommendations}</Text>
          </>
        )}

        {photoPairs.length > 0 && (
          <>
            <SectionTitle>Photos avant / après</SectionTitle>
            <View style={styles.photoHead}>
              <Text style={styles.photoHeadCell}>Avant réglage</Text>
              <Text style={styles.photoHeadCell}>Après réglage</Text>
            </View>
            {photoPairs.map((pair, i) => (
              <View key={i} style={styles.photoRow} wrap={false}>
                <PhotoCellPdf photo={pair.before} />
                <PhotoCellPdf photo={pair.after} />
              </View>
            ))}
          </>
        )}

        </View>
        <Footer />
      </Page>

      {/* PAGE 3 — Plan d'exercices */}
      <Page size="A4" style={styles.page}>
        <Header tag="Plan d'exercices" />
        <View style={styles.content}>

        <SectionTitle>Exercices prescrits</SectionTitle>
        {study.exercisesPrescribed.length === 0 ? (
          <Text style={styles.para}>Aucun exercice prescrit.</Text>
        ) : (
          study.exercisesPrescribed.map((e, i) => (
            <View key={e.id} style={styles.exerciseCard} wrap={false}>
              <View style={styles.exerciseBadge}>
                <Text style={styles.exerciseBadgeText}>{i + 1}</Text>
              </View>
              <View style={styles.exerciseBody}>
                <Text style={styles.exerciseName}>{e.name}</Text>
                <Text style={styles.exerciseMeta}>
                  {[e.category, e.frequency, e.duration].filter(Boolean).join(" · ")}
                </Text>
                {e.description ? <Text style={styles.exerciseDesc}>{e.description}</Text> : null}
              </View>
            </View>
          ))
        )}

        <SectionTitle>Notes du patient</SectionTitle>
        <Text style={styles.hint}>Espace libre pour vos remarques après lecture du rapport.</Text>
        <View style={styles.notesBox} />

        </View>
        <Footer />
      </Page>
    </Document>
  );
}
