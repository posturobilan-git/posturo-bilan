"use client";

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

const COLORS = [
  "var(--color-brand-500)",
  "var(--color-accent-500)",
  "var(--color-brand-300)",
  "var(--color-warning-600)",
  "var(--color-success-600)",
  "var(--color-brand-700)",
  "var(--color-content-subtle)",
];

interface Props {
  data: { category: string; count: number }[];
}

export function CategoryPieChart({ data }: Props) {
  const chartData = data.map((d) => ({
    name: d.category,
    value: d.count,
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={90}
            innerRadius={45}
            paddingAngle={2}
          >
            {chartData.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
