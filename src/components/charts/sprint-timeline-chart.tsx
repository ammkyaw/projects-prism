

"use client";

import type { Task, Member, HolidayCalendar, PublicHoliday } from '@/types/sprint-data'; // Added HolidayCalendar, PublicHoliday
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { Tooltip as UITooltip, TooltipContent as UITooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; // Renamed import to avoid clash
import { format, parseISO, differenceInDays, addDays, isWithinInterval, getDay, eachDayOfInterval, isValid, isSameDay } from 'date-fns';
import { useState, useEffect, useMemo } from 'react';
import { cn } from "@/lib/utils";

interface SprintTimelineChartProps {
  tasks: Task[];
  sprintStartDate?: string;
  sprintEndDate?: string;
  members: Member[];
  holidayCalendars: HolidayCalendar[]; // Add holiday calendars prop
}

const weekendColor = 'hsl(var(--muted) / 0.2)'; // Very light gray for weekend background
const holidayColor = 'hsl(var(--destructive) / 0.15)'; // Light red for holiday background
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

  return totalDays > 0 ? totalDays : (timeString === '0' || timeString === '0d' ? 0 : null); // Allow 0 explicitly
};

// Check if a date is a weekend or a public holiday for a specific member
const isNonWorkingDay = (date: Date, memberHolidays: Set<string>): boolean => {
  const dayOfWeek = getDay(date);
  if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday or Saturday
    return true;
  }
  const dateString = format(date, 'yyyy-MM-dd');
  return memberHolidays.has(dateString);
};

// Calculate end date skipping weekends AND assigned public holidays
const calculateEndDateSkippingNonWorkingDays = (startDate: Date, workingDays: number, memberHolidays: Set<string>): Date => {
  let currentDate = startDate;
  let workingDaysCounted = 0;

   // Adjust start date if it falls on a non-working day BEFORE starting the count
   while (isNonWorkingDay(currentDate, memberHolidays)) {
       currentDate = addDays(currentDate, 1);
   }

   // If 0 working days, the end date is the adjusted start date
   if (workingDays <= 0) {
       return currentDate;
   }

   // Loop until the required number of working days are counted
   // Need to count the start day itself if it's a working day
   while (workingDaysCounted < workingDays) {
        if (!isNonWorkingDay(currentDate, memberHolidays)) {
            workingDaysCounted++;
        }

        // Only advance the date if we haven't reached the target number of working days yet
        if (workingDaysCounted < workingDays) {
             currentDate = addDays(currentDate, 1);
             // Skip subsequent non-working days while advancing
             while (isNonWorkingDay(currentDate, memberHolidays)) {
                 currentDate = addDays(currentDate, 1);
             }
        }
   }

  return currentDate;
};


// Helper to get the next working day, skipping weekends and holidays
const getNextWorkingDay = (date: Date, memberHolidays: Set<string>): Date => {
   let nextDay = addDays(date, 1);
   while (isNonWorkingDay(nextDay, memberHolidays)) {
     nextDay = addDays(nextDay, 1);
   }
   return nextDay;
};

// --- End Helper Functions ---


export default function SprintTimelineChart({ tasks, sprintStartDate, sprintEndDate, members, holidayCalendars }: SprintTimelineChartProps) {
   const [clientNow, setClientNow] = useState<Date | null>(null);

   useEffect(() => {
     setClientNow(new Date());
   }, []);

   // Pre-compute holiday sets for each member
   const memberHolidayMap = useMemo(() => {
       const map = new Map<string, Set<string>>(); // Map member name to set of holiday date strings
       members.forEach(member => {
           const calendarId = member.holidayCalendarId;
           const calendar = holidayCalendars.find(cal => cal.id === calendarId);
           const holidays = new Set<string>();
           if (calendar) {
               calendar.holidays.forEach(holiday => {
                   if (holiday.date && isValid(parseISO(holiday.date))) {
                       holidays.add(holiday.date);
                   }
               });
           }
           map.set(member.name, holidays);
       });
       return map;
   }, [members, holidayCalendars]);

  const chartData = useMemo(() => {
    if (!tasks || tasks.length === 0 || !sprintStartDate || !sprintEndDate || !isValid(parseISO(sprintStartDate)) || !isValid(parseISO(sprintEndDate))) {
       console.log("Timeline Pre-check failed:", { tasks, sprintStartDate, sprintEndDate });
      return [];
    }

    const sprintStartObj = parseISO(sprintStartDate);
    const sprintEndObj = parseISO(sprintEndDate);
    const sprintLengthDays = differenceInDays(sprintEndObj, sprintStartObj);

    console.log("Processing tasks for timeline:", tasks);

    const processedTasks = tasks
        .map((task, index) => {
             console.log(`Task ${index + 1} (${task.description}):`, task);
             const assigneeName = task.assignee;
             const memberHolidays = assigneeName ? (memberHolidayMap.get(assigneeName) ?? new Set<string>()) : new Set<string>(); // Get holidays for assignee or empty set

            if (!task.startDate || !isValid(parseISO(task.startDate))) {
                console.warn(`Task ${index + 1}: Invalid or missing start date.`);
                return null;
            }

            // Changed const to let to allow reassignment in the fallback case
            let taskStartObj = parseISO(task.startDate!);
            let lastPhaseEndDateObj = taskStartObj; // Tracks the end date of the last valid phase for dependency

            // --- Development Phase ---
            const devWorkingDays = parseEstimatedTimeToDays(task.devEstimatedTime);
            console.log(`Task ${index + 1}: Dev days parsed: ${devWorkingDays}`);
            let devStartDateObj = taskStartObj;
            let devEndDateObj = taskStartObj;
            let devStartDayIndex = -1;
            let devEndDayIndex = -1;
            let devPhaseValid = false;

            if (devWorkingDays !== null && devWorkingDays >= 0) { // Allow 0 days
                 devStartDateObj = taskStartObj; // Use task's start date for dev
                 // Adjust start date if it falls on a non-working day
                 while (isNonWorkingDay(devStartDateObj, memberHolidays)) {
                   devStartDateObj = addDays(devStartDateObj, 1);
                 }
                 // Calculate end date based on WORKING days, skipping non-working days
                 devEndDateObj = calculateEndDateSkippingNonWorkingDays(devStartDateObj, devWorkingDays, memberHolidays);

                 devStartDayIndex = differenceInDays(devStartDateObj, sprintStartObj);
                 // End day index should be inclusive of the end date
                 devEndDayIndex = differenceInDays(devEndDateObj, sprintStartObj);

                 // Clamp indices to be within the sprint boundaries
                 devStartDayIndex = Math.max(0, devStartDayIndex);
                 devEndDayIndex = Math.min(sprintLengthDays, Math.max(devStartDayIndex, devEndDayIndex));

                 lastPhaseEndDateObj = devEndDateObj; // Update the end date for the next phase
                 devPhaseValid = true;
                 console.log(`Task ${index + 1}: Dev Phase - Start: ${format(devStartDateObj, 'yyyy-MM-dd')}, End: ${format(devEndDateObj, 'yyyy-MM-dd')}, Indices: [${devStartDayIndex}, ${devEndDayIndex}]`);
            } else {
                console.warn(`Task ${index + 1}: Invalid or zero Dev estimate.`);
                 // If dev is invalid, next phases start from task start date
                 // If dev was 0 days, next phases start immediately after the adjusted start date
                 if (devWorkingDays === 0) {
                    // This loop needs devStartDateObj to be mutable (which is `let`)
                    while (isNonWorkingDay(devStartDateObj, memberHolidays)) {
                       devStartDateObj = addDays(devStartDateObj, 1);
                     }
                     lastPhaseEndDateObj = devStartDateObj;
                 } else {
                      // This loop needs taskStartObj to be mutable (now it's `let`)
                      while (isNonWorkingDay(taskStartObj, memberHolidays)) {
                         taskStartObj = addDays(taskStartObj, 1);
                      }
                     lastPhaseEndDateObj = taskStartObj; // Fallback to adjusted original task start
                 }
            }


            // --- QA Phase ---
            const qaWorkingDays = parseEstimatedTimeToDays(task.qaEstimatedTime);
            console.log(`Task ${index + 1}: QA days parsed: ${qaWorkingDays}`);
            let qaStartDateObj = lastPhaseEndDateObj; // Start relative to the end of the previous valid phase
            let qaEndDateObj = lastPhaseEndDateObj;
            let qaStartDayIndex = -1;
            let qaEndDayIndex = -1;
            let qaPhaseValid = false;

             if (qaWorkingDays !== null && qaWorkingDays >= 0) {
                 // QA starts the next working day *after* the previous phase ended
                 qaStartDateObj = getNextWorkingDay(lastPhaseEndDateObj, memberHolidays);
                 qaEndDateObj = calculateEndDateSkippingNonWorkingDays(qaStartDateObj, qaWorkingDays, memberHolidays);

                 qaStartDayIndex = differenceInDays(qaStartDateObj, sprintStartObj);
                 qaEndDayIndex = differenceInDays(qaEndDateObj, sprintStartObj);

                  // Clamp indices
                 qaStartDayIndex = Math.max(0, qaStartDayIndex);
                 qaEndDayIndex = Math.min(sprintLengthDays, Math.max(qaStartDayIndex, qaEndDayIndex));

                 lastPhaseEndDateObj = qaEndDateObj; // Update the end date for the next phase
                 qaPhaseValid = true;
                 console.log(`Task ${index + 1}: QA Phase - Start: ${format(qaStartDateObj, 'yyyy-MM-dd')}, End: ${format(qaEndDateObj, 'yyyy-MM-dd')}, Indices: [${qaStartDayIndex}, ${qaEndDayIndex}]`);
             } else {
                 console.warn(`Task ${index + 1}: Invalid or zero QA estimate.`);
                 // If QA is invalid or 0, buffer starts after the last valid phase (Dev or task start)
                 // lastPhaseEndDateObj remains unchanged from previous phase
             }


            // --- Buffer Phase ---
            const bufferWorkingDays = parseEstimatedTimeToDays(task.bufferTime);
            console.log(`Task ${index + 1}: Buffer days parsed: ${bufferWorkingDays}`);
            let bufferStartDateObj = lastPhaseEndDateObj; // Start relative to end of the last valid phase (Dev or QA)
            let bufferEndDateObj = lastPhaseEndDateObj;
            let bufferStartDayIndex = -1;
            let bufferEndDayIndex = -1;
            let bufferPhaseValid = false;

            if (bufferWorkingDays !== null && bufferWorkingDays >= 0) {
                // Buffer starts the next working day *after* the previous phase ended
                bufferStartDateObj = getNextWorkingDay(lastPhaseEndDateObj, memberHolidays);
                bufferEndDateObj = calculateEndDateSkippingNonWorkingDays(bufferStartDateObj, bufferWorkingDays, memberHolidays);

                bufferStartDayIndex = differenceInDays(bufferStartDateObj, sprintStartObj);
                bufferEndDayIndex = differenceInDays(bufferEndDateObj, sprintStartObj);

                // Clamp indices
                bufferStartDayIndex = Math.max(0, bufferStartDayIndex);
                bufferEndDayIndex = Math.min(sprintLengthDays, Math.max(bufferStartDayIndex, bufferEndDayIndex));

                bufferPhaseValid = true;
                console.log(`Task ${index + 1}: Buffer Phase - Start: ${format(bufferStartDateObj, 'yyyy-MM-dd')}, End: ${format(bufferEndDateObj, 'yyyy-MM-dd')}, Indices: [${bufferStartDayIndex}, ${bufferEndDayIndex}]`);
            } else {
                console.warn(`Task ${index + 1}: Invalid or zero Buffer estimate.`);
                 // If Buffer is invalid or 0, we don't add a buffer phase
            }


             // Tooltip to show more details
             const tooltipContent = [
                 `${task.description || 'Task'} (${task.status || 'N/A'})`,
                 `Dev: ${task.devEstimatedTime || '?'} [${devPhaseValid ? format(devStartDateObj, 'MM/dd') + ' - ' + format(devEndDateObj, 'MM/dd') : 'N/A'}]`,
                 `QA: ${task.qaEstimatedTime || '?'} [${qaPhaseValid ? format(qaStartDateObj, 'MM/dd') + ' - ' + format(qaEndDateObj, 'MM/dd') : 'N/A'}]`,
                 `Buffer: ${task.bufferTime || '?'} [${bufferPhaseValid ? format(bufferStartDateObj, 'MM/dd') + ' - ' + format(bufferEndDateObj, 'MM/dd') : 'N/A'}]`,
                 task.assignee ? `Assignee: ${task.assignee}` : '',
                 task.reviewer ? `Reviewer: ${task.reviewer}` : '',
             ].filter(Boolean).join(' | ');


            const result = {
                name: task.description || `Task ${task.id}`,
                taskIndex: index,
                // range is for the bar component, needs start and end+1 (to cover the full end day)
                // Ensure indices are valid and end >= start before creating range
                // +1 makes the range inclusive of the end day index
                devRange: devPhaseValid && devEndDayIndex >= devStartDayIndex ? [devStartDayIndex, devEndDayIndex + 1] : undefined,
                qaRange: qaPhaseValid && qaEndDayIndex >= qaStartDayIndex ? [qaStartDayIndex, qaEndDayIndex + 1] : undefined,
                bufferRange: bufferPhaseValid && bufferEndDayIndex >= bufferStartDayIndex ? [bufferStartDayIndex, bufferEndDayIndex + 1] : undefined,
                tooltip: tooltipContent,
                assignee: task.assignee, // Pass assignee for potential holiday highlighting
            };
             console.log(`Task ${index + 1}: Final Result`, result);
             // Include if *any* range is valid
             return result.devRange || result.qaRange || result.bufferRange ? result : null;
        }).filter(item => item !== null);

      console.log("Final Chart Data:", processedTasks);
      return processedTasks as any[]; // Cast to any[] because TS struggles with the filtering type inference

  }, [tasks, sprintStartDate, sprintEndDate, clientNow, memberHolidayMap]); // Add clientNow and memberHolidayMap dependency

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

    // Calculate holiday indices for the entire sprint duration
    const holidayIndices = useMemo(() => {
        if (!sprintStartDate || !sprintEndDate || !isValid(parseISO(sprintStartDate)) || !isValid(parseISO(sprintEndDate))) return [];
        const start = parseISO(sprintStartDate);
        const end = parseISO(sprintEndDate);
        const indices = new Map<number, Set<string>>(); // Map day index to Set of holiday names

        try {
            const allHolidaysInSprint = new Set<string>();
             // Aggregate all unique holiday dates within the sprint range from all calendars
             holidayCalendars.forEach(cal => {
                cal.holidays.forEach(hol => {
                    if (hol.date && isValid(parseISO(hol.date))) {
                         const holidayDate = parseISO(hol.date);
                         if (isWithinInterval(holidayDate, { start, end })) {
                             allHolidaysInSprint.add(hol.date);
                         }
                    }
                });
            });

            // Add indices for these unique holiday dates
            allHolidaysInSprint.forEach(holidayDateStr => {
                const holidayDate = parseISO(holidayDateStr);
                const index = differenceInDays(holidayDate, start);
                // Find holiday names for this date
                const names = new Set<string>();
                holidayCalendars.forEach(cal => {
                   cal.holidays.forEach(hol => {
                       if (hol.date === holidayDateStr) {
                           names.add(hol.name);
                       }
                   });
                });
                indices.set(index, names);
            });

        } catch (e) {
            console.error("Error calculating holiday indices:", e);
            return new Map();
        }
        return indices;
    }, [sprintStartDate, sprintEndDate, holidayCalendars]);


  if (!clientNow) {
     return <div className="flex items-center justify-center h-full text-muted-foreground">Loading chart...</div>;
  }

  if (chartData.length === 0) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">No tasks with valid start date and estimates to display.</div>;
  }

   let sprintDays = 0;
   try {
     // +1 because differenceInDays doesn't include the end date itself
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
                 x={index}
                 stroke="transparent"
                 ifOverflow="extendDomain"
                 label={(props) => {
                     const { viewBox } = props;
                     const dayWidth = viewBox && viewBox.width && sprintDays > 0 ? viewBox.width / sprintDays : 10;
                     return (
                       <rect
                         x={props.viewBox.x}
                         y={viewBox?.y ?? 0}
                         width={dayWidth}
                         height={viewBox?.height ?? 200}
                         fill={weekendColor}
                       />
                     );
                 }}
               />
           ))}
            {/* Holiday Reference Areas */}
            {Array.from(holidayIndices.entries()).map(([index, holidayNames]) => (
                 <ReferenceLine
                   key={`holiday-rect-${index}`}
                   x={index}
                   stroke="transparent"
                   ifOverflow="extendDomain"
                   label={(props) => {
                       const { viewBox } = props;
                       const dayWidth = viewBox && viewBox.width && sprintDays > 0 ? viewBox.width / sprintDays : 10;
                       const holidayNamesString = Array.from(holidayNames).join(', ');
                       return (
                          <TooltipProvider>
                            <UITooltip> {/* Use renamed Tooltip */}
                              <TooltipTrigger asChild>
                                 <rect
                                   x={props.viewBox.x}
                                   y={viewBox?.y ?? 0}
                                   width={dayWidth}
                                   height={viewBox?.height ?? 200}
                                   fill={holidayColor}
                                   style={{ pointerEvents: 'auto' }} // Ensure tooltip triggers
                                 />
                               </TooltipTrigger>
                               <UITooltipContent className="text-xs"> {/* Use renamed TooltipContent */}
                                 Public Holiday: {holidayNamesString}
                               </UITooltipContent>
                             </UITooltip> {/* Use renamed Tooltip */}
                           </TooltipProvider>
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
           {/* Render bars for each phase. Removed stackId to ensure independent positioning */}
           <Bar dataKey="devRange" radius={2} barSize={10} fill={chartConfig.dev.color} name="Development" />
           <Bar dataKey="qaRange" radius={2} barSize={10} fill={chartConfig.qa.color} name="QA" />
           <Bar dataKey="bufferRange" radius={2} barSize={10} fill={chartConfig.buffer.color} name="Buffer" />

        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

    