"use client";

import type { Sprint } from '@/types/sprint-data';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart"


interface VelocityChartProps {
  data: Sprint[];
}

const chartConfig = {
  committed: {
    label: "Committed",
    color: "hsl(var(--secondary))", // Use secondary color (light gray)
  },
  completed: {
    label: "Completed",
    color: "hsl(var(--primary))", // Use primary color (blue)
  },
} satisfies ChartConfig

export default function VelocityChart({ data }: VelocityChartProps) {
  if (!data || data.length === 0) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">No velocity data available.</div>;
  }

   const chartData = data.map(sprint => ({
    name: `Sprint ${sprint.sprintNumber}`,
    committed: sprint.committedPoints,
    completed: sprint.completedPoints,
  }));


  return (
     <ChartContainer config={chartConfig} className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
         <BarChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}> {/* Adjusted margins */}
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
             dataKey="name"
             tickLine={false}
             axisLine={false}
             tickMargin={8}
             fontSize={12}
           />
          <YAxis tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
           <Tooltip
             cursor={false}
             content={<ChartTooltipContent hideLabel />}
            />
          <Bar dataKey="committed" fill="var(--color-committed)" radius={4} />
          <Bar dataKey="completed" fill="var(--color-completed)" radius={4} />
          {/* <Legend /> */} {/* Optional: Add legend if needed */}
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
