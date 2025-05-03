
"use client";

import type { Task, Member } from '@/types/sprint-data'; // Import Member
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { format, parseISO, differenceInDays, addDays, isWithinInterval, getDay, eachDayOfInterval } from 'date-fns'; // Import getDay, eachDayOfInterval
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
    if (!tasks || tasks.length === 0 || !sprintStartDate || !sprintEndDate) {
      return [];
    }

    const start = parseISO(sprintStartDate);
    const end = parseISO(sprintEndDate);

    return tasks
        .map((task, index) => {
            if (!task.startDate) return null; // Skip tasks without start date
            const taskStart = parseISO(task.startDate!);
            const taskEnd = parseISO(task.endDate); // Use the calculated endDate

            // Clamp task dates within sprint boundaries for visualization
            const visStart = taskStart < start ? start : taskStart;
            let visEnd = taskEnd > end ? end : taskEnd;

             // Ensure visEnd is not before visStart after clamping
             if (visEnd < visStart) {
               visEnd = visStart;
             }

            const startDayIndex = differenceInDays(visStart, start);
            // Calculate duration in *days* for the bar length (inclusive)
            const durationInDays = differenceInDays(visEnd, visStart) + 1;
             // Ensure duration is at least 1 day for visualization
            const visualDuration = Math.max(durationInDays, 1);


             // Assign color based on assignee first, fallback to status or default
             const color = task.assignee && memberColorMap[task.assignee]
                ? memberColorMap[task.assignee]
                : statusColors[task.status ?? ''] || defaultColor;

            return {
                name: task.description || `Task ${task.id}`,
                taskIndex: index, // Use index for Y-axis positioning
                // range: [startDayIndex, startDayIndex + visualDuration -1], // [start_day_index, end_day_index]
                range: [startDayIndex, startDayIndex + visualDuration -1], // Bar spans from start day index to end day index
                fill: color,
                tooltip: `${task.description || 'Task'} (${task.status || 'N/A'}) - Est. ${task.estimatedTime || '?'} ${task.assignee ? '(' + task.assignee + ')' : '(Unassigned)'} [${format(taskStart, 'MM/dd')} - ${format(taskEnd, 'MM/dd')}]` // Updated tooltip
            };
        }).filter(item => item !== null); // Remove null items
  }, [tasks, sprintStartDate, sprintEndDate, memberColorMap]); // Add memberColorMap dependency

  // Calculate weekend days within the sprint range
   const weekendIndices = useMemo(() => {
       if (!sprintStartDate || !sprintEndDate) return [];
       const start = parseISO(sprintStartDate);
       const end = parseISO(sprintEndDate);
       const indices: number[] = [];
       eachDayOfInterval({ start, end }).forEach((date) => {
           const dayOfWeek = getDay(date); // 0 = Sunday, 6 = Saturday
           if (dayOfWeek === 0 || dayOfWeek === 6) {
               indices.push(differenceInDays(date, start));
           }
       });
       return indices;
   }, [sprintStartDate, sprintEndDate]);


  if (chartData.length === 0) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">No tasks with valid start date and estimate to display.</div>;
  }

   const sprintDays = differenceInDays(parseISO(sprintEndDate!), parseISO(sprintStartDate!)) + 1;
   const sprintDayIndices = Array.from({ length: sprintDays }, (_, i) => i); // 0 to sprintDays-1

  // Generate ticks for X-axis (e.g., every few days)
   const xTicks = sprintDayIndices.map(i => {
       const date = addDays(parseISO(sprintStartDate!), i);
       // Show tick maybe every 2 days or based on sprint length
       if (i % (sprintDays > 14 ? 2 : 1) === 0) {
           return format(date, 'MM/dd');
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
             dataKey="range[0]" // Use the start day index for positioning
             domain={[0, sprintDays ]} // Domain from day 0 to sprintDays
             ticks={sprintDayIndices} // Ticks for each day index
             tickFormatter={(tick) => xTicks[tick] ?? ''} // Format ticks to dates
             tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
             axisLine={false}
             tickLine={true}
             interval={0} // Ensure all ticks are considered for rendering based on formatter
             allowDuplicatedCategory={false} // Prevent duplicate category labels if needed
             // Reversed might not be needed for X-axis timeline
           />
           {/* Add ReferenceAreas for Weekend Highlighting */}
           {weekendIndices.map((index) => (
               <ReferenceLine
                 key={`weekend-line-${index}`}
                 x={index + 0.5} // Position line slightly offset to cover the day block visually
                 stroke={weekendColor} // Use very light gray for weekends
                 strokeWidth={10} // Adjust width to cover the day visually - EXPERIMENT
                 ifOverflow="extendDomain" // Extend domain if needed
                 // label={{ value: "Weekend", position: 'insideTop', fontSize: 8, fill: 'hsl(var(--muted-foreground))', angle: -90, dy: -5 }}
               />
               // Alternative: Use ReferenceArea - might require different setup
               // <ReferenceArea
               //   key={`weekend-area-${index}`}
               //   x1={index}
               //   x2={index + 1}
               //   fill={weekendColor}
               //   strokeOpacity={0} // No border for the area
               //   ifOverflow="hidden" // Clip the area to the chart boundaries
               // />
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
           {/* Use dataKey="range" which is [start, end]. Recharts automatically calculates width */}
           <Bar dataKey="range" radius={2} barSize={10} fill={(data) => data.payload.fill} />

        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

