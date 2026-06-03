// Sortable field whitelists for each list view. Kept in a plain module (not the
// "use server" action files, which may only export async functions) so both the
// pages and the actions can reference them.

export const PATIENT_SORT_FIELDS = ["name", "createdAt"] as const;
export const STUDY_SORT_FIELDS = ["createdAt", "status", "patient"] as const;
export const EXERCISE_SORT_FIELDS = ["name", "createdAt"] as const;
export const COMPONENT_SORT_FIELDS = ["name", "category", "createdAt"] as const;
