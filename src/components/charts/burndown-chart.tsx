// src/components/charts/burndown-chart.tsx
'use client';

import type { Sprint, Task } from '@/types/sprint-data';
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { useMemo, useState, useEffect } from 'react';
import {
  format,
  parseISO,
  isValid,
  eachDayOfInterval,
  isSameDay,
  isBefore,
  getDay,
  differenceInCalendarDays,
  addDays,
} from 'date-fns';
import { Info } from 'lucide-react';

interface BurndownChartProps {
  activeSprint: Sprint | null | undefined;
}

const chartConfig = {
  ideal: {
    label: 'Ideal',
    color: 'hsl(var(--chart-2))',
  },
  actual: {
    label: 'Actual',
    color: 'hsl(var(--chart-1))',
  },
} satisfies ChartConfig;

const isWorkingDay = (date: Date): boolean => {
  const day = getDay(date);
  return day >= 1 && day <= 5; // Monday to Friday
};

export default function BurndownChart({ activeSprint }: BurndownChartProps) {
  const [clientNow, setClientNow] = useState<Date | null>(null);

  useEffect(() => {
    setClientNow(new Date());
  }, []);

  const chartData = useMemo(() => {
    if (
      !activeSprint ||
      !activeSprint.startDate ||
      !activeSprint.endDate ||
      !isValid(parseISO(activeSprint.startDate)) ||
      !isValid(parseISO(activeSprint.endDate)) ||
      !clientNow
    ) {
      return [];
    }

    const sprintStart = parseISO(activeSprint.startDate);
    const sprintEnd = parseISO(activeSprint.endDate);

    // Include story points from both new tasks and spillover tasks for total commitment
    const totalCommittedAndSpilloverPoints =
      (activeSprint.planning?.newTasks || []).reduce(
        (sum, task) => sum + (Number(task.storyPoints) || 0),
        0
      ) +
      (activeSprint.planning?.spilloverTasks || []).reduce(
        (sum, task) => sum + (Number(task.storyPoints) || 0),
        0
      );

    if (totalCommittedAndSpilloverPoints === 0) {
      return []; // No points to burndown
    }

    let sprintDaysArray: Date[] = [];
    try {
      sprintDaysArray = eachDayOfInterval({
        start: sprintStart,
        end: sprintEnd,
      });
    } catch (error) {
      console.error(
        'Error generating sprint days interval for burndown:',
        error
      );
      return []; // Prevent chart rendering if interval is invalid
    }

    const workingDaysInSprint = sprintDaysArray.filter(isWorkingDay).length;
    if (workingDaysInSprint === 0) {
      return []; // No working days to burndown
    }

    const idealPointsPerDay =
      totalCommittedAndSpilloverPoints / workingDaysInSprint;
    let remainingIdealPoints = totalCommittedAndSpilloverPoints;
    let remainingActualPoints = totalCommittedAndSpilloverPoints;
    let cumulativeWorkingDays = 0;

    const data: {
      date: string;
      ideal: number | null;
      actual: number | null;
    }[] = [];

    sprintDaysArray.forEach((day, index) => {
      const formattedDate = format(day, 'MM/dd');
      let idealValue: number | null = null;
      let actualValue: number | null = null;

      // Ideal line calculation (only decreases on working days)
      if (isWorkingDay(day)) {
        if (cumulativeWorkingDays < workingDaysInSprint) {
          idealValue = Math.max(0, remainingIdealPoints);
          remainingIdealPoints -= idealPointsPerDay;
        } else {
          idealValue = 0; // Ensure ideal line hits zero on the last working day
        }
        cumulativeWorkingDays++;
      } else {
        // For non-working days, ideal points remain the same as the previous working day
        // Find the previous entry's ideal value if it exists and was a working day
        if (data.length > 0) {
          let prevIdeal = data[data.length - 1].ideal;
          // Traverse backwards if previous days were also non-working
          for (let i = data.length - 1; i >= 0; i--) {
            if (data[i].ideal !== null) {
              // Found a day with an ideal value
              prevIdeal = data[i].ideal;
              break;
            }
          }
          idealValue = prevIdeal;
        } else {
          // First day is non-working
          idealValue = totalCommittedAndSpilloverPoints;
        }
      }

      // Actual line calculation (only up to current client date or sprint end)
      if (
        isSameDay(day, clientNow) ||
        isBefore(day, clientNow) ||
        isSameDay(day, sprintEnd) ||
        isBefore(day, sprintEnd)
      ) {
        let pointsCompletedOnThisDay = 0;
        const allTasks = [
          ...(activeSprint.planning?.newTasks || []),
          ...(activeSprint.planning?.spilloverTasks || []),
        ];

        allTasks.forEach((task) => {
          if (
            task.status === 'Done' &&
            task.completedDate &&
            isValid(parseISO(task.completedDate)) &&
            isSameDay(parseISO(task.completedDate), day)
          ) {
            pointsCompletedOnThisDay += Number(task.storyPoints) || 0;
          }
        });
        remainingActualPoints -= pointsCompletedOnThisDay;
        actualValue = Math.max(0, remainingActualPoints);
      }

      data.push({
        date: formattedDate,
        ideal: idealValue !== null ? parseFloat(idealValue.toFixed(2)) : null,
        actual: actualValue,
      });
    });

    // Ensure the ideal line definitively reaches 0 on the last *working* day if not already
    // Find the last working day's index in the `data` array
    let lastWorkingDayDataIndex = -1;
    for (let i = sprintDaysArray.length - 1; i >= 0; i--) {
      if (isWorkingDay(sprintDaysArray[i])) {
        lastWorkingDayDataIndex = i;
        break;
      }
    }
    if (
      lastWorkingDayDataIndex !== -1 &&
      data[lastWorkingDayDataIndex] &&
      data[lastWorkingDayDataIndex].ideal !== 0
    ) {
      data[lastWorkingDayDataIndex].ideal = 0;
      // Propagate this 0 to subsequent non-working days at the end of the sprint
      for (let i = lastWorkingDayDataIndex + 1; i < data.length; i++) {
        if (!isWorkingDay(sprintDaysArray[i])) {
          // Only update if it's a non-working day
          data[i].ideal = 0;
        } else {
          // Stop if we hit another working day (should not happen if logic is correct)
          break;
        }
      }
    }

    return data;
  }, [activeSprint, clientNow]);

  if (!activeSprint) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
        <Info className="mr-2 h-5 w-5" />
        <span>No active sprint to display burndown chart.</span>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
        <Info className="mr-2 h-5 w-5" />
        <span>
          Not enough data to display burndown chart. (Check sprint dates, tasks,
          and points)
        </span>
      </div>
    );
  }

  const totalCommittedAndSpilloverPoints =
    (activeSprint.planning?.newTasks || []).reduce(
      (sum, task) => sum + (Number(task.storyPoints) || 0),
      0
    ) +
    (activeSprint.planning?.spilloverTasks || []).reduce(
      (sum, task) => sum + (Number(task.storyPoints) || 0),
      0
    );

  // Ensure Y-axis max is at least a reasonable number, e.g., 10, even if total points are less.
  // And handle cases where totalPoints might be 0 or NaN.
  const yAxisMaxCalculation =
    totalCommittedAndSpilloverPoints > 0
      ? Math.ceil(totalCommittedAndSpilloverPoints * 1.1)
      : 10;

  const finalYAxisMax =
    !isNaN(yAxisMaxCalculation) && isFinite(yAxisMaxCalculation)
      ? Math.max(10, yAxisMaxCalculation)
      : 10;

  return (
    <ChartContainer config={chartConfig} className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 10, left: -25, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
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
            domain={[0, finalYAxisMax]} // Use the calculated max value
          />
          <Tooltip
            content={
              <ChartTooltipContent
                indicator="line"
                labelKey="date"
                nameKey="name"
                hideLabel={false}
              />
            }
            cursor={{ strokeDasharray: '3 3', fill: 'hsl(var(--muted) / 0.3)' }}
          />
          <Legend verticalAlign="top" height={36} />
          <Line
            dataKey="ideal"
            type="monotone"
            stroke="var(--color-ideal)"
            strokeWidth={2}
            dot={false}
            connectNulls={true} // Connects line over null points (weekends for ideal line)
            name="Ideal Burndown"
          />
          <Line
            dataKey="actual"
            type="monotone"
            stroke="var(--color-actual)"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            connectNulls={false} // Do not connect nulls for actual, only plot where data exists
            name="Actual Burndown"
          />
          {clientNow &&
            activeSprint.startDate &&
            activeSprint.endDate &&
            isValid(parseISO(activeSprint.startDate)) &&
            isValid(parseISO(activeSprint.endDate)) &&
            isSameDay(clientNow, parseISO(activeSprint.startDate)) && (
              <ReferenceLine
                x={format(clientNow, 'MM/dd')}
                stroke="hsl(var(--primary))"
                strokeDasharray="3 3"
              />
            )}
          {clientNow &&
            activeSprint.startDate &&
            activeSprint.endDate &&
            isValid(parseISO(activeSprint.startDate)) &&
            isValid(parseISO(activeSprint.endDate)) &&
            isBefore(clientNow, parseISO(activeSprint.endDate)) &&
            !isSameDay(clientNow, parseISO(activeSprint.startDate)) && (
              <ReferenceLine
                x={format(clientNow, 'MM/dd')}
                stroke="hsl(var(--primary))"
                strokeDasharray="3 3"
              >
                <Legend
                  payload={[
                    {
                      value: 'Today',
                      type: 'line',
                      color: 'hsl(var(--primary))',
                    },
                  ]}
                />
              </ReferenceLine>
            )}
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
