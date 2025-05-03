
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react'; // Added useMemo import
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog"; // Import Dialog
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PlusCircle, Trash2, Package, Save, ArrowUpDown, View, ArrowRightSquare } from 'lucide-react'; // Added View, ArrowRightSquare
import type { Task, Member, Sprint, SprintStatus } from '@/types/sprint-data'; // Added Sprint, SprintStatus
import { taskTypes, taskPriorities, initialBacklogTask } from '@/types/sprint-data';
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format, parseISO, isValid } from 'date-fns';

interface BacklogTabProps {
  projectId: string;
  projectName: string;
  initialBacklog: Task[];
  onSaveBacklog: (backlog: Task[]) => void;
  members: Member[]; // Keep members for initiator?
  sprints: Sprint[]; // Pass sprints to check for active/planned
  onMoveToSprint: (backlogItemId: string, targetSprintNumber: number) => void; // Callback to move item
}

interface BacklogRow extends Omit<Task, 'status'> { // Remove status field from row interface
  _internalId: string; // For React key management
  createdDateObj?: Date | undefined; // For date picker state
}

const createEmptyBacklogRow = (): BacklogRow => ({
  ...initialBacklogTask,
  _internalId: `backlog_${Date.now()}_${Math.random()}`,
  id: '', // Will be assigned on save if needed
  createdDate: format(new Date(), 'yyyy-MM-dd'), // Default created date to today
  createdDateObj: new Date(),
});

export default function BacklogTab({ projectId, projectName, initialBacklog, onSaveBacklog, members, sprints, onMoveToSprint }: BacklogTabProps) {
  const [backlogRows, setBacklogRows] = useState<BacklogRow[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const { toast } = useToast();
  const [viewingTask, setViewingTask] = useState<Task | null>(null); // State for viewing details dialog
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [movingTaskId, setMovingTaskId] = useState<string | null>(null);
  const [selectedTargetSprint, setSelectedTargetSprint] = useState<number | null>(null);

  const parseDateString = (dateString: string | undefined): Date | undefined => {
    if (!dateString) return undefined;
    try {
      const parsed = parseISO(dateString);
      return isValid(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  };

  // Active or planned sprints for the "Move to Sprint" dropdown
  const availableSprints = useMemo(() => {
      return sprints.filter(s => s.status === 'Active' || s.status === 'Planned').sort((a, b) => a.sprintNumber - b.sprintNumber);
  }, [sprints]);

  // Initialize or update rows based on initialBacklog prop
  useEffect(() => {
    const mappedBacklog = initialBacklog.map((task, index) => ({
        ...task,
        _internalId: task.id || `initial_backlog_${index}_${Date.now()}`,
        storyPoints: task.storyPoints?.toString() ?? '', // Ensure string for input
        taskType: task.taskType ?? 'New Feature', // Default type
        priority: task.priority ?? 'Medium', // Default priority
        createdDate: task.createdDate ?? format(new Date(), 'yyyy-MM-dd'), // Default created date
        createdDateObj: parseDateString(task.createdDate),
        initiator: task.initiator ?? '', // Default initiator
        dependsOn: task.dependsOn ?? [],
        backlogId: task.backlogId ?? task.ticketNumber ?? task.id, // Prioritize backlogId, fallback
    }));
    setBacklogRows(mappedBacklog);
    // Add one empty row if backlog is empty
    if (mappedBacklog.length === 0) {
        setBacklogRows([createEmptyBacklogRow()]);
    }
    setHasUnsavedChanges(false); // Reset unsaved changes on initial load or project change
  }, [initialBacklog, projectId]);

  // Track unsaved changes
   useEffect(() => {
        const cleanBacklog = (tasks: Task[]): Omit<Task, 'id' | 'status' | 'createdDateObj' | '_internalId'>[] =>
           tasks.map(({ id, status, createdDateObj, _internalId, backlogId, ...rest }) => ({
               ...rest,
               backlogId: (backlogId || rest.ticketNumber || id)?.trim(), // Use backlogId for comparison
               title: rest.title?.trim() || '',
               description: rest.description?.trim() || '',
               storyPoints: rest.storyPoints?.toString().trim() || '',
               priority: rest.priority ?? 'Medium',
               taskType: rest.taskType ?? 'New Feature',
               createdDate: rest.createdDate ?? '',
               initiator: rest.initiator?.trim() || '',
               dependsOn: rest.dependsOn || [],
               // Omit sprint-specific fields for comparison
               devEstimatedTime: undefined,
               qaEstimatedTime: undefined,
               bufferTime: undefined,
               assignee: undefined,
               reviewer: undefined,
               startDate: undefined,
               ticketNumber: undefined, // Remove ticketNumber from comparison if backlogId is primary
           })).sort((a, b) => (a.backlogId || '').localeCompare(b.backlogId || '')); // Sort consistently by backlogId

       const originalBacklogString = JSON.stringify(cleanBacklog(initialBacklog));
       const currentBacklogString = JSON.stringify(
           cleanBacklog(
               backlogRows.filter(row => row.backlogId?.trim() || row.title?.trim() || row.storyPoints) // Filter empty before comparing
           )
       );
       setHasUnsavedChanges(originalBacklogString !== currentBacklogString);
   }, [backlogRows, initialBacklog]);


  const handleAddRow = () => {
    setBacklogRows(prev => [...prev, createEmptyBacklogRow()]);
  };

  const handleRemoveRow = (internalId: string) => {
    setBacklogRows(prevRows => {
        const newRows = prevRows.filter(row => row._internalId !== internalId);
        // Keep at least one empty row if all are removed
        return newRows.length > 0 ? newRows : [createEmptyBacklogRow()];
    });
  };

  const handleInputChange = (internalId: string, field: keyof Omit<BacklogRow, 'id' | '_internalId' | 'dependsOn' | 'createdDateObj'>, value: string | number | undefined) => {
    setBacklogRows(rows =>
      rows.map(row => (row._internalId === internalId ? { ...row, [field]: value ?? '' } : row))
    );
  };

   const handleDateChange = (internalId: string, field: 'createdDate', date: Date | undefined) => {
     const dateString = date ? format(date, 'yyyy-MM-dd') : '';
     setBacklogRows(rows =>
       rows.map(row =>
         row._internalId === internalId
           ? { ...row, [field]: dateString, [`${field}Obj`]: date }
           : row
       )
     );
   };

  const handleSelectChange = (internalId: string, field: 'taskType' | 'priority' | 'initiator', value: string) => {
     let finalValue: string | undefined | null = value;
     if (value === 'none') {
        finalValue = undefined; // Treat 'none' as undefined for saving
     }
    handleInputChange(internalId, field, finalValue);
  };

  const handleViewDetails = (task: BacklogRow) => {
      setViewingTask(task);
      setIsViewDialogOpen(true);
  };

   const handleOpenMoveDialog = (taskId: string) => {
     setMovingTaskId(taskId);
     setSelectedTargetSprint(null); // Reset selection
     setIsMoveDialogOpen(true);
   };

   const handleConfirmMoveToSprint = () => {
     if (!movingTaskId || selectedTargetSprint === null) {
       toast({ variant: "destructive", title: "Error", description: "No target sprint selected." });
       return;
     }
     onMoveToSprint(movingTaskId, selectedTargetSprint);
     setIsMoveDialogOpen(false);
     setMovingTaskId(null);
   };

  const handleSave = () => {
    let hasErrors = false;
    const finalBacklog: Task[] = [];
    const backlogIds = new Set<string>(); // To check for duplicate IDs

    backlogRows.forEach((row, index) => {
      // Skip completely empty rows silently
      if (!row.backlogId?.trim() && !row.title?.trim() && !row.storyPoints?.toString().trim()) {
        return;
      }

      const backlogId = row.backlogId?.trim() || ''; // Ensure string
      const title = row.title?.trim();
      const description = row.description?.trim();
      const storyPointsRaw = row.storyPoints?.toString().trim();
      const storyPoints = storyPointsRaw ? parseInt(storyPointsRaw, 10) : undefined;
      const taskType = row.taskType ?? 'New Feature';
      const createdDate = row.createdDate ?? '';
      const initiator = row.initiator?.trim() || undefined;
      const dependsOn = row.dependsOn || [];
      const priority = row.priority ?? 'Medium';

      let rowErrors: string[] = [];
      if (!backlogId) rowErrors.push("Backlog ID required");
      if (backlogId && backlogIds.has(backlogId.toLowerCase())) rowErrors.push(`Duplicate Backlog ID "${backlogId}"`);
      if (!title) rowErrors.push("Title required"); // Make title required
      if (storyPointsRaw && (isNaN(storyPoints as number) || (storyPoints as number) < 0)) rowErrors.push("Invalid Story Points");
       if (!createdDate || !isValid(parseISO(createdDate))) rowErrors.push("Invalid Created Date (use YYYY-MM-DD)");
      if (!taskType || !taskTypes.includes(taskType)) rowErrors.push("Invalid Task Type");
      if (!priority || !taskPriorities.includes(priority)) rowErrors.push("Invalid Priority");
      // Add validation for initiator if needed (e.g., check against members list)
      // Add validation for dependsOn IDs if needed (check if they exist in the backlog)

      if (rowErrors.length > 0) {
        toast({
          variant: "destructive",
          title: `Error in Backlog Row ${index + 1}`,
          description: rowErrors.join(', ')
        });
        hasErrors = true;
        return; // Stop processing this row
      }

       if (backlogId) backlogIds.add(backlogId.toLowerCase()); // Add valid id to set

      finalBacklog.push({
        id: row.id || `backlog_${projectId}_${Date.now()}_${index}`, // Generate ID if new
        backlogId: backlogId,
        ticketNumber: backlogId, // Default ticket number to backlog id
        title,
        description,
        storyPoints,
        taskType,
        createdDate,
        initiator,
        dependsOn,
        priority,
        // Reset sprint-specific fields
        devEstimatedTime: undefined,
        qaEstimatedTime: undefined,
        bufferTime: undefined,
        assignee: undefined,
        reviewer: undefined,
        status: undefined, // No status field in backlog-specific type anymore
        startDate: undefined,
      });
    });

    if (hasErrors) {
      return;
    }

    // Sort backlog by priority then ID before saving
    finalBacklog.sort((a, b) => (taskPriorities.indexOf(a.priority!) - taskPriorities.indexOf(b.priority!)) || (a.backlogId ?? '').localeCompare(b.backlogId ?? ''));


    onSaveBacklog(finalBacklog);
    setHasUnsavedChanges(false); // Reset unsaved changes flag after successful save
     // Update state to reflect sorted/cleaned data with potentially new IDs
     setBacklogRows(finalBacklog.map((task, index) => ({
        ...task,
        storyPoints: task.storyPoints?.toString() ?? '',
        _internalId: task.id || `saved_backlog_${index}_${Date.now()}`, // Use saved ID or generate new internal ID
        createdDateObj: parseDateString(task.createdDate),
     })));
     if (finalBacklog.length === 0) {
        setBacklogRows([createEmptyBacklogRow()]); // Ensure one empty row if saved backlog is empty
     }
  };

  return (
    <>
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5 text-primary" /> Project Backlog: {projectName}</CardTitle>
            <CardDescription>Manage tasks that are not yet planned for a specific sprint. Add, edit, prioritize, and detail backlog items.</CardDescription>
          </div>
          <Button onClick={handleSave} disabled={!hasUnsavedChanges}>
             <Save className="mr-2 h-4 w-4" /> Save Backlog
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto">
            <div className="min-w-[1200px] space-y-4"> {/* Adjust min-width as needed */}
                {/* Backlog Table Header */}
                <div className="hidden md:grid grid-cols-[100px_1fr_120px_120px_120px_100px_100px_80px_40px] gap-x-3 items-center pb-2 border-b">
                    <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><ArrowUpDown className="h-3 w-3" /> Backlog ID*</Label>
                    <Label className="text-xs font-medium text-muted-foreground">Title*</Label>
                    <Label className="text-xs font-medium text-muted-foreground">Task Type*</Label>
                    <Label className="text-xs font-medium text-muted-foreground">Initiator</Label>
                    <Label className="text-xs font-medium text-muted-foreground">Created Date*</Label>
                    <Label className="text-xs font-medium text-muted-foreground">Priority*</Label>
                    <Label className="text-xs font-medium text-muted-foreground">Dependencies</Label>
                    <Label className="text-xs font-medium text-muted-foreground text-center">Actions</Label>
                    <div /> {/* Placeholder for delete */}
                </div>

                {/* Backlog Rows */}
                <div className="space-y-4 md:space-y-2">
                {backlogRows.map((row) => (
                    <div key={row._internalId} className="grid grid-cols-2 md:grid-cols-[100px_1fr_120px_120px_120px_100px_100px_80px_40px] gap-x-3 gap-y-2 items-start border-b md:border-none pb-4 md:pb-0 last:border-b-0">
                    {/* Backlog ID */}
                    <div className="md:col-span-1 col-span-1">
                        <Label htmlFor={`backlog-id-${row._internalId}`} className="md:hidden text-xs font-medium">Backlog ID*</Label>
                        <Input
                            id={`backlog-id-${row._internalId}`}
                            value={row.backlogId ?? ''}
                            onChange={e => handleInputChange(row._internalId, 'backlogId', e.target.value)}
                            placeholder="ID-123"
                            className="h-9"
                            required
                        />
                    </div>
                    {/* Title */}
                    <div className="md:col-span-1 col-span-2">
                        <Label htmlFor={`backlog-title-${row._internalId}`} className="md:hidden text-xs font-medium">Title*</Label>
                        <Input
                            id={`backlog-title-${row._internalId}`}
                            value={row.title ?? ''}
                            onChange={e => handleInputChange(row._internalId, 'title', e.target.value)}
                            placeholder="Task Title"
                            className="h-9"
                            required
                        />
                    </div>
                     {/* Task Type */}
                     <div className="md:col-span-1 col-span-1">
                         <Label htmlFor={`backlog-type-${row._internalId}`} className="md:hidden text-xs font-medium">Task Type*</Label>
                         <Select value={row.taskType ?? 'New Feature'} onValueChange={(value) => handleSelectChange(row._internalId, 'taskType', value)}>
                             <SelectTrigger id={`backlog-type-${row._internalId}`} className="h-9">
                                 <SelectValue placeholder="Type" />
                             </SelectTrigger>
                             <SelectContent>
                                 {taskTypes.map(option => (
                                     <SelectItem key={option} value={option}>{option}</SelectItem>
                                 ))}
                             </SelectContent>
                         </Select>
                     </div>
                      {/* Initiator */}
                      <div className="md:col-span-1 col-span-1">
                         <Label htmlFor={`backlog-initiator-${row._internalId}`} className="md:hidden text-xs font-medium">Initiator</Label>
                         <Select
                             value={row.initiator ?? 'none'}
                             onValueChange={(value) => handleSelectChange(row._internalId, 'initiator', value)}
                             disabled={members.length === 0}
                         >
                             <SelectTrigger id={`backlog-initiator-${row._internalId}`} className="h-9">
                                 <SelectValue placeholder="Initiator" />
                             </SelectTrigger>
                             <SelectContent>
                                <SelectItem value="none" className="text-muted-foreground">-- None --</SelectItem>
                                {members.map(member => (
                                    <SelectItem key={member.id} value={member.name}>{member.name}</SelectItem>
                                ))}
                                {members.length === 0 && <SelectItem value="no-members" disabled>No members</SelectItem>}
                             </SelectContent>
                         </Select>
                      </div>
                     {/* Created Date */}
                     <div className="md:col-span-1 col-span-1">
                        <Label htmlFor={`backlog-created-${row._internalId}`} className="md:hidden text-xs font-medium">Created Date*</Label>
                        <Input
                            id={`backlog-created-${row._internalId}`}
                            type="date"
                            value={row.createdDate}
                            onChange={e => handleInputChange(row._internalId, 'createdDate', e.target.value)}
                            required className="h-9 w-full"
                        />
                        {/* Consider using the date picker component if preferred */}
                     </div>
                     {/* Priority */}
                     <div className="md:col-span-1 col-span-1">
                         <Label htmlFor={`backlog-priority-${row._internalId}`} className="md:hidden text-xs font-medium">Priority*</Label>
                         <Select value={row.priority ?? 'Medium'} onValueChange={(value) => handleSelectChange(row._internalId, 'priority', value)}>
                             <SelectTrigger id={`backlog-priority-${row._internalId}`} className="h-9">
                                 <SelectValue placeholder="Priority" />
                             </SelectTrigger>
                             <SelectContent>
                                 {taskPriorities.map(option => (
                                     <SelectItem key={option} value={option}>{option}</SelectItem>
                                 ))}
                             </SelectContent>
                         </Select>
                     </div>
                     {/* Dependencies (Display Only) */}
                     <div className="md:col-span-1 col-span-1 self-center">
                        <Label htmlFor={`backlog-deps-${row._internalId}`} className="md:hidden text-xs font-medium">Dependencies</Label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                               <div className="text-xs text-muted-foreground truncate h-9 flex items-center">
                                  {(row.dependsOn && row.dependsOn.length > 0) ? row.dependsOn.join(', ') : 'None'}
                               </div>
                            </TooltipTrigger>
                            <TooltipContent>
                               <p className="text-xs">{(row.dependsOn && row.dependsOn.length > 0) ? row.dependsOn.join(', ') : 'No dependencies'}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                     </div>
                      {/* Actions Cell */}
                      <div className="md:col-span-1 col-span-2 flex items-center gap-1 justify-center">
                         <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleViewDetails(row)}>
                             <View className="h-4 w-4" />
                             <span className="sr-only">View Details</span>
                         </Button>
                         <Button
                             variant="ghost"
                             size="icon"
                             className="h-7 w-7"
                             disabled={availableSprints.length === 0}
                             onClick={() => handleOpenMoveDialog(row.id)}
                         >
                             <ArrowRightSquare className="h-4 w-4" />
                             <span className="sr-only">Move to Sprint</span>
                         </Button>
                     </div>
                    {/* Delete Button */}
                    <div className="flex items-center justify-end md:col-span-1 col-span-2 md:self-center md:mt-0 mt-1">
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveRow(row._internalId)}
                            className="h-9 w-9 text-muted-foreground hover:text-destructive"
                            aria-label="Remove backlog row"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                    </div>
                ))}
                </div>
                 <Button type="button" onClick={handleAddRow} variant="outline" size="sm" className="mt-4">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Backlog Item
                </Button>
            </div>
         </div>
      </CardContent>
      <CardFooter className="flex justify-between items-center border-t pt-4">
        <p className="text-xs text-muted-foreground">* Required field.</p>
        <Button onClick={handleSave} disabled={!hasUnsavedChanges}>
            <Save className="mr-2 h-4 w-4" /> Save Backlog
        </Button>
      </CardFooter>
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
                        <span className="col-span-2">{viewingTask.createdDate ? format(parseISO(viewingTask.createdDate), 'PPP') : '-'}</span>
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
                </div>
             )}
            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="outline">Close</Button>
                </DialogClose>
            </DialogFooter>
        </DialogContent>
     </Dialog>

      {/* Move to Sprint Dialog */}
     <Dialog open={isMoveDialogOpen} onOpenChange={setIsMoveDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
                <DialogTitle>Move Backlog Item to Sprint</DialogTitle>
                <DialogDescription>
                    Select the target sprint to move backlog item '{backlogRows.find(r => r.id === movingTaskId)?.backlogId}' to.
                </DialogDescription>
            </DialogHeader>
             <div className="py-4">
                <Label htmlFor="target-sprint">Target Sprint</Label>
                 <Select
                     value={selectedTargetSprint?.toString()}
                     onValueChange={(value) => setSelectedTargetSprint(value ? parseInt(value, 10) : null)}
                 >
                     <SelectTrigger id="target-sprint">
                         <SelectValue placeholder="Select a sprint..." />
                     </SelectTrigger>
                     <SelectContent>
                         {availableSprints.map(sprint => (
                             <SelectItem key={sprint.sprintNumber} value={sprint.sprintNumber.toString()}>
                                 Sprint {sprint.sprintNumber} ({sprint.status})
                             </SelectItem>
                         ))}
                     </SelectContent>
                 </Select>
             </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="outline">Cancel</Button>
                </DialogClose>
                <Button onClick={handleConfirmMoveToSprint} disabled={selectedTargetSprint === null}>
                    Move Item
                </Button>
            </DialogFooter>
        </DialogContent>
     </Dialog>
    </>
  );
}

