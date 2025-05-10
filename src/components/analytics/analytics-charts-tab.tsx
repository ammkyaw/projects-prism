// src/components/analytics/analytics-charts-tab.tsx
import React, { useMemo, useState, useEffect } from 'react';
import {
  AreaChart,
  Info,
  LineChart,
  TrendingDown,
  Users,
  BarChartBig,
  User,
  Bug,
  Wrench, // Import Wrench for Hotfix
  PieChart as PieChartIcon, // Icon for Pie Chart
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import VelocityChart from '@/components/charts/velocity-chart';
import BurndownChart from '@/components/charts/burndown-chart';
import DeveloperEffortChart from '@/components/charts/developer-effort-chart';
import BugCountChart from '@/components/charts/bug-count-chart'; // Import the BugCountChart
import BugSeverityChart from '@/components/charts/bug-severity-chart'; // Import the BugSeverityChart
import type { SprintData, Member, Sprint } from '@/types/sprint-data';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface AnalyticsChartsTabProps {
  sprintData: SprintData | null;
  members: Member[];
  projectName: string;
}

export default function AnalyticsChartsTab({
  sprintData,
  members,
  projectName,
}: AnalyticsChartsTabProps) {
  const [selectedAnalyticSprintNumber, setSelectedAnalyticSprintNumber] =
    useState<number | null>(null);
  const [
    selectedDeveloperIdForContribution,
    setSelectedDeveloperIdForContribution,
  ] = useState<string | null>('all');

  const softwareEngineers = useMemo(() => {
    return members.filter((member) => member.role === 'Software Engineer');
  }, [members]);

  const availableSprintsForSelection = useMemo(() => {
    if (!sprintData || !sprintData.sprints) return [];
    // Include Active sprints for burndown selection, Completed for others
    return sprintData.sprints
      .filter((s) => s.status === 'Active' || s.status === 'Completed')
      .sort((a, b) => b.sprintNumber - a.sprintNumber);
  }, [sprintData]);

  const completedOrActiveSprints = useMemo(() => {
    // Renamed for clarity
    if (!sprintData || !sprintData.sprints) return [];
    return sprintData.sprints
      .filter((s) => s.status === 'Completed' || s.status === 'Active')
      .sort((a, b) => a.sprintNumber - b.sprintNumber);
  }, [sprintData]);

  useEffect(() => {
    // Default to the active sprint if available, otherwise the latest completed sprint
    if (
      availableSprintsForSelection.length > 0 &&
      selectedAnalyticSprintNumber === null
    ) {
      const active = availableSprintsForSelection.find(
        (s) => s.status === 'Active'
      );
      if (active) {
        setSelectedAnalyticSprintNumber(active.sprintNumber);
      } else {
        // Find the most recent completed sprint
        const latestCompleted = availableSprintsForSelection.find(
          (s) => s.status === 'Completed'
        );
        if (latestCompleted) {
          setSelectedAnalyticSprintNumber(latestCompleted.sprintNumber);
        } else if (availableSprintsForSelection.length > 0) {
          // Fallback to the first available sprint if no active or completed found (shouldn't usually happen with the filter)
          setSelectedAnalyticSprintNumber(
            availableSprintsForSelection[0].sprintNumber
          );
        }
      }
    } else if (availableSprintsForSelection.length === 0) {
      setSelectedAnalyticSprintNumber(null);
    }
  }, [availableSprintsForSelection, selectedAnalyticSprintNumber]);

  const displayedSprintForBurndownAndSeverity: Sprint | null | undefined =
    useMemo(() => {
      // Renamed for clarity
      if (
        !sprintData ||
        !sprintData.sprints ||
        selectedAnalyticSprintNumber === null
      )
        return null;
      // Burndown and Severity can show active or completed sprints
      return sprintData.sprints.find(
        (s) => s.sprintNumber === selectedAnalyticSprintNumber
      );
    }, [sprintData, selectedAnalyticSprintNumber]);

  return (
    <div className="space-y-6">
      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AreaChart className="h-5 w-5 text-primary" /> Sprint-Specific
                Analytics
              </CardTitle>
              <CardDescription>
                Select a sprint to view its Burndown chart and Bug Severity
                Distribution. Other charts aggregate data from all relevant
                sprints.
              </CardDescription>
            </div>
            {availableSprintsForSelection.length > 0 && (
              <Select
                value={selectedAnalyticSprintNumber?.toString() ?? undefined}
                onValueChange={(value) =>
                  setSelectedAnalyticSprintNumber(
                    value ? parseInt(value) : null
                  )
                }
              >
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Select a sprint..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Sprints</SelectLabel>
                    {availableSprintsForSelection.map((s) => (
                      <SelectItem
                        key={s.sprintNumber}
                        value={s.sprintNumber.toString()}
                      >
                        Sprint {s.sprintNumber} ({s.status})
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        {availableSprintsForSelection.length === 0 &&
          !selectedAnalyticSprintNumber && ( // Ensure we show this if no sprint can be selected
            <CardContent className="flex min-h-[150px] flex-col items-center justify-center rounded-md border border-dashed p-8 text-muted-foreground">
              <Info className="mb-2 h-6 w-6" />
              <p>No active or completed sprints found for analytics.</p>
            </CardContent>
          )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Velocity Chart */}
        <Card className="h-[400px] lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <LineChart className="h-5 w-5 text-primary" /> Velocity Chart
            </CardTitle>
            <CardDescription>
              Committed vs. Completed points for project '{projectName}'.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[calc(100%-100px)] pl-2">
            {sprintData &&
            sprintData.sprints &&
            sprintData.sprints.length > 0 ? (
              <VelocityChart data={sprintData.sprints} />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <Info className="mr-2 h-5 w-5" /> No sprint data for velocity
                chart.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Burndown Chart */}
        <Card className="h-[400px] lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2 text-base">
              <TrendingDown className="h-5 w-5 text-primary" /> Burndown Chart
            </CardTitle>
            <CardDescription className="text-center">
              Ideal vs. Actual burndown for{' '}
              {displayedSprintForBurndownAndSeverity
                ? `Sprint ${displayedSprintForBurndownAndSeverity.sprintNumber}`
                : 'selected sprint'}
              .
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[calc(100%-100px)] pl-2">
            <BurndownChart
              activeSprint={displayedSprintForBurndownAndSeverity}
            />
          </CardContent>
        </Card>

        {/* Dev Team Contribution Chart */}
        <Card className="h-[450px] lg:col-span-1">
          <CardHeader>
            <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" /> Dev Team
                  Contribution
                </CardTitle>
                <CardDescription>
                  {selectedDeveloperIdForContribution === 'all' ||
                  !selectedDeveloperIdForContribution
                    ? `Completed story points by developer (stacked by task type) for Sprint ${selectedAnalyticSprintNumber || 'N/A'}.`
                    : `Completed story points by ${members.find((m) => m.id === selectedDeveloperIdForContribution)?.name || 'selected developer'} for the last 10 completed sprints.`}
                </CardDescription>
              </div>
              {softwareEngineers.length > 0 && (
                <Select
                  value={selectedDeveloperIdForContribution ?? 'all'}
                  onValueChange={(value) =>
                    setSelectedDeveloperIdForContribution(
                      value === 'all' ? null : value
                    )
                  }
                >
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue placeholder="Select Developer..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Developers</SelectLabel>
                      <SelectItem value="all">
                        All Developers (Sprint{' '}
                        {selectedAnalyticSprintNumber || 'N/A'})
                      </SelectItem>
                      {softwareEngineers.map((dev) => (
                        <SelectItem key={dev.id} value={dev.id}>
                          {dev.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardHeader>
          <CardContent className="h-[calc(100%-124px)] pl-2">
            <DeveloperEffortChart
              sprintData={sprintData}
              members={members}
              selectedDeveloperId={selectedDeveloperIdForContribution}
              selectedSprintNumber={selectedAnalyticSprintNumber}
            />
          </CardContent>
        </Card>

        {/* Bug Count Chart */}
        <Card className="h-[450px] lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bug className="h-5 w-5 text-destructive" />{' '}
              <Wrench className="h-5 w-5 text-red-500" />
              Bugs & Hotfixes per Sprint
            </CardTitle>
            <CardDescription>
              Number of tasks marked as 'Bug' or 'Hotfix' in completed/active
              sprints.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[calc(100%-100px)] pl-2">
            {completedOrActiveSprints.length > 0 ? (
              <BugCountChart data={completedOrActiveSprints} />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <Info className="mr-2 h-5 w-5" /> No completed or active sprints
                found to display issue counts.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bug Severity Chart - New Chart */}
        <Card className="h-[450px] lg:col-span-2">
          {' '}
          {/* Make it span 2 columns for better visibility */}
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PieChartIcon className="h-5 w-5 text-destructive" /> Bug Severity
              Distribution
            </CardTitle>
            <CardDescription>
              Distribution of bug severity from new tasks for sprint{' '}
              {displayedSprintForBurndownAndSeverity
                ? `Sprint ${displayedSprintForBurndownAndSeverity.sprintNumber}`
                : 'selected sprint'}
              .
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[calc(100%-100px)] pl-2">
            {displayedSprintForBurndownAndSeverity ? (
              <BugSeverityChart
                sprint={displayedSprintForBurndownAndSeverity}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <Info className="mr-2 h-5 w-5" /> No sprint selected for bug
                severity distribution.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}