
"use client";

import type { SprintData, Sprint, Task, DailyProgressDataPoint } from '@/types/sprint-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartConfig, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { PieChart, Pie, Cell } from 'recharts';
import { Info, LineChart, Activity, CheckCircle, ListChecks, TrendingDown, CalendarCheck, CalendarRange, BarChartBig, Clock } from 'lucide-react'; // Added Clock icon
import VelocityChart from '@/components/charts/velocity-chart';
import BurndownChart from '@/components/charts/burndown-chart';
import DailyProgressChart from '@/components/charts/daily-progress-chart'; // Import DailyProgressChart
import { useMemo, useState, useEffect } from 'react'; // Import useState, useEffect
import { format, parseISO, isValid, eachDayOfInterval, isWithinInterval, getDay, differenceInDays, isBefore, isSameDay } from 'date-fns'; // Added differenceInDays, isBefore, isSameDay

interface DashboardTabProps {
  sprintData: SprintData | null;
  projectName: string;
  projectId: string;
}

const chartConfig = {
  completed: {
    label: "Completed",
    color: "hsl(var(--chart-1))",
  },
  remaining: {
    label: "Remaining",
    color: "hsl(var(--chart-3))",
  },
   committed: {
     label: "Committed",
     color: "hsl(var(--secondary))",
   },
   ideal: {
    label: "Ideal",
    color: "hsl(var(--chart-2))",
  },
  actual: {
    label: "Actual",
    color: "hsl(var(--chart-1))",
  },
  points: { // Added for DailyProgressChart legend consistency
    label: "Points Completed",
    color: "hsl(var(--chart-1))",
  },
  tasksCompleted: { // Added for task completion in DailyProgressChart
    label: "Tasks Completed",
    color: "hsl(var(--chart-2))", // Using a different chart color
  }
} satisfies ChartConfig;

// Helper to check if a day is a working day (Mon-Fri)
const isWorkingDay = (date: Date): boolean => {
  const day = getDay(date);
  return day >= 1 && day <= 5; // 1 (Mon) to 5 (Fri)
};

export default function DashboardTab({ sprintData, projectName, projectId }: DashboardTabProps) {
  const [clientNow, setClientNow] = useState<Date | null>(null);

  useEffect(() => {
      setClientNow(new Date());
  }, []);

  const activeSprint = sprintData?.sprints.find(s => s.status === 'Active');

  const pointsChartData = useMemo(() => {
    if (!activeSprint) return [];
    const committed = activeSprint.committedPoints || 0;
     const completed = (activeSprint.status === 'Active' || activeSprint.status === 'Planned') && activeSprint.planning
         ? [...(activeSprint.planning.newTasks || []), ...(activeSprint.planning.spilloverTasks || [])]
             .filter(task => task.status === 'Done')
             .reduce((sum, task) => sum + (Number(task.storyPoints) || 0), 0)
         : activeSprint.completedPoints || 0;

    const remaining = Math.max(0, committed - completed);
    return [
      { name: 'Completed', value: completed, fill: chartConfig.completed.color },
      { name: 'Remaining', value: remaining, fill: chartConfig.remaining.color },
    ];
  }, [activeSprint]);

  const tasksChartData = useMemo(() => {
    if (!activeSprint || !activeSprint.planning) return [];
    const totalTasks = (activeSprint.planning.newTasks?.length || 0) + (activeSprint.planning.spilloverTasks?.length || 0);
    const completedTasks = [...(activeSprint.planning.newTasks || []), ...(activeSprint.planning.spilloverTasks || [])]
                           .filter(task => task.status === 'Done').length;
    const remainingTasks = totalTasks - completedTasks;
    return [
      { name: 'Completed', value: completedTasks, fill: chartConfig.completed.color },
      { name: 'Remaining', value: remainingTasks, fill: chartConfig.remaining.color },
    ];
  }, [activeSprint]);

  const dailyProgressChartData = useMemo(() => {
    if (!activeSprint || !activeSprint.startDate || !activeSprint.endDate || !isValid(parseISO(activeSprint.startDate)) || !isValid(parseISO(activeSprint.endDate))) {
      return [];
    }

    const sprintStart = parseISO(activeSprint.startDate);
    const sprintEnd = parseISO(activeSprint.endDate);
    const allTasks = [...(activeSprint.planning?.newTasks || []), ...(activeSprint.planning?.spilloverTasks || [])];
    const dailyDataMap: { [date: string]: { points: number, tasksCompleted: number } } = {};

    const sprintDaysArray = eachDayOfInterval({ start: sprintStart, end: sprintEnd });
    sprintDaysArray.forEach(day => {
      dailyDataMap[format(day, 'yyyy-MM-dd')] = { points: 0, tasksCompleted: 0 };
    });

    allTasks.forEach(task => {
      if (task.status === 'Done' && task.completedDate && isValid(parseISO(task.completedDate))) {
        const completedOn = parseISO(task.completedDate);
        if (isWithinInterval(completedOn, { start: sprintStart, end: sprintEnd })) {
          const formattedDate = format(completedOn, 'yyyy-MM-dd');
          // Ensure the date exists in the map before adding
          if (dailyDataMap[formattedDate]) {
              dailyDataMap[formattedDate].points += (Number(task.storyPoints) || 0);
              dailyDataMap[formattedDate].tasksCompleted += 1;
          }
        }
      }
    });

    return Object.entries(dailyDataMap)
      .map(([date, data]) => ({
        date: format(parseISO(date), 'MM/dd'),
        points: data.points,
        tasksCompleted: data.tasksCompleted,
      }))
      .sort((a, b) => {
         const year = sprintStart.getFullYear();
         // Construct full date strings for reliable parsing and comparison
         const dateA = parseISO(`${year}-${a.date.replace('/', '-')}`);
         const dateB = parseISO(`${year}-${b.date.replace('/', '-')}`);
         return dateA.getTime() - dateB.getTime();
       });

  }, [activeSprint]);


   const formattedStartDate = activeSprint?.startDate && isValid(parseISO(activeSprint.startDate))
     ? format(parseISO(activeSprint.startDate), 'MMM d, yyyy')
     : 'N/A';
   const formattedEndDate = activeSprint?.endDate && isValid(parseISO(activeSprint.endDate))
     ? format(parseISO(activeSprint.endDate), 'MMM d, yyyy')
     : 'N/A';

   // Calculate remaining working days
   const remainingWorkingDays = useMemo(() => {
       if (!activeSprint || !clientNow || !activeSprint.endDate || !isValid(parseISO(activeSprint.endDate))) {
           return null;
       }
       const sprintEnd = parseISO(activeSprint.endDate);
       // Ensure end date is today or in the future
       if (isBefore(sprintEnd, clientNow) && !isSameDay(sprintEnd, clientNow)) {
           return 0; // Sprint already ended
       }

       const today = clientNow;
       try {
            // Calculate interval from tomorrow (or today if sprint starts today) to sprint end
            const intervalStart = isBefore(today, parseISO(activeSprint.startDate)) ? parseISO(activeSprint.startDate) : today;
            const interval = eachDayOfInterval({ start: intervalStart, end: sprintEnd });
            // Filter for working days within the interval (including today if it's a working day and part of the interval)
            return interval.filter(day => isWorkingDay(day) && (isSameDay(day, today) || isBefore(today, day))).length;
       } catch (e) {
          console.error("Error calculating remaining days:", e);
          return null; // Return null on error
       }

   }, [activeSprint, clientNow]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

       <Card className="lg:col-span-2">
         <CardHeader>
           <CardTitle className="flex items-center gap-2">
             <Activity className="h-5 w-5 text-primary" />
             Active Sprint: {activeSprint ? `Sprint ${activeSprint.sprintNumber}` : 'None'}
           </CardTitle>
            {activeSprint && (
              <>
                 <CardDescription className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-2">
                      <CalendarRange className="h-4 w-4" />
                      {formattedStartDate} - {formattedEndDate}
                    </span>
                     {remainingWorkingDays !== null && (
                       <span className="flex items-center gap-2 font-medium text-foreground">
                         <Clock className="h-4 w-4" />
                         Countdown: {remainingWorkingDays} working {remainingWorkingDays === 1 ? 'day' : 'days'} left
                       </span>
                     )}
                 </CardDescription>
                 <CardDescription>Status and key metrics for the current sprint in '{projectName}'.</CardDescription>
               </>
            )}
         </CardHeader>
         {!activeSprint && (
           <CardContent className="flex flex-col items-center justify-center text-muted-foreground p-8 border border-dashed rounded-md min-h-[150px]">
               <Info className="mb-2 h-6 w-6" />
               <p>No active sprint found for this project.</p>
           </CardContent>
         )}
       </Card>


       {activeSprint && (
          <Card className="lg:col-span-1 h-[350px] flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle className="h-4 w-4 text-primary" /> Story Points Progress
              </CardTitle>
               <CardDescription className="text-xs">Committed vs. Completed points.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex items-center justify-center pb-0 -mt-4">
              {pointsChartData.reduce((acc, curr) => acc + curr.value, 0) > 0 ? (
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
                         dy="1.2em"
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

       {activeSprint && (
          <Card className="lg:col-span-1 h-[350px] flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ListChecks className="h-4 w-4 text-primary" /> Task Progress
              </CardTitle>
               <CardDescription className="text-xs">Total vs. Completed tasks.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex items-center justify-center pb-0 -mt-4">
               {tasksChartData.reduce((acc, curr) => acc + curr.value, 0) > 0 ? (
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
                         dy="1.2em"
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


      {/* Burndown Chart */}
      <Card className="lg:col-span-1 h-[350px]">
        <CardHeader>
          <CardTitle className="flex items-center justify-center gap-2">
             <TrendingDown className="h-5 w-5 text-primary" /> Burndown Chart
          </CardTitle>
          <CardDescription className="text-center">Ideal vs. Actual burndown for active sprint.</CardDescription>
        </CardHeader>
        <CardContent className="h-[calc(100%-100px)] pl-2">
          <BurndownChart activeSprint={activeSprint} />
        </CardContent>
      </Card>

       {/* Daily Progress Chart */}
       <Card className="lg:col-span-1 h-[350px]">
        <CardHeader>
          <CardTitle className="flex items-center justify-center gap-2">
             <BarChartBig className="h-5 w-5 text-primary" /> Daily Progress
          </CardTitle>
          <CardDescription className="text-center">Story points completed per day.</CardDescription>
        </CardHeader>
        <CardContent className="h-[calc(100%-100px)] pl-2">
          {activeSprint ? (
            <DailyProgressChart data={dailyProgressChartData} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Info className="mr-2 h-5 w-5" />
              <span>No active sprint to display daily progress.</span>
            </div>
          )}
        </CardContent>
      </Card>

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

    