// src/components/sprints/sprint-summary-tab.tsx
'use client';

import type { SprintData, Sprint } from '@/types/sprint-data';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Info, Circle, Trash2, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SprintSummaryTabProps {
  sprintData: SprintData | null;
  projectName: string;
  projectId: string;
  onDeleteSprint: (sprintNumber: number) => void;
  onViewSprintPlanning: (sprint: Sprint) => void; // New prop to handle navigation
}

export default function SprintSummaryTab({
  sprintData,
  projectName,
  projectId,
  onDeleteSprint,
  onViewSprintPlanning, // Destructure new prop
}: SprintSummaryTabProps) {
  const getStatusBadgeVariant = (
    status: Sprint['status']
  ): 'default' | 'secondary' | 'outline' | 'destructive' | null | undefined => {
    switch (status) {
      case 'Active':
        return 'default';
      case 'Planned':
        return 'secondary';
      case 'Completed':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getStatusColorClass = (status: Sprint['status']): string => {
    switch (status) {
      case 'Active':
        return 'text-primary';
      case 'Planned':
        return 'text-muted-foreground';
      case 'Completed':
        return 'text-green-600';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-primary" /> Sprint Overview:{' '}
          {projectName}
        </CardTitle>
        <CardDescription>
          Overview of all sprints for the project. Click on a sprint number to
          view/edit its plan.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sprintData && sprintData.sprints && sprintData.sprints.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Sprint #</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Commitment</TableHead>
                    <TableHead className="text-right">Delivered</TableHead>
                    <TableHead className="w-[50px] text-center">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sprintData.sprints
                    .sort((a, b) => a.sprintNumber - b.sprintNumber)
                    .map((sprint) => (
                      <TableRow key={sprint.sprintNumber}>
                        <TableCell className="font-medium">
                          <Button
                            variant="link"
                            className="h-auto p-0 text-primary" // Styled as a link
                            onClick={() => onViewSprintPlanning(sprint)} // Call handler with sprint object
                          >
                            {sprint.sprintNumber}
                          </Button>
                        </TableCell>
                        <TableCell>{sprint.startDate || 'N/A'}</TableCell>
                        <TableCell>{sprint.endDate || 'N/A'}</TableCell>
                        <TableCell>
                          <Badge
                            variant={getStatusBadgeVariant(sprint.status)}
                            className="capitalize"
                          >
                            <Circle
                              className={cn(
                                'mr-1 h-2 w-2 fill-current',
                                getStatusColorClass(sprint.status)
                              )}
                            />
                            {sprint.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {sprint.committedPoints}
                        </TableCell>
                        <TableCell className="text-right">
                          {sprint.completedPoints}
                        </TableCell>
                        <TableCell className="text-center">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Delete Sprint ${sprint.sprintNumber}`}
                                title="Delete Sprint"
                                className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Are you absolutely sure?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone. This will
                                  permanently delete Sprint{' '}
                                  {sprint.sprintNumber} and all its associated
                                  data.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() =>
                                    onDeleteSprint(sprint.sprintNumber)
                                  }
                                  className={cn(
                                    buttonVariants({ variant: 'destructive' })
                                  )}
                                >
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
          <div className="flex min-h-[200px] flex-col items-center justify-center rounded-md border border-dashed p-8 text-muted-foreground">
            <Info className="mb-2 h-8 w-8" />
            <p className="text-center">
              No sprint data found for project '{projectName}'.
            </p>
            <p className="text-center text-sm">
              Plan a new sprint in the 'Planning' sub-tab.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
