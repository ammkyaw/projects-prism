"use client";

import type { DailyProgressDataPoint } from '@/types/sprint-data';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'; // Added Legend
import { ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { Info } from 'lucide-react';

interface DailyProgressChartProps {
  data: DailyProgressDataPoint[];
}

// Updated chartConfig to potentially include tasksCompleted
const chartConfig = {
  points: {
    label: "Points Completed",
    color: "hsl(var(--chart-1))",
  },
  tasksCompleted: { // Added configuration for tasks completed
    label: "Tasks Completed",
    color: "hsl(var(--chart-2))", // Use a different color
  },
} satisfies ChartConfig;

export default function DailyProgressChart({ data }: DailyProgressChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <Info className="mr-2 h-5 w-5" />
        <span>No daily progress data for this sprint.</span>
      </div>
    );
  }

  // Calculate max points for Y-axis domain for points
  const maxPoints = Math.max(...data.map(d => d.points), 0);
  const yAxisPointsMax = maxPoints > 0 ? Math.ceil(maxPoints * 1.1) : 10;

  // Calculate max tasks for Y-axis domain for tasksCompleted (if you decide to show it)
  // For now, we assume the chart primarily shows points.
  // If you want to show tasks, you might need a secondary Y-axis or a toggle.

  return (
    <ChartContainer config={chartConfig} className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            fontSize={10}
            interval="preserveStartEnd"
          />
          <YAxis
            yAxisId="points" // Assign an ID for clarity if you add another Y-axis later
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            fontSize={10}
            allowDecimals={false}
            domain={[0, yAxisPointsMax]}
          />
          {/* If displaying tasks on a secondary axis, you'd add another YAxis here with a different yAxisId */}
          <Tooltip
            content={<ChartTooltipContent />} // Allow it to show both points and tasksCompleted if present in payload
            cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
          />
          <Legend verticalAlign="top" height={36} />
          <Bar yAxisId="points" dataKey="points" fill="var(--color-points)" radius={4} name="Points Completed" />
          {/* Example for tasks completed bar, if you want to show both:
          <Bar yAxisId="tasks" dataKey="tasksCompleted" fill="var(--color-tasksCompleted)" radius={4} name="Tasks Completed" />
          This would require a second Y-axis and adjustments to the overall chart layout.
          For now, only points are rendered, but the data prop `tasksCompleted` is available in tooltip.
          */}
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}