import "server-only";
import { prisma } from "@/lib/db";
import type { ComponentCategory } from "@prisma/client";

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
  byCategory: { category: ComponentCategory; count: number }[];
  topThisMonth: { name: string; brand: string | null; count: number }[];
  topExercises: TopExercise[];
}

export async function getComponentStats(): Promise<ComponentStats> {
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [topComponents, byCategory, studiesThisMonth, topExercises] = await Promise.all([
    prisma.bikeComponent.findMany({
      where: { isActive: true },
      include: { _count: { select: { studies: true } } },
      orderBy: { studies: { _count: "desc" } },
      take: 10,
    }),

    prisma.bikeComponent.groupBy({
      by: ["category"],
      _count: { id: true },
      where: { isActive: true },
    }),

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
      category: c.category,
      count: c._count.studies,
    })),
    byCategory: byCategory.map((g) => ({ category: g.category, count: g._count.id })),
    topThisMonth,
    topExercises: topExercises.map((e) => ({
      id: e.id,
      name: e.name,
      category: e.category,
      count: e._count.studies,
    })),
  };
}
