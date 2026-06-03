"use client";

import { useTransition } from "react";
import { toggleExercise, deleteExercise, type ExerciseWithCount } from "@/actions/exercise.actions";
import { toast } from "@/lib/stores/toastStore";
import { EXERCISE_CATEGORY_LABELS } from "@/lib/labels";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { IconButton } from "@/components/ui/IconButton";
import { EyeIcon, EyeOffIcon } from "@/components/ui/icons";
import { CreateExerciseModal } from "./CreateExerciseModal";

export function ExerciseCard({ exercise, isAdmin }: { exercise: ExerciseWithCount; isAdmin: boolean }) {
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      const result = await toggleExercise(exercise.id);
      if (!result.ok) return toast.error(result.error);
      toast.success(result.data.isActive ? "Exercice activé." : "Exercice désactivé.");
    });
  }

  return (
    <div className={`flex flex-col rounded-xl border border-border bg-surface p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${!exercise.isActive ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-content">{exercise.name}</h3>
        <span className="flex-shrink-0 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
          {EXERCISE_CATEGORY_LABELS[exercise.category]}
        </span>
      </div>

      {!exercise.isActive && (
        <span className="mt-1 w-fit rounded bg-surface-muted px-1.5 py-0.5 text-xs text-content-muted">Désactivé</span>
      )}

      <p className="mt-2 line-clamp-3 text-sm text-content-muted">{exercise.description}</p>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-content-subtle">
        {exercise.frequency && (
          <span className="inline-flex items-center gap-1.5">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {exercise.frequency}
          </span>
        )}
        {exercise.duration && (
          <span className="inline-flex items-center gap-1.5">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {exercise.duration}
          </span>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <span className="text-xs text-content-subtle">
          Utilisé {exercise._count.studies} fois
        </span>
        {isAdmin && (
          <div className="flex items-center gap-1">
            <CreateExerciseModal exercise={exercise} />
            <IconButton
              icon={exercise.isActive ? <EyeOffIcon /> : <EyeIcon />}
              label={exercise.isActive ? "Désactiver" : "Activer"}
              onClick={handleToggle}
              disabled={pending}
            />
            <DeleteButton
              onConfirm={() => deleteExercise(exercise.id)}
              successMessage="Exercice supprimé."
              warning={
                exercise._count.studies > 0
                  ? `Retiré de ${exercise._count.studies} étude(s).`
                  : undefined
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
