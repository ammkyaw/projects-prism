"use client";

import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart"

interface BurndownChartProps {
  data: number[]; // Array of remaining points, index = day
  totalDays: number;
  committedPoints: number;
}


const chartConfig = {
  remaining: {
    label: "Remaining",
    color: "hsl(var(--primary))", // Blue
  },
  ideal: {
    label: "Ideal Burn",
    color: "hsl(var(--accent))", // Gold
  },
} satisfies ChartConfig

export default function BurndownChart({ data, totalDays, committedPoints }: BurndownChartProps) {
   if (!data || data.length === 0 || totalDays <= 0 || committedPoints <= 0) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">No burndown data available.</div>;
  }

  const chartData = data.map((points, index) => ({
    name: `Day ${index}`,
    day: index,
    remaining: points,
    // Calculate ideal burndown points for each day
    ideal: Math.max(0, committedPoints * (1 - index / totalDays)),
  }));


  return (
     <ChartContainer config={chartConfig} className="h-full w-full">
        <ResponsiveContainer width="100%" height="100%">
         <LineChart data={chartData} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}> {/* Adjusted margins */}
            <CartesianGrid strokeDasharray="3 3" vertical={false}/>
             <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                fontSize={12}
              />
            <YAxis
               tickLine={false}
               axisLine={false}
               tickMargin={8}
               fontSize={12}
               domain={[0, 'dataMax + 10']} // Ensure y-axis starts at 0 and has some padding
            />
            <Tooltip
              cursor={false}
              content={<ChartTooltipContent indicator="line" hideLabel />}
            />
            <Line
              type="monotone"
              dataKey="remaining"
              stroke="var(--color-remaining)"
              strokeWidth={2}
              dot={false}
            />
             <Line
              type="monotone"
              dataKey="ideal"
              stroke="var(--color-ideal)"
              strokeWidth={2}
              strokeDasharray="3 3" // Dashed line for ideal
              dot={false}
            />
             {/* Optional: Add a reference line at 0 */}
             {/* <ReferenceLine y={0} stroke="hsl(var(--foreground))" strokeDasharray="3 3" /> */}
          </LineChart>
        </ResponsiveContainer>
    </ChartContainer>
  );
}
