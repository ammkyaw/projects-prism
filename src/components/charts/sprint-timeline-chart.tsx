

"use client";

import type { Task, Member } from '@/types/sprint-data';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { format, parseISO, differenceInDays, addDays, isWithinInterval, getDay, eachDayOfInterval, isValid } from 'date-fns';
import { useMemo } from 'react';
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
  let daysAdded = 0;
  let workingDaysCounted = 0;

  if (workingDays <= 0) return startDate;

   // Adjust start date if it falls on a weekend
   while (getDay(currentDate) === 0 || getDay(currentDate) === 6) {
     currentDate = addDays(currentDate, 1);
   }

  while (workingDaysCounted < workingDays) {
    const currentDayOfWeek = getDay(currentDate);
    if (currentDayOfWeek !== 0 && currentDayOfWeek !== 6) {
      workingDaysCounted++;
    }
    if (workingDaysCounted < workingDays) {
        currentDate = addDays(currentDate, 1);
        while (getDay(currentDate) === 0 || getDay(currentDate) === 6) {
           currentDate = addDays(currentDate, 1);
        }
    } else {
        break;
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

  const chartData = useMemo(() => {
    if (!tasks || tasks.length === 0 || !sprintStartDate || !sprintEndDate || !isValid(parseISO(sprintStartDate)) || !isValid(parseISO(sprintEndDate))) {
      return [];
    }

    const sprintStartObj = parseISO(sprintStartDate);
    const sprintEndObj = parseISO(sprintEndDate);

    return tasks
        .map((task, index) => {
            if (!task.startDate || !isValid(parseISO(task.startDate))) return null;

            const taskStartObj = parseISO(task.startDate!);
            let currentEndDateObj = taskStartObj;

            // --- Development Phase ---
            const devWorkingDays = parseEstimatedTimeToDays(task.devEstimatedTime);
            let devStartDayIndex = -1;
            let devEndDayIndex = -1;
            if (devWorkingDays !== null && devWorkingDays > 0) {
                 const devStartDateObj = taskStartObj; // Dev starts on task start date
                 const devEndDateObj = calculateEndDateSkippingWeekends(devStartDateObj, devWorkingDays);
                 devStartDayIndex = Math.max(0, differenceInDays(devStartDateObj, sprintStartObj)); // Ensure non-negative
                 devEndDayIndex = differenceInDays(devEndDateObj, sprintStartObj);
                 currentEndDateObj = devEndDateObj; // Update the end date for the next phase
            }

            // --- QA Phase ---
            const qaWorkingDays = parseEstimatedTimeToDays(task.qaEstimatedTime);
            let qaStartDayIndex = -1;
            let qaEndDayIndex = -1;
            if (qaWorkingDays !== null && qaWorkingDays > 0 && devEndDayIndex >= 0) {
                const qaStartDateObj = getNextWorkingDay(currentEndDateObj); // QA starts the next working day after dev ends
                const qaEndDateObj = calculateEndDateSkippingWeekends(qaStartDateObj, qaWorkingDays);
                qaStartDayIndex = Math.max(0, differenceInDays(qaStartDateObj, sprintStartObj)); // Ensure non-negative
                qaEndDayIndex = differenceInDays(qaEndDateObj, sprintStartObj);
                currentEndDateObj = qaEndDateObj; // Update the end date for the next phase
            }

            // --- Buffer Phase ---
            const bufferWorkingDays = parseEstimatedTimeToDays(task.bufferTime);
            let bufferStartDayIndex = -1;
            let bufferEndDayIndex = -1;
            if (bufferWorkingDays !== null && bufferWorkingDays > 0 && (qaEndDayIndex >= 0 || devEndDayIndex >= 0)) { // Buffer starts after QA or Dev if QA doesn't exist
                const bufferStartDateObj = getNextWorkingDay(currentEndDateObj); // Buffer starts the next working day after the last phase
                const bufferEndDateObj = calculateEndDateSkippingWeekends(bufferStartDateObj, bufferWorkingDays);
                bufferStartDayIndex = Math.max(0, differenceInDays(bufferStartDateObj, sprintStartObj)); // Ensure non-negative
                bufferEndDayIndex = differenceInDays(bufferEndDateObj, sprintStartObj);
            }

             // Tooltip to show more details
             const tooltipContent = [
                `${task.description || 'Task'} (${task.status || 'N/A'})`,
                `Dev Est: ${task.devEstimatedTime || '?'} [${devStartDayIndex >= 0 ? format(calculateEndDateSkippingWeekends(taskStartObj, 0), 'MM/dd') + ' - ' + format(calculateEndDateSkippingWeekends(taskStartObj, devWorkingDays ?? 0), 'MM/dd') : 'N/A'}]`,
                `QA Est: ${task.qaEstimatedTime || '?'} [${qaStartDayIndex >= 0 ? format(getNextWorkingDay(calculateEndDateSkippingWeekends(taskStartObj, devWorkingDays ?? 0)), 'MM/dd') + ' - ' + format(calculateEndDateSkippingWeekends(getNextWorkingDay(calculateEndDateSkippingWeekends(taskStartObj, devWorkingDays ?? 0)), qaWorkingDays ?? 0), 'MM/dd') : 'N/A'}]`,
                `Buffer: ${task.bufferTime || '?'} [${bufferStartDayIndex >= 0 ? format(getNextWorkingDay(calculateEndDateSkippingWeekends(getNextWorkingDay(calculateEndDateSkippingWeekends(taskStartObj, devWorkingDays ?? 0)), qaWorkingDays ?? 0)), 'MM/dd') + ' - ' + format(calculateEndDateSkippingWeekends(getNextWorkingDay(calculateEndDateSkippingWeekends(getNextWorkingDay(calculateEndDateSkippingWeekends(taskStartObj, devWorkingDays ?? 0)), qaWorkingDays ?? 0)), bufferWorkingDays ?? 0), 'MM/dd') : 'N/A'}]`,
                task.assignee ? `Assignee: ${task.assignee}` : '',
                task.reviewer ? `Reviewer: ${task.reviewer}` : '',
            ].filter(Boolean).join(' | ');


            const result = {
                name: task.description || `Task ${task.id}`,
                taskIndex: index,
                // range is for the bar component, needs start and end+1
                devRange: devStartDayIndex >= 0 && devEndDayIndex >= devStartDayIndex ? [devStartDayIndex, devEndDayIndex + 1] : undefined,
                qaRange: qaStartDayIndex >= 0 && qaEndDayIndex >= qaStartDayIndex ? [qaStartDayIndex, qaEndDayIndex + 1] : undefined,
                bufferRange: bufferStartDayIndex >= 0 && bufferEndDayIndex >= bufferStartDayIndex ? [bufferStartDayIndex, bufferEndDayIndex + 1] : undefined,
                tooltip: tooltipContent,
            };
            // Only include if at least dev range is valid
            return result.devRange ? result : null;
        }).filter(item => item !== null);
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
           if (i % (sprintDays > 14 ? 2 : 1) === 0 || i === 0 || i === sprintDays -1) {
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
          stackOffset="none" // Ensure bars are side-by-side if overlapping conceptually, though they shouldn't with calculation logic
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
                 segment={[{ x: index, y: -1 }, { x: index, y: chartData.length + 1 }]}
                 shape={(props) => {
                    const { viewBox } = props;
                    const dayWidth = viewBox && viewBox.width && sprintDays > 0 ? viewBox.width / sprintDays : 10; // Default width if calculation fails
                    return (
                      <rect
                        x={props.x}
                        y={viewBox?.y ?? 0}
                        width={dayWidth}
                        height={viewBox?.height ?? 200}
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
                         <div className="text-xs bg-background border rounded px-2 py-1 shadow-sm max-w-md">
                             <p className="font-semibold break-words">{data.tooltip}</p>
                         </div>
                     );
                 }
                 return null;
              }}
             />
           <Legend content={null} />
           {/* Render bars for each phase */}
           <Bar dataKey="devRange" radius={2} barSize={10} fill={chartConfig.dev.color} name="Development" stackId="task" />
           <Bar dataKey="qaRange" radius={2} barSize={10} fill={chartConfig.qa.color} name="QA" stackId="task" />
           <Bar dataKey="bufferRange" radius={2} barSize={10} fill={chartConfig.buffer.color} name="Buffer" stackId="task" />

        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
