// src/components/charts/bug-count-chart.tsx
'use client';

import type { Sprint, Task, TaskType } from '@/types/sprint-data'; // Added TaskType
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
import { Info, Bug, Wrench } from 'lucide-react'; // Added Wrench for Hotfix

interface BugCountChartProps {
  data: Sprint[]; // Expects an array of completed sprints
}

const chartConfig = {
  bugs: {
    label: 'Bugs',
    color: 'hsl(var(--destructive))', // Use destructive color for bugs
  },
  hotfixes: { // Added config for hotfixes
    label: 'Hotfixes',
    color: 'hsl(0 100% 50%)', // Bright red color
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
      ) // Include completed and active sprints
      .map((sprint) => {
        const tasks: Task[] = [
          ...(sprint.planning?.newTasks || []),
          ...(sprint.planning?.spilloverTasks || []),
        ];
        const bugCount = tasks.filter((task) => task.taskType === 'Bug').length;
        const hotfixCount = tasks.filter((task) => task.taskType === 'Hotfix').length; // Count hotfixes
        return {
          name: `Sprint ${sprint.sprintNumber}`,
          bugs: bugCount,
          hotfixes: hotfixCount, // Add hotfix count to data
        };
      });
  }, [data]);

  if (!chartData || chartData.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
        <Info className="mr-2 h-5 w-5" />
        <span>No completed or active sprints to display issue counts.</span>
      </div>
    );
  }

  // Calculate max value based on the higher count between bugs and hotfixes per sprint
  const maxCountPerSprint = chartData.map(d => Math.max(d.bugs, d.hotfixes));
  const maxCountOverall = Math.max(...maxCountPerSprint, 0);
  const yAxisMax = maxCountOverall > 0 ? Math.ceil(maxCountOverall * 1.1) : 5; // Set a minimum axis height

  return (
    <ChartContainer config={chartConfig} className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 5, right: 10, left: -25, bottom: 5 }}
          barGap={4} // Add a small gap between bars for the same sprint
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
          <Bar
            dataKey="bugs"
            fill="var(--color-bugs)"
            radius={4}
            name="Bugs"
            barSize={15} // Adjust bar size if needed
          />
          <Bar
            dataKey="hotfixes" // Add bar for hotfixes
            fill="var(--color-hotfixes)" // Use the new color
            radius={4}
            name="Hotfixes"
            barSize={15} // Adjust bar size if needed
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
