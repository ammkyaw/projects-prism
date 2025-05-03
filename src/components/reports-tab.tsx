
import type { SprintData } from '@/types/sprint-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import VelocityChart from '@/components/charts/velocity-chart';
// Removed BurndownChart and DeveloperPointsChart imports
import { LineChart, Info } from 'lucide-react'; // Keep LineChart for Velocity, Info for empty state

interface ReportsTabProps {
  sprintData: SprintData | null;
}

export default function ReportsTab({ sprintData }: ReportsTabProps) {
  // Removed activeBurndownSprint logic

  if (!sprintData || !sprintData.sprints || sprintData.sprints.length === 0) {
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
    // Adjust grid layout if needed, e.g., grid-cols-1 or grid-cols-2
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
       {/* Velocity Chart */}
      <Card className="lg:col-span-1 h-[400px]"> {/* Spans one column */}
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LineChart className="h-5 w-5 text-primary" /> Velocity Chart
          </CardTitle>
          <CardDescription>Team's capacity (committed vs. completed) over past sprints.</CardDescription>
        </CardHeader>
        <CardContent className="h-[calc(100%-100px)] pl-2">
           <VelocityChart data={sprintData.sprints} />
        </CardContent>
      </Card>

      {/* Removed Burndown Chart Card */}

      {/* Removed Developer Points Chart Card */}

       {/* Placeholder for future reports or summary stats */}
       <Card className="lg:col-span-1 h-[400px] flex flex-col items-center justify-center border-dashed border-2">
          <CardHeader className="text-center">
             <CardTitle>Additional Reports</CardTitle>
             <CardDescription>More reports can be added here.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center text-muted-foreground">
             <Info className="mr-2 h-5 w-5" />
             (Future report area)
          </CardContent>
       </Card>

    </div>
  );
}
