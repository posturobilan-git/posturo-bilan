import "server-only";
import { prisma } from "@/lib/db";

export interface TopItem {
  id: string;
  name: string;
  brand: string | null;
  category: string;
  count: number;
}

export interface TopExercise {
  id: string;
  name: string;
  category: string;
  count: number;
}

export interface ComponentStats {
  topComponents: TopItem[];
  byCategory: { category: string; count: number }[];
  topThisMonth: { name: string; brand: string | null; count: number }[];
  topExercises: TopExercise[];
}

export async function getComponentStats(): Promise<ComponentStats> {
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [topComponents, byCategoryRaw, categories, studiesThisMonth, topExercises] = await Promise.all([
    prisma.bikeComponent.findMany({
      where: { isActive: true },
      include: { _count: { select: { studies: true } }, category: { select: { name: true } } },
      orderBy: { studies: { _count: "desc" } },
      take: 10,
    }),

    prisma.bikeComponent.groupBy({
      by: ["categoryId"],
      _count: { id: true },
      where: { isActive: true },
    }),

    // groupBy can't join — resolve category names separately.
    prisma.componentCategory.findMany({ select: { id: true, name: true } }),

    // Studies created this month + their components → aggregate in JS,
    // avoiding fragile raw queries against the implicit join table.
    prisma.study.findMany({
      where: { createdAt: { gte: startOfMonth } },
      select: { componentsUsed: { select: { id: true, name: true, brand: true } } },
    }),

    prisma.exercise.findMany({
      where: { isActive: true },
      include: { _count: { select: { studies: true } } },
      orderBy: { studies: { _count: "desc" } },
      take: 8,
    }),
  ]);

  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));

  // Aggregate "top this month".
  const monthly = new Map<string, { name: string; brand: string | null; count: number }>();
  for (const study of studiesThisMonth) {
    for (const c of study.componentsUsed) {
      const entry = monthly.get(c.id) ?? { name: c.name, brand: c.brand, count: 0 };
      entry.count += 1;
      monthly.set(c.id, entry);
    }
  }
  const topThisMonth = [...monthly.values()].sort((a, b) => b.count - a.count).slice(0, 5);

  return {
    topComponents: topComponents.map((c) => ({
      id: c.id,
      name: c.name,
      brand: c.brand,
      category: c.category.name,
      count: c._count.studies,
    })),
    byCategory: byCategoryRaw.map((g) => ({
      category: categoryNameById.get(g.categoryId) ?? "?",
      count: g._count.id,
    })),
    topThisMonth,
    topExercises: topExercises.map((e) => ({
      id: e.id,
      name: e.name,
      category: e.category,
      count: e._count.studies,
    })),
  };
}
