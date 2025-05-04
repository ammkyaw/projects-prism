
"use client";

import type { Task, Member, HolidayCalendar, PublicHoliday } from '@/types/sprint-data'; // Added HolidayCalendar, PublicHoliday
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { Tooltip as UITooltip, TooltipContent as UITooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; // Renamed import to avoid clash
import { format, parseISO, differenceInDays, addDays, isWithinInterval, getDay, eachDayOfInterval, isValid, isSameDay } from 'date-fns';
import { useState, useEffect, useMemo } from 'react';
import { cn } from "@/lib/utils";

const weekendColor = 'hsl(0 0% 10%)'; // Dark gray/black for weekend background
const holidayColor = 'hsl(0 72% 51%)'; // Darker Red for holiday background (adjust opacity/saturation as needed)
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

interface SprintTimelineChartProps {
    tasks: Task[];
    sprintStartDate: string | undefined;
    sprintEndDate: string | undefined;
    members: Member[];
    holidayCalendars: HolidayCalendar[];
}

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
           // Use member.id as key if name is not unique, assuming ID is unique
           map.set(member.id, holidays);
       });
       return map;
   }, [members, holidayCalendars]);

  const chartData = useMemo(() => {
    if (!tasks || tasks.length === 0 || !sprintStartDate || !sprintEndDate || !isValid(parseISO(sprintStartDate)) || !isValid(parseISO(sprintEndDate))) {
      return [];
    }

    const sprintStartObj = parseISO(sprintStartDate);
    const sprintEndObj = parseISO(sprintEndDate);
    const sprintLengthDays = differenceInDays(sprintEndObj, sprintStartObj); // Calendar days length

    const processedTasks = tasks
        .map((task, index) => {
             const assigneeId = members.find(m => m.name === task.assignee)?.id; // Find assignee ID
             const memberHolidays = assigneeId ? (memberHolidayMap.get(assigneeId) ?? new Set<string>()) : new Set<string>(); // Get holidays for assignee ID or empty set


            if (!task.startDate || !isValid(parseISO(task.startDate))) {
                console.warn(`Task ${index + 1} (${task.ticketNumber}): Invalid or missing start date.`); // Use ticketNumber
                return null;
            }

            let taskStartObj = parseISO(task.startDate!);
            let lastPhaseEndDateObj = taskStartObj; // Tracks the end date of the last valid phase for dependency

             // Ensure the effective start date of the *first* phase is a working day
             while (isNonWorkingDay(taskStartObj, memberHolidays)) {
               taskStartObj = addDays(taskStartObj, 1);
             }
             lastPhaseEndDateObj = taskStartObj; // Reset lastPhaseEnd to the adjusted task start

            // --- Development Phase ---
            const devWorkingDays = parseEstimatedTimeToDays(task.devEstimatedTime);
            let devStartDateObj = taskStartObj; // Start from adjusted task start date
            let devEndDateObj = devStartDateObj; // Initialize end date
            let devStartDayIndex = -1;
            let devEndDayIndex = -1;
            let devPhaseValid = false;

            if (devWorkingDays !== null && devWorkingDays >= 0) { // Check >= 0
                 // Need to calculate end date even if days are 0
                 devEndDateObj = calculateEndDateSkippingNonWorkingDays(devStartDateObj, devWorkingDays, memberHolidays);

                 devStartDayIndex = differenceInDays(devStartDateObj, sprintStartObj);
                 // End day index should be inclusive for calculation
                 devEndDayIndex = differenceInDays(devEndDateObj, sprintStartObj);

                 // Clamp indices
                 devStartDayIndex = Math.max(0, devStartDayIndex);
                 devEndDayIndex = Math.max(0, devEndDayIndex); // Ensure end is not negative
                 devEndDayIndex = Math.min(sprintLengthDays, devEndDayIndex); // Ensure end is within sprint bounds

                 // If days > 0, update lastPhaseEndDateObj
                 if (devWorkingDays > 0) {
                      lastPhaseEndDateObj = devEndDateObj;
                 }
                 devPhaseValid = true;
             } else {
                  // Handle null/invalid devWorkingDays if needed, for now assume valid >= 0
                  console.warn(`Task ${task.ticketNumber}: Invalid Dev Est. Time ${task.devEstimatedTime}`);
                  // Assign default indices or handle as error?
             }


            // --- QA Phase ---
            const qaWorkingDays = parseEstimatedTimeToDays(task.qaEstimatedTime);
            let qaStartDateObj = devWorkingDays === 0 ? devStartDateObj : getNextWorkingDay(lastPhaseEndDateObj, memberHolidays); // Start immediately if dev is 0, else next working day
            let qaEndDateObj = qaStartDateObj;
            let qaStartDayIndex = -1;
            let qaEndDayIndex = -1;
            let qaPhaseValid = false;

             if (qaWorkingDays !== null && qaWorkingDays >= 0) { // Check >= 0
                 qaEndDateObj = calculateEndDateSkippingNonWorkingDays(qaStartDateObj, qaWorkingDays, memberHolidays);

                 qaStartDayIndex = differenceInDays(qaStartDateObj, sprintStartObj);
                 qaEndDayIndex = differenceInDays(qaEndDateObj, sprintStartObj);

                  // Clamp indices
                 qaStartDayIndex = Math.max(0, qaStartDayIndex);
                 qaEndDayIndex = Math.max(0, qaEndDayIndex); // Ensure end is not negative
                 qaEndDayIndex = Math.min(sprintLengthDays, qaEndDayIndex);

                 if (qaWorkingDays > 0) {
                     lastPhaseEndDateObj = qaEndDateObj; // Update the end date for the next phase dependency
                 }
                 qaPhaseValid = true;
             } else {
                  console.warn(`Task ${task.ticketNumber}: Invalid QA Est. Time ${task.qaEstimatedTime}`);
             }


            // --- Buffer Phase ---
            const bufferWorkingDays = parseEstimatedTimeToDays(task.bufferTime);
            let bufferStartDateObj = qaWorkingDays === 0 ? qaStartDateObj : getNextWorkingDay(lastPhaseEndDateObj, memberHolidays); // Start immediately if QA is 0, else next working day
            let bufferEndDateObj = bufferStartDateObj;
            let bufferStartDayIndex = -1;
            let bufferEndDayIndex = -1;
            let bufferPhaseValid = false;

            if (bufferWorkingDays !== null && bufferWorkingDays >= 0) { // Check >= 0
                bufferEndDateObj = calculateEndDateSkippingNonWorkingDays(bufferStartDateObj, bufferWorkingDays, memberHolidays);

                bufferStartDayIndex = differenceInDays(bufferStartDateObj, sprintStartObj);
                bufferEndDayIndex = differenceInDays(bufferEndDateObj, sprintStartObj);

                // Clamp indices
                bufferStartDayIndex = Math.max(0, bufferStartDayIndex);
                bufferEndDayIndex = Math.max(0, bufferEndDayIndex); // Ensure end is not negative
                bufferEndDayIndex = Math.min(sprintLengthDays, bufferEndDayIndex);

                 // No update to lastPhaseEndDateObj needed after buffer
                bufferPhaseValid = true;
            } else {
                 console.warn(`Task ${task.ticketNumber}: Invalid Buffer Time ${task.bufferTime}`);
            }


             // Tooltip to show more details
             const tooltipContent = [
                 `Ticket: ${task.ticketNumber || 'N/A'} (${task.status || 'N/A'})`, // Use ticketNumber
                 `Dev: ${task.devEstimatedTime || '0d'} [${devPhaseValid ? format(devStartDateObj, 'MM/dd') + '-' + format(devEndDateObj, 'MM/dd') : 'N/A'}]`,
                 `QA: ${task.qaEstimatedTime || '0d'} [${qaPhaseValid ? format(qaStartDateObj, 'MM/dd') + '-' + format(qaEndDateObj, 'MM/dd') : 'N/A'}]`,
                 `Buffer: ${task.bufferTime || '0d'} [${bufferPhaseValid ? format(bufferStartDateObj, 'MM/dd') + '-' + format(bufferEndDateObj, 'MM/dd') : 'N/A'}]`,
                 task.assignee ? `Assignee: ${task.assignee}` : '',
                 task.reviewer ? `Reviewer: ${task.reviewer}` : '',
             ].filter(Boolean).join(' | ');


            const result = {
                name: task.ticketNumber || `Task ${task.id}`, // Use ticketNumber for Y-axis label
                taskIndex: index,
                // Recharts bar needs [start, end] where end is EXCLUSIVE for length calculation,
                // but INCLUSIVE for positioning. So we use [startIndex, endIndex + 1]
                // Check if start <= end before adding 1 to avoid negative length bars
                devRange: devPhaseValid && devEndDayIndex >= devStartDayIndex ? [devStartDayIndex, devEndDayIndex + 1] : undefined,
                qaRange: qaPhaseValid && qaEndDayIndex >= qaStartDayIndex ? [qaStartDayIndex, qaEndDayIndex + 1] : undefined,
                bufferRange: bufferPhaseValid && bufferEndDayIndex >= bufferStartDayIndex ? [bufferStartDayIndex, bufferEndDayIndex + 1] : undefined,
                tooltip: tooltipContent,
                assignee: task.assignee, // Pass assignee for potential holiday highlighting
            };
             // Include if *any* range is valid
             return result.devRange || result.qaRange || result.bufferRange ? result : null;
        }).filter(item => item !== null);

      return processedTasks as any[]; // Cast to any[] because TS struggles with the filtering type inference

  }, [tasks, sprintStartDate, sprintEndDate, clientNow, memberHolidayMap, members]); // Add members dependency

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

    // Calculate holiday indices and names for the entire sprint duration
    const holidayMap = useMemo(() => {
        const map = new Map<number, Set<string>>(); // Map day index to Set of holiday names
        if (!sprintStartDate || !sprintEndDate || !isValid(parseISO(sprintStartDate)) || !isValid(parseISO(sprintEndDate))) return map;
        const start = parseISO(sprintStartDate);
        const end = parseISO(sprintEndDate);

        try {
            eachDayOfInterval({ start, end }).forEach(date => {
                const dateStr = format(date, 'yyyy-MM-dd');
                const dayIndex = differenceInDays(date, start);
                let holidayNamesForDay: Set<string> | undefined;

                // Check all calendars for a holiday on this date
                holidayCalendars.forEach(cal => {
                    cal.holidays.forEach(hol => {
                        if (hol.date === dateStr) {
                            if (!holidayNamesForDay) {
                                holidayNamesForDay = new Set<string>();
                                map.set(dayIndex, holidayNamesForDay);
                            }
                            holidayNamesForDay.add(hol.name);
                        }
                    });
                });
            });
        } catch (e) {
            console.error("Error calculating holiday map:", e);
            return new Map();
        }
        return map;
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

  // Calculate dynamic height based on number of tasks
  const rowHeight = 30; // Adjust as needed for spacing
  const chartHeight = Math.max(250, chartData.length * rowHeight + 100); // Min height 250px, plus header/margins

  return (
    <ChartContainer config={chartConfig} className="w-full" style={{ height: `${chartHeight}px` }}> {/* Dynamic height */}
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
                 stroke="transparent" // Ensure no visible line is drawn
                 ifOverflow="extendDomain" // Prevent clipping if near edge
                 label={(props) => {
                     const { viewBox } = props;
                     // Calculate width based on axis viewbox and total days
                     const dayWidth = viewBox && viewBox.width && sprintDays > 0 ? viewBox.width / sprintDays : 10;
                     return (
                       <rect
                         x={props.viewBox.x} // Use the provided x position
                         y={viewBox?.y ?? 0} // Use the provided y position
                         width={dayWidth} // Use calculated width
                         height={viewBox?.height ?? 200} // Use provided height or default
                         fill={weekendColor} // Use the defined black weekend color
                         fillOpacity={0.3} // Add some opacity
                         style={{ pointerEvents: 'none' }} // Prevent interaction
                       />
                     );
                 }}
               />
           ))}
            {/* Holiday Reference Areas */}
            {Array.from(holidayMap.entries()).map(([index, holidayNames]) => (
                 <ReferenceLine
                   key={`holiday-rect-${index}`}
                   x={index}
                   stroke="transparent" // Ensure no visible line is drawn
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
                                   x={props.viewBox.x} // Use the provided x position
                                   y={viewBox?.y ?? 0} // Use the provided y position
                                   width={dayWidth} // Use calculated width
                                   height={viewBox?.height ?? 200} // Use provided height or default
                                   fill={holidayColor} // Use the defined dark red holiday color
                                   fillOpacity={0.2} // Add some opacity
                                   style={{ pointerEvents: 'auto', cursor: 'help' }} // Ensure tooltip triggers and indicate clickable area
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
