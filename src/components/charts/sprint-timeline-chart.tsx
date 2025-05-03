"use client";

import type { Task, Member } from '@/types/sprint-data';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { format, parseISO, differenceInDays, addDays, isWithinInterval, getDay, eachDayOfInterval, isValid } from 'date-fns';
import { useState, useEffect, useMemo } from 'react';
import { cn } from "@/lib/utils";

interface SprintTimelineChartProps {
  tasks: Task[]; // Expect tasks with original data
  sprintStartDate?: string;
  sprintEndDate?: string;
  members: Member[];
}

const weekendColor = 'hsl(var(--muted) / 0.2)'; // Very light gray for weekend background
const devTaskBarColor = 'hsl(var(--primary))'; // Use primary color (blue) for dev task bars
const qaTaskBarColor = 'hsl(var(--accent))'; // Use accent color (gold/pink) for QA task bars
const bufferTaskBarColor = 'hsl(var(--muted))'; // Use muted color (gray) for buffer bars

// --- Helper Functions ---

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

const calculateEndDateSkippingWeekends = (startDate: Date, workingDays: number): Date => {
  let currentDate = startDate;
  let workingDaysCounted = 0;

   // If 0 working days, the end date is the start date itself (or the next working day if start is weekend)
   if (workingDays <= 0) {
       while (getDay(currentDate) === 0 || getDay(currentDate) === 6) {
           currentDate = addDays(currentDate, 1);
       }
       return currentDate;
   }

   // Adjust start date if it falls on a weekend BEFORE starting the count
   while (getDay(currentDate) === 0 || getDay(currentDate) === 6) {
     currentDate = addDays(currentDate, 1);
   }

   // Loop until the required number of working days are counted
   while (workingDaysCounted < workingDays) {
      const dayOfWeek = getDay(currentDate);
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          workingDaysCounted++;
      }

      // Only advance the date if we haven't reached the target number of working days yet
      if (workingDaysCounted < workingDays) {
          currentDate = addDays(currentDate, 1);
          // Skip subsequent weekends while advancing
          while (getDay(currentDate) === 0 || getDay(currentDate) === 6) {
              currentDate = addDays(currentDate, 1);
          }
      }
   }

  return currentDate;
};


// Helper to get the next working day, skipping weekends
const getNextWorkingDay = (date: Date): Date => {
   let nextDay = addDays(date, 1);
   while (getDay(nextDay) === 0 || getDay(nextDay) === 6) {
     nextDay = addDays(nextDay, 1);
   }
   return nextDay;
};

// --- End Helper Functions ---


export default function SprintTimelineChart({ tasks, sprintStartDate, sprintEndDate, members }: SprintTimelineChartProps) {
   const [clientNow, setClientNow] = useState<Date | null>(null); // For client-side date comparison

   // Get current date on client mount
   useEffect(() => {
     setClientNow(new Date());
   }, []);

  const chartData = useMemo(() => {
    if (!tasks || tasks.length === 0 || !sprintStartDate || !sprintEndDate || !isValid(parseISO(sprintStartDate)) || !isValid(parseISO(sprintEndDate))) {
       console.log("Timeline Pre-check failed:", { tasks, sprintStartDate, sprintEndDate });
      return [];
    }

    const sprintStartObj = parseISO(sprintStartDate);
    const sprintEndObj = parseISO(sprintEndDate);
    const sprintLengthDays = differenceInDays(sprintEndObj, sprintStartObj); // Total calendar days

    console.log("Processing tasks for timeline:", tasks);

    const processedTasks = tasks
        .map((task, index) => {
             console.log(`Task ${index + 1} (${task.description}):`, task);
            if (!task.startDate || !isValid(parseISO(task.startDate))) {
                console.warn(`Task ${index + 1}: Invalid or missing start date.`);
                return null;
            }

            const taskStartObj = parseISO(task.startDate!);
            let currentEndDateObj = taskStartObj; // Tracks the end date of the last phase

            // --- Development Phase ---
            const devWorkingDays = parseEstimatedTimeToDays(task.devEstimatedTime);
            console.log(`Task ${index + 1}: Dev days parsed: ${devWorkingDays}`);
            let devStartDateObj = taskStartObj;
            let devEndDateObj = taskStartObj;
            let devStartDayIndex = -1;
            let devEndDayIndex = -1;

            if (devWorkingDays !== null && devWorkingDays >= 0) { // Allow 0 days
                 devStartDateObj = taskStartObj; // Use task's start date for dev
                 // Adjust start date if it falls on a weekend
                 while (getDay(devStartDateObj) === 0 || getDay(devStartDateObj) === 6) {
                   devStartDateObj = addDays(devStartDateObj, 1);
                 }
                 devEndDateObj = calculateEndDateSkippingWeekends(devStartDateObj, devWorkingDays);

                 devStartDayIndex = differenceInDays(devStartDateObj, sprintStartObj);
                 devEndDayIndex = differenceInDays(devEndDateObj, sprintStartObj);

                 // Clamp indices to be within the sprint boundaries
                 devStartDayIndex = Math.max(0, devStartDayIndex);
                 devEndDayIndex = Math.min(sprintLengthDays, devEndDayIndex); // End index should be within sprint days

                 currentEndDateObj = devEndDateObj; // Update the end date for the next phase
                 console.log(`Task ${index + 1}: Dev Phase - Start: ${format(devStartDateObj, 'yyyy-MM-dd')}, End: ${format(devEndDateObj, 'yyyy-MM-dd')}, Indices: [${devStartDayIndex}, ${devEndDayIndex}]`);
            } else {
                console.warn(`Task ${index + 1}: Invalid Dev estimate.`);
            }


            // --- QA Phase ---
            const qaWorkingDays = parseEstimatedTimeToDays(task.qaEstimatedTime);
            console.log(`Task ${index + 1}: QA days parsed: ${qaWorkingDays}`);
            let qaStartDateObj = currentEndDateObj;
            let qaEndDateObj = currentEndDateObj;
            let qaStartDayIndex = -1;
            let qaEndDayIndex = -1;

             if (qaWorkingDays !== null && qaWorkingDays >= 0 && devEndDayIndex >= -1) { // Allow QA even if Dev is 0 days, start immediately after Dev end (or task start if dev was 0)
                 qaStartDateObj = getNextWorkingDay(currentEndDateObj); // QA starts the next working day
                 qaEndDateObj = calculateEndDateSkippingWeekends(qaStartDateObj, qaWorkingDays);

                 qaStartDayIndex = differenceInDays(qaStartDateObj, sprintStartObj);
                 qaEndDayIndex = differenceInDays(qaEndDateObj, sprintStartObj);

                  // Clamp indices
                 qaStartDayIndex = Math.max(0, qaStartDayIndex);
                 qaEndDayIndex = Math.min(sprintLengthDays, qaEndDayIndex);

                 currentEndDateObj = qaEndDateObj; // Update the end date for the next phase
                 console.log(`Task ${index + 1}: QA Phase - Start: ${format(qaStartDateObj, 'yyyy-MM-dd')}, End: ${format(qaEndDateObj, 'yyyy-MM-dd')}, Indices: [${qaStartDayIndex}, ${qaEndDayIndex}]`);
             } else {
                 console.warn(`Task ${index + 1}: Invalid QA estimate or Dev phase missing/invalid.`);
             }


            // --- Buffer Phase ---
            const bufferWorkingDays = parseEstimatedTimeToDays(task.bufferTime);
            console.log(`Task ${index + 1}: Buffer days parsed: ${bufferWorkingDays}`);
            let bufferStartDateObj = currentEndDateObj;
            let bufferEndDateObj = currentEndDateObj;
            let bufferStartDayIndex = -1;
            let bufferEndDayIndex = -1;

            if (bufferWorkingDays !== null && bufferWorkingDays >= 0 && (qaEndDayIndex >= -1 || devEndDayIndex >= -1)) { // Buffer starts after QA or Dev if QA doesn't exist
                bufferStartDateObj = getNextWorkingDay(currentEndDateObj); // Buffer starts the next working day
                bufferEndDateObj = calculateEndDateSkippingWeekends(bufferStartDateObj, bufferWorkingDays);

                bufferStartDayIndex = differenceInDays(bufferStartDateObj, sprintStartObj);
                bufferEndDayIndex = differenceInDays(bufferEndDateObj, sprintStartObj);

                // Clamp indices
                bufferStartDayIndex = Math.max(0, bufferStartDayIndex);
                bufferEndDayIndex = Math.min(sprintLengthDays, bufferEndDayIndex);

                console.log(`Task ${index + 1}: Buffer Phase - Start: ${format(bufferStartDateObj, 'yyyy-MM-dd')}, End: ${format(bufferEndDateObj, 'yyyy-MM-dd')}, Indices: [${bufferStartDayIndex}, ${bufferEndDayIndex}]`);
            } else {
                console.warn(`Task ${index + 1}: Invalid Buffer estimate or preceding phase missing/invalid.`);
            }


             // Tooltip to show more details
             const tooltipContent = [
                 `${task.description || 'Task'} (${task.status || 'N/A'})`,
                 `Dev: ${task.devEstimatedTime || '?'} [${devStartDayIndex >= 0 ? format(devStartDateObj, 'MM/dd') + ' - ' + format(devEndDateObj, 'MM/dd') : 'N/A'}]`,
                 `QA: ${task.qaEstimatedTime || '?'} [${qaStartDayIndex >= 0 ? format(qaStartDateObj, 'MM/dd') + ' - ' + format(qaEndDateObj, 'MM/dd') : 'N/A'}]`,
                 `Buffer: ${task.bufferTime || '?'} [${bufferStartDayIndex >= 0 ? format(bufferStartDateObj, 'MM/dd') + ' - ' + format(bufferEndDateObj, 'MM/dd') : 'N/A'}]`,
                 task.assignee ? `Assignee: ${task.assignee}` : '',
                 task.reviewer ? `Reviewer: ${task.reviewer}` : '',
             ].filter(Boolean).join(' | ');


            const result = {
                name: task.description || `Task ${task.id}`,
                taskIndex: index,
                // range is for the bar component, needs start and end+1
                // Ensure indices are valid and end >= start before creating range
                devRange: devStartDayIndex >= 0 && devEndDayIndex >= devStartDayIndex ? [devStartDayIndex, devEndDayIndex + 1] : undefined,
                qaRange: qaStartDayIndex >= 0 && qaEndDayIndex >= qaStartDayIndex ? [qaStartDayIndex, qaEndDayIndex + 1] : undefined,
                bufferRange: bufferStartDayIndex >= 0 && bufferEndDayIndex >= bufferStartDayIndex ? [bufferStartDayIndex, bufferEndDayIndex + 1] : undefined,
                tooltip: tooltipContent,
            };
             console.log(`Task ${index + 1}: Final Result`, result);
             // Include if *any* range is valid
             return result.devRange || result.qaRange || result.bufferRange ? result : null;
        }).filter(item => item !== null);

      console.log("Final Chart Data:", processedTasks);
      return processedTasks as any[]; // Cast to any[] because TS struggles with the filtering type inference

  }, [tasks, sprintStartDate, sprintEndDate, clientNow]); // Add clientNow dependency

   const weekendIndices = useMemo(() => {
       if (!sprintStartDate || !sprintEndDate || !isValid(parseISO(sprintStartDate)) || !isValid(parseISO(sprintEndDate))) return [];
       const start = parseISO(sprintStartDate);
       const end = parseISO(sprintEndDate);
       const indices: number[] = [];
       try {
           eachDayOfInterval({ start, end }).forEach((date) => {
               const dayOfWeek = getDay(date);
               if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday is 0, Saturday is 6
                   indices.push(differenceInDays(date, start));
               }
           });
       } catch (e) {
         console.error("Error calculating weekend indices:", e);
         return [];
       }
       return indices;
   }, [sprintStartDate, sprintEndDate]);


  if (!clientNow) {
     return <div className="flex items-center justify-center h-full text-muted-foreground">Loading chart...</div>;
  }

  if (chartData.length === 0) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">No tasks with valid start date and estimates to display.</div>;
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
           // Show tick every day for short sprints, every other for longer
           if (sprintDays <= 14 || i % 2 === 0 || i === 0 || i === sprintDays -1) {
               return format(date, 'MM/dd');
           }
       } catch (e) {
          console.error("Error formatting X tick:", e);
       }
       return '';
   });


  const chartConfig = {
    dev: { label: 'Development', color: devTaskBarColor },
    qa: { label: 'QA', color: qaTaskBarColor },
    buffer: { label: 'Buffer', color: bufferTaskBarColor },
  } satisfies ChartConfig;

  return (
    <ChartContainer config={chartConfig} className="h-[250px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={chartData}
          margin={{ top: 5, right: 20, left: 100, bottom: 20 }}
          barCategoryGap="30%" // Adjust gap between tasks
          barGap={2} // Adjust gap between bars within the same task
          stackOffset="none" // Ensure bars are side-by-side if overlapping conceptually
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis
             type="number"
             dataKey="taskIndex" // Not used for positioning, just reference
             scale="linear"
             domain={[0, sprintDays ]} // Domain is 0 to total calendar days
             ticks={sprintDayIndices} // Ticks for each day index
             tickFormatter={(tick) => xTicks[tick] ?? ''}
             tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
             axisLine={false}
             tickLine={true}
             interval={0} // Show all calculated ticks
             allowDuplicatedCategory={true} // Allow sparse ticks
           />
           {/* Weekend Reference Areas */}
           {weekendIndices.map((index) => (
               <ReferenceLine
                 key={`weekend-rect-${index}`}
                 x={index} // Position at the start of the weekend day index
                 stroke="transparent" // Line itself is invisible
                 ifOverflow="extendDomain"
                 label={(props) => { // Use label to render the rect background
                     const { viewBox } = props;
                     const dayWidth = viewBox && viewBox.width && sprintDays > 0 ? viewBox.width / sprintDays : 10; // Approx width
                     return (
                       <rect
                         x={props.viewBox.x} // Use the calculated x position from ReferenceLine
                         y={viewBox?.y ?? 0}
                         width={dayWidth} // Width covers one day index
                         height={viewBox?.height ?? 200}
                         fill={weekendColor} // Use the specific weekend color
                       />
                     );
                 }}
               />
           ))}

          <YAxis
            dataKey="taskIndex" // Use the index of the task in the chartData array
            type="number" // Treat Y axis as categorical based on index
            domain={[-0.5, chartData.length - 0.5]} // Domain covers indices
            tickFormatter={(index) => chartData[index]?.name ?? ''} // Format tick using task name
            tick={{ fontSize: 10, width: 90, textAnchor: 'end' }}
            axisLine={false}
            tickLine={false}
            interval={0} // Show tick for every task
            reversed={true} // Display tasks from top to bottom
            />
           <Tooltip
              cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
              content={({ payload }) => {
                 // Custom tooltip content to show the detailed string
                 if (payload && payload.length > 0 && payload[0].payload) {
                     const data = payload[0].payload;
                     return (
                         <div className="text-xs bg-background border rounded px-2 py-1 shadow-sm max-w-md">
                             <p className="font-semibold break-words">{data.tooltip}</p>
                         </div>
                     );
                 }
                 return null;
              }}
             />
           <Legend content={null} /> {/* Hide default legend */}
           {/* Render bars for each phase. `stackId` ensures they are grouped per task but `stackOffset="none"` places them based on their range */}
           <Bar dataKey="devRange" radius={2} barSize={10} fill={chartConfig.dev.color} name="Development" stackId="task" />
           <Bar dataKey="qaRange" radius={2} barSize={10} fill={chartConfig.qa.color} name="QA" stackId="task" />
           <Bar dataKey="bufferRange" radius={2} barSize={10} fill={chartConfig.buffer.color} name="Buffer" stackId="task" />

        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
