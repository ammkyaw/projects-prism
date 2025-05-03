
import type { SprintData } from '@/types/sprint-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import VelocityChart from '@/components/charts/velocity-chart';
import { LineChart, Info } from 'lucide-react';

interface ReportsTabProps {
  sprintData: SprintData | null;
  projectName: string; // Add project name prop
}

export default function ReportsTab({ sprintData, projectName }: ReportsTabProps) {

  if (!sprintData || !sprintData.sprints || sprintData.sprints.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center min-h-[400px] border-dashed border-2">
        <CardHeader className="text-center">
          {/* Display Project Name */}
          <CardTitle>No Data for Reports</CardTitle>
          <CardDescription>No sprint data available for project '{projectName}'. Add data using the 'Entry' tab first.</CardDescription>
        </CardHeader>
         <CardContent className="flex items-center justify-center text-muted-foreground">
             <Info className="mr-2 h-5 w-5" />
             Reports will appear here once data is available.
         </CardContent>
      </Card>
    );
  }


  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
       {/* Velocity Chart */}
      <Card className="lg:col-span-1 h-[400px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LineChart className="h-5 w-5 text-primary" /> Velocity Chart ({projectName})
          </CardTitle>
          <CardDescription>Team's capacity (committed vs. completed) for project '{projectName}'.</CardDescription>
        </CardHeader>
        <CardContent className="h-[calc(100%-100px)] pl-2">
           {/* Pass project's sprint data to the chart */}
           <VelocityChart data={sprintData.sprints} />
        </CardContent>
      </Card>

       {/* Placeholder for future reports */}
       <Card className="lg:col-span-1 h-[400px] flex flex-col items-center justify-center border-dashed border-2">
          <CardHeader className="text-center">
             <CardTitle>Additional Reports</CardTitle>
             <CardDescription>More reports for project '{projectName}' can be added here.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center text-muted-foreground">
             <Info className="mr-2 h-5 w-5" />
             (Future report area)
          </CardContent>
       </Card>

    </div>
  );
}
