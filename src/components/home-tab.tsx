

import type { SprintData, Sprint } from '@/types/sprint-data'; // Import Sprint type
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge" // Import Badge
import { Button, buttonVariants } from '@/components/ui/button'; // Import buttonVariants
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"; // Import AlertDialog components
import { Info, Edit, Circle, Trash2 } from 'lucide-react'; // Import Circle for status indicator and Trash2 for delete
import Link from 'next/link'; // Import Link
import { cn } from '@/lib/utils'; // Import cn

interface HomeTabProps {
  sprintData: SprintData | null;
  projectName: string;
  projectId: string; // Add projectId prop
  onDeleteSprint: (sprintNumber: number) => void; // Add delete callback prop
}

export default function HomeTab({ sprintData, projectName, projectId, onDeleteSprint }: HomeTabProps) {

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
                    <TableHead>Status</TableHead>{/* Add Status Header */}
                    <TableHead className="text-right">Commitment</TableHead>
                    <TableHead className="text-right">Delivered</TableHead>
                    <TableHead className="w-[100px] text-center">Actions</TableHead> {/* Adjusted width for two icons */}
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
                       <TableCell className="text-center space-x-1">
                         {/* Edit Button */}
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
                              title="Edit Sprint Details"
                              disabled={sprint.status === 'Completed'}
                              className={cn("h-8 w-8", sprint.status === 'Completed' && "cursor-not-allowed opacity-50")} // Smaller icon button
                           >
                             <a><Edit className="h-4 w-4" /></a>
                           </Button>
                         </Link>

                         {/* Delete Button with Confirmation */}
                         <AlertDialog>
                           <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Delete Sprint ${sprint.sprintNumber}`}
                                title="Delete Sprint"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" // Smaller icon button, destructive color
                                // Disable delete if sprint is active? Optional:
                                // disabled={sprint.status === 'Active'}
                                // className={cn("h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10", sprint.status === 'Active' && "cursor-not-allowed opacity-50")}
                              >
                               <Trash2 className="h-4 w-4" />
                              </Button>
                           </AlertDialogTrigger>
                           <AlertDialogContent>
                              <AlertDialogHeader>
                                 <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                 <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete Sprint {sprint.sprintNumber} and all its associated data (details, planning, etc.).
                                 </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                 <AlertDialogCancel>Cancel</AlertDialogCancel>
                                 <AlertDialogAction onClick={() => onDeleteSprint(sprint.sprintNumber)} className={cn(buttonVariants({ variant: "destructive" }))}>
                                     Delete Sprint {sprint.sprintNumber}
                                 </AlertDialogAction>
                              </AlertDialogFooter>
                           </AlertDialogContent>
                         </AlertDialog>
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
             <p className="text-center text-sm">Go to the 'Entry' or 'Planning' tab to add data.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
