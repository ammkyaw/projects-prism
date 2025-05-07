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
  selectedDeveloperId?: string | null; // Optional: ID of a specific developer to filter by
}

export default function DeveloperEffortChart({ sprintData, members, selectedDeveloperId }: DeveloperEffortChartProps) {
  const { chartData, chartConfig, noDataMessage } = useMemo(() => {
    if (!sprintData || !sprintData.sprints || sprintData.sprints.length === 0) {
      return { chartData: [], chartConfig: {}, noDataMessage: "No sprint data available." };
    }
    if (!members || members.length === 0) {
      return { chartData: [], chartConfig: {}, noDataMessage: "No members found in the project." };
    }

    const softwareEngineers = members.filter(m => m.role === 'Software Engineer');
    if (softwareEngineers.length === 0 && !selectedDeveloperId) { // If no SEs and not filtering for a specific (potentially non-SE) dev
        return { chartData: [], chartConfig: {}, noDataMessage: "No Software Engineers found in the project." };
    }


    // Get the last 5 completed sprints
    const completedSprints = (sprintData.sprints || [])
      .filter(s => s.status === 'Completed')
      .sort((a, b) => b.sprintNumber - a.sprintNumber) // Sort descending by sprint number
      .slice(0, 5)
      .sort((a,b) => a.sprintNumber - b.sprintNumber); // Sort back to ascending for chart display

    if (completedSprints.length === 0) {
        return { chartData: [], chartConfig: {}, noDataMessage: "No completed sprints to display." };
    }


    const dataBySprint: { [sprintName: string]: { sprint: string; [developerNameOrPoints: string]: number | string } } = {};
    const themeChartColors = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];
    let dynamicChartConfig: ChartConfig = {};

    if (selectedDeveloperId) {
        // --- Specific Developer View ---
        const developer = members.find(m => m.id === selectedDeveloperId);
        if (!developer) {
            return { chartData: [], chartConfig: {}, noDataMessage: `Developer with ID ${selectedDeveloperId} not found.` };
        }

        dynamicChartConfig["points"] = { // Use a generic "points" key for the single developer
            label: developer.name,
            color: themeChartColors[0], // Use first color for the selected developer
        };

        completedSprints.forEach(sprint => {
            const sprintName = `Sprint ${sprint.sprintNumber}`;
            dataBySprint[sprintName] = { sprint: sprintName, points: 0 };

            const tasks: Task[] = [...(sprint.planning?.newTasks || []), ...(sprint.planning?.spilloverTasks || [])];
            tasks.forEach(task => {
                if (task.status === 'Done' && task.assignee === developer.name && task.storyPoints) {
                    const points = Number(task.storyPoints);
                    if (!isNaN(points)) {
                        (dataBySprint[sprintName]["points"] as number) += points;
                    }
                }
            });
        });

    } else {
        // --- All Developers View (for the last 5 completed sprints) ---
        const developerColors: { [developerName: string]: string } = {};
        let colorIndex = 0;

        softwareEngineers.forEach(member => { // Only SEs for "All Developers" view
            developerColors[member.name] = themeChartColors[colorIndex % themeChartColors.length];
            dynamicChartConfig[member.name] = {
                label: member.name,
                color: developerColors[member.name],
            };
            colorIndex++;
        });


        completedSprints.forEach(sprint => {
            const sprintName = `Sprint ${sprint.sprintNumber}`;
            if (!dataBySprint[sprintName]) {
                dataBySprint[sprintName] = { sprint: sprintName };
                softwareEngineers.forEach(member => {
                    dataBySprint[sprintName][member.name] = 0; // Initialize points for all SEs
                });
            }

            const tasks: Task[] = [...(sprint.planning?.newTasks || []), ...(sprint.planning?.spilloverTasks || [])];
            tasks.forEach(task => {
                if (task.status === 'Done' && task.assignee && task.storyPoints) {
                    const points = Number(task.storyPoints);
                    // Ensure the assignee is a software engineer for this view and has an entry in developerColors
                    if (!isNaN(points) && softwareEngineers.some(se => se.name === task.assignee) && developerColors[task.assignee]) {
                         (dataBySprint[sprintName][task.assignee] as number) += points;
                    }
                }
            });
        });
    }

    const finalChartData = Object.values(dataBySprint);

    if (finalChartData.every(sprintEntry => selectedDeveloperId ? sprintEntry.points === 0 : softwareEngineers.every(se => (sprintEntry[se.name] as number) === 0))) {
       return { chartData: [], chartConfig: {}, noDataMessage: selectedDeveloperId ? "No completed story points by the selected developer in the last 5 completed sprints." : "No completed story points by developers in the last 5 completed sprints." };
    }

    return { chartData: finalChartData, chartConfig: dynamicChartConfig, noDataMessage: "" };
  }, [sprintData, members, selectedDeveloperId]);


  if (noDataMessage) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <Info className="mr-2 h-5 w-5" />
        <span>{noDataMessage}</span>
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
          {selectedDeveloperId ? (
            <Bar dataKey="points" fill={`var(--color-points)`} radius={4} barSize={20}/>
          ) : (
            members.filter(m=>m.role === 'Software Engineer').map(member => ( // Only render bars for SEs in "All" view
              chartConfig[member.name] ? // Ensure config exists
                <Bar key={member.id} dataKey={member.name} fill={`var(--color-${member.name})`} radius={4} barSize={15} stackId="a"/>
              : null
            ))
          )}
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

