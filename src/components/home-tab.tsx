
import type { SprintData } from '@/types/sprint-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from '@/components/ui/button';
import { Info, Edit } from 'lucide-react';
import Link from 'next/link'; // Import Link

interface HomeTabProps {
  sprintData: SprintData | null;
  projectName: string;
  projectId: string; // Add projectId prop
  // Removed onEditSprint prop
}

export default function HomeTab({ sprintData, projectName, projectId }: HomeTabProps) {
  return (
    <Card>
      <CardHeader>
        {/* Display Project Name */}
        <CardTitle>Project: {projectName}</CardTitle>
        <CardDescription>
          This tab provides a summary of the sprint data loaded for the selected project.
          Use the 'Entry' tab to add or modify basic sprint data (commitment/delivered).
          Click the 'Edit' icon to add detailed ticket information for a specific sprint.
          View charts and reports in the 'Reports' tab.
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
                    <TableHead className="w-[50px]">Actions</TableHead>
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
                       <TableCell>
                         {/* Link to the dynamic edit page */}
                         <Link href={`/projects/${projectId}/sprints/${sprint.sprintNumber}/edit`} passHref legacyBehavior>
                           <Button
                              asChild // Use asChild to make the Link the actual clickable element
                              variant="ghost"
                              size="icon"
                              aria-label={`Edit Sprint ${sprint.sprintNumber}`}
                           >
                             <a><Edit className="h-4 w-4" /></a>
                           </Button>
                         </Link>
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
