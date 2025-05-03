
import type { SprintData, Sprint } from '@/types/sprint-data'; // Import Sprint type
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge" // Import Badge
import { Button } from '@/components/ui/button';
import { Info, Edit, Circle } from 'lucide-react'; // Import Circle for status indicator
import Link from 'next/link'; // Import Link
import { cn } from '@/lib/utils'; // Import cn

interface HomeTabProps {
  sprintData: SprintData | null;
  projectName: string;
  projectId: string; // Add projectId prop
}

export default function HomeTab({ sprintData, projectName, projectId }: HomeTabProps) {

  const getStatusBadgeVariant = (status: Sprint['status']): "default" | "secondary" | "outline" | "destructive" | null | undefined => {
     switch (status) {
        case 'Active': return 'default'; // Use primary color (blue)
        case 'Planned': return 'secondary'; // Use secondary color (gray)
        case 'Completed': return 'outline'; // Use outline style
        default: return 'secondary';
     }
  };

   const getStatusColorClass = (status: Sprint['status']): string => {
     switch (status) {
       case 'Active': return 'text-primary'; // Blue
       case 'Planned': return 'text-muted-foreground'; // Gray
       case 'Completed': return 'text-green-600'; // Green (using direct Tailwind class for now)
       default: return 'text-muted-foreground';
     }
   };


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
                    <TableHead>Status</TableHead> {/* Add Status Header */}
                    <TableHead className="text-right">Commitment</TableHead>
                    <TableHead className="text-right">Delivered</TableHead>
                    <TableHead className="w-[50px] text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sprintData.sprints
                    .sort((a, b) => a.sprintNumber - b.sprintNumber) // Sort sprints by number
                    .map((sprint) => (
                    <TableRow key={sprint.sprintNumber}>
                      <TableCell className="font-medium">{sprint.sprintNumber}</TableCell>
                      <TableCell>{sprint.startDate || 'N/A'}</TableCell>
                      <TableCell>{sprint.endDate || 'N/A'}</TableCell>
                       <TableCell>
                           <Badge variant={getStatusBadgeVariant(sprint.status)} className="capitalize">
                              <Circle className={cn("mr-1 h-2 w-2 fill-current", getStatusColorClass(sprint.status))} />
                              {sprint.status}
                           </Badge>
                       </TableCell>
                      <TableCell className="text-right">{sprint.committedPoints}</TableCell>
                      <TableCell className="text-right">{sprint.completedPoints}</TableCell>
                       <TableCell className="text-center">
                         {/* Link to the dynamic edit page, disable if completed */}
                         <Link
                           href={`/projects/${projectId}/sprints/${sprint.sprintNumber}/edit`}
                           passHref
                           legacyBehavior
                           aria-disabled={sprint.status === 'Completed'}
                           tabIndex={sprint.status === 'Completed' ? -1 : undefined}
                           onClick={(e) => { if (sprint.status === 'Completed') e.preventDefault(); }}
                         >
                           <Button
                              asChild
                              variant="ghost"
                              size="icon"
                              aria-label={`Edit Sprint ${sprint.sprintNumber}`}
                              disabled={sprint.status === 'Completed'}
                              className={cn(sprint.status === 'Completed' && "cursor-not-allowed opacity-50")}
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
