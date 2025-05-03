"use client";

import type { SprintData, Member } from '@/types/sprint-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import VelocityChart from '@/components/charts/velocity-chart';
// import BurndownChart from '@/components/charts/burndown-chart'; // Import when created
// import DeveloperEffortChart from '@/components/charts/developer-effort-chart'; // Import when created
import { Info, LineChart, BarChart, Users } from 'lucide-react';

interface AnalyticsChartsTabProps {
  sprintData: SprintData | null;
  members: Member[]; // Pass members if needed for dev effort chart
  projectName: string;
}

export default function AnalyticsChartsTab({ sprintData, members, projectName }: AnalyticsChartsTabProps) {

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

       {/* Burndown Chart Placeholder */}
       <Card className="lg:col-span-1 h-[400px] flex flex-col items-center justify-center border-dashed border-2">
          <CardHeader className="text-center">
             <CardTitle className="flex items-center justify-center gap-2">
                <BarChart className="h-5 w-5 text-muted-foreground" /> Burndown Chart
             </CardTitle>
             <CardDescription>(Sprint Burndown chart will be displayed here)</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center text-muted-foreground">
             <Info className="mr-2 h-5 w-5" />
             (Placeholder)
          </CardContent>
       </Card>

        {/* Story Points per Developer Placeholder */}
       <Card className="lg:col-span-1 h-[400px] flex flex-col items-center justify-center border-dashed border-2">
          <CardHeader className="text-center">
             <CardTitle className="flex items-center justify-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" /> Story Points / Dev
             </CardTitle>
             <CardDescription>(Chart showing completed points per developer per sprint)</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center text-muted-foreground">
             <Info className="mr-2 h-5 w-5" />
             (Placeholder)
          </CardContent>
       </Card>

        {/* Add more chart placeholders as needed */}

    </div>
  );
}

