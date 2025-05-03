

"use client";

import type { Task, Member } from '@/types/sprint-data';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { format, parseISO, differenceInDays, addDays, isWithinInterval, getDay, eachDayOfInterval, isValid } from 'date-fns';
import { useMemo } from 'react';
import { cn } from "@/lib/utils";

// Define a temporary type for chart data that includes the calculated endDate
// interface TaskWithEndDate extends Task {
//   endDate: string; // This is added just for the chart
// }
// No longer using TaskWithEndDate as chart component calculates ranges directly

interface SprintTimelineChartProps {
  tasks: Task[]; // Expect tasks with original data
  sprintStartDate?: string;
  sprintEndDate?: string;
  members: Member[];
}

const weekendColor = 'hsl(var(--muted) / 0.2)'; // Very light gray for weekend background
const taskBarColor = 'hsl(var(--primary))'; // Use primary color (blue) for all task bars

// --- Helper Functions (Moved here or imported) ---

// Helper function to parse estimated time string (e.g., "2d", "1w 3d") into days
const parseEstimatedTimeToDays = (timeString: string | undefined): number | null => {
  if (!timeString) return null;
  timeString = timeString.trim().toLowerCase();
  let totalDays = 0;

  const parts = timeString.match(/(\d+w)?\s*(\d+d)?/);
  if (!parts || (parts[1] === undefined && parts[2] === undefined)) {
      const simpleDays = parseInt(timeString, 10);
      if (!isNaN(simpleDays) && simpleDays >= 0) {
          return simpleDays;
      }
      return null;
  }

  const weekPart = parts[1];
  const dayPart = parts[2];

  if (weekPart) {
    const weeks = parseInt(weekPart.replace('w', ''), 10);
    if (!isNaN(weeks)) {
      totalDays += weeks * 5;
    }
  }

  if (dayPart) {
    const days = parseInt(dayPart.replace('d', ''), 10);
    if (!isNaN(days)) {
      totalDays += days;
    }
  }

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

  if (workingDays <= 0) return startDate;

  while (workingDaysCounted < workingDays) {
    currentDate = addDays(startDate, daysAdded);
    const dayOfWeek = getDay(currentDate);

    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workingDaysCounted++;
    }
     if (workingDaysCounted < workingDays) {
         daysAdded++;
     } else {
         break;
     }
  }
  return currentDate;
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
            // Use devEstimatedTime for the timeline block
            if (!task.startDate || !task.devEstimatedTime || !isValid(parseISO(task.startDate))) return null;

            const taskStartObj = parseISO(task.startDate!);
            const devWorkingDays = parseEstimatedTimeToDays(task.devEstimatedTime);

            if (devWorkingDays === null || devWorkingDays <= 0) return null;

            // Calculate the end date based *only* on dev time
            const devEndDateObj = calculateEndDateSkippingWeekends(taskStartObj, devWorkingDays);

            // Calculate day indices relative to the sprint start
            const startDayIndex = differenceInDays(taskStartObj, sprintStartObj);
            const endDayIndex = differenceInDays(devEndDateObj, sprintStartObj);

            // Ensure startDayIndex is not negative (task starts before sprint)
            const validStartDayIndex = Math.max(0, startDayIndex);

             // The bar should visually cover the end day.
             // Recharts Bar draws from range[0] up to (but not including) range[1] visually in intervals.
             // To make it cover the block for endDayIndex, the range end needs to be endDayIndex + 1.
            const barEndIndex = endDayIndex + 1;

             // Tooltip to show more details
             const tooltipContent = [
                `${task.description || 'Task'} (${task.status || 'N/A'})`,
                `Dev Est: ${task.devEstimatedTime || '?'}`,
                task.qaEstimatedTime ? `QA Est: ${task.qaEstimatedTime}` : '',
                task.bufferTime ? `Buffer: ${task.bufferTime}` : '',
                task.assignee ? `Assignee: ${task.assignee}` : '',
                task.reviewer ? `Reviewer: ${task.reviewer}` : '',
                `Dates: [${format(taskStartObj, 'MM/dd')} - ${format(devEndDateObj, 'MM/dd')}] (Dev)`,
            ].filter(Boolean).join(' | ');

            return {
                name: task.description || `Task ${task.id}`,
                taskIndex: index,
                // range only represents the dev duration now
                range: [validStartDayIndex, barEndIndex],
                fill: taskBarColor, // Fixed blue color for dev bar
                tooltip: tooltipContent,
            };
        }).filter(item => item !== null && item.range[0] < item.range[1]); // Remove null items and invalid ranges
  }, [tasks, sprintStartDate, sprintEndDate]);

   const weekendIndices = useMemo(() => {
       if (!sprintStartDate || !sprintEndDate || !isValid(parseISO(sprintStartDate)) || !isValid(parseISO(sprintEndDate))) return [];
       const start = parseISO(sprintStartDate);
       const end = parseISO(sprintEndDate);
       const indices: number[] = [];
       try {
           eachDayOfInterval({ start, end }).forEach((date) => {
               const dayOfWeek = getDay(date);
               if (dayOfWeek === 0 || dayOfWeek === 6) {
                   indices.push(differenceInDays(date, start));
               }
           });
       } catch (e) {
         console.error("Error calculating weekend indices:", e);
         return [];
       }
       return indices;
   }, [sprintStartDate, sprintEndDate]);


  if (chartData.length === 0) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">No tasks with valid start date and dev estimate to display.</div>;
  }

   let sprintDays = 0;
   try {
     sprintDays = differenceInDays(parseISO(sprintEndDate!), parseISO(sprintStartDate!)) + 1;
   } catch (e) {
      console.error("Error calculating sprint days:", e);
      return <div className="flex items-center justify-center h-full text-destructive">Error calculating sprint duration.</div>;
   }
   const sprintDayIndices = Array.from({ length: sprintDays }, (_, i) => i);

   const xTicks = sprintDayIndices.map(i => {
       try {
           const date = addDays(parseISO(sprintStartDate!), i);
           if (i % (sprintDays > 14 ? 2 : 1) === 0 || i === 0 || i === sprintDays -1) {
               return format(date, 'MM/dd');
           }
       } catch (e) {
          console.error("Error formatting X tick:", e);
       }
       return '';
   });


  const chartConfig = {
    value: { label: 'Duration', color: taskBarColor },
  } satisfies ChartConfig;

  return (
    <ChartContainer config={chartConfig} className="h-[250px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={chartData}
          margin={{ top: 5, right: 20, left: 100, bottom: 20 }}
          barCategoryGap="20%"
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis
             type="number"
             dataKey="taskIndex" // Still needs a key, but not used for x-position
             scale="linear"
             domain={[0, sprintDays ]}
             ticks={sprintDayIndices}
             tickFormatter={(tick) => xTicks[tick] ?? ''}
             tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
             axisLine={false}
             tickLine={true}
             interval={0}
             allowDuplicatedCategory={false}
           />
           {weekendIndices.map((index) => (
               <ReferenceLine
                 key={`weekend-line-${index}`}
                 x={index}
                 stroke={weekendColor}
                 strokeWidth={10}
                 strokeDasharray="1 0"
                 ifOverflow="extendDomain"
                 // Segment needs to cover the whole day block visually
                 // Using index to index+1 covers the area *before* the next day starts
                 segment={[{ x: index, y: -1 }, { x: index, y: chartData.length + 1 }]}
                 shape={(props) => {
                    // Custom shape to render a rectangle background for the weekend day
                    const { x, y, width, height, viewBox } = props;
                     // Calculate the actual width of one day block on the chart
                    const dayWidth = viewBox && viewBox.width && sprintDays > 0 ? viewBox.width / sprintDays : 10; // Default width if calculation fails
                    return (
                      <rect
                        x={x} // Start at the calculated x position for the day index
                        y={viewBox?.y ?? 0} // Start from the top of the chart area
                        width={dayWidth} // Width representing one day
                        height={viewBox?.height ?? 200} // Full height of the chart area
                        fill={weekendColor}
                      />
                    );
                 }}
               />
           ))}

          <YAxis
            dataKey="taskIndex"
            type="number"
            domain={[-0.5, chartData.length - 0.5]}
            tickFormatter={(index) => chartData[index]?.name ?? ''}
            tick={{ fontSize: 10, width: 90, textAnchor: 'end' }}
            axisLine={false}
            tickLine={false}
            interval={0}
            reversed={true}
            />
           <Tooltip
              cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
              content={({ payload }) => {
                 if (payload && payload.length > 0 && payload[0].payload) {
                     const data = payload[0].payload;
                     return (
                         <div className="text-xs bg-background border rounded px-2 py-1 shadow-sm max-w-md"> {/* Increased max-width */}
                             <p className="font-semibold break-words" style={{ color: taskBarColor }}>{data.tooltip}</p>
                         </div>
                     );
                 }
                 return null;
              }}
             />
           <Legend content={null} />
           {/* Bar represents only the Dev Estimated Time */}
           <Bar dataKey="range" radius={2} barSize={10} fill={taskBarColor} />

        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
