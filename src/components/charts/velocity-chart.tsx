'use client';

import type { Sprint } from '@/types/sprint-data';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltipContent,
} from '@/components/ui/chart';

interface VelocityChartProps {
  data: Sprint[];
}

const chartConfig = {
  committed: {
    label: 'Committed',
    color: 'hsl(var(--chart-3))', // Use muted color
  },
  completed: {
    label: 'Completed',
    color: 'hsl(var(--chart-1))', // Use primary color
  },
} satisfies ChartConfig;

export default function VelocityChart({ data }: VelocityChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        No velocity data available.
      </div>
    );
  }

  const chartData = data.map((sprint) => {
    let completedPointsValue = sprint.completedPoints || 0;

    // If the sprint is Active or Planned, recalculate completed points from its tasks
    // This makes the chart more "live" for ongoing sprints.
    if (
      (sprint.status === 'Active' || sprint.status === 'Planned') &&
      sprint.planning
    ) {
      const tasks = [
        ...(sprint.planning.newTasks || []),
        ...(sprint.planning.spilloverTasks || []),
      ];
      completedPointsValue = tasks
        .filter((task) => task.status === 'Done')
        .reduce((sum, task) => sum + (Number(task.storyPoints) || 0), 0);
    }

    return {
      name: `Sprint ${sprint.sprintNumber}`,
      committed: sprint.committedPoints || 0,
      completed: completedPointsValue,
    };
  });

  return (
    <ChartContainer config={chartConfig} className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 5, right: 5, left: -25, bottom: 5 }}
        >
          {' '}
          {/* Adjusted margins */}
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="name"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            fontSize={12}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            fontSize={12}
            allowDecimals={false}
          />{' '}
          {/* Ensure integer ticks */}
          <Tooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
          <Bar dataKey="committed" fill="var(--color-committed)" radius={4} />
          <Bar dataKey="completed" fill="var(--color-completed)" radius={4} />
          <Legend verticalAlign="top" height={36} /> {/* Show legend */}
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
