"use client";

import type { Task, Member, HolidayCalendar, PublicHoliday } from '@/types/sprint-data';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine, ReferenceArea } from 'recharts';
import { ChartConfig, ChartContainer } from "@/components/ui/chart"; // Removed ChartTooltipContent as we use custom tooltip
import { Tooltip as UITooltip, TooltipContent as UITooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format, parseISO, differenceInDays, addDays, isWithinInterval, getDay, eachDayOfInterval, isValid, isSameDay } from 'date-fns';
import { useState, useEffect, useMemo } from 'react';
import { cn } from "@/lib/utils";
import { Info } from 'lucide-react';

const weekendColor = 'hsl(0 0% 10%)'; // Black for weekend background
// Base colors for tasks
const devTaskBarColor = 'hsl(var(--primary))';
const qaTaskBarColor = 'hsl(var(--chart-2))';
const bufferTaskBarColor = 'hsl(var(--chart-3))';
// Base colors for holidays - will be dynamically assigned
const holidayColorBase = ['hsl(var(--chart-4))', 'hsl(var(--chart-5))', 'hsl(var(--destructive))']; // Cycle through these

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
      totalDays += weeks * 5; // Assuming 5 working days per week
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
  // Check if the date exists in the member's holiday set
  if (!memberHolidays || memberHolidays.size === 0) {
      return false; // No holidays to check
  }
  const dateString = format(date, 'yyyy-MM-dd');
  return memberHolidays.has(dateString);
};

// Calculate end date skipping weekends AND assigned public holidays
const calculateEndDateSkippingNonWorkingDays = (startDate: Date, workingDays: number, memberHolidays: Set<string>): Date => {
  let currentDate = new Date(startDate); // Clone date to avoid modifying original
  let workingDaysCounted = 0;

  // Adjust start date forward if it falls on a non-working day
  while (isNonWorkingDay(currentDate, memberHolidays)) {
       currentDate = addDays(currentDate, 1);
  }

  // If 0 working days, return the adjusted start date
  if (workingDays <= 0) {
       return currentDate;
  }


  // Loop until the required number of working days are counted
  // The start day is counted if it's a working day (which we ensured above)
  while (workingDaysCounted < workingDays) {
     // Count the current day only if it's a working day
     if (!isNonWorkingDay(currentDate, memberHolidays)) {
         workingDaysCounted++;
     }

     // Only advance the date if we haven't finished counting
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
    viewMode: 'task' | 'assignee'; // Add viewMode prop
}

// Interface for processed chart data
interface ChartDataPoint {
    name: string; // Task Ticket # or Assignee Name
    index: number; // Index for Y-axis positioning
    devRange?: [number, number];
    qaRange?: [number, number];
    bufferRange?: [number, number];
    tooltip: string;
    assignee?: string;
    assigneeId?: string | null; // Store assignee MEMBER ID for holiday lookup
    originalTask?: Task; // Include original task for assignee view tooltip
}


export default function SprintTimelineChart({ tasks, sprintStartDate, sprintEndDate, members, holidayCalendars, viewMode }: SprintTimelineChartProps) {
   const [clientNow, setClientNow] = useState<Date | null>(null);

   useEffect(() => {
     setClientNow(new Date());
   }, []);

   // Pre-compute holiday sets for each member based on assigned calendar
   const memberHolidayMap = useMemo(() => {
       const map = new Map<string, { holidays: Set<string>, calendarId: string | null }>(); // Map member NAME to holiday set and calendar ID
       members.forEach(member => {
           const calendarId = member.holidayCalendarId;
           const calendar = holidayCalendars.find(cal => cal.id === calendarId);
           const holidays = new Set<string>();
           if (calendar) {
               calendar.holidays.forEach(holiday => {
                   if (holiday.date) {
                       try {
                           const parsedDate = parseISO(holiday.date);
                           if (isValid(parsedDate)) {
                               holidays.add(holiday.date); // Store in YYYY-MM-DD format
                           } else {
                               console.warn(`Invalid date format for holiday '${holiday.name}' in calendar '${calendar.name}': ${holiday.date}`);
                           }
                       } catch (e) {
                            console.error(`Error parsing holiday date '${holiday.name}' in calendar '${calendar.name}': ${holiday.date}`, e);
                       }
                   }
               });
           }
           map.set(member.name, { holidays, calendarId }); // Store set and calendar ID using member NAME as key
       });
       return map;
   }, [members, holidayCalendars]);

  // Process data based on the viewMode
  const chartData = useMemo(() => {
    if (!tasks || tasks.length === 0 || !sprintStartDate || !sprintEndDate || !isValid(parseISO(sprintStartDate)) || !isValid(parseISO(sprintEndDate))) {
      return [];
    }

    const sprintStartObj = parseISO(sprintStartDate);
    const sprintEndObj = parseISO(sprintEndDate);
    const sprintLengthDays = differenceInDays(sprintEndObj, sprintStartObj) + 1;

    const processedTasks = tasks
        .map((task, index) => {
            const assigneeName = task.assignee;
            // Get member holiday data using ASSIGNEE NAME as key
            const memberHolidayData = assigneeName ? memberHolidayMap.get(assigneeName) : undefined;
            const memberHolidays = memberHolidayData?.holidays ?? new Set<string>();
            const assigneeMember = members.find(m => m.name === assigneeName); // Find member object by name

            if (!task.startDate || !isValid(parseISO(task.startDate))) {
                console.warn(`Task ${task.ticketNumber}: Invalid or missing start date.`);
                return null;
            }

            let taskStartObj: Date;
            try {
                taskStartObj = parseISO(task.startDate!);
            } catch (e) {
                console.error(`Task ${task.ticketNumber}: Error parsing start date: ${task.startDate}`, e);
                return null;
            }

             // Adjust the initial start date forward if it falls on a non-working day
             let currentPhaseStartDate = new Date(taskStartObj);
             while (isNonWorkingDay(currentPhaseStartDate, memberHolidays)) {
                 currentPhaseStartDate = addDays(currentPhaseStartDate, 1);
             }


            // --- Development Phase ---
            const devWorkingDays = parseEstimatedTimeToDays(task.devEstimatedTime);
            let devStartDateObj = new Date(currentPhaseStartDate);
            let devEndDateObj = devStartDateObj;
            let devStartDayIndex = -1;
            let devEndDayIndex = -1;
            let devPhaseValid = false;

            if (devWorkingDays !== null && devWorkingDays >= 0) {
                devEndDateObj = calculateEndDateSkippingNonWorkingDays(devStartDateObj, devWorkingDays, memberHolidays);
                devStartDayIndex = differenceInDays(devStartDateObj, sprintStartObj);
                devEndDayIndex = differenceInDays(devEndDateObj, sprintStartObj);
                devPhaseValid = true;
                currentPhaseStartDate = getNextWorkingDay(devEndDateObj, memberHolidays); // Set start for next phase
            } else {
                console.warn(`Task ${task.ticketNumber}: Invalid Dev Est. Time ${task.devEstimatedTime}`);
                 // If dev time is invalid, next phase starts after the adjusted task start day
                currentPhaseStartDate = getNextWorkingDay(devStartDateObj, memberHolidays);
            }

            // --- QA Phase ---
             let qaStartDateObj = new Date(currentPhaseStartDate);
             const qaWorkingDays = parseEstimatedTimeToDays(task.qaEstimatedTime);
             let qaEndDateObj = qaStartDateObj;
             let qaStartDayIndex = -1;
             let qaEndDayIndex = -1;
             let qaPhaseValid = false;

             if (qaWorkingDays !== null && qaWorkingDays >= 0) {
                 qaEndDateObj = calculateEndDateSkippingNonWorkingDays(qaStartDateObj, qaWorkingDays, memberHolidays);
                 qaStartDayIndex = differenceInDays(qaStartDateObj, sprintStartObj);
                 qaEndDayIndex = differenceInDays(qaEndDateObj, sprintStartObj);
                 qaPhaseValid = true;
                 currentPhaseStartDate = getNextWorkingDay(qaEndDateObj, memberHolidays); // Set start for next phase
             } else {
                  console.warn(`Task ${task.ticketNumber}: Invalid QA Est. Time ${task.qaEstimatedTime}`);
                  // If QA time is invalid, next phase starts after the QA phase start day
                 currentPhaseStartDate = getNextWorkingDay(qaStartDateObj, memberHolidays);
             }

            // --- Buffer Phase ---
            let bufferStartDateObj = new Date(currentPhaseStartDate);
            const bufferWorkingDays = parseEstimatedTimeToDays(task.bufferTime);
            let bufferEndDateObj = bufferStartDateObj;
            let bufferStartDayIndex = -1;
            let bufferEndDayIndex = -1;
            let bufferPhaseValid = false;

            if (bufferWorkingDays !== null && bufferWorkingDays >= 0) {
                bufferEndDateObj = calculateEndDateSkippingNonWorkingDays(bufferStartDateObj, bufferWorkingDays, memberHolidays);
                bufferStartDayIndex = differenceInDays(bufferStartDateObj, sprintStartObj);
                bufferEndDayIndex = differenceInDays(bufferEndDateObj, sprintStartObj);
                bufferPhaseValid = true;
                // Buffer end date doesn't impact next phase start
            } else {
                 console.warn(`Task ${task.ticketNumber}: Invalid Buffer Time ${task.bufferTime}`);
            }

            const clampIndex = (index: number) => Math.max(0, Math.min(sprintLengthDays -1 , index)); // Clamp between 0 and sprintLengthDays-1

            // Apply clamping AFTER calculating the difference
            const clampedDevStart = clampIndex(devStartDayIndex);
            const clampedDevEnd = clampIndex(devEndDayIndex); // End day index is inclusive
            const clampedQaStart = clampIndex(qaStartDayIndex);
            const clampedQaEnd = clampIndex(qaEndDayIndex);
            const clampedBufferStart = clampIndex(bufferStartDayIndex);
            const clampedBufferEnd = clampIndex(bufferEndDayIndex);

             const tooltipContent = [
                 `Ticket: ${task.ticketNumber || 'N/A'} (${task.status || 'N/A'})`,
                 `Dev: ${task.devEstimatedTime || '0d'} [${devPhaseValid ? format(devStartDateObj, 'MM/dd') + '-' + format(devEndDateObj, 'MM/dd') : 'N/A'}]`,
                 `QA: ${task.qaEstimatedTime || '0d'} [${qaPhaseValid ? format(qaStartDateObj, 'MM/dd') + '-' + format(qaEndDateObj, 'MM/dd') : 'N/A'}]`,
                 `Buffer: ${task.bufferTime || '0d'} [${bufferPhaseValid ? format(bufferStartDateObj, 'MM/dd') + '-' + format(bufferEndDateObj, 'MM/dd') : 'N/A'}]`,
                 task.assignee ? `Assignee: ${task.assignee}` : '',
                 task.reviewer ? `Reviewer: ${task.reviewer}` : '',
             ].filter(Boolean).join(' | ');

             // Add +1 to end indices for Recharts bar range (exclusive end)
             const result: ChartDataPoint = {
                 name: task.ticketNumber || `Task ${task.id}`, // Use ticket number for default view
                 index: index, // Default index for task view
                 devRange: devPhaseValid && clampedDevEnd >= clampedDevStart ? [clampedDevStart, clampedDevEnd + 1] : undefined,
                 qaRange: qaPhaseValid && clampedQaEnd >= clampedQaStart ? [clampedQaStart, clampedQaEnd + 1] : undefined,
                 bufferRange: bufferPhaseValid && clampedBufferEnd >= clampedBufferStart ? [clampedBufferStart, clampedBufferEnd + 1] : undefined,
                 tooltip: tooltipContent,
                 assignee: task.assignee, // Pass assignee for potential holiday highlighting
                 assigneeId: assigneeMember?.id, // Pass assignee MEMBER ID for holiday mapping
                 originalTask: task, // Keep original task data
             };
             // Include if *any* range is valid
             return result.devRange || result.qaRange || result.bufferRange ? result : null;
        }).filter(item => item !== null) as ChartDataPoint[]; // Assert type after filtering nulls


        // Group and process data based on viewMode
        if (viewMode === 'assignee') {
            const groupedByAssignee: { [key: string]: ChartDataPoint[] } = {};
            processedTasks.forEach(task => {
                const assigneeKey = task.assignee || 'Unassigned';
                if (!groupedByAssignee[assigneeKey]) {
                    groupedByAssignee[assigneeKey] = [];
                }
                groupedByAssignee[assigneeKey].push(task);
            });

            const assigneeChartData: ChartDataPoint[] = [];
            Object.keys(groupedByAssignee).sort().forEach((assigneeName, assigneeIndex) => { // Sort assignees alphabetically
                groupedByAssignee[assigneeName].forEach((task) => {
                    // Create a new object for each task within the assignee group
                    assigneeChartData.push({
                        ...task,
                        // In assignee view, only show dev range
                        qaRange: undefined,
                        bufferRange: undefined,
                        name: assigneeName, // Y-axis label is now assignee name
                        index: assigneeIndex, // Y-axis position based on assignee group
                        tooltip: `Assignee: ${assigneeName} | Ticket: ${task.originalTask?.ticketNumber || 'N/A'} | Dev: ${task.originalTask?.devEstimatedTime || '0d'}`, // Simplified tooltip for assignee view
                    });
                });
            });
            return assigneeChartData;
        } else {
            // 'task' view (default) - use processedTasks as is
            return processedTasks;
        }

  }, [tasks, sprintStartDate, sprintEndDate, clientNow, memberHolidayMap, members, viewMode]); // Added viewMode


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

   // Calculate holiday indices and names relevant to the specific calendars USED by assignees in the chart
    const assignedHolidayMap = useMemo(() => {
       const map = new Map<number, { name: string; color: string; calendarName: string }>(); // Map day index to holiday details
       const calendarColors = new Map<string, string>(); // Map calendar ID to assigned color
       let colorIndex = 0;

       if (!sprintStartDate || !sprintEndDate || !isValid(parseISO(sprintStartDate)) || !isValid(parseISO(sprintEndDate))) return map;
       const start = parseISO(sprintStartDate);
       const end = parseISO(sprintEndDate);

       try {
         const days = eachDayOfInterval({ start, end });

         days.forEach(date => {
           const dateStr = format(date, 'yyyy-MM-dd');
           const dayIndex = differenceInDays(date, start);
           let holidayForDay: { name: string; color: string; calendarName: string } | null = null;

           // Find *any* assigned member who has a holiday on this day
           // Use the MEMBER ID stored in ChartDataPoint's assigneeId for lookup
           const membersWithHolidayOnDay = chartData
             .filter(dp => dp.assigneeId && memberHolidayMap.get(dp.assignee!)?.holidays.has(dateStr)) // Filter by assignee name to get holiday set
             .map(dp => dp.assigneeId); // Get MEMBER IDs of members with holiday on this day

            // Now find the CALENDAR ID for these members
            const calendarIdsForDay = membersWithHolidayOnDay.map(memberId => members.find(m => m.id === memberId)?.holidayCalendarId).filter(Boolean);


           if (calendarIdsForDay.length > 0) {
               // Prioritize showing one holiday, maybe the first one found?
               const firstCalendarIdWithHoliday = calendarIdsForDay[0];
                if (firstCalendarIdWithHoliday) {
                    const calendar = holidayCalendars.find(cal => cal.id === firstCalendarIdWithHoliday);
                    if (calendar) {
                        // Assign color if not already assigned
                       if (!calendarColors.has(firstCalendarIdWithHoliday)) {
                         calendarColors.set(firstCalendarIdWithHoliday, holidayColorBase[colorIndex % holidayColorBase.length]);
                         colorIndex++;
                       }
                       const color = calendarColors.get(firstCalendarIdWithHoliday)!;
                       const holiday = calendar.holidays.find(hol => hol.date === dateStr);
                       holidayForDay = {
                         name: holiday?.name ?? 'Public Holiday',
                         color: color,
                         calendarName: calendar.name || 'Unknown Calendar',
                       };
                    }
                }
           }

           if (holidayForDay) {
             map.set(dayIndex, holidayForDay);
           }
         });
       } catch (e) {
         console.error("Error calculating assigned holiday map:", e);
         return new Map();
       }
       return map;
   }, [sprintStartDate, sprintEndDate, memberHolidayMap, holidayCalendars, chartData, members]); // Added members dependency

   // Generate Chart Config dynamically based on used calendars
   const chartConfig = useMemo(() => {
       const config: ChartConfig = {
           dev: { label: 'Development', color: devTaskBarColor },
           qa: { label: 'QA', color: qaTaskBarColor },
           buffer: { label: 'Buffer', color: bufferTaskBarColor },
           weekend: { label: 'Weekend', color: weekendColor },
       };
       assignedHolidayMap.forEach((holidayInfo, dayIndex) => {
           // Create a unique key based on calendar name and day index to handle multiple holidays from same calendar
           const key = `holiday-${holidayInfo.calendarName.replace(/[^a-zA-Z0-9]/g, '-')}-${dayIndex}`;
           if (!config[key]) {
               config[key] = { label: holidayInfo.calendarName, color: holidayInfo.color };
           }
       });
       return config;
   }, [assignedHolidayMap]);

   // Determine Y-axis dataKey and formatter based on viewMode
   const yAxisDataKey = 'index'; // Always use index now
   const yAxisTickFormatter = (value: number, index: number): string => {
       if (viewMode === 'assignee') {
           // Find the first data point with this index to get the assignee name
           const dataPoint = chartData.find(d => d.index === value);
           return dataPoint?.name ?? `Assignee ${value + 1}`; // Fallback if name not found
       } else {
           // Task view: find the data point by index
           const dataPoint = chartData[value];
           return dataPoint?.name ?? `Task ${value + 1}`; // Fallback if name not found
       }
   };


   // Determine unique Y-axis domain values (assignee names or task names)
    const yDomainValues = useMemo(() => {
        // Get unique names based on the current view mode
        return [...new Set(chartData.map(d => d.name))];
    }, [chartData]); // Recalculate when chartData changes

   // Calculate dynamic height based on the number of unique Y-axis values
   const rowHeight = 30; // Adjust as needed for spacing
   const chartHeight = Math.max(250, yDomainValues.length * rowHeight + 100); // Min height 250px, plus header/margins


  if (!clientNow) {
     return <div className="flex justify-center items-center min-h-screen">Loading sprint details...</div>;
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
           if (sprintDays <= 14 || i % 2 === 0 || i === 0 || i === sprintDays -1) {
               return format(date, 'MM/dd');
           }
       } catch (e) {
          console.error("Error formatting X tick:", e);
       }
       return '';
   });


  // Custom Legend Component
    const CustomLegend = () => {
        return (
          <div className="flex justify-center items-center flex-wrap space-x-4 mt-4 text-xs">
            {Object.entries(chartConfig).map(([key, value]) => {
                 // Only show relevant legends based on viewMode
                 if (viewMode === 'assignee' && (key === 'qa' || key === 'buffer')) {
                    return null;
                 }
                 // Only show holiday legends if that calendar actually has holidays in the map
                 if (key.startsWith('holiday-') && !Array.from(assignedHolidayMap.values()).some(h => h.calendarName === value.label)) {
                     return null;
                 }
                 return (
                   <div key={key} className="flex items-center space-x-1 mb-1">
                     <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: value.color }}></span>
                     <span>{value.label}</span>
                   </div>
                 );
             })}
          </div>
        );
    };

  return (
    <ChartContainer config={chartConfig} className="w-full" style={{ height: `${chartHeight}px` }}> {/* Dynamic height */}
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={chartData}
          margin={{ top: 5, right: 20, left: 100, bottom: 20 }}
          barCategoryGap="30%" // Adjust gap between tasks/assignees
          barGap={2} // Adjust gap between bars within the same task/assignee
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
            {/* Render Weekend and Holiday areas first */}
           {sprintDayIndices.map((index) => {
             const isWeekend = weekendIndices.includes(index);
             const holidayInfo = assignedHolidayMap.get(index);
             const fillColor = holidayInfo ? holidayInfo.color : (isWeekend ? weekendColor : undefined);
             const tooltipText = holidayInfo ? `${holidayInfo.calendarName}: ${holidayInfo.name}` : (isWeekend ? 'Weekend' : '');

             if (fillColor) {
                 return (
                     <ReferenceArea
                         key={`nonwork-area-${index}`}
                         x1={index} // Start at the beginning of the day index
                         x2={index + 1} // End at the start of the next day index
                         y1={-0.5} // Start slightly above first bar
                         y2={yDomainValues.length - 0.5} // Extend slightly below last bar/assignee
                         ifOverflow="visible" // Allow overflow slightly for visual continuity
                         fill={fillColor}
                         fillOpacity={1} // Make weekend/holiday fully opaque
                         yAxisId={0}
                         strokeWidth={0} // No border for the area itself
                     />
                 );
             }
             return null;
           })}

          <YAxis
            dataKey={yAxisDataKey} // Use calculated dataKey
            type="number" // Treat Y axis as numerical index
            domain={[-0.5, yDomainValues.length - 0.5]} // Domain based on unique assignees/tasks
            ticks={yDomainValues.map((_, i) => i)} // Ticks based on index
            tickFormatter={yAxisTickFormatter} // Format tick using name
            tick={{ fontSize: 10, width: 90, textAnchor: 'end' }}
            axisLine={false}
            tickLine={false}
            interval={0} // Show tick for every assignee/task
            reversed={true} // Display from top to bottom
            yAxisId={0} // Explicitly set Y-axis ID
            />
           <Tooltip
              cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
              content={({ payload }) => {
                 if (payload && payload.length > 0 && payload[0].payload) {
                     const data = payload[0].payload as ChartDataPoint; // Type assertion
                     return (
                         <div className="text-xs bg-background border rounded px-2 py-1 shadow-sm max-w-md">
                             <p className="font-semibold break-words">{data.tooltip}</p>
                         </div>
                     );
                 }
                 return null;
              }}
             />
           {/* Render bars for each phase - Rendered Last to overlay non-working days */}
           <Bar dataKey="devRange" radius={2} barSize={10} fill={chartConfig.dev.color} name="Development" yAxisId={0} />
           {/* Conditionally render QA and Buffer based on viewMode */}
           {viewMode === 'task' && (
                <>
                    <Bar dataKey="qaRange" radius={2} barSize={10} fill={chartConfig.qa.color} name="QA" yAxisId={0} />
                    <Bar dataKey="bufferRange" radius={2} barSize={10} fill={chartConfig.buffer.color} name="Buffer" yAxisId={0} />
                </>
           )}

          {/* Use the custom legend */}
          <Legend content={<CustomLegend />} verticalAlign="bottom" wrapperStyle={{ bottom: 0 }}/>
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
