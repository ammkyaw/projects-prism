// src/components/charts/bug-severity-chart.tsx
'use client';

import type { SprintData, Task, SeverityType } from '@/types/sprint-data';
import { severities } from '@/types/sprint-data'; // Import severities array
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltipContent,
  ChartLegend, // Use ChartLegend for consistent styling
  ChartLegendContent,
} from '@/components/ui/chart';
import { useMemo } from 'react';
import { Info } from 'lucide-react';

interface BugSeverityChartProps {
  sprintData: SprintData | null;
}

// Define colors for severities
const severityColors: { [key in SeverityType]: string } = {
  Critical: 'hsl(var(--destructive))', // Destructive red
  High: 'hsl(var(--chart-4))', // Orange-ish
  Medium: 'hsl(var(--chart-2))', // Gold/Yellow
  Low: 'hsl(var(--chart-5))', // Green-ish or a light blue
};

const chartConfig = severities.reduce(
  (acc, severity) => {
    acc[severity] = {
      label: severity,
      color: severityColors[severity],
    };
    return acc;
  },
  {} as ChartConfig
);

export default function BugSeverityChart({ sprintData }: BugSeverityChartProps) {
  const { pieChartData, totalBugs, totalTasks, bugPercentage } = useMemo(() => {
    if (!sprintData || !sprintData.sprints || sprintData.sprints.length === 0) {
      return { pieChartData: [], totalBugs: 0, totalTasks: 0, bugPercentage: 0 };
    }

    const severityCounts: { [key in SeverityType]?: number } = {};
    let currentTotalTasks = 0;
    let currentTotalBugs = 0;

    sprintData.sprints
      .filter((s) => s.status === 'Completed' || s.status === 'Active')
      .forEach((sprint) => {
        const tasks: Task[] = [
          ...(sprint.planning?.newTasks || []),
          ...(sprint.planning?.spilloverTasks || []),
        ];
        currentTotalTasks += tasks.length;
        tasks.forEach((task) => {
          if (task.taskType === 'Bug') {
            currentTotalBugs++;
            if (task.severity) {
              severityCounts[task.severity] =
                (severityCounts[task.severity] || 0) + 1;
            }
          }
        });
      });

    const pieData = severities
      .map((severity) => ({
        name: severity,
        value: severityCounts[severity] || 0,
        fill: severityColors[severity],
      }))
      .filter((item) => item.value > 0); // Only include severities with counts

    const calculatedBugPercentage =
      currentTotalTasks > 0 ? Math.round((currentTotalBugs / currentTotalTasks) * 100) : 0;

    return {
      pieChartData: pieData,
      totalBugs: currentTotalBugs,
      totalTasks: currentTotalTasks,
      bugPercentage: calculatedBugPercentage,
    };
  }, [sprintData]);

  if (totalTasks === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
        <Info className="mr-2 h-5 w-5" />
        <span>No tasks found in active or completed sprints.</span>
      </div>
    );
  }

  if (pieChartData.length === 0 && totalBugs === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
        <Info className="mr-2 h-5 w-5" />
        <span>
          No bugs found in active or completed sprints to display severity
          distribution.
        </span>
      </div>
    );
  }


  return (
    <ChartContainer config={chartConfig} className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip
            cursor={false}
            content={<ChartTooltipContent hideLabel nameKey="name" />}
          />
          <Pie
            data={pieChartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={100} 
            innerRadius={60} 
            labelLine={false}
            paddingAngle={1.5} // Added paddingAngle for separation
          >
            {pieChartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.fill}
                stroke={'hsl(var(--background))'} // Use background for stroke to create "gap"
                strokeWidth={2} // Define stroke width for separation
              />
            ))}
          </Pie>
          {/* Center Text for Percentage */}
          <text
            x="50%"
            y="45%" // Adjusted y position slightly higher for percentage
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-foreground text-2xl font-semibold"
          >
            {bugPercentage}%
          </text>
          <text
            x="50%"
            y="55%" // Adjusted y position slightly lower for "Bugs" label
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-muted-foreground text-xs"
          >
            Bugs
          </text>
          <ChartLegend
            content={<ChartLegendContent nameKey="name" />}
            verticalAlign="bottom"
            align="center"
            wrapperStyle={{ paddingBottom: 10 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
