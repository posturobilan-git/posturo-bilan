// Colonnes PII chiffrées par modèle — voir lib/crypto.ts et prompts/26-chiffrement.md.

export const PATIENT_ENCRYPTED_FIELDS = ["firstName", "lastName", "email", "phone"] as const;
export const INTAKE_ENCRYPTED_FIELDS = ["medicalNotes"] as const;
export const USER_ENCRYPTED_FIELDS = ["email", "name"] as const;
