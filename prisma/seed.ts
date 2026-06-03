import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  ExerciseCategory,
  ComponentCategory,
  MeasurementCategory,
  StudyStatus,
  Prisma,
} from "@prisma/client";
import type { StudyMeasures, StudyMeasureValue } from "../types";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// ─── Types de vélo (gérés par l'admin) ──────────────────────────────────────────
const BIKE_TYPES = ["Route", "VTT", "Gravel", "Triathlon", "Piste"];

const EXERCISES: Array<{
  name: string;
  description: string;
  category: ExerciseCategory;
  frequency?: string;
  duration?: string;
}> = [
  { name: "Étirement du psoas", description: "Fente avant, bassin rétroversé, étirement de la chaîne antérieure de la hanche.", category: "SOUPLESSE", frequency: "2×/jour", duration: "30 s par côté" },
  { name: "Gainage planche", description: "Maintien isométrique en appui avant-bras, dos neutre.", category: "RENFORCEMENT", frequency: "1×/jour", duration: "3 × 45 s" },
  { name: "Mobilité thoracique", description: "Rotation du segment thoracique en quadrupédie, main derrière la tête.", category: "MOBILITE", frequency: "1×/jour", duration: "10 répétitions/côté" },
  { name: "Renforcement VMO", description: "Extension de genou en fin d'amplitude pour le vaste médial oblique.", category: "RENFORCEMENT", frequency: "3×/semaine", duration: "3 × 15" },
  { name: "Étirement ischio-jambiers", description: "Flexion de hanche jambe tendue, dos droit.", category: "SOUPLESSE", frequency: "2×/jour", duration: "30 s par jambe" },
  { name: "Proprioception cheville", description: "Équilibre unipodal sur surface instable, yeux ouverts puis fermés.", category: "PROPRIOCEPTION", frequency: "1×/jour", duration: "3 × 30 s" },
  { name: "Mobilité hanche 90/90", description: "Travail des rotations interne et externe de hanche en position assise.", category: "MOBILITE", frequency: "1×/jour", duration: "10 transitions" },
  { name: "Renforcement moyen fessier", description: "Abduction de hanche en décubitus latéral, contrôle du bassin.", category: "RENFORCEMENT", frequency: "3×/semaine", duration: "3 × 15/côté" },
];

const COMPONENTS: Array<{
  name: string;
  brand?: string;
  model?: string;
  category: ComponentCategory;
  notes?: string;
  bikeTypes?: string[]; // types compatibles ; vide = universel
}> = [
  { name: "Selle Arione R3", brand: "Fizik", model: "Arione R3", category: "SELLE", notes: "Selle longue, bassin peu mobile.", bikeTypes: ["Route", "Triathlon"] },
  { name: "Selle Antares R3", brand: "Fizik", model: "Antares R3", category: "SELLE", notes: "Bassin à mobilité moyenne.", bikeTypes: ["Route", "Gravel"] },
  { name: "Selle SR", brand: "Ergon", model: "SR Pro", category: "SELLE", notes: "Canal central, confort périnéal.", bikeTypes: ["Gravel", "VTT"] },
  { name: "Potence SL-K", brand: "FSA", model: "SL-K", category: "POTENCE", notes: "Disponible 90–120 mm.", bikeTypes: ["Route", "Gravel"] },
  { name: "Potence Pro PLT", brand: "Pro", model: "PLT", category: "POTENCE", bikeTypes: ["Route", "Triathlon"] },
  { name: "Cintre Compact", brand: "Deda", model: "Zero100", category: "CINTRE", notes: "Drop court, reach 75 mm.", bikeTypes: ["Route"] },
  { name: "Cales SPD-SL", brand: "Shimano", model: "SM-SH11", category: "CALE_PIEDS", notes: "Jeu 6°, jaune.", bikeTypes: ["Route", "Triathlon"] },
  { name: "Cales SPD-SL fixes", brand: "Shimano", model: "SM-SH10", category: "CALE_PIEDS", notes: "Jeu 0°, rouge.", bikeTypes: ["Route"] },
  { name: "Manivelles 170 mm", brand: "Shimano", model: "Ultegra R8000", category: "MANIVELLES", notes: "Pour petits gabarits." }, // universel
  { name: "Pédales Keo", brand: "Look", model: "Keo 2 Max", category: "PEDALES", bikeTypes: ["Route", "Gravel"] },
];

// ─── Côtes (mesures dynamiques) ──────────────────────────────────────────────────
// `legacyKey` permet de migrer l'ancien JSON `measures` à champs fixes vers le
// nouveau format avant/après (la valeur historique devient la valeur "après").
interface SeedMeasurement {
  name: string;
  unit: string;
  category: MeasurementCategory;
  order: number;
  isCommon: boolean;
  bikeTypes?: string[]; // si non commune
  legacyKey?: keyof StudyMeasures;
}

const MEASUREMENTS: SeedMeasurement[] = [
  // Tronc commun
  { name: "Hauteur de selle", unit: "cm", category: "SELLE", order: 1, isCommon: true, legacyKey: "saddleHeight" },
  { name: "Recul de selle", unit: "mm", category: "SELLE", order: 2, isCommon: true, legacyKey: "saddleSetback" },
  { name: "Angle de selle", unit: "°", category: "SELLE", order: 3, isCommon: true, legacyKey: "saddleAngle" },
  { name: "Hauteur de cintre", unit: "cm", category: "CINTRE", order: 4, isCommon: true, legacyKey: "handlebarHeight" },
  { name: "Longueur de potence", unit: "mm", category: "POTENCE", order: 5, isCommon: true, legacyKey: "stemLength" },
  { name: "Angle de potence", unit: "°", category: "POTENCE", order: 6, isCommon: true, legacyKey: "stemAngle" },
  { name: "Reach effectif", unit: "mm", category: "POSITION", order: 7, isCommon: true, legacyKey: "effectiveReach" },
  { name: "Angle du genou", unit: "°", category: "POSITION", order: 8, isCommon: true, legacyKey: "kneeAngle" },
  { name: "Angle de cale", unit: "°", category: "CALE_PIEDS", order: 9, isCommon: true, legacyKey: "cleatAngle" },
  { name: "Longueur de manivelles", unit: "mm", category: "MANIVELLES", order: 10, isCommon: true, legacyKey: "crankLength" },
  // Spécifiques Route
  { name: "Largeur de cintre", unit: "mm", category: "CINTRE", order: 20, isCommon: false, bikeTypes: ["Route", "Gravel"], legacyKey: "handlebarWidth" },
  // Spécifiques Triathlon
  { name: "Angle du tronc (aéro)", unit: "°", category: "POSITION", order: 30, isCommon: false, bikeTypes: ["Triathlon"], legacyKey: "trunkAngle" },
  { name: "Avancée de selle (aéro)", unit: "mm", category: "SELLE", order: 31, isCommon: false, bikeTypes: ["Triathlon"] },
];

// ─── Patients d'exemple (intake + une ou plusieurs études) ───────────────────────
interface SeedStudy {
  bikeType: string;
  status: StudyStatus;
  measures: StudyMeasures;
  componentNames: string[];
  exerciseNames: string[];
}

interface SeedPatient {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  intake: {
    heightCm?: number;
    weightKg?: number;
    bikeType?: string;
    ridingLevel?: string;
    weeklyHours?: number;
    yearsRiding?: number;
    injuries?: string[];
    goals?: string;
  };
  studies: SeedStudy[];
}

const PATIENTS: SeedPatient[] = [
  {
    email: "emma.petit@example.com",
    firstName: "Emma",
    lastName: "Petit",
    intake: { heightCm: 168, weightKg: 60, bikeType: "Route", ridingLevel: "Sportif", weeklyHours: 6, yearsRiding: 4, injuries: ["douleur cervicale"], goals: "Améliorer le confort sur longue distance." },
    studies: [], // patient sans étude encore
  },
  {
    email: "marie.dupont@example.com",
    firstName: "Marie",
    lastName: "Dupont",
    intake: { heightCm: 172, weightKg: 64, bikeType: "Route", ridingLevel: "Compétiteur", weeklyHours: 12, yearsRiding: 8, injuries: ["lombalgie"], goals: "Optimiser l'aérodynamisme sans douleur lombaire." },
    studies: [
      {
        bikeType: "Route",
        status: "study_pending",
        measures: { saddleHeight: 72.5, saddleSetback: 65 },
        componentNames: [],
        exerciseNames: [],
      },
    ],
  },
  {
    email: "thomas.martin@example.com",
    firstName: "Thomas",
    lastName: "Martin",
    intake: { heightCm: 181, weightKg: 78, bikeType: "Gravel", ridingLevel: "Sportif", weeklyHours: 8, yearsRiding: 10, injuries: ["douleur genou gauche"], goals: "Soulager le genou en montée." },
    studies: [
      {
        bikeType: "Gravel",
        status: "study_completed",
        measures: { saddleHeight: 76, saddleSetback: 72, stemLength: 100, effectiveReach: 388, cleatAngle: -2, crankLength: 172.5, observations: "Recul de cale pour soulager le genou gauche." },
        componentNames: ["Selle Antares R3", "Cales SPD-SL"],
        exerciseNames: ["Renforcement VMO", "Mobilité hanche 90/90"],
      },
      {
        // Multi-étude : le même patient a aussi un vélo de route.
        bikeType: "Route",
        status: "study_pending",
        measures: { saddleHeight: 75.5, saddleSetback: 70 },
        componentNames: [],
        exerciseNames: [],
      },
    ],
  },
  {
    email: "sophie.bernard@example.com",
    firstName: "Sophie",
    lastName: "Bernard",
    intake: { heightCm: 165, weightKg: 58, bikeType: "Triathlon", ridingLevel: "Compétiteur", weeklyHours: 14, yearsRiding: 6, injuries: ["douleur périnéale"], goals: "Tenir la position de triathlon sans gêne." },
    studies: [
      {
        bikeType: "Triathlon",
        status: "report_sent",
        measures: { saddleHeight: 70, saddleSetback: 40, saddleAngle: -3, stemLength: 90, effectiveReach: 410, trunkAngle: 12, crankLength: 165, observations: "Selle avancée pour position aéro." },
        componentNames: ["Selle SR", "Potence Pro PLT"],
        exerciseNames: ["Gainage planche", "Mobilité thoracique"],
      },
    ],
  },
  {
    email: "julien.leroy@example.com",
    firstName: "Julien",
    lastName: "Leroy",
    intake: { heightCm: 178, weightKg: 82, bikeType: "VTT", ridingLevel: "Loisir", weeklyHours: 4, yearsRiding: 3, injuries: ["douleur épaule"], goals: "Confort en sortie VTT le week-end." },
    studies: [
      {
        bikeType: "VTT",
        status: "followup_completed",
        measures: { saddleHeight: 74, saddleSetback: 60, handlebarHeight: 62, stemLength: 60, observations: "Potence raccourcie pour redresser le buste." },
        componentNames: ["Potence SL-K", "Cintre Compact"],
        exerciseNames: ["Étirement du psoas", "Proprioception cheville"],
      },
    ],
  },
];

async function main() {
  const admin =
    (await prisma.user.findFirst({ where: { role: "ADMIN" } })) ??
    (await prisma.user.findFirst());

  if (!admin) {
    throw new Error(
      "Aucun utilisateur en base. Connectez-vous une première fois via Clerk pour créer le compte admin, puis relancez le seed."
    );
  }

  // ── Types de vélo ──
  let btCreated = 0;
  for (const name of BIKE_TYPES) {
    const exists = await prisma.bikeType.findFirst({ where: { name } });
    if (exists) continue;
    await prisma.bikeType.create({ data: { name, createdById: admin.id } });
    btCreated++;
  }

  const bikeTypes = await prisma.bikeType.findMany();
  const bikeTypeByName = new Map(bikeTypes.map((b) => [b.name, b.id]));
  const idsForNames = (names: string[] = []) =>
    names.map((n) => bikeTypeByName.get(n)).filter((id): id is string => Boolean(id));

  // ── Exercices ──
  let exCreated = 0;
  for (const ex of EXERCISES) {
    const exists = await prisma.exercise.findFirst({ where: { name: ex.name } });
    if (exists) continue;
    await prisma.exercise.create({ data: { ...ex, createdById: admin.id } });
    exCreated++;
  }

  // ── Composants ──
  let compCreated = 0;
  for (const comp of COMPONENTS) {
    const exists = await prisma.bikeComponent.findFirst({ where: { name: comp.name } });
    if (exists) continue;
    const { bikeTypes: compTypes, ...fields } = comp;
    await prisma.bikeComponent.create({
      data: {
        ...fields,
        createdById: admin.id,
        bikeTypes: { connect: idsForNames(compTypes).map((id) => ({ id })) },
      },
    });
    compCreated++;
  }

  // Backfill : associe les types de vélo aux composants existants encore sans type.
  let compTypesLinked = 0;
  for (const comp of COMPONENTS) {
    if (!comp.bikeTypes || comp.bikeTypes.length === 0) continue;
    const existing = await prisma.bikeComponent.findFirst({
      where: { name: comp.name },
      select: { id: true, _count: { select: { bikeTypes: true } } },
    });
    if (!existing || existing._count.bikeTypes > 0) continue;
    await prisma.bikeComponent.update({
      where: { id: existing.id },
      data: { bikeTypes: { connect: idsForNames(comp.bikeTypes).map((id) => ({ id })) } },
    });
    compTypesLinked++;
  }

  // Resolve lookups once for the studies.
  const components = await prisma.bikeComponent.findMany({ select: { id: true, name: true } });
  const componentByName = new Map(components.map((c) => [c.name, c.id]));
  const exercises = await prisma.exercise.findMany({ select: { id: true, name: true } });
  const exerciseByName = new Map(exercises.map((e) => [e.name, e.id]));

  // ── Côtes (mesures dynamiques) ──
  let measCreated = 0;
  for (const m of MEASUREMENTS) {
    const exists = await prisma.measurement.findFirst({ where: { name: m.name } });
    if (exists) continue;
    await prisma.measurement.create({
      data: {
        name: m.name,
        unit: m.unit,
        category: m.category,
        isCommon: m.isCommon,
        createdById: admin.id,
        // Non-common côtes are linked to their bike types with a per-bike-type
        // display order (the old global `order` becomes this link order).
        bikeTypeLinks: m.isCommon
          ? undefined
          : {
              create: (m.bikeTypes ?? [])
                .map((n) => bikeTypeByName.get(n))
                .filter((id): id is string => Boolean(id))
                .map((bikeTypeId) => ({ bikeTypeId, order: m.order })),
            },
      },
    });
    measCreated++;
  }

  // Maps: measurement name/id and legacy-key → measurementId (for conversions).
  const measurements = await prisma.measurement.findMany({ select: { id: true, name: true } });
  const measurementIdByName = new Map(measurements.map((m) => [m.name, m.id]));
  const measurementIdByLegacyKey = new Map<string, string>();
  for (const m of MEASUREMENTS) {
    if (!m.legacyKey) continue;
    const id = measurementIdByName.get(m.name);
    if (id) measurementIdByLegacyKey.set(m.legacyKey, id);
  }

  /** Converts the example studies' fixed measures into before/after côte values. */
  function measuresToValues(measures: StudyMeasures): StudyMeasureValue[] {
    const out: StudyMeasureValue[] = [];
    for (const [key, value] of Object.entries(measures)) {
      if (typeof value !== "number") continue; // skip text fields & observations
      const measurementId = measurementIdByLegacyKey.get(key);
      if (!measurementId) continue;
      out.push({ measurementId, before: null, after: value });
    }
    return out;
  }

  // ── Patients + études d'exemple ──
  let patientsCreated = 0;
  let studiesCreated = 0;
  for (const p of PATIENTS) {
    const exists = await prisma.patient.findUnique({ where: { email: p.email } });
    if (exists) continue;

    const patient = await prisma.patient.create({
      data: {
        email: p.email,
        firstName: p.firstName,
        lastName: p.lastName,
        phone: p.phone,
        kineId: admin.id,
        intake: { create: { ...p.intake, injuries: p.intake.injuries ?? [], source: "manual" } },
      },
    });
    patientsCreated++;

    for (const s of p.studies) {
      const bikeTypeId = bikeTypeByName.get(s.bikeType);
      if (!bikeTypeId) continue;
      const { observations, ...numericMeasures } = s.measures;
      await prisma.study.create({
        data: {
          patientId: patient.id,
          kineId: admin.id,
          bikeTypeId,
          status: s.status,
          measureValues: measuresToValues(numericMeasures) as unknown as Prisma.InputJsonValue,
          observations: observations ?? null,
          componentsUsed: {
            connect: s.componentNames
              .map((n) => componentByName.get(n))
              .filter((id): id is string => Boolean(id))
              .map((id) => ({ id })),
          },
          exercisesPrescribed: {
            connect: s.exerciseNames
              .map((n) => exerciseByName.get(n))
              .filter((id): id is string => Boolean(id))
              .map((id) => ({ id })),
          },
        },
      });
      studiesCreated++;
    }
  }

  // ── Backfill : études antérieures (legacy `measures`) → `measureValues` ──
  let backfilled = 0;
  const legacyStudies = await prisma.study.findMany({
    where: { measures: { not: Prisma.JsonNull } },
    select: { id: true, measures: true, observations: true, measureValues: true },
  });
  for (const s of legacyStudies) {
    const existing = (s.measureValues as StudyMeasureValue[] | null) ?? [];
    if (existing.length > 0) continue; // déjà migrée
    const legacy = (s.measures as StudyMeasures | null) ?? {};
    const values = measuresToValues(legacy);
    if (values.length === 0 && !legacy.observations) continue;
    await prisma.study.update({
      where: { id: s.id },
      data: {
        measureValues: values as unknown as Prisma.InputJsonValue,
        // Conserve les observations historiques si la colonne dédiée est vide.
        observations: s.observations ?? legacy.observations ?? null,
      },
    });
    backfilled++;
  }

  console.log(
    `Seed terminé : ${btCreated}/${BIKE_TYPES.length} types de vélo, ${measCreated}/${MEASUREMENTS.length} côtes, ` +
      `${exCreated}/${EXERCISES.length} exercices, ${compCreated}/${COMPONENTS.length} composants ` +
      `(${compTypesLinked} associés à des types de vélo), ` +
      `${patientsCreated}/${PATIENTS.length} patients, ${studiesCreated} études créées, ` +
      `${backfilled} études migrées vers les côtes dynamiques (attribués à ${admin.email}).`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
