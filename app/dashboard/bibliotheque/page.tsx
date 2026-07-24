import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { getCurrentKine } from "@/lib/auth";
import { getExercises } from "@/actions/exercise.actions";
import { getComponents, getComponentAttributeFilterOptions } from "@/actions/component.actions";
import { getAttributesByCategory, getComponentAttributes } from "@/actions/componentAttribute.actions";
import { getCategories, getActiveCategories } from "@/actions/componentCategory.actions";
import { getActiveBikeTypes } from "@/actions/bikeType.actions";
import { EXERCISE_SORT_FIELDS, COMPONENT_SORT_FIELDS } from "@/lib/sort-fields";
import { parsePageQuery, type RawListParams } from "@/lib/pagination";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { SortControl } from "@/components/ui/SortControl";
import { SearchBar } from "@/components/patients/SearchBar";
import { CategoryFilter } from "@/components/bibliotheque/CategoryFilter";
import { ComponentCategoryPicker } from "@/components/bibliotheque/ComponentCategoryPicker";
import { CategoryManagerModal, type CategoryRow } from "@/components/bibliotheque/CategoryManagerModal";
import { ComponentAttributeFilters } from "@/components/bibliotheque/ComponentAttributeFilters";
import { ExerciseCard } from "@/components/bibliotheque/ExerciseCard";
import { ComponentCard } from "@/components/bibliotheque/ComponentCard";
import { CreateExerciseModal } from "@/components/bibliotheque/CreateExerciseModal";
import { CreateComponentModal } from "@/components/bibliotheque/CreateComponentModal";
import { AttributeManagerModal, type AttributeRow } from "@/components/bibliotheque/AttributeManagerModal";
import { ImportExportComponentsModal } from "@/components/bibliotheque/ImportExportComponentsModal";
import { EXERCISE_CATEGORY_LABELS } from "@/lib/labels";
import type { ExerciseCategory } from "@prisma/client";

type Tab = "exercices" | "composants";

const ATTR_PARAM_PREFIX = "attr_";

interface Props {
  searchParams: Promise<{ tab?: string; q?: string; category?: string } & RawListParams>;
}

export default async function BibliothequePage({ searchParams }: Props) {
  const kine = await getCurrentKine();
  if (!kine) redirect("/sign-in");

  const rawParams = (await searchParams) as Record<string, string | undefined>;
  const { tab, q, category, ...rest } = rawParams;
  const activeTab: Tab = tab === "composants" ? "composants" : "exercices";
  const isAdmin = kine.role === "ADMIN";

  // Filtres par attribut : une entrée `attr_<attributeId>=<valeur>` par attribut
  // filtré — clés dynamiques, donc lues à part du reste (page/perPage/sort/dir).
  const rawAttributeFilters = Object.entries(rawParams)
    .filter(([key, value]) => key.startsWith(ATTR_PARAM_PREFIX) && value)
    .map(([key, value]) => ({ attributeId: key.slice(ATTR_PARAM_PREFIX.length), value: value! }));
  const attributeFilterValues = Object.fromEntries(rawAttributeFilters.map((f) => [f.attributeId, f.value]));

  // Le filtrage/la config par attribut, comme l'import/export, ne s'appliquent
  // qu'à une seule catégorie à la fois — pas de sens pour « Toutes catégories ».
  // `category` est désormais l'id d'une ComponentCategory (plus un tag d'enum).
  const selectedCategoryId = activeTab === "composants" && category ? category : null;

  // The component editor needs the list of active bike types to associate,
  // the active categories (picker + create-component form), and every
  // category's active attributes for its dynamic fields.
  const activeBikeTypes = activeTab === "composants" ? await getActiveBikeTypes() : [];
  const bikeTypeOptions = activeBikeTypes.map((b) => ({ id: b.id, name: b.name }));
  const activeCategories = activeTab === "composants" ? await getActiveCategories() : [];
  const categoryOptions = activeCategories.map((c) => ({ id: c.id, name: c.name }));
  const attributesByCategory = activeTab === "composants" ? await getAttributesByCategory() : {};

  // Un attr_<id> laissé dans l'URL après un changement de catégorie (ou en mode
  // "Toutes catégories") ne doit jamais s'appliquer — sinon il s'intersecte
  // silencieusement avec la nouvelle catégorie et vide la liste sans qu'aucun
  // filtre visible n'explique pourquoi.
  const categoryAttributeIds = new Set(
    (selectedCategoryId ? attributesByCategory[selectedCategoryId] : []).map((a) => a.id)
  );
  const attributeFilters = rawAttributeFilters.filter((f) => categoryAttributeIds.has(f.attributeId));

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
      ? await getComponents({
          search: q,
          categoryId: selectedCategoryId ?? undefined,
          attributeFilters,
          page,
        })
      : null;

  const attributeFilterOptions = selectedCategoryId
    ? await getComponentAttributeFilterOptions(selectedCategoryId)
    : [];
  const selectedCategoryLabel = categoryOptions.find((c) => c.id === selectedCategoryId)?.name ?? null;

  // Le manager d'attributs doit voir actifs ET inactifs (pour pouvoir réactiver) —
  // getComponentAttributes() renvoie les deux pour un ADMIN, contrairement à
  // getAttributesByCategory() (actifs uniquement, utilisé par le formulaire de
  // composant et les filtres).
  const categoryAttributes =
    selectedCategoryId && isAdmin ? await getComponentAttributes(selectedCategoryId) : [];
  const categoryAttributeRows: AttributeRow[] = categoryAttributes.map((a) => ({
    id: a.id,
    name: a.name,
    key: a.key,
    type: a.type,
    unit: a.unit,
    options: a.options,
    isRequired: a.isRequired,
    isActive: a.isActive,
    valueCount: a._count.values,
  }));

  // Toutes les catégories (actives + inactives) pour le gestionnaire admin.
  const allCategories = activeTab === "composants" && isAdmin ? await getCategories() : [];
  const categoryRows: CategoryRow[] = allCategories.map((c) => ({
    id: c.id,
    name: c.name,
    isActive: c.isActive,
    componentCount: c._count.components,
    attributeCount: c._count.attributes,
  }));

  const exerciseCategoryOptions: [string, string][] = Object.entries(EXERCISE_CATEGORY_LABELS);

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
              : (
                <div className="flex flex-wrap gap-2">
                  <CreateComponentModal
                    bikeTypes={bikeTypeOptions}
                    categories={categoryOptions}
                    attributesByCategory={attributesByCategory}
                  />
                  <AttributeManagerModal
                    categoryId={selectedCategoryId}
                    categoryLabel={selectedCategoryLabel}
                    attributes={categoryAttributeRows}
                  />
                </div>
              )
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
        {activeTab === "exercices" ? (
          <Suspense>
            <CategoryFilter options={exerciseCategoryOptions} defaultValue={category} />
          </Suspense>
        ) : null}
        <Suspense>
          <SortControl options={sortOptions} activeSort={page.sort} activeDir={page.dir} />
        </Suspense>
      </div>

      {/* Composants : rangée de catégories (sélecteur primaire, pas un simple
          filtre) + gestion admin, puis filtres par attribut + import/export. */}
      {activeTab === "composants" && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Suspense>
              <ComponentCategoryPicker categories={categoryOptions} selectedId={selectedCategoryId} />
            </Suspense>
            {isAdmin && <CategoryManagerModal categories={categoryRows} />}
          </div>

          {/* Les boutons Import/Export restent visibles (désactivés, avec
              info-bulle) même sans catégorie sélectionnée — sinon rien ne
              signale que ces outils existent avant d'en choisir une. */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-3">
              <Suspense>
                <ComponentAttributeFilters options={attributeFilterOptions} values={attributeFilterValues} />
              </Suspense>
            </div>
            {isAdmin && (
              <ImportExportComponentsModal
                categoryId={selectedCategoryId}
                categoryLabel={selectedCategoryLabel}
              />
            )}
          </div>
        </>
      )}

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
              <ComponentCard
                key={c.id}
                component={c}
                bikeTypes={bikeTypeOptions}
                categories={categoryOptions}
                attributesByCategory={attributesByCategory}
                isAdmin={isAdmin}
              />
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
      href={`/dashboard/bibliotheque?tab=${tab}`}
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
