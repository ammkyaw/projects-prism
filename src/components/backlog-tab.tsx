
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'; // Added React import
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PlusCircle, Trash2, Package, Save, ArrowUpDown, View, ArrowRightSquare, LinkIcon } from 'lucide-react'; // Added LinkIcon
import type { Task, Member, Sprint, SprintStatus, TaskType } from '@/types/sprint-data'; // Added TaskType
import { taskTypes, taskPriorities, initialBacklogTask } from '@/types/sprint-data';
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format, parseISO, isValid } from 'date-fns';
import SelectDependenciesDialog from '@/components/select-dependencies-dialog'; // Import the new dialog

interface BacklogTabProps {
  projectId: string;
  projectName: string;
  initialBacklog: Task[];
  onSaveBacklog: (backlog: Task[]) => void;
  members: Member[];
  sprints: Sprint[];
  onMoveToSprint: (backlogItemId: string, targetSprintNumber: number) => void;
}

interface BacklogRow extends Omit<Task, 'status'> {
  _internalId: string;
  createdDateObj?: Date | undefined;
  ref?: React.RefObject<HTMLDivElement>; // Add ref for scrolling
}

const createEmptyBacklogRow = (): BacklogRow => ({
  ...initialBacklogTask,
  _internalId: `backlog_${Date.now()}_${Math.random()}`,
  id: '',
  createdDate: format(new Date(), 'yyyy-MM-dd'),
  createdDateObj: new Date(),
  dependsOn: [], // Initialize dependsOn
});

export default function BacklogTab({ projectId, projectName, initialBacklog, onSaveBacklog, members, sprints, onMoveToSprint }: BacklogTabProps) {
  const [backlogRows, setBacklogRows] = useState<BacklogRow[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const { toast } = useToast();
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [movingTaskId, setMovingTaskId] = useState<string | null>(null);
  const [selectedTargetSprint, setSelectedTargetSprint] = useState<number | null>(null);
  const [isDepsDialogOpen, setIsDepsDialogOpen] = useState(false); // State for dependencies dialog
  const [editingDepsTaskId, setEditingDepsTaskId] = useState<string | null>(null); // ID of the task whose dependencies are being edited
  const backlogContainerRef = useRef<HTMLDivElement>(null); // Ref for the container of backlog rows

  // Map internal IDs to refs for scrolling
  const rowRefs = useRef<Map<string, React.RefObject<HTMLDivElement>>>(new Map());


  const parseDateString = (dateString: string | undefined): Date | undefined => {
    if (!dateString) return undefined;
    try {
      const parsed = parseISO(dateString);
      return isValid(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  };

  const availableSprints = useMemo(() => {
      return sprints.filter(s => s.status === 'Active' || s.status === 'Planned').sort((a, b) => a.sprintNumber - b.sprintNumber);
  }, [sprints]);

  // Initialize or update rows based on initialBacklog prop
  useEffect(() => {
      rowRefs.current.clear(); // Clear refs when backlog changes
      const mappedBacklog = initialBacklog.map((task, index) => {
          const internalId = task.id || `initial_backlog_${index}_${Date.now()}`;
          // Ensure each row has a ref
          if (!rowRefs.current.has(internalId)) {
              rowRefs.current.set(internalId, React.createRef<HTMLDivElement>());
          }
          return {
              ...task,
              _internalId: internalId,
              ref: rowRefs.current.get(internalId), // Assign ref
              storyPoints: task.storyPoints?.toString() ?? '',
              taskType: task.taskType ?? 'New Feature',
              priority: task.priority ?? 'Medium',
              createdDate: task.createdDate ?? format(new Date(), 'yyyy-MM-dd'),
              createdDateObj: parseDateString(task.createdDate),
              initiator: task.initiator ?? '',
              dependsOn: task.dependsOn ?? [],
              backlogId: task.backlogId ?? task.ticketNumber ?? task.id,
          };
      });
      setBacklogRows(mappedBacklog);
      if (mappedBacklog.length === 0) {
          const newRow = createEmptyBacklogRow();
          rowRefs.current.set(newRow._internalId, React.createRef<HTMLDivElement>());
          setBacklogRows([{ ...newRow, ref: rowRefs.current.get(newRow._internalId) }]);
      }
      setHasUnsavedChanges(false);
  }, [initialBacklog, projectId]);


  // Track unsaved changes
   useEffect(() => {
        const cleanBacklog = (tasks: Task[]): Omit<Task, 'id' | 'status' | 'createdDateObj' | '_internalId'>[] =>
           tasks.map(({ id, status, createdDateObj, _internalId, backlogId, ref, ...rest }: any) => ({ // Exclude ref
               ...rest,
               backlogId: (backlogId || rest.ticketNumber || id)?.trim(),
               title: rest.title?.trim() || '',
               description: rest.description?.trim() || '',
               storyPoints: rest.storyPoints?.toString().trim() || '',
               priority: rest.priority ?? 'Medium',
               taskType: rest.taskType ?? 'New Feature',
               createdDate: rest.createdDate ?? '',
               initiator: rest.initiator?.trim() || '',
               dependsOn: (rest.dependsOn || []).sort(), // Sort dependencies for consistent comparison
               devEstimatedTime: null,
               qaEstimatedTime: null,
               bufferTime: null,
               assignee: null,
               reviewer: null,
               startDate: null,
               ticketNumber: null,
           })).sort((a, b) => (a.backlogId || '').localeCompare(b.backlogId || ''));

       const originalBacklogString = JSON.stringify(cleanBacklog(initialBacklog));
       const currentBacklogString = JSON.stringify(
           cleanBacklog(
               backlogRows.filter(row => row.backlogId?.trim() || row.title?.trim() || row.storyPoints)
           )
       );
       setHasUnsavedChanges(originalBacklogString !== currentBacklogString);
   }, [backlogRows, initialBacklog]);


  const handleAddRow = () => {
      const newRow = createEmptyBacklogRow();
      rowRefs.current.set(newRow._internalId, React.createRef<HTMLDivElement>());
      setBacklogRows(prev => [...prev, { ...newRow, ref: rowRefs.current.get(newRow._internalId) }]);
  };

  const handleRemoveRow = (internalId: string) => {
      rowRefs.current.delete(internalId); // Remove ref when row is removed
      setBacklogRows(prevRows => {
          const newRows = prevRows.filter(row => row._internalId !== internalId);
          if (newRows.length === 0) {
              const newRow = createEmptyBacklogRow();
              rowRefs.current.set(newRow._internalId, React.createRef<HTMLDivElement>());
              return [{ ...newRow, ref: rowRefs.current.get(newRow._internalId) }];
          }
          return newRows;
      });
  };


  const handleInputChange = (internalId: string, field: keyof Omit<BacklogRow, 'id' | '_internalId' | 'dependsOn' | 'createdDateObj' | 'ref'>, value: string | number | undefined) => {
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
        finalValue = undefined;
     }
    handleInputChange(internalId, field, finalValue);
  };

  const handleViewDetails = (task: BacklogRow) => {
      if (task.backlogId?.trim()) {
          setViewingTask(task);
          setIsViewDialogOpen(true);
      }
  };

   const handleOpenMoveDialog = (taskId: string) => {
     setMovingTaskId(taskId);
     setSelectedTargetSprint(null);
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

   // Handler for opening the dependencies dialog
   const handleOpenDepsDialog = (taskId: string) => {
       setEditingDepsTaskId(taskId);
       setIsDepsDialogOpen(true);
   };

   // Handler for saving dependencies from the dialog
   const handleSaveDependencies = (selectedDeps: string[]) => {
       if (!editingDepsTaskId) return;
       setBacklogRows(prevRows =>
           prevRows.map(row =>
               row._internalId === editingDepsTaskId
                   ? { ...row, dependsOn: selectedDeps.sort() } // Update dependencies and sort them
                   : row
           )
       );
       setIsDepsDialogOpen(false);
       setEditingDepsTaskId(null);
   };

    // Handler to scroll to a dependency row
    const handleScrollToDependency = (dependencyBacklogId: string) => {
        const targetRow = backlogRows.find(row => row.backlogId === dependencyBacklogId);
        if (targetRow && targetRow.ref?.current) {
            targetRow.ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Optionally add a temporary highlight effect
            targetRow.ref.current.classList.add('bg-accent/20'); // Use lighter accent for highlight
            setTimeout(() => {
                targetRow.ref.current?.classList.remove('bg-accent/20'); // Remove highlight after a delay
            }, 1500);
        } else {
            toast({ variant: "default", title: "Info", description: `Backlog item '${dependencyBacklogId}' not found or not rendered.` });
        }
    };

  const handleSave = () => {
    let hasErrors = false;
    const finalBacklog: Task[] = [];
    const backlogIds = new Set<string>();

    backlogRows.forEach((row, index) => {
      if (!row.backlogId?.trim() && !row.title?.trim() && !row.storyPoints?.toString().trim()) {
        return;
      }

      const backlogId = row.backlogId?.trim() || '';
      const title = row.title?.trim();
      const description = row.description?.trim();
      const storyPointsRaw = row.storyPoints?.toString().trim();
      const storyPoints = storyPointsRaw ? parseInt(storyPointsRaw, 10) : null;
      const taskType = row.taskType ?? 'New Feature';
      const createdDate = row.createdDate ?? '';
      const initiator = row.initiator?.trim() || undefined;
      const dependsOn = row.dependsOn || [];
      const priority = row.priority ?? 'Medium';

      let rowErrors: string[] = [];
      if (!backlogId) rowErrors.push("Backlog ID required");
      if (backlogId && backlogIds.has(backlogId.toLowerCase())) rowErrors.push(`Duplicate Backlog ID "${backlogId}"`);
      if (!title) rowErrors.push("Title required");
      if (storyPointsRaw && (isNaN(storyPoints as number) || (storyPoints as number) < 0)) rowErrors.push("Invalid Story Points");
      if (!createdDate || !isValid(parseISO(createdDate))) rowErrors.push("Invalid Created Date (use YYYY-MM-DD)");
      if (!taskType || !taskTypes.includes(taskType as any)) rowErrors.push("Invalid Task Type");
      if (!priority || !taskPriorities.includes(priority as any)) rowErrors.push("Invalid Priority");
       // Validate dependencies exist in the current backlog (excluding self)
       const existingBacklogIds = new Set(backlogRows.filter(r => r._internalId !== row._internalId && r.backlogId).map(r => r.backlogId!));
       const invalidDeps = dependsOn.filter(depId => !existingBacklogIds.has(depId));
       if (invalidDeps.length > 0) {
           rowErrors.push(`Invalid dependencies: ${invalidDeps.join(', ')}`);
       }


      if (rowErrors.length > 0) {
        toast({
          variant: "destructive",
          title: `Error in Backlog Row ${index + 1}`,
          description: rowErrors.join(', ')
        });
        hasErrors = true;
        return;
      }

       if (backlogId) backlogIds.add(backlogId.toLowerCase());

      finalBacklog.push({
        id: row.id || `backlog_${projectId}_${Date.now()}_${index}`,
        backlogId: backlogId,
        ticketNumber: backlogId,
        title,
        description,
        storyPoints: null,
        taskType: taskType as TaskType,
        createdDate,
        initiator,
        dependsOn,
        priority: priority as Task['priority'],
        devEstimatedTime: null,
        qaEstimatedTime: null,
        bufferTime: null,
        assignee: '',
        reviewer: '',
        status: 'To Do',
        startDate: '',
      });
    });

    if (hasErrors) {
      return;
    }

    finalBacklog.sort((a, b) => (taskPriorities.indexOf(a.priority!) - taskPriorities.indexOf(b.priority!)) || (a.backlogId ?? '').localeCompare(b.backlogId ?? ''));


    onSaveBacklog(finalBacklog);
    setHasUnsavedChanges(false);
     // Update state to reflect sorted/cleaned data with potentially new IDs
     setBacklogRows(finalBacklog.map((task, index) => {
         const internalId = task.id || `saved_backlog_${index}_${Date.now()}`;
          if (!rowRefs.current.has(internalId)) {
              rowRefs.current.set(internalId, React.createRef<HTMLDivElement>());
          }
         return {
             ...task,
             storyPoints: task.storyPoints?.toString() ?? '',
             _internalId: internalId,
             ref: rowRefs.current.get(internalId),
             createdDateObj: parseDateString(task.createdDate),
             dependsOn: task.dependsOn ?? [], // Ensure dependsOn is always an array
         };
     }));
     if (finalBacklog.length === 0) {
          const newRow = createEmptyBacklogRow();
          rowRefs.current.set(newRow._internalId, React.createRef<HTMLDivElement>());
          setBacklogRows([{ ...newRow, ref: rowRefs.current.get(newRow._internalId) }]);
     }
  };

   // Memoized list of potential dependencies (other backlog items)
   const potentialDependencies = useMemo(() => {
        if (!editingDepsTaskId) return [];
        return backlogRows
            .filter(row => row._internalId !== editingDepsTaskId && row.backlogId?.trim()) // Exclude self and rows without ID
            .map(row => ({ id: row.backlogId!, title: row.title || `Item ${row.backlogId}` })); // Use backlogId as the ID
   }, [backlogRows, editingDepsTaskId]);

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
        <div className="overflow-x-auto" ref={backlogContainerRef}>
            <div className="min-w-[1200px] space-y-4">
                {/* Backlog Table Header */}
                <div className="hidden md:grid grid-cols-[100px_1fr_120px_120px_120px_100px_100px_80px_40px] gap-x-3 items-center pb-2 border-b sticky top-0 bg-card z-10"> {/* Added sticky header */}
                    <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><ArrowUpDown className="h-3 w-3" /> Backlog ID*</Label>
                    <Label className="text-xs font-medium text-muted-foreground">Title*</Label>
                    <Label className="text-xs font-medium text-muted-foreground">Task Type*</Label>
                    <Label className="text-xs font-medium text-muted-foreground">Initiator</Label>
                    <Label className="text-xs font-medium text-muted-foreground">Created Date*</Label>
                    <Label className="text-xs font-medium text-muted-foreground">Priority*</Label>
                    <Label className="text-xs font-medium text-muted-foreground">Dependencies</Label>
                    <Label className="text-xs font-medium text-muted-foreground text-center">Actions</Label>
                    <div />
                </div>

                {/* Backlog Rows */}
                <div className="space-y-4 md:space-y-2">
                {backlogRows.map((row) => (
                    <div
                        key={row._internalId}
                        ref={row.ref} // Assign ref to the row container
                        className="grid grid-cols-2 md:grid-cols-[100px_1fr_120px_120px_120px_100px_100px_80px_40px] gap-x-3 gap-y-2 items-start border-b md:border-none pb-4 md:pb-0 last:border-b-0 transition-colors duration-1000" // Add transition for highlight
                    >
                        {/* Backlog ID */}
                        <div className="md:col-span-1 col-span-1 relative">
                             <Label htmlFor={`backlog-id-${row._internalId}`} className="md:hidden text-xs font-medium">Backlog ID*</Label>
                             <Input
                                 id={`backlog-id-${row._internalId}`}
                                 value={row.backlogId ?? ''}
                                 onChange={e => handleInputChange(row._internalId, 'backlogId', e.target.value)}
                                 placeholder="ID-123"
                                 className={cn("h-9", row.backlogId?.trim() && "text-transparent")} // Hide text if ID exists and link is shown
                                 required
                             />
                             {row.backlogId?.trim() && (
                                <button
                                    type="button"
                                    onClick={() => handleViewDetails(row)}
                                    className="absolute inset-0 z-10 flex items-center pl-3 text-sm font-medium text-primary underline cursor-pointer bg-transparent border-none hover:text-primary/80"
                                    aria-label={`View details for ${row.backlogId}`}
                                >
                                    {row.backlogId}
                                </button>
                             )}
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
                         {/* Dependencies */}
                         <div className="md:col-span-1 col-span-2 self-center">
                            <Label htmlFor={`backlog-deps-${row._internalId}`} className="md:hidden text-xs font-medium">Dependencies</Label>
                            <div className="flex items-center gap-1 flex-wrap min-h-[36px]"> {/* Ensure min height */}
                                {(row.dependsOn && row.dependsOn.length > 0) ? (
                                    row.dependsOn.map(depId => (
                                        <button
                                            key={depId}
                                            type="button"
                                            onClick={() => handleScrollToDependency(depId)}
                                            className="text-xs text-primary underline hover:text-primary/80 px-1 py-0.5 rounded bg-primary/10 cursor-pointer border-none"
                                        >
                                            {depId}
                                        </button>
                                    ))
                                ) : (
                                    <span className="text-xs text-muted-foreground italic">None</span>
                                )}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 ml-1"
                                    onClick={() => handleOpenDepsDialog(row._internalId)}
                                    aria-label="Edit Dependencies"
                                >
                                    <LinkIcon className="h-3 w-3" />
                                </Button>
                             </div>
                         </div>
                          {/* Actions Cell */}
                          <div className="md:col-span-1 col-span-2 flex items-center gap-1 justify-center">
                             <Button
                                 variant="ghost"
                                 size="icon"
                                 className="h-7 w-7"
                                 disabled={availableSprints.length === 0 || !row.id?.trim()} // Disable if no sprints or row is not saved yet
                                 onClick={() => handleOpenMoveDialog(row.id)}
                                 aria-label="Move to Sprint"
                                 title={availableSprints.length === 0 ? "No active/planned sprints" : "Move to Sprint"}
                             >
                                 <ArrowRightSquare className="h-4 w-4" />
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
                         {availableSprints.length === 0 && <SelectItem value="no-sprints" disabled>No planned/active sprints</SelectItem>}
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

      {/* Select Dependencies Dialog */}
      <SelectDependenciesDialog
         isOpen={isDepsDialogOpen}
         onOpenChange={setIsDepsDialogOpen}
         currentDependencies={backlogRows.find(row => row._internalId === editingDepsTaskId)?.dependsOn ?? []}
         potentialDependencies={potentialDependencies}
         onSave={handleSaveDependencies}
         currentTaskName={backlogRows.find(row => row._internalId === editingDepsTaskId)?.title || ''}
         currentTaskId={backlogRows.find(row => row._internalId === editingDepsTaskId)?.backlogId || ''}
      />
    </>
  );
}


    