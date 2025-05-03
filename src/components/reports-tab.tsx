
import type { SprintData } from '@/types/sprint-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import VelocityChart from '@/components/charts/velocity-chart';
import BurndownChart from '@/components/charts/burndown-chart';
import DeveloperPointsChart from '@/components/charts/developer-points-chart';
import { LineChart, Users, Info } from 'lucide-react'; // Removed BarChart icon if not needed directly

interface ReportsTabProps {
  sprintData: SprintData | null;
}

export default function ReportsTab({ sprintData }: ReportsTabProps) {
  // Determine which sprint's burndown to show (e.g., the last one)
  const activeBurndownSprint = sprintData?.sprints && sprintData.sprints.length > 0
                                ? sprintData.sprints[sprintData.sprints.length - 1]
                                : null;

  if (!sprintData) {
    return (
      <Card className="flex flex-col items-center justify-center min-h-[400px] border-dashed border-2">
        <CardHeader className="text-center">
          <CardTitle>No Data for Reports</CardTitle>
          <CardDescription>Please add sprint data using the 'Entry' tab first.</CardDescription>
        </CardHeader>
         <CardContent className="flex items-center justify-center text-muted-foreground">
             <Info className="mr-2 h-5 w-5" />
             Reports will appear here once data is available.
         </CardContent>
      </Card>
    );
  }


  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
       {/* Velocity Chart */}
      <Card className="lg:col-span-1 h-[400px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LineChart className="h-5 w-5 text-primary" /> Velocity Chart
          </CardTitle>
          <CardDescription>Team's capacity over past sprints.</CardDescription>
        </CardHeader>
        <CardContent className="h-[calc(100%-100px)] pl-2">
           <VelocityChart data={sprintData.sprints} />
        </CardContent>
      </Card>

      {/* Burndown Chart */}
      <Card className="lg:col-span-1 h-[400px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {/* Burndown Icon SVG */}
             <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg>
            Burndown Chart
            </CardTitle>
            <CardDescription>
              {activeBurndownSprint ? `Progress for Sprint ${activeBurndownSprint.sprintNumber}` : 'Sprint progress tracking.'}
            </CardDescription>
        </CardHeader>
        <CardContent className="h-[calc(100%-100px)] pl-2">
           {activeBurndownSprint ? (
            <BurndownChart
                data={activeBurndownSprint.dailyBurndown}
                totalDays={activeBurndownSprint.totalDays}
                committedPoints={activeBurndownSprint.committedPoints} />
           ) : (
               <p className="text-muted-foreground text-center pt-10">No sprint data for burndown.</p>
           )}
        </CardContent>
      </Card>

       {/* Developer Points Chart */}
      <Card className="lg:col-span-1 h-[400px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> Developer Points
          </CardTitle>
          <CardDescription>Story points completed per developer per day.</CardDescription>
        </CardHeader>
        <CardContent className="h-[calc(100%-100px)] pl-2">
           <DeveloperPointsChart data={sprintData.developerPoints} />
        </CardContent>
      </Card>
    </div>
  );
}
```