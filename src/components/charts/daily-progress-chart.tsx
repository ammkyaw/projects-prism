'use client';

import type { DailyProgressDataPoint } from '@/types/sprint-data';
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'; // Added Legend
import {
  ChartConfig,
  ChartContainer,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Info } from 'lucide-react';

interface DailyProgressChartProps {
  data: DailyProgressDataPoint[];
}

// Updated chartConfig to potentially include tasksCompleted
const chartConfig = {
  points: {
    label: 'Points Completed',
    color: 'hsl(var(--chart-1))',
  },
  tasksCompleted: {
    // Added configuration for tasks completed
    label: 'Tasks Completed',
    color: 'hsl(var(--chart-2))', // Use a different color
  },
} satisfies ChartConfig;

export default function DailyProgressChart({ data }: DailyProgressChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
        <Info className="mr-2 h-5 w-5" />
        <span>No daily progress data for this sprint.</span>
      </div>
    );
  }

  // Calculate max value for Y-axis domain, considering both points and tasks
  // This assumes they will be on the same Y-axis or a primary Y-axis.
  // If using a secondary Y-axis for tasks, this would need to be split.
  const maxPoints = Math.max(...data.map((d) => d.points), 0);
  const maxTasks = Math.max(...data.map((d) => d.tasksCompleted || 0), 0); // Consider tasksCompleted if present

  // For now, let's assume points are primary and determine Y-axis based on points.
  // If tasks are also plotted on this axis, and scales are very different, it might not look good.
  const yAxisPrimaryMax = maxPoints > 0 ? Math.ceil(maxPoints * 1.1) : 10;

  return (
    <ChartContainer config={chartConfig} className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 5, right: 10, left: -25, bottom: 5 }}
        >
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
            yAxisId="left" // Give an ID to the primary Y-axis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            fontSize={10}
            allowDecimals={false}
            domain={[0, yAxisPrimaryMax]}
          />
          {/* If you want a secondary Y-axis for tasks, you'd define it here:
           <YAxis
            yAxisId="right"
            orientation="right"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            fontSize={10}
            allowDecimals={false}
            domain={[0, Math.ceil(maxTasks * 1.1) || 5]} // Example domain for tasks
          /> 
          */}
          <Tooltip
            content={<ChartTooltipContent />}
            cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
          />
          <Legend verticalAlign="top" height={36} />
          <Bar
            yAxisId="left"
            dataKey="points"
            fill="var(--color-points)"
            radius={4}
            name="Points Completed"
          />
          {/* Render tasks completed bar. If scales are too different, this might not look great on same axis. */}
          <Bar
            yAxisId="left"
            dataKey="tasksCompleted"
            fill="var(--color-tasksCompleted)"
            radius={4}
            name="Tasks Completed"
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
