// src/components/analytics/analytics-charts-tab.tsx
"use client";

import type { SprintData, Member, Sprint } from '@/types/sprint-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import VelocityChart from '@/components/charts/velocity-chart';
import BurndownChart from '@/components/charts/burndown-chart';
import DeveloperEffortChart from '@/components/charts/developer-effort-chart'; // Import DeveloperEffortChart
import { Info, LineChart, TrendingDown, Users } from 'lucide-react';
import { useMemo } from 'react';

interface AnalyticsChartsTabProps {
  sprintData: SprintData | null;
  members: Member[];
  projectName: string;
}

export default function AnalyticsChartsTab({ sprintData, members, projectName }: AnalyticsChartsTabProps) {
  const activeSprint: Sprint | null | undefined = useMemo(() => {
    if (!sprintData || !sprintData.sprints) return null;
    return sprintData.sprints.find(s => s.status === 'Active') || sprintData.sprints.filter(s => s.status === 'Completed').sort((a,b) => b.sprintNumber - a.sprintNumber)[0];
  }, [sprintData]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Velocity Chart */}
      <Card className="lg:col-span-1 h-[400px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LineChart className="h-5 w-5 text-primary" /> Velocity Chart
          </CardTitle>
          <CardDescription>Committed vs. Completed points for project '{projectName}'.</CardDescription>
        </CardHeader>
        <CardContent className="h-[calc(100%-100px)] pl-2">
          {sprintData && sprintData.sprints && sprintData.sprints.length > 0 ? (
            <VelocityChart data={sprintData.sprints} />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <Info className="mr-2 h-5 w-5" /> No sprint data for velocity chart.
            </div>
          )}
        </CardContent>
      </Card>

       {/* Burndown Chart */}
       <Card className="lg:col-span-1 h-[400px]">
          <CardHeader>
             <CardTitle className="flex items-center justify-center gap-2">
                <TrendingDown className="h-5 w-5 text-primary" /> Burndown Chart
             </CardTitle>
             <CardDescription className="text-center">Ideal vs. Actual burndown for {activeSprint ? `Sprint ${activeSprint.sprintNumber}` : 'latest/active sprint'}.</CardDescription>
          </CardHeader>
          <CardContent className="h-[calc(100%-100px)] pl-2">
             <BurndownChart activeSprint={activeSprint} />
          </CardContent>
       </Card>

        {/* Story Points per Developer */}
       <Card className="lg:col-span-1 h-[400px]">
          <CardHeader>
             <CardTitle className="flex items-center justify-center gap-2">
                <Users className="h-5 w-5 text-primary" /> Story Points / Developer
             </CardTitle>
             <CardDescription className="text-center">Completed story points per developer across sprints.</CardDescription>
          </CardHeader>
          <CardContent className="h-[calc(100%-100px)] pl-2">
             <DeveloperEffortChart sprintData={sprintData} members={members} />
          </CardContent>
       </Card>

        {/* Add more chart placeholders as needed */}
         <Card className="lg:col-span-1 h-[400px] flex flex-col items-center justify-center border-dashed border-2">
          <CardHeader className="text-center">
             <CardTitle className="flex items-center justify-center gap-2">
                <Info className="h-5 w-5 text-muted-foreground" /> Future Chart
             </CardTitle>
             <CardDescription>(Another insightful chart will be displayed here)</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center text-muted-foreground">
             <Info className="mr-2 h-5 w-5" />
             (Placeholder)
          </CardContent>
       </Card>
    </div>
  );
}
