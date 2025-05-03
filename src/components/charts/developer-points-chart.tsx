"use client";

import type { DeveloperDailyPoints } from '@/types/sprint-data';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart"


interface DeveloperPointsChartProps {
  data: DeveloperDailyPoints;
}

// Helper to generate distinct colors (simple implementation)
const generateColor = (index: number): string => {
  const colors = [
    "hsl(var(--chart-1))", // Blue
    "hsl(var(--chart-2))", // Gold
    "hsl(var(--chart-3))", // Muted Blue
    "hsl(var(--chart-4))", // Orange-ish
    "hsl(var(--chart-5))", // Green-ish
    "hsl(200 80% 60%)",
    "hsl(300 70% 65%)",
    "hsl(50 90% 55%)",
  ];
  return colors[index % colors.length];
};


export default function DeveloperPointsChart({ data }: DeveloperPointsChartProps) {
  if (!data || Object.keys(data).length === 0) {
     return <div className="flex items-center justify-center h-full text-muted-foreground">No developer data available.</div>;
  }

  // Aggregate data by date, summing points for each developer on that date
  const aggregatedData: { [date: string]: { name: string; [developer: string]: number } } = {};
  const developers = Object.keys(data);

  developers.forEach(dev => {
    Object.entries(data[dev]).forEach(([date, points]) => {
      if (!aggregatedData[date]) {
        aggregatedData[date] = { name: date };
         // Initialize points for all known developers to 0 for this date
         developers.forEach(d => aggregatedData[date][d] = 0);
      }
       aggregatedData[date][dev] = (aggregatedData[date][dev] || 0) + points; // Sum points if dev worked on multiple tasks same day
    });
  });


  // Convert aggregated data to array and sort by date
  const chartData = Object.values(aggregatedData).sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());


  // Generate chart config dynamically based on developers
   const chartConfig = developers.reduce((acc, dev, index) => {
    acc[dev] = {
      label: dev,
      color: generateColor(index),
    };
    return acc;
  }, {} as ChartConfig);


  return (
     <ChartContainer config={chartConfig} className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
         <BarChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}> {/* Adjusted margins */}
           <CartesianGrid strokeDasharray="3 3" vertical={false} />
           <XAxis
             dataKey="name"
             tickLine={false}
             axisLine={false}
             tickMargin={8}
             fontSize={12}
             // Can add formatter if dates are too long
             // tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
           />
           <YAxis tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
           <Tooltip
             cursor={false}
             content={<ChartTooltipContent hideLabel />} // Use ShadCN tooltip
           />
            {/* <Legend /> */} {/* Optional: Add legend */}
           {developers.map((dev) => (
             <Bar
               key={dev}
               dataKey={dev}
               stackId="a" // Stack the bars
               fill={`var(--color-${dev})`}
               radius={[4, 4, 0, 0]} // Rounded top corners
             />
           ))}
         </BarChart>
      </ResponsiveContainer>
     </ChartContainer>
  );
}
