"use client";

import type { Sprint, Task } from '@/types/sprint-data';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { useMemo } from 'react';
import { format, parseISO, isValid, eachDayOfInterval, differenceInDays, getDay, isBefore, isSameDay } from 'date-fns';
import { Info } from 'lucide-react';

interface BurndownChartProps {
  activeSprint: Sprint | null | undefined;
}

const chartConfig = {
  ideal: {
    label: "Ideal",
    color: "hsl(var(--chart-2))", // Muted color for ideal line
  },
  actual: {
    label: "Actual",
    color: "hsl(var(--chart-1))", // Primary color for actual line
  },
} satisfies ChartConfig;

// Helper to check if a day is a working day (Mon-Fri)
const isWorkingDay = (date: Date): boolean => {
  const day = getDay(date);
  return day >= 1 && day <= 5; // 1 (Mon) to 5 (Fri)
};

export default function BurndownChart({ activeSprint }: BurndownChartProps) {
  const chartData = useMemo(() => {
    if (!activeSprint || !activeSprint.startDate || !activeSprint.endDate || !isValid(parseISO(activeSprint.startDate)) || !isValid(parseISO(activeSprint.endDate))) {
      return [];
    }

    const sprintStart = parseISO(activeSprint.startDate);
    const sprintEnd = parseISO(activeSprint.endDate);
    const committedPoints = activeSprint.committedPoints || 0;
    const allTasks = [...(activeSprint.planning?.newTasks || []), ...(activeSprint.planning?.spilloverTasks || [])];

    const sprintDaysArray = eachDayOfInterval({ start: sprintStart, end: sprintEnd });

    // Calculate total working days in the sprint
    const totalSprintWorkingDays = sprintDaysArray.filter(isWorkingDay).length;
    
    // Avoid division by zero if there are no working days (e.g. very short sprint or all weekend)
    const pointsToBurnPerWorkingDay = totalSprintWorkingDays > 0 ? committedPoints / totalSprintWorkingDays : 0;

    let idealRemaining = committedPoints;
    let workingDaysElapsed = 0;

    return sprintDaysArray.map((currentDay, index) => {
      if (isWorkingDay(currentDay)) {
        // For the first working day, ideal remaining is committed points
        // For subsequent working days, burn points.
        // Ensure ideal line doesn't start burning before the first working day of the sprint or after the sprint ends.
        if (index > 0 || isSameDay(currentDay, sprintStart)) { // Start burning from the first day
             idealRemaining = Math.max(0, committedPoints - (workingDaysElapsed * pointsToBurnPerWorkingDay));
        }
        if(!isBefore(currentDay, sprintStart)) { // Only increment if currentDay is not before sprintStart
            workingDaysElapsed++;
        }
      }
      // If it's a weekend, ideal remaining stays the same as the previous working day,
      // unless it's the very first day of the sprint and it's a weekend, then it's committedPoints.
      else if (index === 0) {
        idealRemaining = committedPoints;
      }


      const actualRemaining = allTasks.reduce((sum, task) => {
        const taskPoints = Number(task.storyPoints) || 0;
        if (task.status !== 'Done') {
          return sum + taskPoints;
        }
        if (task.completedDate && isValid(parseISO(task.completedDate))) {
          if (isBefore(currentDay, parseISO(task.completedDate))) { // If currentDay is before task completion day
            return sum + taskPoints;
          }
        } else { // If task is Done but no completedDate, assume it's still remaining for burndown calc
            return sum + taskPoints;
        }
        return sum;
      }, 0);
      
      // Special handling for the first day of the sprint for the actual line
      // On the first day, actual remaining points are always the total committed points
      // unless tasks were somehow completed *before* the sprint officially started (unlikely scenario).
      const actualForToday = index === 0 ? committedPoints : actualRemaining;


      return {
        date: format(currentDay, 'MM/dd'),
        ideal: parseFloat(idealRemaining.toFixed(2)),
        actual: actualForToday,
      };
    });
  }, [activeSprint]);

  if (!activeSprint) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <Info className="mr-2 h-5 w-5" />
        <span>No active sprint to display burndown.</span>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <Info className="mr-2 h-5 w-5" />
        <span>Not enough data for burndown chart.</span>
        <span className="text-xs">(Ensure sprint has start/end dates and committed points)</span>
      </div>
    );
  }
  
  const yAxisMax = activeSprint.committedPoints > 0 ? activeSprint.committedPoints + Math.ceil(activeSprint.committedPoints * 0.1) : 10;


  return (
    <ChartContainer config={chartConfig} className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
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
            domain={[0, yAxisMax]} // Set dynamic Y-axis domain
          />
          <Tooltip content={<ChartTooltipContent hideLabel />} />
          <Legend verticalAlign="top" height={36} />
          <Line type="monotone" dataKey="ideal" stroke="var(--color-ideal)" strokeWidth={2} dot={false} name="Ideal" />
          <Line type="monotone" dataKey="actual" stroke="var(--color-actual)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} name="Actual" />
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}