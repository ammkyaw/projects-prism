
"use client";

import type { Task, Member } from '@/types/sprint-data';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { format, parseISO, differenceInDays, addDays, isWithinInterval, getDay, eachDayOfInterval, isValid } from 'date-fns';
import { useMemo } from 'react';
import { cn } from "@/lib/utils";

// Define a temporary type for chart data that includes the calculated endDate
interface TaskWithEndDate extends Task {
  endDate: string; // This is added just for the chart
}

interface SprintTimelineChartProps {
  tasks: TaskWithEndDate[]; // Expect tasks with the calculated endDate
  sprintStartDate?: string;
  sprintEndDate?: string;
  members: Member[]; // Kept for potential future use but not used for coloring now
}

const weekendColor = 'hsl(var(--muted) / 0.2)'; // Very light gray for weekend background
const taskBarColor = 'hsl(var(--primary))'; // Use primary color (blue) for all task bars
const defaultColor = 'hsl(var(--muted-foreground))'; // Gray for unassigned/default - maybe used elsewhere


// --- Helper Functions (Copied from planning-tab.tsx for now) ---

// Helper function to parse estimated time string (e.g., "2d", "1w 3d") into days
const parseEstimatedTimeToDays = (timeString: string | undefined): number | null => {
  if (!timeString) return null;
  timeString = timeString.trim().toLowerCase();
  let totalDays = 0;

  const parts = timeString.match(/(\d+w)?\s*(\d+d)?/);
  if (!parts || (parts[1] === undefined && parts[2] === undefined)) {
      // Try parsing just a number as days
      const simpleDays = parseInt(timeString, 10);
      if (!isNaN(simpleDays) && simpleDays >= 0) {
          return simpleDays;
      }
      return null; // No valid parts found
  }

  const weekPart = parts[1];
  const dayPart = parts[2];

  if (weekPart) {
    const weeks = parseInt(weekPart.replace('w', ''), 10);
    if (!isNaN(weeks)) {
      totalDays += weeks * 5; // Assuming 5 working days per week
    }
  }

  if (dayPart) {
    const days = parseInt(dayPart.replace('d', ''), 10);
    if (!isNaN(days)) {
      totalDays += days;
    }
  }

  // Allow just "5" or "3" to mean days
  if (totalDays === 0 && /^\d+$/.test(timeString)) {
       const simpleDays = parseInt(timeString, 10);
       if (!isNaN(simpleDays) && simpleDays >= 0) {
            return simpleDays;
       }
  }


  return totalDays > 0 ? totalDays : null;
};

// Helper function to calculate end date skipping weekends
const calculateEndDateSkippingWeekends = (startDate: Date, workingDays: number): Date => {
  let currentDate = startDate;
  let daysAdded = 0;
  let workingDaysCounted = 0;

  // If duration is 0 or less, return the start date
  if (workingDays <= 0) return startDate;

  // Loop until we have counted the required number of working days
  while (workingDaysCounted < workingDays) {
    currentDate = addDays(startDate, daysAdded);
    const dayOfWeek = getDay(currentDate); // 0=Sun, 6=Sat

    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workingDaysCounted++;
    }
    // If we haven't reached the target working days, increment daysAdded to check the next day
    // IMPORTANT: Increment daysAdded *after* checking the current day, otherwise we skip the first day.
    // But if the target is met, we don't need to check the next day.
     if (workingDaysCounted < workingDays) {
        daysAdded++;
     } else {
        // If we just counted the last working day, this currentDate is the end date.
        break;
     }
  }
  return currentDate; // The final end date
};

// --- End Helper Functions ---


export default function SprintTimelineChart({ tasks, sprintStartDate, sprintEndDate, members }: SprintTimelineChartProps) {

  const chartData = useMemo(() => {
    if (!tasks || tasks.length === 0 || !sprintStartDate || !sprintEndDate || !isValid(parseISO(sprintStartDate)) || !isValid(parseISO(sprintEndDate))) {
      return [];
    }

    const sprintStartObj = parseISO(sprintStartDate);
    const sprintEndObj = parseISO(sprintEndDate);

    return tasks
        .map((task, index) => {
            if (!task.startDate || !task.estimatedTime || !isValid(parseISO(task.startDate))) return null; // Skip tasks without valid start date or estimate

            const taskStartObj = parseISO(task.startDate!);
            const workingDays = parseEstimatedTimeToDays(task.estimatedTime);

            if (workingDays === null || workingDays <= 0) return null; // Skip tasks with invalid or zero duration

            // Calculate the actual end date skipping weekends
            const actualEndDateObj = calculateEndDateSkippingWeekends(taskStartObj, workingDays);

            // Calculate day indices relative to the sprint start
            const startDayIndex = differenceInDays(taskStartObj, sprintStartObj);
            const endDayIndex = differenceInDays(actualEndDateObj, sprintStartObj);

             // The bar should visually cover the end day.
             // Recharts Bar draws from range[0] up to (but not including) range[1] visually in intervals.
             // To make it cover the block for endDayIndex, the range end needs to be endDayIndex + 1.
            const barEndIndex = endDayIndex + 1;

            return {
                name: task.description || `Task ${task.id}`,
                taskIndex: index, // Use index for Y-axis positioning
                // range should be [start_day_index, end_day_index + 1] for correct visual span
                range: [startDayIndex, barEndIndex],
                fill: taskBarColor, // Use fixed blue color for all bars
                tooltip: `${task.description || 'Task'} (${task.status || 'N/A'}) - Est. ${task.estimatedTime || '?'} ${task.assignee ? '(' + task.assignee + ')' : '(Unassigned)'} [${format(taskStartObj, 'MM/dd')} - ${format(actualEndDateObj, 'MM/dd')}]` // Updated tooltip shows calculated end date
            };
        }).filter(item => item !== null && item.range[0] < item.range[1]); // Remove null items and invalid ranges (start must be before end)
  }, [tasks, sprintStartDate, sprintEndDate]);

  // Calculate weekend days within the sprint range
   const weekendIndices = useMemo(() => {
       if (!sprintStartDate || !sprintEndDate || !isValid(parseISO(sprintStartDate)) || !isValid(parseISO(sprintEndDate))) return [];
       const start = parseISO(sprintStartDate);
       const end = parseISO(sprintEndDate);
       const indices: number[] = [];
       try {
           eachDayOfInterval({ start, end }).forEach((date) => {
               const dayOfWeek = getDay(date); // 0 = Sunday, 6 = Saturday
               if (dayOfWeek === 0 || dayOfWeek === 6) {
                   indices.push(differenceInDays(date, start));
               }
           });
       } catch (e) {
         console.error("Error calculating weekend indices:", e); // Handle potential date errors
         return [];
       }
       return indices;
   }, [sprintStartDate, sprintEndDate]);


  if (chartData.length === 0) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">No tasks with valid start date and estimate to display.</div>;
  }

   let sprintDays = 0;
   try {
     // Get the number of calendar days in the sprint for the axis domain
     sprintDays = differenceInDays(parseISO(sprintEndDate!), parseISO(sprintStartDate!)) + 1;
   } catch (e) {
      console.error("Error calculating sprint days:", e);
      return <div className="flex items-center justify-center h-full text-destructive">Error calculating sprint duration.</div>;
   }
   const sprintDayIndices = Array.from({ length: sprintDays }, (_, i) => i); // 0 to sprintDays-1

  // Generate ticks for X-axis (e.g., every few days)
   const xTicks = sprintDayIndices.map(i => {
       try {
           const date = addDays(parseISO(sprintStartDate!), i);
           // Show tick maybe every 2 days or based on sprint length
           if (i % (sprintDays > 14 ? 2 : 1) === 0 || i === 0 || i === sprintDays -1) {
               return format(date, 'MM/dd');
           }
       } catch (e) {
          console.error("Error formatting X tick:", e);
       }
       return ''; // Return empty string for non-labeled ticks
   });


  const chartConfig = {
    value: { label: 'Duration', color: taskBarColor }, // Use the blue color
  } satisfies ChartConfig;

  return (
    <ChartContainer config={chartConfig} className="h-[250px] w-full"> {/* Adjust height as needed */}
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={chartData}
          margin={{ top: 5, right: 20, left: 100, bottom: 20 }} // Adjust margins
          barCategoryGap="20%" // Adjust gap between bars
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis
             type="number"
             // Use a dummy key here since the bar position is determined by the range
             dataKey="taskIndex" // Needs a dataKey, but not used for position
             scale="linear"
             domain={[0, sprintDays ]} // Domain from day 0 to sprintDays
             ticks={sprintDayIndices} // Ticks for each day index
             tickFormatter={(tick) => xTicks[tick] ?? ''} // Format ticks to dates
             tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
             axisLine={false}
             tickLine={true}
             interval={0} // Ensure all ticks are considered for rendering based on formatter
             allowDuplicatedCategory={false}
           />
           {/* Add ReferenceLines for Weekend Highlighting */}
           {weekendIndices.map((index) => (
               // Use ReferenceLine, representing the *start* of the weekend day block
               <ReferenceLine
                 key={`weekend-line-${index}`}
                 x={index} // Position at the start of the weekend day index
                 stroke={weekendColor} // Use very light gray for weekends
                 strokeWidth={10} // Adjust width visually - MAY NEED TUNING
                 strokeDasharray="1 0" // Make it solid, not dashed
                 ifOverflow="extendDomain" // Ensure it covers the full height
                 // Vertical segment from top to bottom of chart area
                 segment={[{ x: index, y: -1 }, { x: index, y: chartData.length + 1 }]}
               />
           ))}

          <YAxis
            dataKey="taskIndex"
            type="number"
            domain={[-0.5, chartData.length - 0.5]} // Adjust domain slightly for padding
            tickFormatter={(index) => chartData[index]?.name ?? ''} // Use task names as labels
            tick={{ fontSize: 10, width: 90, textAnchor: 'end' }} // Adjust width and anchor
            axisLine={false}
            tickLine={false}
            interval={0} // Show all ticks
            reversed={true} // Display tasks from top to bottom
            />
           <Tooltip
              cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
              content={({ payload }) => {
                 if (payload && payload.length > 0 && payload[0].payload) {
                     const data = payload[0].payload;
                     return (
                         <div className="text-xs bg-background border rounded px-2 py-1 shadow-sm max-w-xs">
                             {/* Use fixed color style from taskBarColor */}
                             <p className="font-semibold break-words" style={{ color: taskBarColor }}>{data.tooltip}</p>
                         </div>
                     );
                 }
                 return null;
              }}
             />
           <Legend content={null} /> {/* Hide default legend */}
           {/* Bar dataKey uses range [startDayIndex, endDayIndex + 1].
               The Bar component uses this to determine position and length.
               It effectively positions the bar starting at range[0] with a length of range[1] - range[0].
            */}
           <Bar dataKey="range" radius={2} barSize={10} fill={taskBarColor} />

        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

