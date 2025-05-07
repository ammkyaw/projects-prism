// src/components/charts/developer-effort-chart.tsx
"use client";

import type { SprintData, Member, Sprint, Task, TaskType } from '@/types/sprint-data';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { useMemo } from 'react';
import { Info, User } from 'lucide-react'; 
import { taskTypes as allTaskTypes } from '@/types/sprint-data'; 

interface DeveloperEffortChartProps {
    sprintData: SprintData | null;
    members: Member[];
    selectedDeveloperId?: string | null; 
    selectedSprintNumber?: number | null;
}

const taskTypeColors: { [key in TaskType]?: string } = {
    'New Feature': "hsl(var(--chart-1))",
    'Improvement': "hsl(var(--chart-2))",
    'Bug': "hsl(var(--chart-3))",
    'Refactoring': "hsl(var(--chart-4))",
    'Documentation': "hsl(var(--chart-5))",
    'Security': "hsl(var(--destructive))",
    'Infra': "hsl(var(--muted))",
    'CI/CD': "hsl(var(--primary))",
    'Compliance': "hsl(var(--secondary))",
};


export default function DeveloperEffortChart({ sprintData, members, selectedDeveloperId, selectedSprintNumber }: DeveloperEffortChartProps) {
    const { chartData, chartConfig, noDataMessage, xAxisDataKey } = useMemo(() => {
        if (!sprintData || !sprintData.sprints || sprintData.sprints.length === 0) {
            return { chartData: [], chartConfig: {}, noDataMessage: "No sprint data available.", xAxisDataKey: "name" };
        }
        if (!members || members.length === 0) {
            return { chartData: [], chartConfig: {}, noDataMessage: "No members found in the project.", xAxisDataKey: "name" };
        }

        const softwareEngineers = members.filter(m => m.role === 'Software Engineer');
        let filteredSprints = [...sprintData.sprints]; // Start with all sprints

        if (selectedDeveloperId && selectedDeveloperId !== "all") {
            const developer = members.find(m => m.id === selectedDeveloperId);
            if (!developer) {
                return { chartData: [], chartConfig: {}, noDataMessage: `Developer with ID ${selectedDeveloperId} not found.`, xAxisDataKey: "sprintName" };
            }

            filteredSprints = sprintData.sprints
                .filter(s => s.status === 'Completed')
                .sort((a, b) => b.sprintNumber - a.sprintNumber)
                .slice(0, 10) // Changed from 5 to 10
                .sort((a, b) => a.sprintNumber - b.sprintNumber);
            const specificDevChartData = filteredSprints.map(sprint => {
                const tasks: Task[] = [...(sprint.planning?.newTasks || []), ...(sprint.planning?.spilloverTasks || [])];
                const points = tasks.reduce((sum, task) => {
                    if (task.status === 'Done' && task.assignee === developer.name && task.storyPoints) {
                        const taskPoints = Number(task.storyPoints);
                        if (!isNaN(taskPoints)) {
                            return sum + taskPoints;
                        }
                    }
                    return sum;
                }, 0);
                return { sprintName: `Sprint ${sprint.sprintNumber}`, points: points };
            });

            if (specificDevChartData.every(d => d.points === 0)) {
                return { chartData: [], chartConfig: {}, noDataMessage: `No completed story points by ${developer.name} in the last 10 completed sprints.`, xAxisDataKey: "sprintName" };
            }

            const dynamicChartConfig: ChartConfig = {
                points: {
                    label: developer.name,
                    color: taskTypeColors['New Feature'] || "hsl(var(--chart-1))", // Default color if New Feature isn't in taskTypeColors
                },
            };
            return { chartData: specificDevChartData, chartConfig: dynamicChartConfig, noDataMessage: "", xAxisDataKey: "sprintName" };
        }
         else if(selectedSprintNumber && (selectedDeveloperId === "all" || !selectedDeveloperId) ){
            //Active Sprint
             const activeSprint = sprintData.sprints.find(s => s.sprintNumber === selectedSprintNumber);
             if (!activeSprint) {
                 return { chartData: [], chartConfig: {}, noDataMessage: "No active sprint to display contributions.", xAxisDataKey: "developerName" };
             }
             if (softwareEngineers.length === 0) {
                 return { chartData: [], chartConfig: {}, noDataMessage: "No Software Engineers found in the project for active sprint view.", xAxisDataKey: "developerName" };
             }

             const tasksInActiveSprint: Task[] = [...(activeSprint.planning?.newTasks || []), ...(activeSprint.planning?.spilloverTasks || [])];
             const dataByDeveloper: { [devName: string]: { developerName: string } & { [taskTypeKey: string]: number } } = {};
             const activeSprintChartConfig: ChartConfig = {};
             let colorIdx = 0;

             softwareEngineers.forEach(dev => {
                 dataByDeveloper[dev.name] = { developerName: dev.name };
                 allTaskTypes.forEach(type => {
                     dataByDeveloper[dev.name][type.replace(/\s+/g, '')] = 0; // Initialize task types with 0 points
                 });
             });

             tasksInActiveSprint.forEach(task => {
                 if (task.status === 'Done' && task.assignee && task.storyPoints && task.taskType) {
                     const assignee = members.find(m => m.name === task.assignee);
                     if (assignee && softwareEngineers.some(se => se.id === assignee.id)) { // Ensure assignee is an SE
                         const points = Number(task.storyPoints);
                         const taskTypeKey = task.taskType.replace(/\s+/g, ''); // e.g., NewFeature
                         if (!isNaN(points) && dataByDeveloper[task.assignee]) {
                             dataByDeveloper[task.assignee][taskTypeKey] = (dataByDeveloper[task.assignee][taskTypeKey] || 0) + points;

                             // Dynamically build chartConfig for task types if not already present
                             if (!activeSprintChartConfig[taskTypeKey]) {
                                 activeSprintChartConfig[taskTypeKey] = {
                                     label: task.taskType,
                                     color: taskTypeColors[task.taskType] || `hsl(var(--chart-${(colorIdx % 5) + 1}))`, // Cycle through chart-1 to chart-5
                                 };
                                 colorIdx++;
                             }
                         }
                     }
                 }
             });

             const allDevsChartData = Object.values(dataByDeveloper);

             if (allDevsChartData.every(devData => allTaskTypes.every(type => (devData[type.replace(/\s+/g, '')] || 0) === 0))) {
                 return { chartData: [], chartConfig: {}, noDataMessage: "No completed story points by developers in the active sprint.", xAxisDataKey: "developerName" };
             }

             return { chartData: allDevsChartData, chartConfig: activeSprintChartConfig, noDataMessage: "", xAxisDataKey: "developerName" };
         } else { // Default case if no specific developer or "all" for active sprint is chosen (e.g. initial load, or error state)
            return { chartData: [], chartConfig: {}, noDataMessage: "Select a developer or 'All Developers' to view contributions.", xAxisDataKey: "name"};
         }
    }, [sprintData, members, selectedDeveloperId, selectedSprintNumber]);


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
                        dataKey={xAxisDataKey}
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
                    {selectedDeveloperId && selectedDeveloperId !== "all" ? (
                        // Specific developer view: one bar for 'points'
                        <Bar dataKey="points" fill={chartConfig.points?.color || "hsl(var(--chart-1))"} radius={4} barSize={20} />
                    ) : (
                        // All developers view: stacked bars by task type
                        Object.keys(chartConfig).map(taskTypeKey => (
                            chartConfig[taskTypeKey] ? // Ensure config exists for this task type
                                <Bar
                                    key={taskTypeKey}
                                    dataKey={taskTypeKey}
                                    fill={chartConfig[taskTypeKey]?.color || "hsl(var(--muted))"}
                                    radius={4}
                                    barSize={15}
                                    stackId="a" // All bars for a developer stack together
                                    name={chartConfig[taskTypeKey]?.label?.toString()} // For legend
                                />
                                : null
                        ))
                    )}
                </BarChart>
            </ResponsiveContainer>
        </ChartContainer>
    );
}
