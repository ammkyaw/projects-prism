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
    
    const pointsToBurnPerWorkingDay = totalSprintWorkingDays > 0 ? committedPoints / totalSprintWorkingDays : 0;

    let nthWorkingDayCounter = 0; 

    return sprintDaysArray.map((currentDay) => {
      let idealForThisDay;

      if (isWorkingDay(currentDay)) {
        nthWorkingDayCounter++; 
        idealForThisDay = Math.max(0, committedPoints - (nthWorkingDayCounter * pointsToBurnPerWorkingDay));
      } else {
        if (nthWorkingDayCounter === 0) { 
          idealForThisDay = committedPoints;
        } else {
          idealForThisDay = Math.max(0, committedPoints - (nthWorkingDayCounter * pointsToBurnPerWorkingDay));
        }
      }

      const actualRemaining = allTasks.reduce((sum, task) => {
        const taskPoints = Number(task.storyPoints) || 0;
        if (task.status !== 'Done') {
          return sum + taskPoints;
        }
        if (task.completedDate && isValid(parseISO(task.completedDate))) {
          if (isBefore(currentDay, parseISO(task.completedDate))) { 
            return sum + taskPoints;
          }
        } else { 
            return sum + taskPoints;
        }
        return sum;
      }, 0);
      
      const actualForToday = isSameDay(currentDay, sprintStart) ? committedPoints : actualRemaining;


      return {
        date: format(currentDay, 'MM/dd'),
        ideal: parseFloat(idealForThisDay.toFixed(2)),
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
            domain={[0, yAxisMax]} 
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
