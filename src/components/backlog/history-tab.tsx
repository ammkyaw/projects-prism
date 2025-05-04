"use client";

import React, { useState, useMemo } from 'react'; // Added React import
import type { Task, Sprint, HistoryStatus } from '@/types/sprint-data'; // Import HistoryStatus
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from '@/components/ui/checkbox'; // Import Checkbox
import { Info, History, ArrowUpDown, LinkIcon, View, Move, GitMerge, Split, Undo } from 'lucide-react'; // Import icons for history status and Undo
import { taskPriorities, taskTypes } from '@/types/sprint-data';
import { format, parseISO, isValid } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from '@/lib/utils';
import { Badge } from "@/components/ui/badge"; // Import Badge

interface HistoryTabProps {
  projectId: string;
  projectName: string;
  historyItems: Task[]; // Pass only items that have been moved/split/merged
  onUndoBacklogAction: (taskId: string) => void; // Callback to undo split/merge
}

type SortKey = 'priority' | 'title' | 'taskType' | 'createdDate' | 'movedToSprint' | 'historyStatus' | 'backlogId' | 'initiator' | 'needsGrooming' | 'readyForSprint'; // Added historyStatus
type SortDirection = 'asc' | 'desc';

// Helper function to get an icon based on HistoryStatus
const getHistoryStatusIcon = (status: HistoryStatus | undefined) => {
  switch (status) {
    case 'Move': return <Move className="h-3 w-3 mr-1 inline" />;
    case 'Split': return <Split className="h-3 w-3 mr-1 inline" />;
    case 'Merge': return <GitMerge className="h-3 w-3 mr-1 inline" />;
    default: return null;
  }
};

export default function HistoryTab({ projectId, projectName, historyItems, onUndoBacklogAction }: HistoryTabProps) {
  const [sortConfig, setSortConfig] = useState<{ key: SortKey, direction: SortDirection } | null>(null);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);


  const sortedHistory = useMemo(() => {
    let sortableItems = [...(historyItems || [])]; // Use historyItems
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortConfig.key) {
            case 'priority':
                aValue = taskPriorities.indexOf(a.priority || 'Medium');
                bValue = taskPriorities.indexOf(b.priority || 'Medium');
                break;
            case 'createdDate':
                 const dateA = a.createdDate && isValid(parseISO(a.createdDate)) ? parseISO(a.createdDate) : new Date(0);
                 const dateB = b.createdDate && isValid(parseISO(b.createdDate)) ? parseISO(b.createdDate) : new Date(0);
                 aValue = dateA.getTime();
                 bValue = dateB.getTime();
                break;
            case 'title':
                 aValue = a.title?.toLowerCase() || '';
                 bValue = b.title?.toLowerCase() || '';
                 break;
            case 'backlogId': // Add sorting for backlogId
                aValue = a.backlogId?.toLowerCase() || '';
                bValue = b.backlogId?.toLowerCase() || '';
                break;
            case 'initiator': // Add sorting for initiator
                aValue = a.initiator?.toLowerCase() || '';
                bValue = b.initiator?.toLowerCase() || '';
                break;
            case 'movedToSprint':
                  aValue = a.movedToSprint ?? Infinity; // Sort undefined/null last
                  bValue = b.movedToSprint ?? Infinity;
                  break;
             case 'historyStatus': // Add sorting for historyStatus
                 aValue = a.historyStatus || '';
                 bValue = b.historyStatus || '';
                 break;
            case 'taskType':
                  aValue = a.taskType || '';
                  bValue = b.taskType || '';
                  break;
            case 'needsGrooming': // Sort booleans (false first)
                 aValue = a.needsGrooming ? 1 : 0;
                 bValue = b.needsGrooming ? 1 : 0;
                 break;
            case 'readyForSprint': // Sort booleans (false first)
                 aValue = a.readyForSprint ? 1 : 0;
                 bValue = b.readyForSprint ? 1 : 0;
                 break;
            default:
                 aValue = (a[sortConfig.key as keyof Task] as any)?.toString().toLowerCase() || '';
                 bValue = (b[sortConfig.key as keyof Task] as any)?.toString().toLowerCase() || '';
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        // Secondary sort by backlogId if primary values are equal
        return (a.backlogId ?? '').localeCompare(b.backlogId ?? '');
      });
    } else {
        // Default sort by historyStatus (Move, Split, Merge), then movedToSprint, then priority
        const statusOrder: HistoryStatus[] = ['Move', 'Split', 'Merge'];
        sortableItems.sort((a, b) =>
            (statusOrder.indexOf(a.historyStatus!) - statusOrder.indexOf(b.historyStatus!)) ||
            (a.movedToSprint ?? Infinity) - (b.movedToSprint ?? Infinity) ||
            taskPriorities.indexOf(a.priority || 'Medium') - taskPriorities.indexOf(b.priority || 'Medium')
        );
    }
    return sortableItems;
  }, [historyItems, sortConfig]);

  const requestSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIndicator = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="ml-1 h-3 w-3 opacity-30 inline" />; // Consistent style
    }
    return sortConfig.direction === 'asc' ? '▲' : '▼';
  };

   const handleViewDetails = (task: Task) => {
       setViewingTask(task);
       setIsViewDialogOpen(true);
   };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><History className="h-5 w-5 text-primary" /> Backlog History</CardTitle>
          <CardDescription>View backlog items that have been moved, split, or merged for project '{projectName}'. Click headers to sort.</CardDescription>
        </CardHeader>
        <CardContent>
          {sortedHistory.length === 0 ? (
               <div className="flex flex-col items-center justify-center min-h-[200px] border-dashed border-2 rounded-md p-6">
                  <Info className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No historical backlog items found.</p>
               </div>
            ) : (
              <div className="overflow-x-auto">
                 {/* Adjust min-width if necessary to accommodate new columns */}
                <div className="min-w-[1500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                         <TableHead className="w-[120px]">
                             <Button variant="ghost" onClick={() => requestSort('backlogId')} className="px-1 h-auto justify-start text-xs font-medium text-muted-foreground">
                                 Backlog ID {getSortIndicator('backlogId')}
                             </Button>
                         </TableHead>
                         <TableHead>
                             <Button variant="ghost" onClick={() => requestSort('title')} className="px-1 h-auto justify-start text-xs font-medium text-muted-foreground">
                                 Title {getSortIndicator('title')}
                             </Button>
                         </TableHead>
                         <TableHead className="w-[120px]">
                             <Button variant="ghost" onClick={() => requestSort('taskType')} className="px-1 h-auto justify-start text-xs font-medium text-muted-foreground">
                                 Task Type {getSortIndicator('taskType')}
                             </Button>
                         </TableHead>
                         <TableHead className="w-[120px]">
                              <Button variant="ghost" onClick={() => requestSort('initiator')} className="px-1 h-auto justify-start text-xs font-medium text-muted-foreground">
                                  Initiator {getSortIndicator('initiator')}
                              </Button>
                         </TableHead>
                         <TableHead className="w-[120px]">
                              <Button variant="ghost" onClick={() => requestSort('createdDate')} className="px-1 h-auto justify-start text-xs font-medium text-muted-foreground">
                                  Created Date {getSortIndicator('createdDate')}
                              </Button>
                         </TableHead>
                         <TableHead className="w-[100px]">
                             <Button variant="ghost" onClick={() => requestSort('priority')} className="px-1 h-auto justify-start text-xs font-medium text-muted-foreground">
                                 Priority {getSortIndicator('priority')}
                             </Button>
                         </TableHead>
                          <TableHead className="w-[100px]">
                              Dependencies
                          </TableHead>
                          <TableHead className="w-[60px] text-center">
                               <Button variant="ghost" onClick={() => requestSort('needsGrooming')} className="px-1 h-auto justify-center text-xs font-medium text-muted-foreground">
                                  Groom? {getSortIndicator('needsGrooming')}
                              </Button>
                          </TableHead>
                          <TableHead className="w-[60px] text-center">
                              <Button variant="ghost" onClick={() => requestSort('readyForSprint')} className="px-1 h-auto justify-center text-xs font-medium text-muted-foreground">
                                  Ready? {getSortIndicator('readyForSprint')}
                              </Button>
                          </TableHead>
                          <TableHead className="w-[100px]"> {/* Add History Status Header */}
                              <Button variant="ghost" onClick={() => requestSort('historyStatus')} className="px-1 h-auto justify-start text-xs font-medium text-muted-foreground">
                                  Status {getSortIndicator('historyStatus')}
                              </Button>
                          </TableHead>
                          <TableHead className="w-[100px]">
                              <Button variant="ghost" onClick={() => requestSort('movedToSprint')} className="px-1 h-auto justify-start text-xs font-medium text-muted-foreground">
                                  Sprint # {getSortIndicator('movedToSprint')}
                              </Button>
                          </TableHead>
                         <TableHead className="w-[80px] text-right">Story Pts</TableHead>
                         <TableHead className="w-[80px] text-center">Actions</TableHead> {/* Added Action Header */}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedHistory.map(task => (
                        <TableRow key={task.id}>
                          <TableCell className="font-medium">
                            <button
                                type="button"
                                onClick={() => handleViewDetails(task)}
                                className="text-primary underline cursor-pointer hover:text-primary/80"
                                aria-label={`View details for ${task.backlogId}`}
                            >
                                {task.backlogId}
                            </button>
                          </TableCell>
                          <TableCell>{task.title}</TableCell>
                          <TableCell>{task.taskType}</TableCell>
                          <TableCell>{task.initiator || '-'}</TableCell>
                          <TableCell>{task.createdDate && isValid(parseISO(task.createdDate)) ? format(parseISO(task.createdDate), 'MMM d, yyyy') : 'N/A'}</TableCell>
                          <TableCell>{task.priority}</TableCell>
                           <TableCell className="text-xs">
                               {(task.dependsOn && task.dependsOn.length > 0) ? task.dependsOn.join(', ') : <span className="italic text-muted-foreground">None</span>}
                           </TableCell>
                            <TableCell className="text-center">
                                <Checkbox checked={task.needsGrooming} disabled className="h-4 w-4"/>
                            </TableCell>
                            <TableCell className="text-center">
                                <Checkbox checked={task.readyForSprint} disabled className="h-4 w-4"/>
                            </TableCell>
                           <TableCell>
                              {task.historyStatus ? (
                                  <Badge variant="outline" className="capitalize">
                                      {getHistoryStatusIcon(task.historyStatus)} {task.historyStatus}
                                  </Badge>
                              ) : (
                                  <span className="text-muted-foreground italic">N/A</span>
                              )}
                          </TableCell>
                           <TableCell>{task.movedToSprint ?? '-'}</TableCell>
                          <TableCell className="text-right">{task.storyPoints ?? '-'}</TableCell>
                           {/* Action Cell with Undo Button */}
                          <TableCell className="text-center">
                              {(task.historyStatus === 'Split' || task.historyStatus === 'Merge') && (
                                  <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => onUndoBacklogAction(task.id)}
                                      className="h-7 w-7 text-blue-600 hover:text-blue-700"
                                      title={`Undo ${task.historyStatus}`}
                                  >
                                      <Undo className="h-4 w-4" />
                                  </Button>
                              )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
             </div>
           )}
        </CardContent>
      </Card>

       {/* View Details Dialog */}
     <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Backlog Item Details: {viewingTask?.backlogId}</DialogTitle>
            </DialogHeader>
             {viewingTask && (
                <div className="grid gap-4 py-4 text-sm">
                    <div className="grid grid-cols-3 items-center gap-4">
                        <Label className="text-right font-medium text-muted-foreground">Title</Label>
                        <span className="col-span-2">{viewingTask.title || '-'}</span>
                    </div>
                    <div className="grid grid-cols-3 items-center gap-4">
                        <Label className="text-right font-medium text-muted-foreground">Type</Label>
                        <span className="col-span-2">{viewingTask.taskType}</span>
                    </div>
                    <div className="grid grid-cols-3 items-center gap-4">
                        <Label className="text-right font-medium text-muted-foreground">Priority</Label>
                        <span className="col-span-2">{viewingTask.priority}</span>
                    </div>
                    <div className="grid grid-cols-3 items-center gap-4">
                        <Label className="text-right font-medium text-muted-foreground">Initiator</Label>
                        <span className="col-span-2">{viewingTask.initiator || '-'}</span>
                    </div>
                    <div className="grid grid-cols-3 items-center gap-4">
                        <Label className="text-right font-medium text-muted-foreground">Created</Label>
                        <span className="col-span-2">{viewingTask.createdDate && isValid(parseISO(viewingTask.createdDate)) ? format(parseISO(viewingTask.createdDate), 'PPP') : '-'}</span>
                    </div>
                     <div className="grid grid-cols-3 items-start gap-4">
                        <Label className="text-right font-medium text-muted-foreground pt-1">Description</Label>
                        <p className="col-span-2 whitespace-pre-wrap break-words">{viewingTask.description || '-'}</p>
                    </div>
                     <div className="grid grid-cols-3 items-center gap-4">
                        <Label className="text-right font-medium text-muted-foreground">Dependencies</Label>
                        <span className="col-span-2">{(viewingTask.dependsOn && viewingTask.dependsOn.length > 0) ? viewingTask.dependsOn.join(', ') : 'None'}</span>
                    </div>
                    <div className="grid grid-cols-3 items-center gap-4">
                        <Label className="text-right font-medium text-muted-foreground">Story Points</Label>
                        <span className="col-span-2">{viewingTask.storyPoints || '-'}</span>
                    </div>
                     <div className="grid grid-cols-3 items-center gap-4">
                         <Label className="text-right font-medium text-muted-foreground">Needs Grooming</Label>
                         <span className="col-span-2">{viewingTask.needsGrooming ? 'Yes' : 'No'}</span>
                     </div>
                     <div className="grid grid-cols-3 items-center gap-4">
                         <Label className="text-right font-medium text-muted-foreground">Ready for Sprint</Label>
                         <span className="col-span-2">{viewingTask.readyForSprint ? 'Yes' : 'No'}</span>
                     </div>
                     <div className="grid grid-cols-3 items-center gap-4">
                         <Label className="text-right font-medium text-muted-foreground">History Status</Label>
                         <span className="col-span-2">{viewingTask.historyStatus ?? 'N/A'}</span>
                     </div>
                     <div className="grid grid-cols-3 items-center gap-4">
                         <Label className="text-right font-medium text-muted-foreground">Moved to Sprint</Label>
                         <span className="col-span-2">{viewingTask.movedToSprint ?? 'N/A'}</span>
                     </div>
                </div>
             )}
            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="outline">Close</Button>
                </DialogClose>
            </DialogFooter>
        </DialogContent>
     </Dialog>
    </>
  );
}

