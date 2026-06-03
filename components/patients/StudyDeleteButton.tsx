"use client";

import { deleteStudy } from "@/actions/study.actions";
import { DeleteButton } from "@/components/ui/DeleteButton";

export function StudyDeleteButton({ studyId }: { studyId: string }) {
  return (
    <DeleteButton
      onConfirm={() => deleteStudy(studyId)}
      successMessage="Étude supprimée."
      warning="Action définitive."
    />
  );
}
