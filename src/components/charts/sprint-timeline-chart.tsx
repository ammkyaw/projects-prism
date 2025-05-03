
"use client";

import type { Task, Member } from '@/types/sprint-data'; // Import Member
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { format, parseISO, differenceInDays, addDays, isWithinInterval, getDay, eachDayOfInterval, isValid } from 'date-fns'; // Import getDay, eachDayOfInterval, isValid
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
  members: Member[]; // Add members for coloring
}

// Define a base color palette for assignees (expandable)
const assigneeColors = [
  'hsl(var(--chart-1))', // Blue
  'hsl(var(--chart-2))', // Gold
  'hsl(var(--chart-3))', // Muted Blue
  'hsl(var(--chart-4))', // Orangeish
  'hsl(var(--chart-5))', // Greenish
  'hsl(270 60% 60%)', // Purple
  'hsl(180 50% 55%)', // Teal
  'hsl(330 70% 65%)', // Pink
];

const statusColors: { [key: string]: string } = {
  'To Do': 'hsl(var(--muted) / 0.5)', // Lighter gray for To Do
  'In Progress': 'hsl(var(--accent))', // Use Accent color (Gold)
  'Done': 'hsl(var(--primary))', // Blue
  'Blocked': 'hsl(var(--destructive))', // Red
};

const weekendColor = 'hsl(var(--muted) / 0.2)'; // Very light gray for weekend background


const defaultColor = 'hsl(var(--muted-foreground))'; // Gray for unassigned/default


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
    if (workingDaysCounted < workingDays) {
        daysAdded++;
    }
  }
  return currentDate; // The final end date
};

// --- End Helper Functions ---


export default function SprintTimelineChart({ tasks, sprintStartDate, sprintEndDate, members }: SprintTimelineChartProps) {

  // Create a map for consistent assignee colors
  const memberColorMap = useMemo(() => {
    const map: { [assigneeName: string]: string } = {};
    members.forEach((member, index) => {
      map[member.name] = assigneeColors[index % assigneeColors.length];
    });
    return map;
  }, [members]);


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

             // Ensure indices are within sprint boundaries (or handle visualization if needed)
             // For simplicity, we might let bars extend slightly if domain allows, or clamp:
             // const clampedStartDayIndex = Math.max(0, startDayIndex);
             // const clampedEndDayIndex = Math.min(differenceInDays(sprintEndObj, sprintStartObj), endDayIndex);


            // Assign color based on assignee first, fallback to status or default
            const color = task.assignee && memberColorMap[task.assignee]
                ? memberColorMap[task.assignee]
                : statusColors[task.status ?? ''] || defaultColor;

            return {
                name: task.description || `Task ${task.id}`,
                taskIndex: index, // Use index for Y-axis positioning
                // range should be [start_day_index, end_day_index]
                // The bar will visually span from the start of startDayIndex to the end of endDayIndex
                range: [startDayIndex, endDayIndex],
                fill: color,
                tooltip: `${task.description || 'Task'} (${task.status || 'N/A'}) - Est. ${task.estimatedTime || '?'} ${task.assignee ? '(' + task.assignee + ')' : '(Unassigned)'} [${format(taskStartObj, 'MM/dd')} - ${format(actualEndDateObj, 'MM/dd')}]` // Updated tooltip shows calculated end date
            };
        }).filter(item => item !== null && item.range[0] <= item.range[1]); // Remove null items and invalid ranges
  }, [tasks, sprintStartDate, sprintEndDate, memberColorMap]); // Add memberColorMap dependency

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
    value: { label: 'Duration' }, // Dummy config, color is set per bar
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
             dataKey="range[0]" // Position based on start day index
             domain={[0, sprintDays ]} // Domain from day 0 to sprintDays
             ticks={sprintDayIndices} // Ticks for each day index
             tickFormatter={(tick) => xTicks[tick] ?? ''} // Format ticks to dates
             tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
             axisLine={false}
             tickLine={true}
             interval={0} // Ensure all ticks are considered for rendering based on formatter
             allowDuplicatedCategory={false} // Prevent duplicate category labels if needed
           />
           {/* Add ReferenceAreas for Weekend Highlighting */}
           {weekendIndices.map((index) => (
               // Use ReferenceArea to cover the full day block
               <ReferenceLine
                 key={`weekend-line-${index}`}
                 x={index} // Position at the start of the weekend day index
                 stroke={weekendColor} // Use very light gray for weekends
                 strokeWidth={10} // Adjust width visually - MAY NEED TUNING BASED ON BAR SIZE/GAPS
                 ifOverflow="visible" // Allow drawing outside strict plot area if needed? Or hidden
                 segment={[{ x: index, y: -1 }, { x: index, y: chartData.length }]} // Draw vertical line covering y-axis
                 // Optional label:
                 // label={{ value: "W", position: 'top', fontSize: 8, fill: 'hsl(var(--muted-foreground))', dy: -5 }}
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
                             <p className="font-semibold break-words" style={{ color: data.fill }}>{data.tooltip}</p>
                         </div>
                     );
                 }
                 return null;
              }}
             />
           <Legend content={null} /> {/* Hide default legend */}
           {/* Bar dataKey uses range [startDayIndex, endDayIndex]. Bar length is endDayIndex - startDayIndex + 1 */}
           <Bar dataKey="range" radius={2} barSize={10} fill={(data) => data.payload.fill} />

        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

