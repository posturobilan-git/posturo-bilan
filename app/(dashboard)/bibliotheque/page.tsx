import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { getCurrentKine } from "@/lib/auth";
import { getExercises } from "@/actions/exercise.actions";
import { getComponents } from "@/actions/component.actions";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchBar } from "@/components/patients/SearchBar";
import { CategoryFilter } from "@/components/bibliotheque/CategoryFilter";
import { ExerciseCard } from "@/components/bibliotheque/ExerciseCard";
import { ComponentCard } from "@/components/bibliotheque/ComponentCard";
import { CreateExerciseModal } from "@/components/bibliotheque/CreateExerciseModal";
import { CreateComponentModal } from "@/components/bibliotheque/CreateComponentModal";
import {
  EXERCISE_CATEGORY_LABELS,
  COMPONENT_CATEGORY_LABELS,
} from "@/lib/labels";
import type { ExerciseCategory, ComponentCategory } from "@prisma/client";

interface Props {
  searchParams: Promise<{ tab?: string; q?: string; category?: string }>;
}

export default async function BibliothequePage({ searchParams }: Props) {
  const kine = await getCurrentKine();
  if (!kine) redirect("/sign-in");

  const { tab, q, category } = await searchParams;
  const activeTab = tab === "composants" ? "composants" : "exercices";
  const isAdmin = kine.role === "ADMIN";

  const exercises =
    activeTab === "exercices"
      ? await getExercises({ search: q, category: category as ExerciseCategory | undefined })
      : [];
  const components =
    activeTab === "composants"
      ? await getComponents({ search: q, category: category as ComponentCategory | undefined })
      : [];

  const categoryOptions: [string, string][] =
    activeTab === "exercices"
      ? Object.entries(EXERCISE_CATEGORY_LABELS)
      : Object.entries(COMPONENT_CATEGORY_LABELS);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bibliothèque"
        description="Exercices et composants vélo"
        action={
          isAdmin
            ? activeTab === "exercices"
              ? <CreateExerciseModal />
              : <CreateComponentModal />
            : undefined
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        <TabLink label="Exercices" tab="exercices" active={activeTab === "exercices"} />
        <TabLink label="Composants" tab="composants" active={activeTab === "composants"} />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <Suspense>
            <SearchBar defaultValue={q} />
          </Suspense>
        </div>
        <Suspense>
          <CategoryFilter options={categoryOptions} defaultValue={category} />
        </Suspense>
      </div>

      {/* Grid */}
      {activeTab === "exercices" ? (
        exercises.length === 0 ? (
          <EmptyState label="exercice" />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {exercises.map((e) => (
              <ExerciseCard key={e.id} exercise={e} isAdmin={isAdmin} />
            ))}
          </div>
        )
      ) : components.length === 0 ? (
        <EmptyState label="composant" />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {components.map((c) => (
            <ComponentCard key={c.id} component={c} isAdmin={isAdmin} />
          ))}
        </div>
      )}
    </div>
  );
}

function TabLink({ label, tab, active }: { label: string; tab: string; active: boolean }) {
  return (
    <Link
      href={`/bibliotheque?tab=${tab}`}
      className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-brand-600 text-brand-700"
          : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
      }`}
    >
      {label}
    </Link>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center">
      <p className="text-sm text-gray-500">Aucun {label} ne correspond.</p>
    </div>
  );
}
