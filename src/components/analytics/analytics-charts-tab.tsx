// src/components/analytics/analytics-charts-tab.tsx
"use client";

import type { SprintData, Member, Sprint } from '@/types/sprint-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import VelocityChart from '@/components/charts/velocity-chart';
import BurndownChart from '@/components/charts/burndown-chart';
import DeveloperEffortChart from '@/components/charts/developer-effort-chart';
import { Info, LineChart, TrendingDown, Users, AreaChart } from 'lucide-react'; // Added AreaChart for consistency
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import React, { useMemo, useState, useEffect } from 'react'; // Added useState and useEffect

interface AnalyticsChartsTabProps {
  sprintData: SprintData | null;
  members: Member[];
  projectName: string;
}

export default function AnalyticsChartsTab({ sprintData, members, projectName }: AnalyticsChartsTabProps) {
  const [selectedAnalyticSprintNumber, setSelectedAnalyticSprintNumber] = useState<number | null>(null);

  const availableSprintsForSelection = useMemo(() => {
    if (!sprintData || !sprintData.sprints) return [];
    return sprintData.sprints
      .filter(s => s.status === 'Active' || s.status === 'Completed')
      .sort((a, b) => b.sprintNumber - a.sprintNumber); // Show latest first
  }, [sprintData]);

  useEffect(() => {
    if (availableSprintsForSelection.length > 0 && selectedAnalyticSprintNumber === null) {
      // Default to the active sprint if available, otherwise the latest completed
      const active = availableSprintsForSelection.find(s => s.status === 'Active');
      if (active) {
        setSelectedAnalyticSprintNumber(active.sprintNumber);
      } else {
        setSelectedAnalyticSprintNumber(availableSprintsForSelection[0].sprintNumber);
      }
    } else if (availableSprintsForSelection.length === 0) {
      setSelectedAnalyticSprintNumber(null);
    }
  }, [availableSprintsForSelection, selectedAnalyticSprintNumber]);

  const displayedSprint: Sprint | null | undefined = useMemo(() => {
    if (!sprintData || !sprintData.sprints || selectedAnalyticSprintNumber === null) return null;
    return sprintData.sprints.find(s => s.sprintNumber === selectedAnalyticSprintNumber);
  }, [sprintData, selectedAnalyticSprintNumber]);

  return (
    <div className="space-y-6">
      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AreaChart className="h-5 w-5 text-primary" /> Sprint-Specific Analytics
              </CardTitle>
              <CardDescription>View burndown charts for a selected sprint.</CardDescription>
            </div>
            {availableSprintsForSelection.length > 0 && (
              <Select
                value={selectedAnalyticSprintNumber?.toString() ?? undefined}
                onValueChange={(value) => setSelectedAnalyticSprintNumber(value ? parseInt(value) : null)}
              >
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Select a sprint..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Sprints</SelectLabel>
                    {availableSprintsForSelection.map(s => (
                      <SelectItem key={s.sprintNumber} value={s.sprintNumber.toString()}>
                        Sprint {s.sprintNumber} ({s.status})
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        {availableSprintsForSelection.length === 0 && (
            <CardContent className="flex flex-col items-center justify-center text-muted-foreground p-8 border border-dashed rounded-md min-h-[150px]">
               <Info className="mb-2 h-6 w-6" />
               <p>No active or completed sprints found for analytics.</p>
           </CardContent>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Velocity Chart - Always shows all sprints */}
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

        {/* Burndown Chart - Shows data for the selected sprint */}
        <Card className="lg:col-span-1 h-[400px]">
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2">
              <TrendingDown className="h-5 w-5 text-primary" /> Burndown Chart
            </CardTitle>
            <CardDescription className="text-center">Ideal vs. Actual burndown for {displayedSprint ? `Sprint ${displayedSprint.sprintNumber}` : 'selected sprint'}.</CardDescription>
          </CardHeader>
          <CardContent className="h-[calc(100%-100px)] pl-2">
            <BurndownChart activeSprint={displayedSprint} />
          </CardContent>
        </Card>

        {/* Story Points per Developer - Shows data across all sprints */}
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
    </div>
  );
}
