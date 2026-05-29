import type {
  Patient,
  PatientIntake,
  PostureStudy,
  Followup,
  BikeComponent,
  Exercise,
  User,
  PatientStatus,
  Role,
  ComponentCategory,
  ExerciseCategory,
} from "@prisma/client";

export type { PatientStatus, Role, ComponentCategory, ExerciseCategory };

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

export type PatientWithRelations = Patient & {
  intake: PatientIntake | null;
  studies: (PostureStudy & {
    componentsUsed: BikeComponent[];
    exercisesPrescribed: Exercise[];
  })[];
  followups: Followup[];
  kine: User;
};

export type StudyWithRelations = PostureStudy & {
  componentsUsed: BikeComponent[];
  exercisesPrescribed: Exercise[];
  patient: Patient;
  kine: User;
};

/** Study with everything needed to render the PDF report. */
export type StudyForReport = PostureStudy & {
  componentsUsed: BikeComponent[];
  exercisesPrescribed: Exercise[];
  patient: Patient & { intake: PatientIntake | null };
  kine: User;
};

export type UserWithCounts = User & {
  _count: {
    patients: number;
    studies: number;
  };
};
