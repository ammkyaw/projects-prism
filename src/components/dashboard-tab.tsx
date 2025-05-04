
"use client";

import type { SprintData, Sprint, Task } from '@/types/sprint-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartConfig, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { PieChart, Pie, Cell, Tooltip } from 'recharts';
import { Info, LineChart, BarChart, Activity, CheckCircle, ListChecks, TrendingDown, CalendarCheck } from 'lucide-react';
import VelocityChart from '@/components/charts/velocity-chart';
import { useMemo } from 'react';

interface DashboardTabProps {
  sprintData: SprintData | null;
  projectName: string;
  projectId: string;
}

// Define colors for charts
const chartConfig = {
  completed: {
    label: "Completed",
    color: "hsl(var(--chart-1))", // Use primary theme color
  },
  remaining: {
    label: "Remaining",
    color: "hsl(var(--chart-3))", // Use a muted/secondary theme color
  },
   committed: { // Keep committed for Velocity chart legend consistency
     label: "Committed",
     color: "hsl(var(--secondary))",
   },
} satisfies ChartConfig;

export default function DashboardTab({ sprintData, projectName, projectId }: DashboardTabProps) {

  const activeSprint = sprintData?.sprints.find(s => s.status === 'Active');

  const pointsChartData = useMemo(() => {
    if (!activeSprint) return [];
    const committed = activeSprint.committedPoints || 0;
    // Calculate completed based on 'Done' tasks if status is Active/Planned, otherwise use stored value
     const completed = (activeSprint.status === 'Active' || activeSprint.status === 'Planned')
         ? [...(activeSprint.planning?.newTasks || []), ...(activeSprint.planning?.spilloverTasks || [])]
             .filter(task => task.status === 'Done')
             .reduce((sum, task) => sum + (Number(task.storyPoints) || 0), 0)
         : activeSprint.completedPoints || 0;

    const remaining = Math.max(0, committed - completed); // Ensure remaining is not negative
    return [
      { name: 'Completed', value: completed, fill: 'var(--color-completed)' },
      { name: 'Remaining', value: remaining, fill: 'var(--color-remaining)' },
    ];
  }, [activeSprint]);

  const tasksChartData = useMemo(() => {
    if (!activeSprint || !activeSprint.planning) return [];
    const totalTasks = (activeSprint.planning.newTasks?.length || 0) + (activeSprint.planning.spilloverTasks?.length || 0);
    const completedTasks = [...(activeSprint.planning.newTasks || []), ...(activeSprint.planning.spilloverTasks || [])]
                           .filter(task => task.status === 'Done').length;
    const remainingTasks = totalTasks - completedTasks;
    return [
      { name: 'Completed', value: completedTasks, fill: 'var(--color-completed)' },
      { name: 'Remaining', value: remainingTasks, fill: 'var(--color-remaining)' },
    ];
  }, [activeSprint]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

       {/* Active Sprint Status */}
       <Card className="lg:col-span-2">
         <CardHeader>
           <CardTitle className="flex items-center gap-2">
             <Activity className="h-5 w-5 text-primary" />
             Active Sprint: {activeSprint ? `Sprint ${activeSprint.sprintNumber}` : 'None'}
           </CardTitle>
           <CardDescription>Status and key metrics for the current sprint in '{projectName}'.</CardDescription>
         </CardHeader>
         {!activeSprint && (
           <CardContent className="flex flex-col items-center justify-center text-muted-foreground p-8 border border-dashed rounded-md min-h-[150px]">
               <Info className="mb-2 h-6 w-6" />
               <p>No active sprint found for this project.</p>
           </CardContent>
         )}
       </Card>


       {/* Commitment vs Delivered Points Pie Chart */}
       {activeSprint && (
          <Card className="lg:col-span-1 h-[350px] flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"> {/* Smaller title */}
                <CheckCircle className="h-4 w-4 text-primary" /> Story Points Progress
              </CardTitle>
               <CardDescription className="text-xs">Committed vs. Completed points.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex items-center justify-center pb-0 -mt-4">
              {pointsChartData.reduce((acc, curr) => acc + curr.value, 0) > 0 ? ( // Check if there's data to show
                <ChartContainer config={chartConfig} className="w-full h-[250px]">
                  <PieChart>
                    <ChartTooltip
                       cursor={false}
                       content={<ChartTooltipContent hideLabel nameKey="name" />}
                     />
                    <Pie
                      data={pointsChartData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={80}
                      strokeWidth={5}
                    >
                       {pointsChartData.map((entry, index) => (
                         <Cell key={`cell-${index}`} fill={entry.fill} />
                       ))}
                    </Pie>
                     {/* Center Label */}
                     <text
                        x="50%"
                        y="50%"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-foreground text-2xl font-semibold"
                     >
                        {activeSprint.committedPoints || 0}
                     </text>
                     <text
                         x="50%"
                         y="50%"
                         textAnchor="middle"
                         dominantBaseline="middle"
                         dy="1.2em" // Adjust vertical position
                         className="fill-muted-foreground text-xs"
                      >
                         Committed
                      </text>
                  </PieChart>
                </ChartContainer>
              ) : (
                 <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center">
                   <Info className="mr-2 h-5 w-5" /> No committed points in this sprint.
                 </div>
               )}
            </CardContent>
          </Card>
       )}

       {/* Total Tasks vs Remaining Tasks Pie Chart */}
       {activeSprint && (
          <Card className="lg:col-span-1 h-[350px] flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"> {/* Smaller title */}
                <ListChecks className="h-4 w-4 text-primary" /> Task Progress
              </CardTitle>
               <CardDescription className="text-xs">Total vs. Completed tasks.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex items-center justify-center pb-0 -mt-4">
               {tasksChartData.reduce((acc, curr) => acc + curr.value, 0) > 0 ? ( // Check if there are tasks
                 <ChartContainer config={chartConfig} className="w-full h-[250px]">
                   <PieChart>
                      <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent hideLabel nameKey="name" />}
                      />
                     <Pie
                       data={tasksChartData}
                       dataKey="value"
                       nameKey="name"
                       innerRadius={60}
                       outerRadius={80}
                        strokeWidth={5}
                     >
                        {tasksChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                     </Pie>
                      {/* Center Label */}
                      <text
                         x="50%"
                         y="50%"
                         textAnchor="middle"
                         dominantBaseline="middle"
                         className="fill-foreground text-2xl font-semibold"
                      >
                         {tasksChartData.reduce((acc, curr) => acc + curr.value, 0) || 0}
                      </text>
                      <text
                         x="50%"
                         y="50%"
                         textAnchor="middle"
                         dominantBaseline="middle"
                         dy="1.2em" // Adjust vertical position
                         className="fill-muted-foreground text-xs"
                       >
                          Total Tasks
                       </text>
                   </PieChart>
                 </ChartContainer>
               ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center">
                    <Info className="mr-2 h-5 w-5" /> No tasks planned for this sprint.
                  </div>
                )}
            </CardContent>
          </Card>
       )}


      {/* Burndown Chart Placeholder */}
      <Card className="lg:col-span-1 h-[350px] flex flex-col items-center justify-center border-dashed border-2">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
             <TrendingDown className="h-5 w-5 text-muted-foreground" /> Burndown Chart
          </CardTitle>
          <CardDescription>(Ideal vs. Actual burndown)</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center text-muted-foreground">
          <Info className="mr-2 h-5 w-5" />
          (Placeholder - Requires daily progress tracking)
        </CardContent>
      </Card>

       {/* Daily Progress Placeholder */}
       <Card className="lg:col-span-1 h-[350px] flex flex-col items-center justify-center border-dashed border-2">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
             <CalendarCheck className="h-5 w-5 text-muted-foreground" /> Daily Progress
          </CardTitle>
          <CardDescription>(Tasks/Points completed per day)</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center text-muted-foreground">
          <Info className="mr-2 h-5 w-5" />
          (Placeholder - Requires daily progress tracking)
        </CardContent>
      </Card>

       {/* Velocity Chart (Moved to bottom) */}
       <Card className="lg:col-span-2 h-[350px]">
         <CardHeader>
           <CardTitle className="flex items-center gap-2">
             <LineChart className="h-5 w-5 text-primary" /> Project Velocity
           </CardTitle>
           <CardDescription>Committed vs. Completed points over past sprints for '{projectName}'.</CardDescription>
         </CardHeader>
         <CardContent className="h-[calc(100%-100px)] pl-2">
           {sprintData && sprintData.sprints && sprintData.sprints.length > 0 ? (
             <VelocityChart data={sprintData.sprints} />
           ) : (
             <div className="flex items-center justify-center h-full text-muted-foreground">
               <Info className="mr-2 h-5 w-5" /> No sprint data for velocity chart.
             </div>
           )}
         </CardContent>
       </Card>

    </div>
  );
}
