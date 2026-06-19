import type {
  Patient,
  PatientIntake,
  Study,
  Followup,
  BikeComponent,
  BikeType,
  Exercise,
  User,
  StudyStatus,
  Role,
  ComponentCategory,
  ExerciseCategory,
} from "@prisma/client";

export type { StudyStatus, Role, ComponentCategory, ExerciseCategory };

/** Une valeur de côte saisie pour une étude (avant/après). */
export interface StudyMeasureValue {
  measurementId: string;
  before: number | null;
  after: number | null;
}

/** Une valeur de mesure du cycliste saisie pour une étude (avant/après). */
export interface StudyRiderMeasureValue {
  riderMeasurementId: string;
  before: number | null;
  after: number | null;
}

/** Métadonnées minimales d'une côte/mesure, pour résoudre les valeurs à l'affichage. */
export interface MeasurementInfo {
  name: string;
  unit: string;
}

/** Legacy fixed-field measures (études antérieures à la refacto des côtes). */
export interface StudyMeasures {
  // Selle
  saddleHeight?: number;
  saddleSetback?: number;
  saddleAngle?: number;
  saddleModel?: string;
  // Cintre / potence
  handlebarHeight?: number;
  stemLength?: number;
  stemAngle?: number;
  handlebarWidth?: number;
  // Position corps
  effectiveReach?: number;
  trunkAngle?: number;
  kneeAngle?: number;
  // Cale-pieds
  cleatAngle?: number;
  cleatPosition?: string;
  // Manivelles
  crankLength?: number;
  // Libre
  observations?: string;
}

export type StudyWithLibrary = Study & {
  bikeType: BikeType;
  componentsUsed: BikeComponent[];
  exercisesPrescribed: Exercise[];
};

export type PatientWithRelations = Patient & {
  intake: PatientIntake | null;
  studies: StudyWithLibrary[];
  followups: Followup[];
  kine: User;
};

export type StudyWithRelations = Study & {
  bikeType: BikeType;
  componentsUsed: BikeComponent[];
  exercisesPrescribed: Exercise[];
  patient: Patient;
  kine: User;
};

/** Study with everything needed to render the PDF report. */
export type StudyForReport = Study & {
  bikeType: BikeType;
  componentsUsed: BikeComponent[];
  exercisesPrescribed: Exercise[];
  patient: Patient & { intake: PatientIntake | null };
  kine: User;
};

/** Study row for the cross-patient studies list (/dashboard/etudes). */
export type StudyListItem = Study & {
  bikeType: BikeType;
  patient: Pick<Patient, "id" | "firstName" | "lastName" | "isAnonymized">;
  kine: Pick<User, "name">;
};

export type UserWithCounts = User & {
  _count: {
    patients: number;
    studies: number;
  };
};
