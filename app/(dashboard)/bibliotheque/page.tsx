import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { getCurrentKine } from "@/lib/auth";
import { getExercises } from "@/actions/exercise.actions";
import { getComponents } from "@/actions/component.actions";
import { getActiveBikeTypes } from "@/actions/bikeType.actions";
import { EXERCISE_SORT_FIELDS, COMPONENT_SORT_FIELDS } from "@/lib/sort-fields";
import { parsePageQuery, type RawListParams } from "@/lib/pagination";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { SortControl } from "@/components/ui/SortControl";
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

type Tab = "exercices" | "composants";

interface Props {
  searchParams: Promise<{ tab?: string; q?: string; category?: string } & RawListParams>;
}

export default async function BibliothequePage({ searchParams }: Props) {
  const kine = await getCurrentKine();
  if (!kine) redirect("/sign-in");

  const { tab, q, category, ...rest } = await searchParams;
  const activeTab: Tab = tab === "composants" ? "composants" : "exercices";
  const isAdmin = kine.role === "ADMIN";

  const page =
    activeTab === "exercices"
      ? parsePageQuery(rest, { sortFields: EXERCISE_SORT_FIELDS, defaultSort: "name", defaultDir: "asc" })
      : parsePageQuery(rest, { sortFields: COMPONENT_SORT_FIELDS, defaultSort: "name", defaultDir: "asc" });

  const exercises =
    activeTab === "exercices"
      ? await getExercises({ search: q, category: category as ExerciseCategory | undefined, page })
      : null;
  const components =
    activeTab === "composants"
      ? await getComponents({ search: q, category: category as ComponentCategory | undefined, page })
      : null;

  // The component editor needs the list of active bike types to associate.
  const activeBikeTypes = activeTab === "composants" ? await getActiveBikeTypes() : [];
  const bikeTypeOptions = activeBikeTypes.map((b) => ({ id: b.id, name: b.name }));

  const categoryOptions: [string, string][] =
    activeTab === "exercices"
      ? Object.entries(EXERCISE_CATEGORY_LABELS)
      : Object.entries(COMPONENT_CATEGORY_LABELS);

  const sortOptions =
    activeTab === "exercices"
      ? [
          { field: "name", label: "Nom" },
          { field: "createdAt", label: "Date de création" },
        ]
      : [
          { field: "name", label: "Nom" },
          { field: "category", label: "Catégorie" },
          { field: "createdAt", label: "Date de création" },
        ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bibliothèque"
        description="Exercices et composants prescrits pendant les études"
        action={
          isAdmin
            ? activeTab === "exercices"
              ? <CreateExerciseModal />
              : <CreateComponentModal bikeTypes={bikeTypeOptions} />
            : undefined
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        <TabLink label="Exercices" tab="exercices" active={activeTab === "exercices"} />
        <TabLink label="Composants" tab="composants" active={activeTab === "composants"} />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <Suspense>
            <SearchBar
              defaultValue={q}
              placeholder={activeTab === "exercices" ? "Rechercher un exercice…" : "Rechercher un composant…"}
            />
          </Suspense>
        </div>
        <Suspense>
          <CategoryFilter options={categoryOptions} defaultValue={category} />
        </Suspense>
        <Suspense>
          <SortControl options={sortOptions} activeSort={page.sort} activeDir={page.dir} />
        </Suspense>
      </div>

      {/* Content */}
      {activeTab === "exercices" ? (
        exercises!.items.length === 0 ? (
          <EmptyState label="exercice" />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {exercises!.items.map((e) => (
                <ExerciseCard key={e.id} exercise={e} isAdmin={isAdmin} />
              ))}
            </div>
            <Suspense>
              <Pagination total={exercises!.total} page={page.page} perPage={page.perPage} />
            </Suspense>
          </>
        )
      ) : components!.items.length === 0 ? (
        <EmptyState label="composant" />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {components!.items.map((c) => (
              <ComponentCard key={c.id} component={c} bikeTypes={bikeTypeOptions} isAdmin={isAdmin} />
            ))}
          </div>
          <Suspense>
            <Pagination total={components!.total} page={page.page} perPage={page.perPage} />
          </Suspense>
        </>
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
          : "border-transparent text-content-muted hover:border-border-strong hover:text-content"
      }`}
    >
      {label}
    </Link>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border-strong py-12 text-center">
      <p className="text-sm text-content-muted">Aucun {label} ne correspond.</p>
    </div>
  );
}
