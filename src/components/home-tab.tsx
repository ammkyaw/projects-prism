
import type { SprintData } from '@/types/sprint-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from '@/components/ui/button';
import { Info, Edit } from 'lucide-react'; // Keep Info icon, Add Edit icon

interface HomeTabProps {
  sprintData: SprintData | null;
  projectName: string; // Add project name prop
  onEditSprint?: (sprintNumber: number) => void; // Optional callback for edit
}

export default function HomeTab({ sprintData, projectName, onEditSprint }: HomeTabProps) {
  return (
    <Card>
      <CardHeader>
        {/* Display Project Name */}
        <CardTitle>Project: {projectName}</CardTitle>
        <CardDescription>
          This tab provides a summary of the sprint data loaded for the selected project.
          Use the 'Entry' tab to add or modify sprint details for this project.
          View the generated charts and reports in the 'Reports' tab.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sprintData && sprintData.sprints && sprintData.sprints.length > 0 ? (
          <>
            <h3 className="text-lg font-semibold mb-4">Sprint Summary</h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Sprint #</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead className="text-right">Commitment</TableHead>
                    <TableHead className="text-right">Delivered</TableHead>
                    {/* Removed Details header */}
                    <TableHead className="w-[50px]">Actions</TableHead> {/* Added Actions header */}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sprintData.sprints.map((sprint) => (
                    <TableRow key={sprint.sprintNumber}>
                      <TableCell className="font-medium">{sprint.sprintNumber}</TableCell>
                      <TableCell>{sprint.startDate || 'N/A'}</TableCell>
                      <TableCell>{sprint.endDate || 'N/A'}</TableCell>
                      <TableCell className="text-right">{sprint.committedPoints}</TableCell>
                      <TableCell className="text-right">{sprint.completedPoints}</TableCell>
                      {/* Removed Details cell */}
                       {/* Added Actions cell with Edit button */}
                       <TableCell>
                         <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onEditSprint?.(sprint.sprintNumber)} // Call callback on click
                            aria-label={`Edit Sprint ${sprint.sprintNumber}`}
                         >
                           <Edit className="h-4 w-4" />
                         </Button>
                       </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center text-muted-foreground p-8 border border-dashed rounded-md min-h-[200px]">
            <Info className="mb-2 h-8 w-8" />
             <p className="text-center">No sprint data loaded for project '{projectName}'.</p>
             <p className="text-center text-sm">Go to the 'Entry' tab to add data.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
