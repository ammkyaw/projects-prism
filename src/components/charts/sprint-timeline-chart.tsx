
"use client";

import type { Task } from '@/types/sprint-data';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { format, parseISO, differenceInDays, addDays, isWithinInterval } from 'date-fns';
import { useMemo } from 'react';

interface SprintTimelineChartProps {
  tasks: Task[];
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
    const sprintDurationDays = differenceInDays(end, start) + 1; // Inclusive

    return tasks
        .filter(task => task.startDate && task.endDate) // Ensure tasks have dates
        .map((task, index) => {
            const taskStart = parseISO(task.startDate!);
            const taskEnd = parseISO(task.endDate!);

            // Clamp task dates within sprint boundaries for visualization
            const visStart = taskStart < start ? start : taskStart;
            const visEnd = taskEnd > end ? end : taskEnd;

            const startDay = differenceInDays(visStart, start);
            const duration = differenceInDays(visEnd, visStart) + 1; // Inclusive duration

             // Assign color based on status or assignee (example)
             const color = statusColors[task.status ?? ''] || defaultColor;

            return {
                name: task.description || `Task ${task.id}`,
                taskIndex: index, // Use index for Y-axis positioning
                range: [startDay, startDay + duration -1], // [start_day_index, end_day_index]
                fill: color,
                tooltip: `${task.description || 'Task'} (${task.status || 'N/A'}): ${format(taskStart, 'MM/dd')} - ${format(taskEnd, 'MM/dd')}${task.assignee ? ' (' + task.assignee + ')' : ''}`
            };
        });
  }, [tasks, sprintStartDate, sprintEndDate]);

  if (chartData.length === 0) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">No tasks with valid start/end dates to display.</div>;
  }

  const sprintDays = differenceInDays(parseISO(sprintEndDate!), parseISO(sprintStartDate!)) + 1;

  // Generate ticks for X-axis (e.g., every few days)
   const xTicks = Array.from({ length: sprintDays }, (_, i) => {
       const date = addDays(parseISO(sprintStartDate!), i);
       // Show tick maybe every 2 days or based on sprint length
       if (i % (sprintDays > 14 ? 2 : 1) === 0) {
           return format(date, 'MM/dd');
       }
       return ''; // Return empty string for non-labeled ticks
   }); //.filter(tick => tick !== ''); // Keep all ticks for ReferenceLines


  const chartConfig = {
    value: { label: 'Duration' }, // Dummy config, color is set per bar
  } satisfies ChartConfig;

  return (
    <ChartContainer config={chartConfig} className="h-[250px] w-full"> {/* Adjust height as needed */}
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={chartData}
          margin={{ top: 5, right: 20, left: 100, bottom: 5 }} // Adjust left margin for task names
          barCategoryGap={5} // Space between bars
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis
             type="number"
             domain={[0, sprintDays -1]} // Domain from day 0 to last day index
             // ticks={Array.from({ length: sprintDays }, (_, i) => i)} // Ticks for each day index
             // tickFormatter={(tick) => xTicks[tick] ?? ''} // Format ticks to dates
             tick={{ fontSize: 10 }}
             axisLine={false}
             tickLine={false}
             hide // Hide the default axis, we use ReferenceLines
           />
           {/* Add ReferenceLines for Date Ticks */}
            {Array.from({ length: sprintDays }, (_, i) => (
               <ReferenceLine
                 key={`day-${i}`}
                 x={i}
                 stroke="hsl(var(--border))"
                 strokeDasharray="3 3"
                 label={{ value: xTicks[i] ?? '', position: 'bottom', fontSize: 10, fill: 'hsl(var(--muted-foreground))', dy: 10 }}
               />
            ))}
          <YAxis
            dataKey="taskIndex"
            type="number"
            domain={[-1, chartData.length]} // Adjust domain to include space around bars
            tickFormatter={(index) => chartData[index]?.name ?? ''} // Use task names as labels
            tick={{ fontSize: 10, width: 90, textAnchor: 'end' }} // Adjust width and anchor
            axisLine={false}
            tickLine={false}
            interval={0} // Show all ticks
            />
           <Tooltip
              cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
              content={({ payload }) => {
                 if (payload && payload.length > 0 && payload[0].payload) {
                     const data = payload[0].payload;
                     return (
                         <div className="text-xs bg-background border rounded px-2 py-1 shadow-sm">
                             <p className="font-semibold" style={{ color: data.fill }}>{data.tooltip}</p>
                         </div>
                     );
                 }
                 return null;
              }}
             />
          <Bar dataKey="range" radius={2} barSize={10}> {/* Use radius and adjust barSize */}
            {/* We set fill color directly in chartData */}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
