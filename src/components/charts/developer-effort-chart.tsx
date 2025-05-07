// src/components/charts/developer-effort-chart.tsx
"use client";

import type { SprintData, Member, Sprint, Task } from '@/types/sprint-data';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { useMemo } from 'react';
import { Info } from 'lucide-react';

interface DeveloperEffortChartProps {
  sprintData: SprintData | null;
  members: Member[];
}

export default function DeveloperEffortChart({ sprintData, members }: DeveloperEffortChartProps) {
  const { chartData, chartConfig } = useMemo(() => {
    if (!sprintData || !sprintData.sprints || sprintData.sprints.length === 0 || !members || members.length === 0) {
      return { chartData: [], chartConfig: {} };
    }

    const dataBySprint: { [sprintName: string]: { sprint: string; [developerName: string]: number | string } } = {};
    const developerColors: { [developerName: string]: string } = {};
    const themeChartColors = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];
    let colorIndex = 0;

    members.forEach(member => {
      developerColors[member.name] = themeChartColors[colorIndex % themeChartColors.length];
      colorIndex++;
    });

    const dynamicChartConfig: ChartConfig = {};
    members.forEach(member => {
      dynamicChartConfig[member.name] = {
        label: member.name,
        color: developerColors[member.name],
      };
    });

    sprintData.sprints.forEach(sprint => {
      const sprintName = `Sprint ${sprint.sprintNumber}`;
      if (!dataBySprint[sprintName]) {
        dataBySprint[sprintName] = { sprint: sprintName };
        // Initialize all member points to 0 for this sprint to ensure they appear in the legend/tooltip
        members.forEach(member => {
          dataBySprint[sprintName][member.name] = 0;
        });
      }

      const tasks: Task[] = [...(sprint.planning?.newTasks || []), ...(sprint.planning?.spilloverTasks || [])];
      tasks.forEach(task => {
        if (task.status === 'Done' && task.assignee && task.storyPoints) {
          const points = Number(task.storyPoints);
          if (!isNaN(points) && developerColors[task.assignee]) { // Ensure assignee exists in our color map
            (dataBySprint[sprintName][task.assignee] as number) += points;
          }
        }
      });
    });

    return { chartData: Object.values(dataBySprint), chartConfig: dynamicChartConfig };
  }, [sprintData, members]);

  if (!sprintData || !sprintData.sprints || sprintData.sprints.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <Info className="mr-2 h-5 w-5" />
        <span>No sprint data available.</span>
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <Info className="mr-2 h-5 w-5" />
        <span>No members found in the project.</span>
      </div>
    );
  }
   if (chartData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <Info className="mr-2 h-5 w-5" />
        <span>No completed story points by developers to display.</span>
      </div>
    );
  }


  return (
    <ChartContainer config={chartConfig} className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="sprint"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            fontSize={10}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            fontSize={10}
            allowDecimals={false}
          />
          <Tooltip content={<ChartTooltipContent />} cursor={{ fill: 'hsl(var(--muted) / 0.3)' }} />
          <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '10px' }}/>
          {members.map(member => (
            <Bar key={member.id} dataKey={member.name} fill={`var(--color-${member.name})`} radius={4} barSize={15}/>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
