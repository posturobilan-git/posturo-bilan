// Shared pagination + sorting helpers used by list pages and their server actions.

export const PER_PAGE_OPTIONS = [10, 25, 50] as const;
export const DEFAULT_PER_PAGE = 10;

export type SortDir = "asc" | "desc";

export interface PageQuery {
  page: number; // 1-based
  perPage: number;
  sort: string;
  dir: SortDir;
}

export interface ListResult<T> {
  items: T[];
  total: number;
}

/** Raw search params a list page receives (all strings/undefined). */
export interface RawListParams {
  page?: string;
  perPage?: string;
  sort?: string;
  dir?: string;
}

/**
 * Normalises raw URL search params into a safe PageQuery: clamps the page,
 * restricts perPage to the allowed set, and only accepts a sort field from the
 * provided whitelist (falling back to the default otherwise).
 */
export function parsePageQuery(
  raw: RawListParams,
  opts: { sortFields: readonly string[]; defaultSort: string; defaultDir?: SortDir }
): PageQuery {
  const perPageNum = Number(raw.perPage);
  const perPage = (PER_PAGE_OPTIONS as readonly number[]).includes(perPageNum)
    ? perPageNum
    : DEFAULT_PER_PAGE;

  const pageNum = Number(raw.page);
  const page = Number.isFinite(pageNum) && pageNum >= 1 ? Math.floor(pageNum) : 1;

  const sort = opts.sortFields.includes(raw.sort ?? "") ? (raw.sort as string) : opts.defaultSort;
  const dir: SortDir = raw.dir === "asc" || raw.dir === "desc" ? raw.dir : opts.defaultDir ?? "desc";

  return { page, perPage, sort, dir };
}

/** Translates a PageQuery into Prisma `skip`/`take`. */
export function toSkipTake(q: PageQuery): { skip: number; take: number } {
  return { skip: (q.page - 1) * q.perPage, take: q.perPage };
}
