// src/components/charts/developer-effort-chart.tsx
"use client";

import type { SprintData, Member, Sprint, Task, TaskType } from '@/types/sprint-data';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { useMemo } from 'react';
import { Info, User } from 'lucide-react';

interface DeveloperEffortChartProps {
    sprintData: SprintData | null;
    members: Member[];
    selectedDeveloperId?: string | null;
    selectedSprintNumber?: number | null;
}

// Base chart colors to cycle through for tasks
const baseChartColors = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
];

// Function to generate a consistent color based on a string (e.g., ticket number)
// This is a simple hash function, might need refinement for better color distribution
const getColorForString = (str: string, colorPalette: string[]): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colorPalette.length;
    return colorPalette[index];
};

// Define all possible task types for consistent handling
const allTaskTypes: TaskType[] = [
    'New Feature', 'Improvement', 'Bug', 'Refactoring', 'Documentation', 'Security', 'Infra', 'CI/CD', 'Compliance'
];


export default function DeveloperEffortChart({ sprintData, members, selectedDeveloperId, selectedSprintNumber }: DeveloperEffortChartProps) {
    const { chartData, chartConfig, noDataMessage, xAxisDataKey } = useMemo(() => {
        if (!sprintData || !sprintData.sprints || sprintData.sprints.length === 0) {
            return { chartData: [], chartConfig: {}, noDataMessage: "No sprint data available.", xAxisDataKey: "name" };
        }
        if (!members || members.length === 0) {
            return { chartData: [], chartConfig: {}, noDataMessage: "No members found in the project.", xAxisDataKey: "name" };
        }

        const softwareEngineers = members.filter(m => m.role === 'Software Engineer');

        // --- Specific Developer View (Last 10 Completed Sprints) ---
        if (selectedDeveloperId && selectedDeveloperId !== "all") {
            const developer = members.find(m => m.id === selectedDeveloperId);
            if (!developer) {
                return { chartData: [], chartConfig: {}, noDataMessage: `Developer with ID ${selectedDeveloperId} not found.`, xAxisDataKey: "sprintName" };
            }

            const completedSprints = sprintData.sprints
                .filter(s => s.status === 'Completed')
                .sort((a, b) => b.sprintNumber - a.sprintNumber)
                .slice(0, 10) // Last 10 completed
                .sort((a, b) => a.sprintNumber - b.sprintNumber); // Sort ascending for chart

            const specificDevChartData = completedSprints.map(sprint => {
                const tasks: Task[] = [...(sprint.planning?.newTasks || []), ...(sprint.planning?.spilloverTasks || [])];
                // Correctly sum points from ALL completed tasks for this dev in this sprint
                const points = tasks.reduce((sum, task) => {
                    if (task.status === 'Done' && task.assignee === developer.name && task.storyPoints != null) { // Check if storyPoints is not null/undefined
                        const taskPoints = Number(task.storyPoints);
                        if (!isNaN(taskPoints)) {
                            return sum + taskPoints;
                        }
                    }
                    return sum;
                }, 0);
                return { sprintName: `Sprint ${sprint.sprintNumber}`, points: points };
            });

            if (specificDevChartData.length === 0) {
                 return { chartData: [], chartConfig: {}, noDataMessage: `No completed sprints found for this developer.`, xAxisDataKey: "sprintName" };
            }
             if (specificDevChartData.every(d => d.points === 0)) {
                 return { chartData: [], chartConfig: {}, noDataMessage: `No completed story points by ${developer.name} in the last 10 completed sprints.`, xAxisDataKey: "sprintName" };
             }


            const dynamicChartConfig: ChartConfig = {
                points: {
                    label: developer.name, // Use developer name as label
                    color: baseChartColors[0], // Use the first base color
                },
            };
            return { chartData: specificDevChartData, chartConfig: dynamicChartConfig, noDataMessage: null, xAxisDataKey: "sprintName" };
        }
        // --- All Developers View (Selected Sprint) ---
        else if (selectedSprintNumber && (selectedDeveloperId === null || selectedDeveloperId === "all")) { // Adjusted condition
             const selectedSprint = sprintData.sprints.find(s => s.sprintNumber === selectedSprintNumber);
             if (!selectedSprint) {
                 return { chartData: [], chartConfig: {}, noDataMessage: `Sprint ${selectedSprintNumber} not found.`, xAxisDataKey: "developerName" };
             }
              if (softwareEngineers.length === 0) {
                 return { chartData: [], chartConfig: {}, noDataMessage: "No Software Engineers found in the project for this sprint.", xAxisDataKey: "developerName" };
             }

             const tasksInSelectedSprint: Task[] = [...(selectedSprint.planning?.newTasks || []), ...(selectedSprint.planning?.spilloverTasks || [])];
             const completedTasks = tasksInSelectedSprint.filter(task =>
                 task.status === 'Done' &&
                 task.assignee &&
                 task.storyPoints != null && // Ensure story points exist
                 !isNaN(Number(task.storyPoints)) &&
                 members.some(m => m.name === task.assignee && m.role === 'Software Engineer') // Ensure assignee is an SE
             );

             if (completedTasks.length === 0) {
                  return { chartData: [], chartConfig: {}, noDataMessage: `No completed story points by developers in Sprint ${selectedSprintNumber}.`, xAxisDataKey: "developerName" };
             }

             const dataByDeveloper: { [devName: string]: { developerName: string } & { [ticketKey: string]: number } } = {};
             const allDevsChartConfig: ChartConfig = {};
             const uniqueTicketNumbers = new Set<string>();

             // Initialize data structure for each SE
             softwareEngineers.forEach(dev => {
                 dataByDeveloper[dev.name] = { developerName: dev.name };
             });

             // Populate data and config
             completedTasks.forEach(task => {
                 const assigneeName = task.assignee!;
                 const points = Number(task.storyPoints);
                 const ticketKey = task.ticketNumber || `task-${task.id}`; // Use ticket number or task ID as key

                 if (dataByDeveloper[assigneeName]) {
                      // Accumulate points per task for the developer
                     dataByDeveloper[assigneeName][ticketKey] = (dataByDeveloper[assigneeName][ticketKey] || 0) + points;

                      // Add task to config if not already present
                     if (!allDevsChartConfig[ticketKey]) {
                         uniqueTicketNumbers.add(ticketKey); // Keep track for legend ordering potentially
                         allDevsChartConfig[ticketKey] = {
                             label: ticketKey, // Legend label is the ticket number
                             color: getColorForString(ticketKey, baseChartColors), // Assign color based on ticket key
                         };
                     }
                 }
             });

             const allDevsChartData = Object.values(dataByDeveloper);


             // Check if all aggregated points are zero after processing
             if (allDevsChartData.every(devData => Object.keys(devData).filter(k => k !== 'developerName').every(ticketKey => (devData[ticketKey] || 0) === 0))) {
                  return { chartData: [], chartConfig: {}, noDataMessage: `No completed story points by developers in Sprint ${selectedSprintNumber}.`, xAxisDataKey: "developerName" };
             }


             return { chartData: allDevsChartData, chartConfig: allDevsChartConfig, noDataMessage: null, xAxisDataKey: "developerName" };
         }
         // --- Default Case (e.g., no sprint selected for "All Developers") ---
         else {
             // Default to showing active sprint data if "All Developers" is selected but no specific sprint number is passed/valid
             const activeSprint = sprintData.sprints.find(s => s.status === "Active");
             if (activeSprint && (selectedDeveloperId === null || selectedDeveloperId === "all")) {
                if (softwareEngineers.length === 0) {
                   return { chartData: [], chartConfig: {}, noDataMessage: "No Software Engineers found.", xAxisDataKey: "developerName" };
                }
                const tasksInActiveSprint: Task[] = [...(activeSprint.planning?.newTasks || []), ...(activeSprint.planning?.spilloverTasks || [])];
                 const completedTasks = tasksInActiveSprint.filter(task =>
                    task.status === 'Done' &&
                    task.assignee &&
                    task.storyPoints != null &&
                    !isNaN(Number(task.storyPoints)) &&
                    members.some(m => m.name === task.assignee && m.role === 'Software Engineer')
                 );
                 if (completedTasks.length === 0) {
                    return { chartData: [], chartConfig: {}, noDataMessage: `No completed story points by developers in the active sprint (Sprint ${activeSprint.sprintNumber}).`, xAxisDataKey: "developerName" };
                 }
                 const dataByDeveloper: { [devName: string]: { developerName: string } & { [ticketKey: string]: number } } = {};
                 const activeSprintChartConfig: ChartConfig = {};
                 softwareEngineers.forEach(dev => { dataByDeveloper[dev.name] = { developerName: dev.name }; });
                 completedTasks.forEach(task => {
                     const assigneeName = task.assignee!;
                     const points = Number(task.storyPoints);
                     const ticketKey = task.ticketNumber || `task-${task.id}`;
                     if (dataByDeveloper[assigneeName]) {
                         dataByDeveloper[assigneeName][ticketKey] = (dataByDeveloper[assigneeName][ticketKey] || 0) + points;
                         if (!activeSprintChartConfig[ticketKey]) {
                             activeSprintChartConfig[ticketKey] = { label: ticketKey, color: getColorForString(ticketKey, baseChartColors) };
                         }
                     }
                 });
                 const allDevsChartData = Object.values(dataByDeveloper);
                  if (allDevsChartData.every(devData => Object.keys(devData).filter(k => k !== 'developerName').every(ticketKey => (devData[ticketKey] || 0) === 0))) {
                     return { chartData: [], chartConfig: {}, noDataMessage: `No completed story points by developers in the active sprint (Sprint ${activeSprint.sprintNumber}).`, xAxisDataKey: "developerName" };
                 }

                 return { chartData: allDevsChartData, chartConfig: activeSprintChartConfig, noDataMessage: null, xAxisDataKey: "developerName" };
             } else {
                return { chartData: [], chartConfig: {}, noDataMessage: "Select a developer or ensure an active sprint exists to view contributions.", xAxisDataKey: "name"};
             }
         }
    }, [sprintData, members, selectedDeveloperId, selectedSprintNumber]);


    if (noDataMessage) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center p-4">
                <Info className="mb-2 h-5 w-5" />
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
                        dataKey={xAxisDataKey}
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        fontSize={10}
                        interval={0} // Show all ticks for sprint names or developer names
                    />
                    <YAxis
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        fontSize={10}
                        allowDecimals={false}
                    />
                    <Tooltip content={<ChartTooltipContent />} cursor={{ fill: 'hsl(var(--muted) / 0.3)' }} />
                    {/* Conditionally render legend only for "All Developers" view */}
                    {(selectedDeveloperId === "all" || !selectedDeveloperId) && (
                        <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '10px' }}/>
                    )}
                    {selectedDeveloperId && selectedDeveloperId !== "all" ? (
                        // Specific developer view: one bar for 'points'
                         <Bar dataKey="points" fill={chartConfig.points?.color || baseChartColors[0]} radius={4} barSize={20} name={chartConfig.points?.label?.toString()} /> // Use label for name
                    ) : (
                        // All developers view: stacked bars by task ticket number
                        Object.keys(chartConfig).map(ticketKey => (
                            chartConfig[ticketKey] ? // Ensure config exists for this task key
                                <Bar
                                    key={ticketKey}
                                    dataKey={ticketKey}
                                    fill={chartConfig[ticketKey]?.color || "hsl(var(--muted))"}
                                    radius={4}
                                    barSize={15}
                                    stackId="a" // All bars for a developer stack together
                                    name={chartConfig[ticketKey]?.label?.toString()} // For tooltip/legend if shown
                                />
                                : null
                        ))
                    )}
                </BarChart>
            </ResponsiveContainer>
        </ChartContainer>
    );
}
