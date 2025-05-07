"use client";

import type { DailyProgressDataPoint } from '@/types/sprint-data';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { Info } from 'lucide-react';

interface DailyProgressChartProps {
  data: DailyProgressDataPoint[];
}

const chartConfig = {
  points: {
    label: "Points Completed",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

export default function DailyProgressChart({ data }: DailyProgressChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <Info className="mr-2 h-5 w-5" />
        <span>No daily progress data for this sprint.</span>
      </div>
    );
  }

  // Calculate max points for Y-axis domain
  const maxPoints = Math.max(...data.map(d => d.points), 0);
  const yAxisMax = maxPoints > 0 ? Math.ceil(maxPoints * 1.1) : 10; // Add 10% padding or default to 10


  return (
    <ChartContainer config={chartConfig} className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            fontSize={10}
            interval="preserveStartEnd" // Show first and last, and some in between
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            fontSize={10}
            allowDecimals={false}
            domain={[0, yAxisMax]}
          />
          <Tooltip
            content={<ChartTooltipContent hideLabel />}
            cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
          />
          {/* <Legend verticalAlign="top" height={36} /> */}
          <Bar dataKey="points" fill="var(--color-points)" radius={4} name="Points Completed" />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}