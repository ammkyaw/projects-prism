
"use client";

import type { Task } from '@/types/sprint-data';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { format, parseISO, differenceInDays, addDays, isWithinInterval } from 'date-fns';
import { useMemo } from 'react';

// Define a temporary type for chart data that includes the calculated endDate
interface TaskWithEndDate extends Task {
  endDate: string; // This is added just for the chart
}

interface SprintTimelineChartProps {
  tasks: TaskWithEndDate[]; // Expect tasks with the calculated endDate
  sprintStartDate?: string;
  sprintEndDate?: string;
}

// Define colors for different task statuses or assignees (example)
const statusColors: { [key: string]: string } = {
  'To Do': 'hsl(var(--chart-5))', // Greenish
  'In Progress': 'hsl(var(--chart-4))', // Orangeish
  'Done': 'hsl(var(--chart-1))', // Blue
  'Blocked': 'hsl(var(--destructive))', // Red
};

const defaultColor = 'hsl(var(--chart-3))'; // Muted blue for unassigned/default

export default function SprintTimelineChart({ tasks, sprintStartDate, sprintEndDate }: SprintTimelineChartProps) {
  const chartData = useMemo(() => {
    if (!tasks || tasks.length === 0 || !sprintStartDate || !sprintEndDate) {
      return [];
    }

    const start = parseISO(sprintStartDate);
    const end = parseISO(sprintEndDate);

    return tasks
        // Tasks are pre-filtered in the parent component to have valid startDate and endDate (calculated)
        .map((task, index) => {
            const taskStart = parseISO(task.startDate!);
            const taskEnd = parseISO(task.endDate); // Use the calculated endDate

            // Clamp task dates within sprint boundaries for visualization
            const visStart = taskStart < start ? start : taskStart;
            let visEnd = taskEnd > end ? end : taskEnd;

            // Ensure visEnd is not before visStart after clamping
             if (visEnd < visStart) {
               visEnd = visStart;
            }

            const startDay = differenceInDays(visStart, start);
            // Ensure duration is at least 1 day for visualization
            const duration = Math.max(differenceInDays(visEnd, visStart) + 1, 1);

             // Assign color based on status or assignee (example)
             const color = statusColors[task.status ?? ''] || defaultColor;

            return {
                name: task.description || `Task ${task.id}`,
                taskIndex: index, // Use index for Y-axis positioning
                range: [startDay, startDay + duration -1], // [start_day_index, end_day_index]
                fill: color,
                tooltip: `${task.description || 'Task'} (${task.status || 'N/A'}) - Est. ${task.estimatedTime || '?'} ${task.assignee ? '(' + task.assignee + ')' : ''} [${format(taskStart, 'MM/dd')} - ${format(taskEnd, 'MM/dd')}]` // Updated tooltip
            };
        });
  }, [tasks, sprintStartDate, sprintEndDate]);

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
             domain={[0, sprintDays ]} // Domain from day 0 to sprintDays
             ticks={sprintDayIndices} // Ticks for each day index
             tickFormatter={(tick) => xTicks[tick] ?? ''} // Format ticks to dates
             tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
             axisLine={false}
             tickLine={true}
             interval={0} // Ensure all ticks are considered for rendering based on formatter
            //  hide // Hide the default axis, we use ReferenceLines below for grid effect
             allowDuplicatedCategory={false} // Prevent duplicate category labels if needed
           />
           {/* Add ReferenceLines for Day Markers (Grid effect) */}
           {/* {sprintDayIndices.map((i) => (
               <ReferenceLine
                 key={`day-line-${i}`}
                 x={i} // Position line at the START of the day index
                 stroke="hsl(var(--border))"
                 strokeDasharray="2 2"
                 // label={{ value: xTicks[i] ?? '', position: 'bottom', fontSize: 10, fill: 'hsl(var(--muted-foreground))', dy: 10 }}
               />
            ))} */}
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
           <Bar dataKey="range" radius={2} barSize={10} fill={(data) => data.payload.fill} >
             {/* We set fill color directly in chartData or using fill function */}
           </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
