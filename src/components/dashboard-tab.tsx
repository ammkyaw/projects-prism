
"use client";

import type { SprintData, Sprint } from '@/types/sprint-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Info, LineChart, BarChart, Activity } from 'lucide-react';
import VelocityChart from '@/components/charts/velocity-chart';
// Import BurndownChart component when it's created
// import BurndownChart from '@/components/charts/burndown-chart';

interface DashboardTabProps {
  sprintData: SprintData | null;
  projectName: string;
  projectId: string;
}

export default function DashboardTab({ sprintData, projectName, projectId }: DashboardTabProps) {

  const activeSprint = sprintData?.sprints.find(s => s.status === 'Active');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Active Sprint Overview */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary" /> Active Sprint Overview</CardTitle>
          <CardDescription>Summary of the currently active sprint for project: {projectName}.</CardDescription>
        </CardHeader>
        <CardContent>
          {activeSprint ? (
            <div className="space-y-2 text-sm">
              <p><strong>Sprint Number:</strong> {activeSprint.sprintNumber}</p>
              <p><strong>Status:</strong> <span className="font-semibold text-primary">{activeSprint.status}</span></p>
              <p><strong>Start Date:</strong> {activeSprint.startDate}</p>
              <p><strong>End Date:</strong> {activeSprint.endDate}</p>
              <p><strong>Goal:</strong> {activeSprint.planning?.goal || 'Not defined'}</p>
              <p><strong>Committed Points:</strong> {activeSprint.committedPoints}</p>
              {/* Add more relevant active sprint details here */}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-muted-foreground p-8 border border-dashed rounded-md min-h-[150px]">
              <Info className="mb-2 h-6 w-6" />
              <p>No active sprint found for this project.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Velocity Chart */}
      <Card className="lg:col-span-1 h-[350px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LineChart className="h-5 w-5 text-primary" /> Velocity
          </CardTitle>
          <CardDescription>Committed vs. Completed points over past sprints.</CardDescription>
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
      <Card className="lg:col-span-1 h-[350px] flex flex-col items-center justify-center border-dashed border-2">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
             <BarChart className="h-5 w-5 text-muted-foreground" /> Burndown Chart
          </CardTitle>
          <CardDescription>(Burndown chart will be displayed here)</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center text-muted-foreground">
          <Info className="mr-2 h-5 w-5" />
          (Placeholder for Burndown Chart)
        </CardContent>
      </Card>

       {/* Other Key Metrics Placeholder */}
       <Card className="lg:col-span-1 h-[350px] flex flex-col items-center justify-center border-dashed border-2">
        <CardHeader className="text-center">
          <CardTitle>Other Metrics</CardTitle>
          <CardDescription>(Additional key metrics can be shown here)</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center text-muted-foreground">
          <Info className="mr-2 h-5 w-5" />
          (Placeholder for other metrics)
        </CardContent>
      </Card>

    </div>
  );
}
