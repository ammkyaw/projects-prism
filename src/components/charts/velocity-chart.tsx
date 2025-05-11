// src/components/charts/velocity-chart.tsx
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
import { useMemo } from 'react'; // Import useMemo
import { Info } from 'lucide-react'; // Import Info icon

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
  const chartData = useMemo(() => {
    if (!data || data.length === 0) {
      return [];
    }

    // Filter for active or completed, sort descending to get latest, take max 10, then sort ascending for chart
    const relevantSprints = data
      .filter(
        (sprint) => sprint.status === 'Completed' || sprint.status === 'Active'
      )
      .sort((a, b) => b.sprintNumber - a.sprintNumber) // Sort descending by sprint number
      .slice(0, 10) // Take the last 10 relevant sprints
      .sort((a, b) => a.sprintNumber - b.sprintNumber); // Sort ascending for chart display

    return relevantSprints.map((sprint) => {
      const newTasks = sprint.planning?.newTasks || [];

      // Committed points from new tasks only
      const committedPoints = newTasks.reduce(
        (sum, task) => sum + (Number(task.storyPoints) || 0),
        0
      );

      let completedPointsValue = 0;
      // If the sprint is Active or Completed, calculate completed points from its NEW tasks
      if (sprint.status === 'Active' || sprint.status === 'Completed') {
        completedPointsValue = newTasks
          .filter((task) => task.status === 'Done')
          .reduce((sum, task) => sum + (Number(task.storyPoints) || 0), 0);
      }

      return {
        name: `Sprint ${sprint.sprintNumber}`,
        committed: committedPoints,
        completed: completedPointsValue,
      };
    });
  }, [data]);

  if (!chartData || chartData.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Info className="mr-2 h-4 w-4" /> {/* Added Info icon */}
        No velocity data available. (Ensure sprints are 'Completed' or 'Active'
        with 'New Tasks' planned)
      </div>
    );
  }
  const maxPoints = Math.max(
    ...chartData.map((d) => Math.max(d.committed, d.completed)),
    0
  );
  const yAxisMax = maxPoints > 0 ? Math.ceil(maxPoints * 1.1) : 10;

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
            domain={[0, yAxisMax]}
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
