
'use client';

import type {
  SprintData,
  Sprint,
  Task,
  DailyProgressDataPoint,
} from '@/types/sprint-data';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartConfig,
  ChartTooltip,
  ChartTooltipContent,
  ChartPie,
  ChartPieChart,
  ChartCell,
} from '@/components/ui/chart'; // Use imported types from chart.tsx
import {
  Info,
  LineChart,
  Activity,
  CheckCircle,
  ListChecks,
  TrendingDown,
  CalendarCheck,
  CalendarRange,
  BarChartBig,
  Clock,
} from 'lucide-react';
import VelocityChart from '@/components/charts/velocity-chart';
import BurndownChart from '@/components/charts/burndown-chart';
import DailyProgressChart from '@/components/charts/daily-progress-chart';
import TaskNodeProgress from '@/components/task-node-progress'; // Import the new node progress component
import { Progress } from '@/components/ui/progress'; // Import the progress bar
import { useMemo, useState, useEffect } from 'react';
import {
  format,
  parseISO,
  isValid,
  eachDayOfInterval,
  isWithinInterval,
  getDay,
  differenceInDays,
  isBefore,
  isSameDay,
} from 'date-fns';

interface DashboardTabProps {
  sprintData: SprintData | null;
  projectName: string;
  projectId: string;
}

const chartConfig = {
  completed: {
    label: 'Completed',
    color: 'hsl(var(--chart-1))',
  },
  remaining: {
    label: 'Remaining',
    color: 'hsl(var(--chart-3))',
  },
  committed: {
    label: 'Committed',
    color: 'hsl(var(--secondary))',
  },
  ideal: {
    label: 'Ideal',
    color: 'hsl(var(--chart-2))',
  },
  actual: {
    label: 'Actual',
    color: 'hsl(var(--chart-1))',
  },
  points: {
    label: 'Points Completed',
    color: 'hsl(var(--chart-1))',
  },
  tasksCompleted: {
    label: 'Tasks Completed',
    color: 'hsl(var(--chart-2))',
  },
} satisfies ChartConfig;

const isWorkingDay = (date: Date): boolean => {
  const day = getDay(date);
  return day >= 1 && day <= 5;
};

export default function DashboardTab({
  sprintData,
  projectName,
  projectId,
}: DashboardTabProps) {
  const [clientNow, setClientNow] = useState<Date | null>(null);

  useEffect(() => {
    setClientNow(new Date());
  }, []);

  const activeSprint = sprintData?.sprints.find((s) => s.status === 'Active');

  // Recalculate points chart data and completion percentage
  const { pointsChartData, pointsCompletionPercentage } = useMemo(() => {
    if (!activeSprint || !activeSprint.planning)
      return { pointsChartData: [], pointsCompletionPercentage: 0 };

    // Committed points only include NEW tasks planned for this sprint
    const committed = (activeSprint.planning.newTasks || []).reduce(
      (sum, task) => sum + (Number(task.storyPoints) || 0),
      0
    );

    // Completed points include DONE tasks from BOTH new and spillover for this sprint
    const completed = [
      ...(activeSprint.planning.newTasks || []),
      ...(activeSprint.planning.spilloverTasks || []),
    ]
      .filter((task) => task.status === 'Done')
      .reduce((sum, task) => sum + (Number(task.storyPoints) || 0), 0);

    // Remaining is based on the original commitment (new tasks only)
    const remaining = Math.max(0, committed - completed);
    const percentage =
      committed > 0 ? Math.round((completed / committed) * 100) : 0;

    const chartData = [
      {
        name: 'Completed',
        value: completed,
        fill: chartConfig.completed.color,
      },
      {
        name: 'Remaining',
        value: remaining,
        fill: chartConfig.remaining.color,
      },
    ];
    return {
      pointsChartData: chartData,
      pointsCompletionPercentage: percentage,
    };
  }, [activeSprint]);

  const taskProgressData = useMemo(() => {
    if (!activeSprint || !activeSprint.planning)
      return { totalTasks: 0, completedTasks: 0, tasks: [] };
    const tasks = [
      ...(activeSprint.planning.newTasks || []),
      ...(activeSprint.planning.spilloverTasks || []),
    ];
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(
      (task) => task.status === 'Done'
    ).length;
    return { totalTasks, completedTasks, tasks };
  }, [activeSprint]);

  const taskCompletionPercentage =
    taskProgressData.totalTasks > 0
      ? Math.round(
          (taskProgressData.completedTasks / taskProgressData.totalTasks) * 100
        )
      : 0;

  const dailyProgressChartData = useMemo(() => {
    if (
      !activeSprint ||
      !activeSprint.startDate ||
      !activeSprint.endDate ||
      !isValid(parseISO(activeSprint.startDate)) ||
      !isValid(parseISO(activeSprint.endDate))
    ) {
      return [];
    }

    const sprintStart = parseISO(activeSprint.startDate);
    const sprintEnd = parseISO(activeSprint.endDate);
    const allTasks = [
      ...(activeSprint.planning?.newTasks || []),
      ...(activeSprint.planning?.spilloverTasks || []),
    ];
    const dailyDataMap: {
      [date: string]: { points: number; tasksCompleted: number };
    } = {};

    const sprintDaysArray = eachDayOfInterval({
      start: sprintStart,
      end: sprintEnd,
    });
    sprintDaysArray.forEach((day) => {
      dailyDataMap[format(day, 'yyyy-MM-dd')] = {
        points: 0,
        tasksCompleted: 0,
      };
    });

    allTasks.forEach((task) => {
      if (
        task.status === 'Done' &&
        task.completedDate &&
        isValid(parseISO(task.completedDate))
      ) {
        const completedOn = parseISO(task.completedDate);
        if (
          isWithinInterval(completedOn, { start: sprintStart, end: sprintEnd })
        ) {
          const formattedDate = format(completedOn, 'yyyy-MM-dd');
          if (dailyDataMap[formattedDate]) {
            dailyDataMap[formattedDate].points += Number(task.storyPoints) || 0;
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
        const dateA = parseISO(`2000-${a.date.replace('/', '-')}`); // Use placeholder year
        const dateB = parseISO(`2000-${b.date.replace('/', '-')}`);
        return dateA.getTime() - dateB.getTime();
      });
  }, [activeSprint]);

  const formattedStartDate =
    activeSprint?.startDate && isValid(parseISO(activeSprint.startDate))
      ? format(parseISO(activeSprint.startDate), 'MMM d, yyyy')
      : 'N/A';
  const formattedEndDate =
    activeSprint?.endDate && isValid(parseISO(activeSprint.endDate))
      ? format(parseISO(activeSprint.endDate), 'MMM d, yyyy')
      : 'N/A';

  const remainingWorkingDays = useMemo(() => {
    if (
      !activeSprint ||
      !clientNow ||
      !activeSprint.endDate ||
      !isValid(parseISO(activeSprint.endDate))
    ) {
      return null;
    }
    const sprintEnd = parseISO(activeSprint.endDate);
    if (isBefore(sprintEnd, clientNow) && !isSameDay(sprintEnd, clientNow)) {
      return 0;
    }

    const today = clientNow;
    try {
      const intervalStart = isBefore(today, parseISO(activeSprint.startDate))
        ? parseISO(activeSprint.startDate)
        : today;
      const interval = eachDayOfInterval({
        start: intervalStart,
        end: sprintEnd,
      });
      return interval.filter(
        (day) =>
          isWorkingDay(day) && (isSameDay(day, today) || isBefore(today, day))
      ).length;
    } catch (e) {
      console.error('Error calculating remaining days:', e);
      return null;
    }
  }, [activeSprint, clientNow]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle
            className="flex items-center gap-2"
            style={{ fontSize: '1.2em' }}
          >
            <Activity className="h-5 w-5 text-primary" />
            Active Sprint:{' '}
            {activeSprint ? `Sprint ${activeSprint.sprintNumber}` : 'None'}
          </CardTitle>
          {activeSprint && (
            <>
              <CardDescription className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-2">
                  <CalendarRange className="h-4 w-4" />
                  {formattedStartDate} - {formattedEndDate}
                </span>
                {remainingWorkingDays !== null && (
                  <span className="flex items-center gap-2 font-medium text-foreground">
                    <Clock className="h-4 w-4" />
                    Countdown: {remainingWorkingDays} working{' '}
                    {remainingWorkingDays === 1 ? 'day' : 'days'} left
                  </span>
                )}
              </CardDescription>
              <CardDescription>
                Status and key metrics for the current sprint in '{projectName}
                '.
              </CardDescription>
            </>
          )}
        </CardHeader>
        {!activeSprint && (
          <CardContent className="flex min-h-[150px] flex-col items-center justify-center rounded-md border border-dashed p-8 text-muted-foreground">
            <Info className="mb-2 h-6 w-6" />
            <p>No active sprint found for this project.</p>
          </CardContent>
        )}
      </Card>

      {activeSprint && (
        <Card className="flex h-[350px] flex-col lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle className="h-4 w-4 text-primary" /> Story Points
              Progress
            </CardTitle>
            <CardDescription className="text-xs">
              Committed (New Tasks Only) vs. Completed points.
            </CardDescription>
          </CardHeader>
          <CardContent className="-mt-4 flex flex-1 items-center justify-center pb-0">
            {pointsChartData.reduce((acc, curr) => acc + curr.value, 0) > 0 ||
            activeSprint.committedPoints > 0 ? ( // Show chart even if only commitment exists
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <ChartPieChart>
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent hideLabel nameKey="name" />}
                  />
                  <ChartPie
                    data={pointsChartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={80}
                    strokeWidth={5}
                  >
                    {pointsChartData.map((entry, index) => (
                      <ChartCell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </ChartPie>
                  {/* Center Text */}
                  <text
                    x="50%"
                    y="50%"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="fill-foreground text-2xl font-semibold"
                  >
                    {pointsCompletionPercentage}%
                  </text>
                  <text
                    x="50%"
                    y="50%"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    dy="1.5em" // Keep padding
                    className="fill-muted-foreground text-xs"
                  >
                    Completed
                  </text>
                </ChartPieChart>
              </ChartContainer>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
                <Info className="mr-2 h-5 w-5" /> No committed points in this
                sprint.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* --- Task Progress Card --- */}
      {activeSprint && (
        <Card className="flex h-[350px] flex-col lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ListChecks className="h-4 w-4 text-primary" /> Task Progress
            </CardTitle>
            <CardDescription className="text-xs">
              Overall task completion status.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col items-center justify-center gap-4 pb-4 pt-2">
            {taskProgressData.totalTasks > 0 ? (
              <>
                <div className="relative w-full px-4">
                  <Progress value={taskCompletionPercentage} className="h-4" />
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-primary-foreground mix-blend-screen">
                    {taskCompletionPercentage}% Complete
                  </span>
                </div>
                <TaskNodeProgress tasks={taskProgressData.tasks} />
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
                <Info className="mr-2 h-5 w-5" /> No tasks planned for this
                sprint.
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {/* --- End Task Progress Card --- */}

      <Card className="h-[350px] lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center justify-center gap-2 text-base">
            <TrendingDown className="h-5 w-5 text-primary" /> Burndown Chart
          </CardTitle>
          <CardDescription className="text-center">
            Ideal vs. Actual burndown for active sprint.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[calc(100%-100px)] pl-2">
          <BurndownChart activeSprint={activeSprint} />
        </CardContent>
      </Card>

      <Card className="h-[350px] lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center justify-center gap-2 text-base">
            <BarChartBig className="h-5 w-5 text-primary" /> Daily Progress
          </CardTitle>
          <CardDescription className="text-center">
            Story points completed per day.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[calc(100%-100px)] pl-2">
          {activeSprint ? (
            <DailyProgressChart data={dailyProgressChartData} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
              <Info className="mr-2 h-5 w-5" />
              <span>No active sprint to display daily progress.</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="h-[350px] lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <LineChart className="h-5 w-5 text-primary" /> Project Velocity
          </CardTitle>
          <CardDescription>
            Committed vs. Completed points over past sprints for '{projectName}
            '.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[calc(100%-100px)] pl-2">
          {sprintData && sprintData.sprints && sprintData.sprints.length > 0 ? (
            <VelocityChart data={sprintData.sprints} />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Info className="mr-2 h-5 w-5" /> No sprint data for velocity
              chart.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

