// src/components/charts/bug-count-chart.tsx
'use client';

import type { Sprint, Task } from '@/types/sprint-data';
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { useMemo } from 'react';
import { Info } from 'lucide-react';

interface BugCountChartProps {
  data: Sprint[]; // Expects an array of completed sprints
}

const chartConfig = {
  bugs: {
    label: 'Bugs',
    color: 'hsl(var(--destructive))', // Use destructive color for bugs
  },
} satisfies ChartConfig;

export default function BugCountChart({ data }: BugCountChartProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) {
      return [];
    }

    return data
      .filter(
        (sprint) => sprint.status === 'Completed' || sprint.status === 'Active'
      ) // Ensure only completed sprints
      .map((sprint) => {
        const tasks: Task[] = [
          ...(sprint.planning?.newTasks || []),
          ...(sprint.planning?.spilloverTasks || []),
        ];
        const bugCount = tasks.filter((task) => task.taskType === 'Bug').length;
        return {
          name: `Sprint ${sprint.sprintNumber}`,
          bugs: bugCount,
        };
      });
  }, [data]);

  if (!chartData || chartData.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
        <Info className="mr-2 h-5 w-5" />
        <span>No completed sprints to display bug counts.</span>
      </div>
    );
  }

  const maxBugs = Math.max(...chartData.map((d) => d.bugs), 0);
  const yAxisMax = maxBugs > 0 ? Math.ceil(maxBugs * 1.1) : 5; // Set a minimum axis height

  return (
    <ChartContainer config={chartConfig} className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 5, right: 10, left: -25, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="name"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            fontSize={10}
            interval={0} // Show all sprint labels if possible
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            fontSize={10}
            allowDecimals={false}
            domain={[0, yAxisMax]}
          />
          <Tooltip
            content={<ChartTooltipContent />}
            cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
          />
          <Legend verticalAlign="top" height={36} />
          <Bar dataKey="bugs" fill="var(--color-bugs)" radius={4} name="Bugs" />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
