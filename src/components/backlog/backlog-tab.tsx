"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from '@/components/ui/checkbox'; // Import Checkbox
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PlusCircle, Trash2, Package, Save, ArrowUpDown, View, ArrowRightSquare, LinkIcon, Filter, GripVertical, ListChecks } from 'lucide-react'; // Added ListChecks
import type { Task, Member, Sprint, SprintStatus, TaskType } from '@/types/sprint-data'; // Added TaskType
import { taskTypes, taskPriorities, initialBacklogTask } from '@/types/sprint-data';
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format, parseISO, isValid, getYear } from 'date-fns'; // Added getYear
import SelectDependenciesDialog from '@/components/select-dependencies-dialog'; // Import the new dialog
import { Separator } from '@/components/ui/separator'; // Import Separator
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface BacklogTabProps {
  projectId: string;
  projectName: string;
  initialBacklog: Task[]; // Receive ALL backlog items for the project
  onSaveNewItems: (newItems: Task[]) => void; // Renamed prop
  members: Member[];
  sprints: Sprint[];
  onMoveToSprint: (backlogItemId: string, targetSprintNumber: number) => void;
  generateNextBacklogId: (allProjectBacklogItems: Task[]) => string; // Receive the helper function
  // Add callbacks for editing saved items if needed later
  onUpdateSavedItem: (updatedItem: Task) => void; // Example: callback to update a single saved item
  onDeleteSavedItem: (itemId: string) => void; // Example: callback to delete a saved item
}

type SortKey = 'backlogId' | 'title' | 'priority' | 'createdDate' | 'needsGrooming' | 'readyForSprint'; // Added sorting keys
type SortDirection = 'asc' | 'desc';

// Renamed BacklogRow to EditingBacklogRow for clarity
interface EditingBacklogRow extends Omit<Task, 'status'> {
  _internalId: string;
  createdDateObj?: Date | undefined;
}

// Type for displayed saved rows (including refs)
interface DisplayBacklogRow extends Task {
    ref?: React.RefObject<HTMLDivElement>;
}

export default function BacklogTab({
  projectId,
  projectName,
  initialBacklog,
  onSaveNewItems, // Renamed prop
  members,
  sprints,
  onMoveToSprint,
  generateNextBacklogId,
  onUpdateSavedItem, // Example prop
  onDeleteSavedItem, // Example prop
}: BacklogTabProps) {
  // State for the *new items* being added in the top table
  const [newBacklogRows, setNewBacklogRows] = useState<EditingBacklogRow[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const { toast } = useToast();
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState<boolean>(false);
  const [movingTaskId, setMovingTaskId] = useState<string | null>(null);
  const [selectedTargetSprint, setSelectedTargetSprint] = useState<number | null>(null);
  const [isDepsDialogOpen, setIsDepsDialogOpen] = useState(false); // State for dependencies dialog
  const [editingDepsTaskId, setEditingDepsTaskId] = useState<string | null>(null); // ID of the task whose dependencies are being edited
  const [sortConfig, setSortConfig] = useState<{ key: SortKey, direction: SortDirection } | null>(null); // State for sorting saved items
  const [isFilteringReady, setIsFilteringReady] = useState(false); // State for filter on saved items

   // Filtered list for display (only items needing grooming and not already moved/split/merged)
   const displayableSavedItems = useMemo(() => {
       return initialBacklog.filter(task => !task.movedToSprint && !task.historyStatus);
   }, [initialBacklog]);

  // Map internal IDs to refs for scrolling within saved items table
  const savedRowRefs = useRef<Map<string, React.RefObject<HTMLDivElement>>>(new Map());

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

  // Clear new rows when project changes
  useEffect(() => {
      setNewBacklogRows([]);
      setHasUnsavedChanges(false);
  }, [projectId]);

  // Initialize refs for saved items table
   useEffect(() => {
       savedRowRefs.current.clear();
       displayableSavedItems.forEach(task => {
           if (!savedRowRefs.current.has(task.id)) {
               savedRowRefs.current.set(task.id, React.createRef<HTMLDivElement>());
           }
       });
   }, [displayableSavedItems]);


  // Track unsaved changes in the new items table
   useEffect(() => {
       // Unsaved changes exist if there are any rows in the new items table
       setHasUnsavedChanges(newBacklogRows.length > 0);
   }, [newBacklogRows]);

    // Apply filtering and sorting to SAVED backlog rows for display
    const filteredAndSortedSavedRows = useMemo(() => {
        let items = [...displayableSavedItems];

        // Apply filter if active
        if (isFilteringReady) {
            items = items.filter(row => row.readyForSprint);
        }

        // Apply sorting
        if (sortConfig !== null) {
            items.sort((a, b) => {
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
                     case 'backlogId':
                         aValue = a.backlogId?.toLowerCase() || '';
                         bValue = b.backlogId?.toLowerCase() || '';
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
                return 0;
            });
        } else {
             // Default sort by priority if no specific sort is selected
            items.sort((a, b) => taskPriorities.indexOf(a.priority || 'Medium') - taskPriorities.indexOf(b.priority || 'Medium'));
        }
        // Map to include refs
        return items.map(task => ({
           ...task,
           ref: savedRowRefs.current.get(task.id)
        }));
    }, [displayableSavedItems, sortConfig, isFilteringReady]); // Add isFilteringReady dependency


    // Sorting handlers
    const requestSort = (key: SortKey) => {
        let direction: SortDirection = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIndicator = (key: SortKey) => {
        if (!sortConfig || sortConfig.key !== key) {
            return <ArrowUpDown className="ml-1 h-3 w-3 opacity-30 inline" />; // Made smaller
        }
        return sortConfig.direction === 'asc' ? ' ▲' : ' ▼';
    };

    // Filter toggle handler
    const toggleFilterReady = () => {
        setIsFilteringReady(prev => !prev);
    };


  const handleAddNewRow = () => {
      // Combine existing initial backlog (all items) and current unsaved rows
      const allCurrentItems = [
          ...initialBacklog, // Includes historical/moved items
          ...newBacklogRows // Include items currently being added
      ];
      const nextId = generateNextBacklogId(allCurrentItems);
      const newRow: EditingBacklogRow = {
          ...initialBacklogTask,
          _internalId: `backlog_${Date.now()}_${Math.random()}`,
          id: '', // Keep ID empty until save
          backlogId: nextId, // Assign the generated ID
          createdDate: format(new Date(), 'yyyy-MM-dd'),
          createdDateObj: new Date(),
          dependsOn: [],
          needsGrooming: false,
          readyForSprint: false,
      };

       setNewBacklogRows(prev => [...prev, newRow]);
       setHasUnsavedChanges(true); // Adding a row is an unsaved change
  };


  const handleRemoveNewRow = (internalId: string) => {
      setNewBacklogRows(prevRows => {
          const newRows = prevRows.filter(row => row._internalId !== internalId);
          return newRows;
      });
       // Update unsaved changes based on whether rows remain
       setHasUnsavedChanges(newBacklogRows.length > 1);
  };


  const handleNewInputChange = (internalId: string, field: keyof Omit<EditingBacklogRow, 'id' | '_internalId' | 'dependsOn' | 'createdDateObj' | 'ref' | 'movedToSprint' | 'needsGrooming' | 'readyForSprint' | 'historyStatus'>, value: string | number | undefined) => {
    setNewBacklogRows(rows =>
      rows.map(row => (row._internalId === internalId ? { ...row, [field]: value ?? '' } : row))
    );
     setHasUnsavedChanges(true);
  };

   const handleNewDateChange = (internalId: string, field: 'createdDate', date: Date | undefined) => {
     const dateString = date ? format(date, 'yyyy-MM-dd') : '';
     setNewBacklogRows(rows =>
       rows.map(row =>
         row._internalId === internalId
           ? { ...row, [field]: dateString, [`${field}Obj`]: date }
           : row
       )
     );
      setHasUnsavedChanges(true);
   };

  const handleNewSelectChange = (internalId: string, field: 'taskType' | 'priority' | 'initiator', value: string) => {
     let finalValue: string | undefined | null = value;
     if (value === 'none') {
        finalValue = undefined;
     }
    handleNewInputChange(internalId, field, finalValue);
     setHasUnsavedChanges(true);
   };

   const handleNewCheckboxChange = (internalId: string, field: 'needsGrooming' | 'readyForSprint', checked: boolean | 'indeterminate') => {
     setNewBacklogRows(rows =>
       rows.map(row =>
         row._internalId === internalId ? { ...row, [field]: !!checked } : row
       )
     );
      setHasUnsavedChanges(true);
   };

  const handleViewDetails = (task: Task) => { // Accepts Task type now
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

   // Handler for opening the dependencies dialog (needs adaptation for saved items)
   const handleOpenDepsDialog = (taskId: string, isNewItem: boolean) => {
       if (isNewItem) {
           setEditingDepsTaskId(taskId); // Use internalId for new items
       } else {
           setEditingDepsTaskId(taskId); // Use task.id for saved items
       }
       setIsDepsDialogOpen(true);
   };

   // Handler for saving dependencies from the dialog (needs adaptation)
   const handleSaveDependencies = (selectedDeps: string[]) => {
       if (!editingDepsTaskId) return;

       // Check if we are editing a new item or a saved item
       const isEditingNewItem = newBacklogRows.some(row => row._internalId === editingDepsTaskId);

       if (isEditingNewItem) {
            setNewBacklogRows(prevRows =>
               prevRows.map(row =>
                   row._internalId === editingDepsTaskId
                       ? { ...row, dependsOn: selectedDeps.sort() }
                       : row
               )
           );
            setHasUnsavedChanges(true);
       } else {
           // Find the saved item and update it via callback
           const savedItem = displayableSavedItems.find(item => item.id === editingDepsTaskId);
           if (savedItem) {
               onUpdateSavedItem({ ...savedItem, dependsOn: selectedDeps.sort() });
           }
       }

       setIsDepsDialogOpen(false);
       setEditingDepsTaskId(null);
   };

    // Handler to scroll to a dependency row in the saved items table
    const handleScrollToDependency = (dependencyBacklogId: string) => {
        const targetRow = displayableSavedItems.find(row => row.backlogId === dependencyBacklogId);
        const targetRef = targetRow ? savedRowRefs.current.get(targetRow.id) : undefined;

        if (targetRef?.current) {
            targetRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
            targetRef.current.classList.add('bg-accent/20');
            setTimeout(() => {
                targetRef.current?.classList.remove('bg-accent/20');
            }, 1500);
        } else {
            toast({ variant: "default", title: "Info", description: `Backlog item '${dependencyBacklogId}' not found or not rendered.` });
        }
    };

  const handleSaveNewItems = () => {
    let hasErrors = false;
    const itemsToSave: Task[] = [];
    const allKnownBacklogIds = new Set<string>();

    // Populate with ALL IDs from initial backlog (including historical)
    initialBacklog.forEach(task => {
        if (task.backlogId) allKnownBacklogIds.add(task.backlogId.toLowerCase());
    });
    // Populate with IDs from the CURRENT rows being added (to catch duplicates within the edit session)
    newBacklogRows.forEach(row => {
        if (row.backlogId) allKnownBacklogIds.add(row.backlogId.toLowerCase());
    });


    newBacklogRows.forEach((row, index) => {
      const isEmptyRow = !row.backlogId?.trim() && !row.title?.trim() && !row.storyPoints?.toString().trim();
      if (isEmptyRow) {
          return; // Skip empty rows
      }

      const backlogId = row.backlogId?.trim() || '';
      const title = row.title?.trim();
      const description = row.description?.trim();
      const storyPointsRaw = row.storyPoints?.toString().trim();
      const storyPoints = storyPointsRaw ? parseInt(storyPointsRaw, 10) : undefined;
      const taskType = row.taskType ?? 'New Feature';
      const createdDate = row.createdDate ?? '';
      const initiator = row.initiator?.trim() || undefined;
      const dependsOn = row.dependsOn || [];
      const priority = row.priority ?? 'Medium';
      const needsGrooming = !!row.needsGrooming;
      const readyForSprint = !!row.readyForSprint;

      let rowErrors: string[] = [];
      if (!backlogId) rowErrors.push("Backlog ID required");
      // Check against ALL known IDs (initial + current rows being added)
      if (backlogId && allKnownBacklogIds.has(backlogId.toLowerCase())) {
           // Check if it's a duplicate within the new rows themselves
           if (newBacklogRows.filter(r => r.backlogId === backlogId).length > 1) {
               rowErrors.push(`Duplicate Backlog ID "${backlogId}" in new items.`);
           }
           // Check if it conflicts with an existing saved ID
           else if (initialBacklog.some(t => t.backlogId === backlogId)) {
                rowErrors.push(`Backlog ID "${backlogId}" already exists in the saved backlog.`);
           }
       }

      if (!title) rowErrors.push("Title required");
      if (storyPointsRaw && (isNaN(storyPoints as number) || (storyPoints as number) < 0)) rowErrors.push("Invalid Story Points");
      if (!createdDate || !isValid(parseISO(createdDate))) rowErrors.push("Invalid Created Date (use YYYY-MM-DD)");
      if (!taskType || !taskTypes.includes(taskType as any)) rowErrors.push("Invalid Task Type");
      if (!priority || !taskPriorities.includes(priority as any)) rowErrors.push("Invalid Priority");
       // Validate dependencies exist in the combined backlog (saved + new items being added, excluding self)
       const combinedBacklogIds = new Set([
         ...initialBacklog.map(t => t.backlogId!).filter(Boolean),
         ...newBacklogRows.filter(r => r._internalId !== row._internalId && r.backlogId).map(r => r.backlogId!),
       ]);
       const invalidDeps = dependsOn.filter(depId => !combinedBacklogIds.has(depId));
       if (invalidDeps.length > 0) {
           rowErrors.push(`Invalid dependencies: ${invalidDeps.join(', ')}`);
       }


      if (rowErrors.length > 0) {
        toast({
          variant: "destructive",
          title: `Error in New Backlog Row ${index + 1}`,
          description: rowErrors.join(', ')
        });
        hasErrors = true;
        return;
      }

       if (backlogId) allKnownBacklogIds.add(backlogId.toLowerCase());

      itemsToSave.push({
        id: '', // ID will be assigned by the parent component/saving logic
        backlogId: backlogId,
        ticketNumber: backlogId, // Keep ticketNumber aligned with backlogId for simplicity now
        title,
        description,
        storyPoints,
        taskType: taskType as TaskType,
        createdDate,
        initiator,
        dependsOn,
        priority: priority as Task['priority'],
        needsGrooming,
        readyForSprint,
        // Ensure these are undefined for new backlog items
        movedToSprint: undefined,
        historyStatus: undefined,
        devEstimatedTime: undefined,
        qaEstimatedTime: undefined,
        bufferTime: undefined,
        assignee: undefined,
        reviewer: undefined,
        status: undefined,
        startDate: undefined,
        acceptanceCriteria: row.acceptanceCriteria, // Persist acceptance criteria
      });
    });

    if (hasErrors) {
        return;
    }

    if (itemsToSave.length === 0) {
        toast({ variant: "default", title: "No New Items", description: "Add items to the table first." });
        return;
    }

    onSaveNewItems(itemsToSave); // Call the specific prop for saving new items
    setNewBacklogRows([]); // Clear the new items table
    setHasUnsavedChanges(false);
    toast({ title: "Success", description: `${itemsToSave.length} new backlog item(s) saved.` });
  };

   // Memoized list of potential dependencies (considering both saved and new items)
   const potentialDependencies = useMemo(() => {
       if (!editingDepsTaskId) return [];

       // Find the item being edited (could be new or saved)
       const editingNewItem = newBacklogRows.find(row => row._internalId === editingDepsTaskId);
       const editingSavedItem = !editingNewItem ? displayableSavedItems.find(item => item.id === editingDepsTaskId) : undefined;
       const editingItemId = editingNewItem?._internalId : editingSavedItem?.id;
       const editingBacklogId = editingNewItem?.backlogId || editingSavedItem?.backlogId;

       // Combine potential dependencies from saved and new items, excluding the item being edited
       const depsFromSaved = displayableSavedItems
           .filter(item => item.id !== editingItemId && item.backlogId !== editingBacklogId && item.backlogId?.trim())
           .map(item => ({ id: item.backlogId!, title: item.title || `Item ${item.backlogId}` }));

       const depsFromNew = newBacklogRows
           .filter(row => row._internalId !== editingItemId && row.backlogId !== editingBacklogId && row.backlogId?.trim())
           .map(row => ({ id: row.backlogId!, title: row.title || `Item ${row.backlogId}` }));

       // Combine and remove duplicates based on ID
       const combinedDepsMap = new Map<string, PotentialDependency>();
       [...depsFromSaved, ...depsFromNew].forEach(dep => {
           if (!combinedDepsMap.has(dep.id)) {
               combinedDepsMap.set(dep.id, dep);
           }
       });

       return Array.from(combinedDepsMap.values());
   }, [displayableSavedItems, newBacklogRows, editingDepsTaskId]);

  return (
    <>
    {/* --- Add New Backlog Items Section --- */}
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="flex items-center gap-2"><PlusCircle className="h-5 w-5 text-primary" /> Add New Backlog Items</CardTitle>
            <CardDescription>Add new tasks to the project backlog. Click 'Save New Items' to add them to the main backlog list below.</CardDescription>
          </div>
          <Button onClick={handleSaveNewItems} disabled={!hasUnsavedChanges || newBacklogRows.length === 0}>
             <Save className="mr-2 h-4 w-4" /> Save New Items
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto">
            <div className="min-w-[1600px] space-y-4">
                {/* Header for the NEW items table */}
                <div className="hidden md:grid grid-cols-[120px_1fr_120px_120px_120px_100px_100px_80px_60px_60px_40px] gap-x-3 items-center pb-2 border-b sticky top-0 bg-card z-10">
                    <Label className="text-xs font-medium text-muted-foreground">Backlog ID*</Label>
                    <Label className="text-xs font-medium text-muted-foreground">Title*</Label>
                    <Label className="text-xs font-medium text-muted-foreground">Task Type*</Label>
                    <Label className="text-xs font-medium text-muted-foreground">Initiator</Label>
                    <Label className="text-xs font-medium text-muted-foreground">Created Date*</Label>
                    <Label className="text-xs font-medium text-muted-foreground">Priority*</Label>
                    <Label className="text-xs font-medium text-muted-foreground">Dependencies</Label>
                    <Label className="text-xs font-medium text-muted-foreground text-center">Groom?</Label>
                    <Label className="text-xs font-medium text-muted-foreground text-center">Ready?</Label>
                    <div />
                </div>
                {/* Rows for NEW items */}
                <div className="space-y-4 md:space-y-2">
                {newBacklogRows.map((row) => (
                    <div key={row._internalId} className="grid grid-cols-2 md:grid-cols-[120px_1fr_120px_120px_120px_100px_100px_80px_60px_60px_40px] gap-x-3 gap-y-2 items-start border-b md:border-none pb-4 md:pb-0 last:border-b-0">
                        {/* Backlog ID (Generated) */}
                        <div className="md:col-span-1 col-span-1">
                             <Label htmlFor={`new-backlog-id-${row._internalId}`} className="md:hidden text-xs font-medium">Backlog ID*</Label>
                             <Input
                                 id={`new-backlog-id-${row._internalId}`}
                                 value={row.backlogId ?? ''}
                                 onChange={e => handleNewInputChange(row._internalId, 'backlogId', e.target.value)}
                                 placeholder="ID-123"
                                 className="h-9"
                                 required
                             />
                        </div>
                        {/* Title */}
                        <div className="md:col-span-1 col-span-2">
                            <Label htmlFor={`new-backlog-title-${row._internalId}`} className="md:hidden text-xs font-medium">Title*</Label>
                            <Input
                                id={`new-backlog-title-${row._internalId}`}
                                value={row.title ?? ''}
                                onChange={e => handleNewInputChange(row._internalId, 'title', e.target.value)}
                                placeholder="Task Title"
                                className="h-9"
                                required
                            />
                        </div>
                         {/* Task Type */}
                         <div className="md:col-span-1 col-span-1">
                             <Label htmlFor={`new-backlog-type-${row._internalId}`} className="md:hidden text-xs font-medium">Task Type*</Label>
                             <Select value={row.taskType ?? 'New Feature'} onValueChange={(value) => handleNewSelectChange(row._internalId, 'taskType', value)}>
                                 <SelectTrigger id={`new-backlog-type-${row._internalId}`} className="h-9">
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
                             <Label htmlFor={`new-backlog-initiator-${row._internalId}`} className="md:hidden text-xs font-medium">Initiator</Label>
                             <Select
                                 value={row.initiator ?? 'none'}
                                 onValueChange={(value) => handleNewSelectChange(row._internalId, 'initiator', value)}
                                 disabled={members.length === 0}
                             >
                                 <SelectTrigger id={`new-backlog-initiator-${row._internalId}`} className="h-9">
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
                            <Label htmlFor={`new-backlog-created-${row._internalId}`} className="md:hidden text-xs font-medium">Created Date*</Label>
                            <Input
                                id={`new-backlog-created-${row._internalId}`}
                                type="date"
                                value={row.createdDate}
                                onChange={e => handleNewInputChange(row._internalId, 'createdDate', e.target.value)}
                                required className="h-9 w-full"
                            />
                         </div>
                         {/* Priority */}
                         <div className="md:col-span-1 col-span-1">
                             <Label htmlFor={`new-backlog-priority-${row._internalId}`} className="md:hidden text-xs font-medium">Priority*</Label>
                             <Select value={row.priority ?? 'Medium'} onValueChange={(value) => handleNewSelectChange(row._internalId, 'priority', value)}>
                                 <SelectTrigger id={`new-backlog-priority-${row._internalId}`} className="h-9">
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
                            <Label htmlFor={`new-backlog-deps-${row._internalId}`} className="md:hidden text-xs font-medium">Dependencies</Label>
                            <div className="flex items-center gap-1 flex-wrap min-h-[36px]">
                                {(row.dependsOn && row.dependsOn.length > 0) ? (
                                    row.dependsOn.map(depId => (
                                        <span key={depId} className="text-xs text-muted-foreground px-1 py-0.5 rounded bg-muted/50">
                                            {depId}
                                        </span>
                                    ))
                                ) : (
                                    <span className="text-xs text-muted-foreground italic">None</span>
                                )}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 ml-1"
                                    onClick={() => handleOpenDepsDialog(row._internalId, true)}
                                    aria-label="Edit Dependencies"
                                >
                                    <LinkIcon className="h-3 w-3" />
                                </Button>
                             </div>
                         </div>
                          {/* Needs Grooming Checkbox */}
                          <div className="md:col-span-1 col-span-1 flex items-center justify-center pt-2 md:pt-0">
                             <Label htmlFor={`new-needs-grooming-${row._internalId}`} className="md:hidden text-xs font-medium">Groom?</Label>
                             <Checkbox
                                id={`new-needs-grooming-${row._internalId}`}
                                checked={row.needsGrooming}
                                onCheckedChange={(checked) => handleNewCheckboxChange(row._internalId, 'needsGrooming', checked)}
                                className="h-5 w-5"
                             />
                          </div>
                           {/* Ready for Sprint Checkbox */}
                           <div className="md:col-span-1 col-span-1 flex items-center justify-center pt-2 md:pt-0">
                             <Label htmlFor={`new-ready-sprint-${row._internalId}`} className="md:hidden text-xs font-medium">Ready?</Label>
                             <Checkbox
                                id={`new-ready-sprint-${row._internalId}`}
                                checked={row.readyForSprint}
                                onCheckedChange={(checked) => handleNewCheckboxChange(row._internalId, 'readyForSprint', checked)}
                                className="h-5 w-5"
                             />
                           </div>
                        {/* Delete Button */}
                        <div className="flex items-center justify-end md:col-span-1 col-span-2 md:self-center md:mt-0 mt-1">
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveNewRow(row._internalId)}
                                className="h-9 w-9 text-muted-foreground hover:text-destructive"
                                aria-label="Remove new backlog row"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                ))}
                </div>
                 <Button type="button" onClick={handleAddNewRow} variant="outline" size="sm" className="mt-4">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Another Item
                </Button>
            </div>
         </div>
         <CardFooter className="flex justify-between items-center border-t pt-4">
           <p className="text-xs text-muted-foreground">* Required field.</p>
           <Button onClick={handleSaveNewItems} disabled={!hasUnsavedChanges || newBacklogRows.length === 0}>
               <Save className="mr-2 h-4 w-4" /> Save New Items ({newBacklogRows.length})
           </Button>
         </CardFooter>
       </CardContent>
    </Card>

    <Separator className="my-6" />

    {/* --- Saved Backlog Items Table --- */}
     <Card>
       <CardHeader>
         <div className="flex justify-between items-center">
           <div>
             <CardTitle className="flex items-center gap-2"><ListChecks className="h-5 w-5 text-primary" /> Saved Backlog Items</CardTitle>
             <CardDescription>View and manage existing backlog items. Use the filter or sort options.</CardDescription>
           </div>
           <div className="flex items-center gap-2">
              <Button
                  variant={isFilteringReady ? "secondary" : "outline"}
                  size="sm"
                  onClick={toggleFilterReady}
              >
                  <Filter className="mr-2 h-4 w-4" />
                  {isFilteringReady ? "Show All" : "Show Ready Only"}
              </Button>
              {/* Add other actions for saved items if needed, e.g., batch edit, export */}
           </div>
         </div>
       </CardHeader>
       <CardContent className="space-y-4">
           {filteredAndSortedSavedRows.length === 0 ? (
                 <div className="flex flex-col items-center justify-center min-h-[200px] border-dashed border-2 rounded-md p-6">
                    <Package className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">{isFilteringReady ? "No items marked 'Ready for Sprint'." : "The backlog is empty."}</p>
                    <p className="text-sm text-muted-foreground">{isFilteringReady ? "Clear the filter or mark items as ready." : "Add new items using the section above."}</p>
                 </div>
             ) : (
               <div className="overflow-x-auto">
                 <div className="min-w-[1600px] space-y-4">
                     {/* Header for SAVED items table */}
                     <div className="hidden md:grid grid-cols-[120px_1fr_120px_120px_120px_100px_100px_80px_60px_60px_80px_40px] gap-x-3 items-center pb-2 border-b sticky top-0 bg-card z-10">
                         <Button variant="ghost" onClick={() => requestSort('backlogId')} className="px-1 h-auto justify-start text-xs font-medium text-muted-foreground">
                            Backlog ID {getSortIndicator('backlogId')}
                         </Button>
                         <Button variant="ghost" onClick={() => requestSort('title')} className="px-1 h-auto justify-start text-xs font-medium text-muted-foreground">
                            Title {getSortIndicator('title')}
                         </Button>
                         <Label className="text-xs font-medium text-muted-foreground">Task Type</Label>
                         <Label className="text-xs font-medium text-muted-foreground">Initiator</Label>
                         <Button variant="ghost" onClick={() => requestSort('createdDate')} className="px-1 h-auto justify-start text-xs font-medium text-muted-foreground">
                            Created {getSortIndicator('createdDate')}
                         </Button>
                         <Button variant="ghost" onClick={() => requestSort('priority')} className="px-1 h-auto justify-start text-xs font-medium text-muted-foreground">
                            Priority {getSortIndicator('priority')}
                         </Button>
                         <Label className="text-xs font-medium text-muted-foreground">Dependencies</Label>
                         <Button variant="ghost" onClick={() => requestSort('needsGrooming')} className="px-1 h-auto justify-center text-xs font-medium text-muted-foreground">
                            Groom? {getSortIndicator('needsGrooming')}
                         </Button>
                         <Button variant="ghost" onClick={() => requestSort('readyForSprint')} className="px-1 h-auto justify-center text-xs font-medium text-muted-foreground">
                            Ready? {getSortIndicator('readyForSprint')}
                         </Button>
                         <Label className="text-xs font-medium text-muted-foreground text-center">Actions</Label>
                         <div />
                     </div>
                     {/* Rows for SAVED items */}
                     <div className="space-y-4 md:space-y-2">
                         {filteredAndSortedSavedRows.map((row) => (
                             <div
                                 key={row.id} // Use persistent ID for saved items
                                 ref={row.ref}
                                 className="grid grid-cols-2 md:grid-cols-[120px_1fr_120px_120px_120px_100px_100px_80px_60px_60px_80px_40px] gap-x-3 gap-y-2 items-start border-b md:border-none pb-4 md:pb-0 last:border-b-0 transition-colors duration-1000"
                             >
                                 {/* Backlog ID (Link) */}
                                 <TableCell className="font-medium md:col-span-1 col-span-1">
                                     <button
                                         type="button"
                                         onClick={() => handleViewDetails(row)}
                                         className="text-primary underline cursor-pointer hover:text-primary/80 text-sm font-semibold"
                                         aria-label={`View details for ${row.backlogId}`}
                                     >
                                         {row.backlogId}
                                     </button>
                                 </TableCell>
                                 {/* Title */}
                                 <TableCell className="md:col-span-1 col-span-2 text-sm">{row.title}</TableCell>
                                 {/* Task Type */}
                                 <TableCell className="md:col-span-1 col-span-1 text-sm">{row.taskType}</TableCell>
                                 {/* Initiator */}
                                 <TableCell className="md:col-span-1 col-span-1 text-sm">{row.initiator || '-'}</TableCell>
                                 {/* Created Date */}
                                 <TableCell className="md:col-span-1 col-span-1 text-sm">{row.createdDate && isValid(parseISO(row.createdDate)) ? format(parseISO(row.createdDate), 'MMM d, yyyy') : 'N/A'}</TableCell>
                                 {/* Priority */}
                                 <TableCell className="md:col-span-1 col-span-1 text-sm">{row.priority}</TableCell>
                                 {/* Dependencies */}
                                  <TableCell className="md:col-span-1 col-span-2 self-center">
                                      <div className="flex items-center gap-1 flex-wrap min-h-[36px]">
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
                                           {/* Edit Dependencies Icon (adjust if needed for saved items) */}
                                          {/* <Button variant="ghost" size="icon" className="h-6 w-6 ml-1" onClick={() => handleOpenDepsDialog(row.id, false)}><LinkIcon className="h-3 w-3" /></Button> */}
                                      </div>
                                  </TableCell>
                                   {/* Needs Grooming */}
                                  <TableCell className="md:col-span-1 col-span-1 text-center">
                                      <Checkbox checked={row.needsGrooming} disabled className="h-5 w-5" />
                                  </TableCell>
                                  {/* Ready for Sprint */}
                                  <TableCell className="md:col-span-1 col-span-1 text-center">
                                      <Checkbox checked={row.readyForSprint} disabled className="h-5 w-5"/>
                                  </TableCell>
                                 {/* Actions Cell */}
                                  <TableCell className="md:col-span-1 col-span-2 flex items-center gap-1 justify-center">
                                     <Button
                                         variant="ghost"
                                         size="icon"
                                         className="h-7 w-7"
                                         disabled={availableSprints.length === 0 || !row.id?.trim() || !row.readyForSprint} // Disable if not ready
                                         onClick={() => handleOpenMoveDialog(row.id)}
                                         aria-label="Move to Sprint"
                                         title={!row.readyForSprint ? "Item not ready for sprint" : availableSprints.length === 0 ? "No active/planned sprints" : "Move to Sprint"}
                                     >
                                         <ArrowRightSquare className="h-4 w-4" />
                                     </Button>
                                     {/* Add Edit button for saved items here if needed */}
                                  </TableCell>
                                  {/* Delete Button (For Saved Items - Optional) */}
                                  <TableCell className="flex items-center justify-end md:col-span-1 col-span-2 md:self-center md:mt-0 mt-1">
                                       <Button
                                           type="button"
                                           variant="ghost"
                                           size="icon"
                                           onClick={() => onDeleteSavedItem(row.id)} // Use delete callback
                                           className="h-9 w-9 text-muted-foreground hover:text-destructive"
                                           aria-label="Delete saved backlog item"
                                       >
                                           <Trash2 className="h-4 w-4" />
                                       </Button>
                                   </TableCell>
                             </div>
                         ))}
                     </div>
                 </div>
             </div>
           )}
       </CardContent>
     </Card>

     {/* --- Modals --- */}

     {/* View Details Dialog */}
     <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Backlog Item Details: {viewingTask?.backlogId}</DialogTitle>
            </DialogHeader>
             {viewingTask && (
                <div className="grid gap-4 py-4 text-sm">
                     {/* Details */}
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
                    Select the target sprint to move backlog item '{initialBacklog.find(r => r.id === movingTaskId)?.backlogId}' to.
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
         currentDependencies={
             (newBacklogRows.find(row => row._internalId === editingDepsTaskId)?.dependsOn) ??
             (displayableSavedItems.find(item => item.id === editingDepsTaskId)?.dependsOn) ??
             []
         }
         potentialDependencies={potentialDependencies}
         onSave={handleSaveDependencies}
         currentTaskName={
             (newBacklogRows.find(row => row._internalId === editingDepsTaskId)?.title) ||
             (displayableSavedItems.find(item => item.id === editingDepsTaskId)?.title) || ''
          }
         currentTaskId={
             (newBacklogRows.find(row => row._internalId === editingDepsTaskId)?.backlogId) ||
             (displayableSavedItems.find(item => item.id === editingDepsTaskId)?.backlogId) || ''
         }
      />
    </>
  );
}

    
