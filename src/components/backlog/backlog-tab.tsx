
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
import { PlusCircle, Trash2, Package, Save, ArrowUpDown, View, ArrowRightSquare, LinkIcon, Filter, GripVertical, ListChecks, XCircle, Edit } from 'lucide-react'; // Added ListChecks, XCircle, Edit
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
    isEditing?: boolean;
}

// Helper function to safely parse date strings
const parseDateString = (dateString: string | undefined): Date | undefined => {
    if (!dateString) return undefined;
    try {
      const parsed = parseISO(dateString);
      return isValid(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
};

// Helper function to generate the next backlog ID based on *all* items (including historical and unsaved)
const generateNextBacklogIdHelper = (allProjectBacklogItems: Task[]): string => {
   const currentYear = getYear(new Date()).toString().slice(-2); // Get last two digits of the year
   const prefix = `BL-${currentYear}`;
   let maxNum = 0;

   allProjectBacklogItems.forEach(item => {
     const id = item.backlogId; // Use the actual backlogId
     // Consider only base BL-YYxxxx IDs from the current year
     // Use regex to extract the numeric part more reliably
     const match = id?.match(/^BL-\d{2}(\d{4})(?:-.*)?$/); // Match BL-YYNNNN or BL-YYNNNN-suffix
     if (id && id.startsWith(prefix) && match) {
         const numPart = parseInt(match[1], 10); // Get the NNNN part
         if (!isNaN(numPart) && numPart > maxNum) {
             maxNum = numPart;
         }
     }
   });

   const nextNum = maxNum + 1;
   const nextNumPadded = nextNum.toString().padStart(4, '0'); // Pad with leading zeros to 4 digits
   const newBaseId = `${prefix}${nextNumPadded}`;
   console.log("Generated next backlog ID:", newBaseId, "based on max:", maxNum); // Debug log
   return newBaseId;
 };

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
  // State for items that are saved and displayed in the bottom table
  const [savedBacklogItems, setSavedBacklogItems] = useState<DisplayBacklogRow[]>([]);
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

   // Map internal IDs to refs for scrolling within saved items table
  const savedRowRefs = useRef<Map<string, React.RefObject<HTMLDivElement>>>(new Map());

  // Filtered list for display (only items needing grooming and not already moved/split/merged)
  const displayableSavedItems = useMemo(() => {
      return savedBacklogItems.filter(task => !task.movedToSprint && !task.historyStatus);
  }, [savedBacklogItems]);

  const availableSprints = useMemo(() => {
      return sprints.filter(s => s.status === 'Active' || s.status === 'Planned').sort((a, b) => a.sprintNumber - b.sprintNumber);
  }, [sprints]);

  // Effect to populate savedBacklogItems from initialBacklog
  useEffect(() => {
      savedRowRefs.current.clear(); // Clear refs when initial backlog changes
       // Filter out historical or moved items initially
      const initialDisplayableItems = initialBacklog.filter(task => !task.movedToSprint && !task.historyStatus);

      const mappedItems = initialDisplayableItems.map(item => {
          const internalId = item.id; // Use the actual ID
          if (!savedRowRefs.current.has(internalId)) {
              savedRowRefs.current.set(internalId, React.createRef<HTMLDivElement>());
          }
          return {
             ...item,
             _internalId: internalId, // Use actual ID as internal ID for saved items
             ref: savedRowRefs.current.get(internalId),
             isEditing: false, // Initialize as not editing
             createdDateObj: parseDateString(item.createdDate),
          };
      });
      setSavedBacklogItems(mappedItems);
      setNewBacklogRows([]); // Clear new rows when project changes
      setHasUnsavedChanges(false);
   }, [initialBacklog, projectId]); // Depend on projectId to reset on project switch


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
                // Secondary sort by backlogId if primary values are equal
                return (a.backlogId ?? '').localeCompare(b.backlogId ?? '');
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
    }, [displayableSavedItems, sortConfig, isFilteringReady]); // Updated dependency array


    // Sorting handlers for the SAVED items table
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

    // Filter toggle handler for SAVED items table
    const toggleFilterReady = () => {
        setIsFilteringReady(prev => !prev);
    };


  const handleAddNewRow = () => {
      // Combine existing initial backlog (all items) and current unsaved rows
      const allCurrentItems = [
          ...initialBacklog, // Includes historical/moved items
          ...newBacklogRows // Include items currently being added
      ];
       // Generate the next ID based on the combined list
       const nextId = generateNextBacklogIdHelper(allCurrentItems);

      const newRow: EditingBacklogRow = {
          ...initialBacklogTask,
          _internalId: `new_backlog_${Date.now()}_${Math.random()}`, // Unique internal ID for new rows
          id: '', // Keep ID empty until save
          backlogId: nextId, // Assign the generated ID
          createdDate: format(new Date(), 'yyyy-MM-dd'),
          createdDateObj: new Date(),
          dependsOn: [],
          needsGrooming: false, // Default to false
          readyForSprint: false, // Default to false
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
       setHasUnsavedChanges(newBacklogRows.length > 1 || newBacklogRows.length === 0 && initialBacklog.length === 0); // Adjust logic slightly
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
     // Remove item from savedBacklogItems immediately after moving
     setSavedBacklogItems(prev => prev.filter(item => item.id !== movingTaskId));
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
           // Update the saved item's dependencies directly in the state
           setSavedBacklogItems(prevItems =>
               prevItems.map(item =>
                   item.id === editingDepsTaskId
                       ? { ...item, dependsOn: selectedDeps.sort() }
                       : item
               )
           );
           // Mark changes as unsaved for the main save button
           // This requires a new state or logic to track if saved items have changes.
           // For now, let's assume saving dependencies on a saved item requires the main Save button.
           setHasUnsavedChanges(true); // Indicate unsaved changes overall
       }

       setIsDepsDialogOpen(false);
       setEditingDepsTaskId(null);
   };

    // Handler to scroll to a dependency row in the saved items table
    const handleScrollToDependency = (dependencyBacklogId: string) => {
        const targetRow = savedBacklogItems.find(row => row.backlogId === dependencyBacklogId);
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

   // Handler for saving NEW ITEMS ONLY from the top table
   const handleSaveNewItems = () => {
     let hasErrors = false;
     const itemsToSave: Task[] = [];
     const allKnownBacklogIds = new Set<string>();

     // Populate with ALL IDs from initial backlog (including historical)
     initialBacklog.forEach(task => {
         if (task.backlogId) allKnownBacklogIds.add(task.backlogId.toLowerCase());
     });

     // Validate NEW items against all existing IDs and within the new batch
     newBacklogRows.forEach((row, index) => {
       const isEmptyRow = !row.backlogId?.trim() && !row.title?.trim() && !row.storyPoints?.toString().trim();
       if (isEmptyRow && newBacklogRows.length > 1) { // Allow single empty row if it's the only one
           return; // Skip empty rows if more than one row exists
       } else if (isEmptyRow && newBacklogRows.length === 1) {
           // If it's the only row and empty, clear it and show success if needed
           setNewBacklogRows([]);
           setHasUnsavedChanges(false);
           toast({ title: "No New Items", description: "No new items to save." });
           return; // Exit save function
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
       if (!backlogId) rowErrors.push(`Row ${index + 1}: Backlog ID required`);

       // Check against ALL known IDs (initial + current new rows being added)
       const lowerCaseBacklogId = backlogId.toLowerCase();
       if (backlogId && allKnownBacklogIds.has(lowerCaseBacklogId)) { // Check against all existing
            rowErrors.push(`Row ${index + 1}: Duplicate Backlog ID "${backlogId}" already exists.`);
       }
       if (backlogId && newBacklogRows.filter(r => r._internalId !== row._internalId && r.backlogId?.toLowerCase() === lowerCaseBacklogId).length > 0) {
            rowErrors.push(`Row ${index + 1}: Duplicate Backlog ID "${backlogId}" within new items.`);
       }


       if (!title) rowErrors.push("Title required");
       if (storyPointsRaw && (isNaN(storyPoints as number) || (storyPoints as number) < 0)) rowErrors.push(`Row ${index + 1}: Invalid Story Points`);
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
           rowErrors.push(`Row ${index + 1}: Invalid dependencies: ${invalidDeps.join(', ')}`);
       }

       if (rowErrors.length > 0) {
         toast({
           variant: "destructive",
           title: `Error in New Backlog Row ${index + 1}`,
           description: rowErrors.join(', ')
         });
         hasErrors = true;
         return; // Stop processing this item
       }

       // Add validated ID to set to prevent duplicates within the batch being saved
       if (backlogId) allKnownBacklogIds.add(lowerCaseBacklogId);

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
         // Ensure historical fields are not set for new items
         historyStatus: undefined,
         movedToSprint: undefined,
         devEstimatedTime: undefined,
         qaEstimatedTime: undefined,
         bufferTime: undefined,
         assignee: undefined,
         reviewer: undefined,
         status: undefined, // Status isn't typically set for backlog items directly
         startDate: undefined,
         acceptanceCriteria: row.acceptanceCriteria, // Persist acceptance criteria
       });
     });

     if (hasErrors) {
         return;
     }

     if (itemsToSave.length === 0) {
        if (newBacklogRows.length > 0) { // If there were rows but they were all skipped/empty
            toast({ title: "No New Items", description: "No valid new items to save." });
        } // No toast if it was already empty
         setNewBacklogRows([]); // Ensure the row area is cleared
         setHasUnsavedChanges(false);
         return;
     }


     onSaveNewItems(itemsToSave); // Call the specific prop for saving NEW items
     setNewBacklogRows([]); // Clear the new items table after successful save
     setHasUnsavedChanges(false); // Reset unsaved changes for the top table
     toast({ title: "Success", description: `${itemsToSave.length} new backlog item(s) saved.` });
   };

   // --- Handlers for the SAVED items table ---

   // Toggle edit mode for a saved item
   const handleSavedItemEditToggle = (itemId: string) => {
      setSavedBacklogItems(prev =>
          prev.map(item =>
              item.id === itemId
                  ? { ...item, isEditing: !item.isEditing }
                  : { ...item, isEditing: false } // Only one item can be edited at a time
          )
      );
   };

    // Handle input changes for SAVED items
    const handleSavedInputChange = (itemId: string, field: keyof Omit<Task, 'id' | '_internalId' | 'ref' | 'isEditing' | 'createdDateObj' | 'dependsOn'>, value: string | number | undefined) => {
        setSavedBacklogItems(prev =>
            prev.map(item =>
                item.id === itemId ? { ...item, [field]: value ?? '' } : item
            )
        );
        // Mark changes as unsaved for the main save button
        setHasUnsavedChanges(true);
    };

    // Handle select changes for SAVED items
    const handleSavedSelectChange = (itemId: string, field: 'taskType' | 'priority' | 'initiator', value: string) => {
       let finalValue: string | undefined | null = value;
       if (value === 'none') {
          finalValue = undefined;
       }
      handleSavedInputChange(itemId, field, finalValue);
    };

    // Handle checkbox changes for SAVED items
    const handleSavedCheckboxChange = (itemId: string, field: 'needsGrooming' | 'readyForSprint', checked: boolean | 'indeterminate') => {
      setSavedBacklogItems(prev =>
        prev.map(item =>
          item.id === itemId ? { ...item, [field]: !!checked } : item
        )
      );
      // Mark changes as unsaved
      setHasUnsavedChanges(true);
    };


    // Handle saving an individual edited SAVED item
    const handleSaveSingleEditedItem = (itemId: string) => {
        const itemToSave = savedBacklogItems.find(item => item.id === itemId);
        if (!itemToSave) {
            toast({ variant: "destructive", title: "Error", description: "Item not found." });
            return;
        }

        // Basic Validation (adapt as needed from handleSaveNewItems)
        const backlogId = itemToSave.backlogId?.trim() || '';
        const title = itemToSave.title?.trim();
        let hasErrors = false;
        let errors: string[] = [];

        if (!backlogId) errors.push(`Backlog ID required`);
        // Check against all OTHER saved items
        if (initialBacklog.some(t => t.id !== itemId && t.backlogId?.toLowerCase() === backlogId.toLowerCase())) {
             errors.push(`Duplicate Backlog ID "${backlogId}" already exists.`);
        }
        if (!title) errors.push("Title required");

         // Add other validation as necessary (priority, task type etc.)

         if (errors.length > 0) {
             toast({ variant: "destructive", title: `Validation Error`, description: errors.join(', ') });
             hasErrors = true;
             return;
         }

        if (!hasErrors) {
            // Convert back to Task type (remove internal state)
            const { _internalId, isEditing, ref, createdDateObj, ...finalTask } = itemToSave;
            onUpdateSavedItem(finalTask);
            // Turn off editing mode for this item
            setSavedBacklogItems(prev => prev.map(item => item.id === itemId ? { ...item, isEditing: false } : item));
            toast({ title: "Success", description: `Backlog item '${finalTask.backlogId}' updated.` });
             // Potentially reset overall unsaved changes if this was the only change
             // This requires more complex tracking, maybe a separate state for saved item changes
             // For simplicity, leave hasUnsavedChanges as is, or reset it here assuming Save All is the goal
             // setHasUnsavedChanges(false); // Or track changes more granularly
        }
    };


   // Memoized list of potential dependencies for the SAVED items table
   const savedPotentialDependencies = useMemo(() => {
       if (!editingDepsTaskId) return [];
       return savedBacklogItems
           .filter(item => item.id !== editingDepsTaskId && item.backlogId?.trim()) // Exclude self and items without ID
           .map(item => ({ id: item.backlogId!, title: item.title || `Item ${item.backlogId}` }));
   }, [savedBacklogItems, editingDepsTaskId]);

   // Memoized list of potential dependencies for the NEW items table
    const potentialDependenciesForNewItems = useMemo(() => {
        if (!editingDepsTaskId) return [];
        const allBacklogItems = [
            ...savedBacklogItems.map(t => ({ id: t.backlogId!, title: t.title || `Item ${t.backlogId}` })),
            ...newBacklogRows.filter(r => r._internalId !== editingDepsTaskId && r.backlogId).map(r => ({ id: r.backlogId!, title: r.title || `Item ${r.backlogId}` }))
        ];
        return allBacklogItems.filter(item => item.id?.trim()); // Ensure IDs are valid
    }, [savedBacklogItems, newBacklogRows, editingDepsTaskId]);


  return (
    <>
    {/* --- Add New Backlog Items Section --- */}
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="flex items-center gap-2"><PlusCircle className="h-5 w-5 text-primary" /> Add New Backlog Items</CardTitle>
            <CardDescription>Add new tasks to the project backlog. Click 'Add Backlog Item' to create rows, then 'Save New Items'.</CardDescription>
          </div>
           {/* Save button specifically for NEW items */}
          <Button onClick={handleSaveNewItems} disabled={newBacklogRows.length === 0}>
             <Save className="mr-2 h-4 w-4" /> Save New Items
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto">
            {/* Adjust min-width based on the number of columns */}
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
                        {/* Backlog ID (Readonly, Generated) */}
                        <div className="md:col-span-1 col-span-1">
                             <Label htmlFor={`new-backlog-id-${row._internalId}`} className="md:hidden text-xs font-medium">Backlog ID*</Label>
                             <Input
                                 id={`new-backlog-id-${row._internalId}`}
                                 value={row.backlogId ?? ''}
                                 readOnly // Generated ID is read-only
                                 className="h-9 bg-muted/50 cursor-default"
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
                                    onClick={() => handleOpenDepsDialog(row._internalId, true)} // Pass true for new item
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
                    Add Backlog Item
                </Button>
            </div>
         </div>
         <CardFooter className="flex justify-between items-center border-t pt-4">
           <p className="text-xs text-muted-foreground">* Required field.</p>
           {/* Save button specific to the NEW items section */}
           <Button onClick={handleSaveNewItems} disabled={newBacklogRows.length === 0}>
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
                    <p className="text-muted-foreground">{isFilteringReady ? "No items marked 'Ready for Sprint'." : "The saved backlog is empty."}</p>
                    <p className="text-sm text-muted-foreground">{isFilteringReady ? "Clear the filter or mark items as ready." : "Add and save new items using the section above."}</p>
                 </div>
             ) : (
               <div className="overflow-x-auto">
                 {/* Adjust min-width based on columns */}
                 <div className="min-w-[1600px] space-y-4">
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
                              <TableHead className="w-[120px]">Task Type</TableHead>
                              <TableHead className="w-[120px]">Initiator</TableHead>
                              <TableHead className="w-[120px]">
                                  <Button variant="ghost" onClick={() => requestSort('createdDate')} className="px-1 h-auto justify-start text-xs font-medium text-muted-foreground">
                                     Created {getSortIndicator('createdDate')}
                                  </Button>
                              </TableHead>
                              <TableHead className="w-[100px]">
                                  <Button variant="ghost" onClick={() => requestSort('priority')} className="px-1 h-auto justify-start text-xs font-medium text-muted-foreground">
                                     Priority {getSortIndicator('priority')}
                                  </Button>
                              </TableHead>
                              <TableHead className="w-[100px]">Dependencies</TableHead>
                              <TableHead className="w-[80px] text-center">
                                   <Button variant="ghost" onClick={() => requestSort('needsGrooming')} className="px-1 h-auto justify-center text-xs font-medium text-muted-foreground">
                                      Groom? {getSortIndicator('needsGrooming')}
                                   </Button>
                              </TableHead>
                              <TableHead className="w-[60px] text-center">
                                  <Button variant="ghost" onClick={() => requestSort('readyForSprint')} className="px-1 h-auto justify-center text-xs font-medium text-muted-foreground">
                                      Ready? {getSortIndicator('readyForSprint')}
                                  </Button>
                              </TableHead>
                              <TableHead className="w-[80px] text-center">Actions</TableHead>
                              <TableHead className="w-[40px]"></TableHead> {/* Delete column */}
                          </TableRow>
                     </TableHeader>
                     <TableBody>
                         {filteredAndSortedSavedRows.map((row) => (
                             <TableRow key={row.id} ref={row.ref} className="transition-colors duration-1000">
                                 {/* Backlog ID (Link/Editable) */}
                                <TableCell className="font-medium">
                                    {row.isEditing ? (
                                        <Input
                                            id={`saved-backlog-id-${row.id}`}
                                            value={row.backlogId ?? ''}
                                            onChange={e => handleSavedInputChange(row.id, 'backlogId', e.target.value)}
                                            placeholder="ID-123"
                                            className="h-9"
                                            required
                                        />
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => handleViewDetails(row)}
                                            className="text-primary underline cursor-pointer hover:text-primary/80 text-sm font-semibold"
                                            aria-label={`View details for ${row.backlogId}`}
                                        >
                                            {row.backlogId}
                                        </button>
                                    )}
                                </TableCell>
                                {/* Title (Editable) */}
                                <TableCell>
                                    {row.isEditing ? (
                                        <Input
                                            id={`saved-title-${row.id}`}
                                            value={row.title ?? ''}
                                            onChange={e => handleSavedInputChange(row.id, 'title', e.target.value)}
                                            placeholder="Task Title"
                                            className="h-9"
                                            required
                                        />
                                    ) : (
                                        <span className="text-sm">{row.title}</span>
                                    )}
                                </TableCell>
                                {/* Task Type (Editable) */}
                                <TableCell>
                                    {row.isEditing ? (
                                        <Select value={row.taskType ?? 'New Feature'} onValueChange={(value) => handleSavedSelectChange(row.id, 'taskType', value)}>
                                            <SelectTrigger id={`saved-type-${row.id}`} className="h-9">
                                                <SelectValue placeholder="Type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {taskTypes.map(option => (
                                                    <SelectItem key={option} value={option}>{option}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <span className="text-sm">{row.taskType}</span>
                                    )}
                                </TableCell>
                                {/* Initiator (Editable) */}
                                <TableCell>
                                    {row.isEditing ? (
                                        <Select value={row.initiator ?? 'none'} onValueChange={(value) => handleSavedSelectChange(row.id, 'initiator', value)} disabled={members.length === 0}>
                                            <SelectTrigger id={`saved-initiator-${row.id}`} className="h-9">
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
                                    ) : (
                                        <span className="text-sm">{row.initiator || '-'}</span>
                                    )}
                                </TableCell>
                                 {/* Created Date (Readonly) */}
                                 <TableCell className="text-sm">{row.createdDate && isValid(parseISO(row.createdDate)) ? format(parseISO(row.createdDate), 'MMM d, yyyy') : 'N/A'}</TableCell>
                                 {/* Priority (Editable) */}
                                <TableCell>
                                    {row.isEditing ? (
                                        <Select value={row.priority ?? 'Medium'} onValueChange={(value) => handleSavedSelectChange(row.id, 'priority', value)}>
                                            <SelectTrigger id={`saved-priority-${row.id}`} className="h-9">
                                                <SelectValue placeholder="Priority" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {taskPriorities.map(option => (
                                                    <SelectItem key={option} value={option}>{option}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <span className="text-sm">{row.priority}</span>
                                    )}
                                </TableCell>
                                 {/* Dependencies */}
                                  <TableCell className="self-center">
                                      <div className="flex items-center gap-1 flex-wrap min-h-[36px]">
                                          {(row.dependsOn && row.dependsOn.length > 0) ? (
                                              row.dependsOn.map(depId => (
                                                  <button
                                                      key={depId}
                                                      type="button"
                                                      onClick={() => handleScrollToDependency(depId)}
                                                      className="text-xs text-primary underline hover:text-primary/80 px-1 py-0.5 rounded bg-primary/10 cursor-pointer border-none"
                                                      disabled={row.isEditing} // Disable link when editing
                                                  >
                                                      {depId}
                                                  </button>
                                              ))
                                          ) : (
                                              <span className="text-xs text-muted-foreground italic">None</span>
                                          )}
                                           {/* Edit Dependencies Icon */}
                                           <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 ml-1"
                                                onClick={() => handleOpenDepsDialog(row.id, false)} // Pass false for saved item
                                                aria-label="Edit Dependencies"
                                                disabled={row.isEditing} // Disable button when editing main row
                                            >
                                                <LinkIcon className="h-3 w-3" />
                                           </Button>
                                      </div>
                                  </TableCell>
                                   {/* Needs Grooming */}
                                  <TableCell className="text-center">
                                      <Checkbox
                                          id={`saved-grooming-${row.id}`}
                                          checked={row.needsGrooming}
                                          onCheckedChange={(checked) => handleSavedCheckboxChange(row.id, 'needsGrooming', checked)}
                                          disabled={!row.isEditing}
                                          className="h-5 w-5"
                                      />
                                  </TableCell>
                                  {/* Ready for Sprint */}
                                  <TableCell className="text-center">
                                      <Checkbox
                                          id={`saved-ready-${row.id}`}
                                          checked={row.readyForSprint}
                                          onCheckedChange={(checked) => handleSavedCheckboxChange(row.id, 'readyForSprint', checked)}
                                          disabled={!row.isEditing}
                                          className="h-5 w-5"
                                      />
                                  </TableCell>
                                 {/* Actions Cell */}
                                  <TableCell className="text-center">
                                      <div className="flex items-center justify-center gap-1">
                                          {row.isEditing ? (
                                              <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600 hover:text-green-700" onClick={() => handleSaveSingleEditedItem(row.id)} title="Save Changes">
                                                  <Save className="h-4 w-4" />
                                              </Button>
                                          ) : (
                                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleSavedItemEditToggle(row.id)} title="Edit Item">
                                                  <Edit className="h-4 w-4" />
                                              </Button>
                                          )}
                                         <Button
                                             variant="ghost"
                                             size="icon"
                                             className="h-7 w-7"
                                             disabled={availableSprints.length === 0 || !row.id?.trim() || !row.readyForSprint || row.isEditing} // Disable if not ready or editing
                                             onClick={() => handleOpenMoveDialog(row.id)}
                                             aria-label="Move to Sprint"
                                             title={row.isEditing ? "Save or cancel edit first" : !row.readyForSprint ? "Item not ready for sprint" : availableSprints.length === 0 ? "No active/planned sprints" : "Move to Sprint"}
                                         >
                                             <ArrowRightSquare className="h-4 w-4" />
                                         </Button>
                                      </div>
                                  </TableCell>
                                  {/* Delete Button */}
                                  <TableCell>
                                       <Button
                                           type="button"
                                           variant="ghost"
                                           size="icon"
                                           onClick={() => onDeleteSavedItem(row.id)} // Use delete callback
                                           className="h-9 w-9 text-muted-foreground hover:text-destructive"
                                           aria-label="Delete saved backlog item"
                                           disabled={row.isEditing} // Disable delete while editing
                                           title="Delete Item"
                                       >
                                           <Trash2 className="h-4 w-4" />
                                       </Button>
                                   </TableCell>
                             </TableRow>
                         ))}
                     </TableBody>
                 </Table>
                 </div>
             </div>
           )}
       </CardContent>
       {/* Footer for Saved Items - maybe add bulk actions later? */}
        {/* <CardFooter className="border-t pt-4 flex justify-end">
            <Button disabled={!hasUnsavedChanges}>Save All Changes to Saved Items</Button>
        </CardFooter> */}
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
                    Select the target sprint to move backlog item '{savedBacklogItems.find(r => r.id === movingTaskId)?.backlogId}' to.
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
             (savedBacklogItems.find(item => item.id === editingDepsTaskId)?.dependsOn) ??
             []
         }
         potentialDependencies={
             newBacklogRows.some(row => row._internalId === editingDepsTaskId)
                 ? potentialDependenciesForNewItems // Use memoized list for new items
                 : savedPotentialDependencies // Use memoized list for saved items
         }
         onSave={handleSaveDependencies}
         currentTaskName={
             (newBacklogRows.find(row => row._internalId === editingDepsTaskId)?.title) ||
             (savedBacklogItems.find(item => item.id === editingDepsTaskId)?.title) || ''
          }
         currentTaskId={
             (newBacklogRows.find(row => row._internalId === editingDepsTaskId)?.backlogId) ||
             (savedBacklogItems.find(item => item.id === editingDepsTaskId)?.backlogId) || ''
         }
      />
    </>
  );
}