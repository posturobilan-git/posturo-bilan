import { Suspense } from "react";
import { redirect } from "next/navigation";
import { StudyStatus } from "@prisma/client";
import { getCurrentKine } from "@/lib/auth";
import { getStudies } from "@/actions/study.actions";
import { STUDY_SORT_FIELDS } from "@/lib/sort-fields";
import { parsePageQuery, type RawListParams } from "@/lib/pagination";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { StudiesTable } from "@/components/patients/StudiesTable";
import { StatusFilter } from "@/components/patients/StatusFilter";
import { SearchBar } from "@/components/patients/SearchBar";

interface Props {
  searchParams: Promise<{ status?: string; q?: string } & RawListParams>;
}

export default async function EtudesPage({ searchParams }: Props) {
  const kine = await getCurrentKine();
  if (!kine) redirect("/sign-in");

  const { status, q, ...rest } = await searchParams;
  const page = parsePageQuery(rest, {
    sortFields: STUDY_SORT_FIELDS,
    defaultSort: "createdAt",
    defaultDir: "desc",
  });

  const { items: studies, total } = await getStudies({
    status: status as StudyStatus | undefined,
    search: q,
    page,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Études"
        description={`${total} étude${total !== 1 ? "s" : ""}`}
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <Suspense>
            <SearchBar defaultValue={q} placeholder="Rechercher une étude…" />
          </Suspense>
        </div>
        <Suspense>
          <StatusFilter defaultValue={status} />
        </Suspense>
      </div>

      <StudiesTable
        studies={studies}
        sort={page.sort}
        dir={page.dir}
        emptyMessage={
          status || q
            ? "Aucune étude ne correspond à ces critères."
            : "Aucune étude pour le moment."
        }
      />

      {total > 0 && (
        <Suspense>
          <Pagination total={total} page={page.page} perPage={page.perPage} />
        </Suspense>
      )}
    </div>
  );
}
