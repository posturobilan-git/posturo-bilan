import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { getCurrentKine } from "@/lib/auth";
import { getExercises } from "@/actions/exercise.actions";
import { getComponents } from "@/actions/component.actions";
import { getBikeTypes, getActiveBikeTypes } from "@/actions/bikeType.actions";
import { getMeasurements } from "@/actions/measurement.actions";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchBar } from "@/components/patients/SearchBar";
import { CategoryFilter } from "@/components/bibliotheque/CategoryFilter";
import { ExerciseCard } from "@/components/bibliotheque/ExerciseCard";
import { ComponentCard } from "@/components/bibliotheque/ComponentCard";
import { BikeTypeCard } from "@/components/bibliotheque/BikeTypeCard";
import { MeasurementCard } from "@/components/bibliotheque/MeasurementCard";
import { CreateExerciseModal } from "@/components/bibliotheque/CreateExerciseModal";
import { CreateComponentModal } from "@/components/bibliotheque/CreateComponentModal";
import { CreateBikeTypeModal } from "@/components/bibliotheque/CreateBikeTypeModal";
import { CreateMeasurementModal } from "@/components/bibliotheque/CreateMeasurementModal";
import {
  EXERCISE_CATEGORY_LABELS,
  COMPONENT_CATEGORY_LABELS,
} from "@/lib/labels";
import type { ExerciseCategory, ComponentCategory } from "@prisma/client";

type Tab = "exercices" | "composants" | "velos" | "cotes";

interface Props {
  searchParams: Promise<{ tab?: string; q?: string; category?: string }>;
}

export default async function BibliothequePage({ searchParams }: Props) {
  const kine = await getCurrentKine();
  if (!kine) redirect("/sign-in");

  const { tab, q, category } = await searchParams;
  const activeTab: Tab =
    tab === "composants"
      ? "composants"
      : tab === "velos"
      ? "velos"
      : tab === "cotes"
      ? "cotes"
      : "exercices";
  const isAdmin = kine.role === "ADMIN";

  const exercises =
    activeTab === "exercices"
      ? await getExercises({ search: q, category: category as ExerciseCategory | undefined })
      : [];
  const components =
    activeTab === "composants"
      ? await getComponents({ search: q, category: category as ComponentCategory | undefined })
      : [];
  const bikeTypes = activeTab === "velos" ? await getBikeTypes({ search: q }) : [];
  const measurements = activeTab === "cotes" ? await getMeasurements({ search: q }) : [];
  // The côte editor needs the list of active bike types to associate.
  const activeBikeTypes = activeTab === "cotes" ? await getActiveBikeTypes() : [];
  const bikeTypeOptions = activeBikeTypes.map((b) => ({ id: b.id, name: b.name }));

  const categoryOptions: [string, string][] =
    activeTab === "exercices"
      ? Object.entries(EXERCISE_CATEGORY_LABELS)
      : activeTab === "composants"
      ? Object.entries(COMPONENT_CATEGORY_LABELS)
      : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bibliothèque"
        description="Exercices, composants et types de vélo"
        action={
          isAdmin
            ? activeTab === "exercices"
              ? <CreateExerciseModal />
              : activeTab === "composants"
              ? <CreateComponentModal />
              : activeTab === "velos"
              ? <CreateBikeTypeModal />
              : <CreateMeasurementModal bikeTypes={bikeTypeOptions} />
            : undefined
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        <TabLink label="Exercices" tab="exercices" active={activeTab === "exercices"} />
        <TabLink label="Composants" tab="composants" active={activeTab === "composants"} />
        <TabLink label="Types de vélo" tab="velos" active={activeTab === "velos"} />
        <TabLink label="Côtes" tab="cotes" active={activeTab === "cotes"} />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <Suspense>
            <SearchBar defaultValue={q} />
          </Suspense>
        </div>
        {(activeTab === "exercices" || activeTab === "composants") && (
          <Suspense>
            <CategoryFilter options={categoryOptions} defaultValue={category} />
          </Suspense>
        )}
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
      ) : activeTab === "composants" ? (
        components.length === 0 ? (
          <EmptyState label="composant" />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {components.map((c) => (
              <ComponentCard key={c.id} component={c} isAdmin={isAdmin} />
            ))}
          </div>
        )
      ) : activeTab === "velos" ? (
        bikeTypes.length === 0 ? (
          <EmptyState label="type de vélo" />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {bikeTypes.map((bt) => (
              <BikeTypeCard key={bt.id} bikeType={bt} isAdmin={isAdmin} />
            ))}
          </div>
        )
      ) : measurements.length === 0 ? (
        <EmptyState label="côte" />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {measurements.map((m) => (
            <MeasurementCard key={m.id} measurement={m} bikeTypes={bikeTypeOptions} isAdmin={isAdmin} />
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
