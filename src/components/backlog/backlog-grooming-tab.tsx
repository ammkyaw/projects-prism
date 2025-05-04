
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react'; // Added useMemo
import type { Task, HistoryStatus } from '@/types/sprint-data'; // Added HistoryStatus
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea'; // Added Textarea
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from '@/components/ui/checkbox'; // Import Checkbox
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog"; // Import Dialog components
import { Info, Edit, Save, XCircle, HelpCircle, BookOpenCheck, Split, GitMerge, Undo } from 'lucide-react'; // Added Undo icon
import { useToast } from "@/hooks/use-toast";
import { taskPriorities } from '@/types/sprint-data'; // Import priorities
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; // Import Tooltip components
import SplitBacklogItemDialog from '@/components/split-backlog-item-dialog'; // Import Split Dialog
import MergeBacklogDialog from '@/components/merge-backlog-dialog'; // Import Merge Dialog

interface BacklogGroomingTabProps {
  projectId: string;
  projectName: string;
  initialBacklog: Task[]; // Receive initial backlog (all items)
  onSaveBacklog: (backlog: Task[]) => void; // Callback to save changes (saves ALL items, not just groomed)
  onSplitBacklogItem: (originalTaskId: string, splitTasks: Task[]) => void; // Add split handler prop
  onMergeBacklogItems: (taskIdsToMerge: string[], mergedTask: Task) => void; // Add merge handler prop
  onUndoBacklogAction: (taskId: string) => void; // Add undo handler prop
  generateNextBacklogId: (allProjectBacklogItems: Task[]) => string; // Add helper prop for merging
}

interface EditableBacklogItem extends Task {
  _internalId: string;
  isEditing?: boolean;
}

export default function BacklogGroomingTab({ projectId, projectName, initialBacklog, onSaveBacklog, onSplitBacklogItem, onMergeBacklogItems, onUndoBacklogAction, generateNextBacklogId }: BacklogGroomingTabProps) {
  const [allEditableBacklog, setAllEditableBacklog] = useState<EditableBacklogItem[]>([]); // Store ALL items
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSplitDialogOpen, setIsSplitDialogOpen] = useState(false); // State for Split dialog
  const [splittingTask, setSplittingTask] = useState<Task | null>(null); // Task being split
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false); // State for Merge dialog
  const { toast } = useToast();

   // Filtered list for display (only items needing grooming and not already moved/split/merged)
   const groomingItems = useMemo(() =>
       allEditableBacklog.filter(item => item.needsGrooming && !item.historyStatus),
       [allEditableBacklog]
   );

   // Filtered list for Merge dialog (all non-historical items)
    const mergeCandidates = useMemo(() =>
       allEditableBacklog.filter(item => !item.historyStatus),
       [allEditableBacklog]
    );


   // Initialize state when initialBacklog changes
   useEffect(() => {
       setAllEditableBacklog(
           (initialBacklog || []).map((task, index) => ({ // Add null check for initialBacklog
               ...task,
               _internalId: task.id || `groom_${index}_${Date.now()}`,
               storyPoints: task.storyPoints?.toString() ?? '', // Ensure story points are string for input
               needsGrooming: task.needsGrooming ?? false, // Ensure boolean, default is false
               readyForSprint: task.readyForSprint ?? false, // Ensure boolean
               isEditing: false,
           }))
       );
       setHasUnsavedChanges(false); // Reset changes on new data load
   }, [initialBacklog]);

   // Track unsaved changes by comparing current state with initial props
   useEffect(() => {
        const cleanBacklog = (tasks: Task[]): Omit<Task, 'id' | 'status' | 'movedToSprint' | 'historyStatus'>[] =>
           (tasks || []).map(({ id, status, movedToSprint, historyStatus, ...rest }: any) => ({ // Add null check, exclude historyStatus
               backlogId: rest.backlogId?.trim() || '',
               title: rest.title?.trim() || '',
               description: rest.description?.trim() || '',
               acceptanceCriteria: rest.acceptanceCriteria?.trim() || '', // Added acceptance criteria
               storyPoints: rest.storyPoints?.toString().trim() || '',
               priority: rest.priority ?? 'Medium',
               taskType: rest.taskType ?? 'New Feature',
               createdDate: rest.createdDate ?? '',
               initiator: rest.initiator?.trim() || '',
               dependsOn: (rest.dependsOn || []).sort(),
               needsGrooming: !!rest.needsGrooming,
               readyForSprint: !!rest.readyForSprint,
               devEstimatedTime: undefined,
               qaEstimatedTime: undefined,
               bufferTime: undefined,
               assignee: undefined,
               reviewer: undefined,
               startDate: undefined,
               ticketNumber: undefined,
           })).sort((a, b) => (a.backlogId || '').localeCompare(b.backlogId || ''));

        // Compare against the *displayable* initial items (those not moved/split/merged)
       const originalBacklogString = JSON.stringify(cleanBacklog(initialBacklog?.filter(t => !t.historyStatus) || []));
       const currentBacklogString = JSON.stringify(
            cleanBacklog(
                allEditableBacklog.filter(t => !t.historyStatus) // Compare with the FULL current editable state (excluding historical)
            )
       );
       setHasUnsavedChanges(originalBacklogString !== currentBacklogString);
   }, [allEditableBacklog, initialBacklog]);


  const handleEditToggle = (internalId: string) => {
    setAllEditableBacklog(prev =>
      prev.map(item =>
        item._internalId === internalId ? { ...item, isEditing: !item.isEditing } : { ...item, isEditing: false } // Only one can be edited at a time
      )
    );
  };

  const handleInputChange = (internalId: string, field: keyof Omit<EditableBacklogItem, '_internalId' | 'id' | 'isEditing' | 'needsGrooming' | 'readyForSprint' | 'historyStatus' | 'movedToSprint'>, value: string | number | undefined) => {
    setAllEditableBacklog(prev =>
      prev.map(item =>
        item._internalId === internalId ? { ...item, [field]: value ?? '' } : item
      )
    );
  };

   const handlePriorityChange = (internalId: string, value: string) => {
        handleInputChange(internalId, 'priority', value);
   };

   const handleCheckboxChange = (internalId: string, field: 'needsGrooming' | 'readyForSprint', checked: boolean | 'indeterminate') => {
       setAllEditableBacklog(prev =>
           prev.map(item =>
               item._internalId === internalId ? { ...item, [field]: !!checked } : item
           )
       );
   };

   // Handler for opening the split dialog
   const handleOpenSplitDialog = (item: EditableBacklogItem) => {
        setSplittingTask(item);
        setIsSplitDialogOpen(true);
   };

   // Handler for saving the split items (passed to the dialog)
   const handleConfirmSplit = (originalTaskId: string, splitTasks: Task[]) => {
        console.log("Confirming split:", originalTaskId, splitTasks);
        onSplitBacklogItem(originalTaskId, splitTasks);
        setIsSplitDialogOpen(false);
        setSplittingTask(null);
   };

   // Handler for opening the merge dialog
   const handleOpenMergeDialog = () => {
      setIsMergeDialogOpen(true);
   };

   // Handler for confirming the merge operation
   const handleConfirmMerge = (taskIdsToMerge: string[], mergedTask: Task) => {
       console.log("Confirming merge:", taskIdsToMerge, mergedTask);
       onMergeBacklogItems(taskIdsToMerge, mergedTask);
       setIsMergeDialogOpen(false);
   };

   // Handler for the Undo button
   const handleUndoClick = (item: EditableBacklogItem) => {
      if (!item.backlogId) {
          toast({ variant: "destructive", title: "Error", description: "Cannot undo action for item without Backlog ID." });
          return;
      }
       // Extract the base ID (e.g., BL-250001 from BL-250001-a or BL-250001-m)
        const baseIdMatch = item.backlogId.match(/^(BL-\d{6})/); // Adjust regex if ID format changes
        const baseId = baseIdMatch ? baseIdMatch[1] : null;


       if (!baseId) {
           toast({ variant: "destructive", title: "Error", description: "Could not determine original item ID to undo." });
           return;
       }

       // Find the original item(s) in the full backlog (including history)
       // For Split: Find the item with the baseId and 'Split' status
       // For Merge: Find *all* items with 'Merge' status that might relate (this needs better tracking ideally)
       // We need to find the *historical* record of the original item(s)
       const originalItems = initialBacklog.filter(
            task => task.backlogId === baseId && (task.historyStatus === 'Split' || task.historyStatus === 'Merge')
       );

       if (originalItems.length === 0) {
          toast({ variant: "destructive", title: "Error", description: `Original historical item(s) for ${baseId} not found.` });
          return;
       }

       // Assuming undo is triggered from one of the results, we need the *original* historical item's ID
       // For simplicity, let's assume we just need the ID of the first found original historical item
       const originalItemId = originalItems[0].id;

       // Call the main undo handler with the ID of the original historical item
       onUndoBacklogAction(originalItemId);
   };


  const handleSaveAll = () => {
    let hasErrors = false;
    // We only save changes for items that are NOT historical
    const itemsToSave = allEditableBacklog.filter(item => !item.historyStatus);
    const finalBacklogPortion: Task[] = [];
    const backlogIds = new Set<string>();

    // Pre-populate set with existing IDs from non-historical initial backlog
    initialBacklog.filter(t => !t.historyStatus).forEach(task => {
        if (task.backlogId) backlogIds.add(task.backlogId.toLowerCase());
    });


    itemsToSave.forEach((item, index) => { // Iterate over items needing potential save
        const backlogId = item.backlogId?.trim() || '';
        const title = item.title?.trim();
        const description = item.description?.trim();
        const acceptanceCriteria = item.acceptanceCriteria?.trim(); // Added
        const storyPointsRaw = item.storyPoints?.toString().trim();
        const storyPoints = storyPointsRaw ? parseInt(storyPointsRaw, 10) : undefined;
        const priority = item.priority ?? 'Medium';
        const needsGrooming = !!item.needsGrooming; // Ensure boolean
        const readyForSprint = !!item.readyForSprint; // Ensure boolean

        let itemErrors: string[] = [];
        if (!backlogId) itemErrors.push(`Row ${index + 1}: Backlog ID required`);
        // Check for duplicates only if the ID has changed from its initial state OR if it's a new item (no initial ID)
         if (backlogId && item.id && initialBacklog.find(i => i.id === item.id)?.backlogId !== backlogId && backlogIds.has(backlogId.toLowerCase())) {
             itemErrors.push(`Row ${index + 1}: Duplicate Backlog ID "${backlogId}"`);
         } else if (backlogId && !item.id && backlogIds.has(backlogId.toLowerCase())) {
             itemErrors.push(`Row ${index + 1}: Duplicate Backlog ID "${backlogId}"`);
         }
        if (!title) itemErrors.push(`Row ${index + 1}: Title required`);
         if (storyPointsRaw && (isNaN(storyPoints as number) || (storyPoints as number) < 0)) itemErrors.push(`Row ${index + 1}: Invalid Story Points`);

        if (itemErrors.length > 0) {
            toast({ variant: "destructive", title: "Validation Error", description: itemErrors.join(', ') });
            hasErrors = true;
            return; // Stop processing this item
        }

        if (backlogId && !item.id) backlogIds.add(backlogId.toLowerCase()); // Add to set only if it's a new item being validated

        finalBacklogPortion.push({
            ...item, // Keep other original fields like taskType, createdDate etc.
            id: item.id || `groom_save_${index}_${Date.now()}`, // Ensure ID
            backlogId: backlogId,
            title: title,
            description: description,
            acceptanceCriteria: acceptanceCriteria, // Save acceptance criteria
            storyPoints: storyPoints,
            priority: priority as Task['priority'],
            needsGrooming, // Save flag state
            readyForSprint, // Save flag state
             // Ensure historical fields are preserved if they somehow exist (though they shouldn't be in itemsToSave)
            historyStatus: item.historyStatus,
            movedToSprint: item.movedToSprint,
        });
    });

    if (hasErrors) {
        return;
    }

    // Get historical items from the main state to combine before saving
    const historicalItems = allEditableBacklog.filter(item => item.historyStatus);
    const fullBacklogToSave = [...finalBacklogPortion, ...historicalItems];

    // Sort before saving
    fullBacklogToSave.sort((a, b) => (taskPriorities.indexOf(a.priority!) - taskPriorities.indexOf(b.priority!)) || (a.backlogId ?? '').localeCompare(b.backlogId ?? ''));

    onSaveBacklog(fullBacklogToSave); // Save the entire updated backlog (active + historical)
    setHasUnsavedChanges(false);
    // Collapse all edit forms after saving
    setAllEditableBacklog(prev => prev.map(item => ({ ...item, isEditing: false })));
    toast({ title: "Success", description: "Backlog grooming changes saved." });
  };

  // Check if a backlog ID indicates a split or merged item based on the format (e.g., ends with -suffix)
  const isSplitOrMergedItem = (backlogId: string | undefined): boolean => {
     if (!backlogId) return false;
     // Checks if the ID ends with '-[number]' (split) or was potentially created by merge (harder to tell without better linking)
     return /-\d+$/.test(backlogId);
     // Note: Checking for merge results is complex without a direct link.
     // Relying on the historical record might be better if needed.
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
              <div>
                 <CardTitle className="flex items-center gap-2"><Edit className="h-5 w-5 text-primary" /> Backlog Grooming</CardTitle> {/* Updated Icon */}
                 <CardDescription>Refine items marked 'Needs Grooming'. Add details, estimate, mark as ready, split, or merge stories.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                  <TooltipProvider>
                      {/* View DoR */}
                       <Tooltip>
                          <TooltipTrigger asChild>
                              <Dialog>
                                  <DialogTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8">
                                          <BookOpenCheck className="h-4 w-4" />
                                      </Button>
                                  </DialogTrigger>
                                  <DialogContent className="sm:max-w-md">
                                      <DialogHeader>
                                          <DialogTitle>Definition of Ready (DoR)</DialogTitle>
                                      </DialogHeader>
                                      <DialogDescription asChild>
                                         <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground py-4">
                                             <li>Well-defined and clear acceptance criteria</li>
                                             <li>Small enough to be completed within one sprint</li>
                                             <li>No blockers or unresolved dependencies</li>
                                             <li>Prioritized by the Project Manager/ Product Owner</li>
                                          </ul>
                                      </DialogDescription>
                                      <DialogFooter>
                                          <DialogClose asChild>
                                              <Button type="button" variant="secondary">Close</Button>
                                          </DialogClose>
                                      </DialogFooter>
                                  </DialogContent>
                              </Dialog>
                          </TooltipTrigger>
                          <TooltipContent><p>View Definition of Ready</p></TooltipContent>
                       </Tooltip>
                       {/* Merge Items */}
                       <Tooltip>
                           <TooltipTrigger asChild>
                               <Button variant="ghost" size="icon" onClick={handleOpenMergeDialog} disabled={mergeCandidates.length < 2} className="h-8 w-8">
                                   <GitMerge className="h-4 w-4" />
                               </Button>
                           </TooltipTrigger>
                           <TooltipContent><p>Merge Items</p></TooltipContent>
                       </Tooltip>
                      {/* Save All */}
                      <Tooltip>
                          <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={handleSaveAll} disabled={!hasUnsavedChanges} className="h-8 w-8">
                                  <Save className="h-4 w-4" />
                              </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Save All Changes</p></TooltipContent>
                      </Tooltip>
                  </TooltipProvider>
              </div>
          </div>
        </CardHeader>
        <CardContent>
          {groomingItems.length === 0 ? ( // Check filtered list for display
               <div className="flex flex-col items-center justify-center min-h-[200px] border-dashed border-2 rounded-md p-6">
                  <Info className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No backlog items currently marked as needing grooming.</p>
                  <p className="text-sm text-muted-foreground">Check items in the 'Management' tab.</p>
               </div>
           ) : (
              <div className="space-y-4">
                {groomingItems.map(item => ( // Map over filtered list for display
                  <Card key={item._internalId} className={cn("transition-all", item.isEditing ? "shadow-lg border-primary" : "")}>
                    <CardHeader className="flex flex-row justify-between items-center py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{item.backlogId}</span> - <span>{item.title}</span>
                        <span className="text-xs text-muted-foreground">({item.priority})</span>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => handleEditToggle(item._internalId)} className="h-8 w-8">
                         {item.isEditing ? <XCircle className="h-4 w-4 text-destructive" /> : <Edit className="h-4 w-4" />}
                      </Button>
                    </CardHeader>
                    {item.isEditing && (
                      <CardContent className="px-4 pb-4 space-y-4 border-t pt-4">
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1">
                               <Label htmlFor={`groom-title-${item._internalId}`}>Title</Label>
                               <Input
                                  id={`groom-title-${item._internalId}`}
                                  value={item.title ?? ''}
                                  onChange={e => handleInputChange(item._internalId, 'title', e.target.value)}
                                  placeholder="Task Title"
                               />
                            </div>
                             <div className="space-y-1">
                                  <Label htmlFor={`groom-priority-${item._internalId}`}>Priority</Label>
                                  <Select value={item.priority ?? 'Medium'} onValueChange={(value) => handlePriorityChange(item._internalId, value)}>
                                      <SelectTrigger id={`groom-priority-${item._internalId}`}>
                                          <SelectValue placeholder="Priority" />
                                      </SelectTrigger>
                                      <SelectContent>
                                          {taskPriorities.map(option => (
                                              <SelectItem key={option} value={option}>{option}</SelectItem>
                                          ))}
                                      </SelectContent>
                                  </Select>
                             </div>
                             <div className="space-y-1">
                                  <Label htmlFor={`groom-sp-${item._internalId}`}>Story Points</Label>
                                  <Input
                                      id={`groom-sp-${item._internalId}`}
                                      type="number"
                                      value={item.storyPoints}
                                      onChange={e => handleInputChange(item._internalId, 'storyPoints', e.target.value)}
                                      placeholder="SP (e.g., 3)"
                                      min="0"
                                  />
                             </div>
                         </div>
                          <div className="space-y-1">
                              <Label htmlFor={`groom-desc-${item._internalId}`}>Description</Label>
                              <Textarea
                                  id={`groom-desc-${item._internalId}`}
                                  value={item.description ?? ''}
                                  onChange={e => handleInputChange(item._internalId, 'description', e.target.value)}
                                  placeholder="Detailed description of the task..."
                                  rows={3}
                              />
                          </div>
                           <div className="space-y-1">
                               <Label htmlFor={`groom-ac-${item._internalId}`}>Acceptance Criteria</Label>
                               <Textarea
                                   id={`groom-ac-${item._internalId}`}
                                   value={item.acceptanceCriteria ?? ''}
                                   onChange={e => handleInputChange(item._internalId, 'acceptanceCriteria', e.target.value)}
                                   placeholder="List the criteria for accepting this task as done..."
                                   rows={4}
                               />
                           </div>
                           {/* Flags and Split/Undo Button */}
                            <div className="flex items-center justify-between space-x-4">
                               <div className="flex items-center space-x-4">
                                  <div className="flex items-center space-x-2">
                                      <Checkbox
                                          id={`groom-needs-${item._internalId}`}
                                          checked={item.needsGrooming}
                                          onCheckedChange={(checked) => handleCheckboxChange(item._internalId, 'needsGrooming', checked)}
                                      />
                                      <Label htmlFor={`groom-needs-${item._internalId}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                          Needs Grooming
                                      </Label>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                      <Checkbox
                                          id={`groom-ready-${item._internalId}`}
                                          checked={item.readyForSprint}
                                          onCheckedChange={(checked) => handleCheckboxChange(item._internalId, 'readyForSprint', checked)}
                                      />
                                      <Label htmlFor={`groom-ready-${item._internalId}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                          Ready for Sprint
                                      </Label>
                                      <TooltipProvider>
                                          <Tooltip>
                                              <TooltipTrigger asChild>
                                                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                  <p className="text-xs max-w-xs">DoR: Story must be small, clear, prioritized, and have no blockers.</p>
                                              </TooltipContent>
                                          </Tooltip>
                                      </TooltipProvider>
                                  </div>
                               </div>
                                {/* Conditionally render Split or Undo button */}
                                {isSplitOrMergedItem(item.backlogId) ? (
                                     <Button
                                         variant="outline"
                                         size="sm"
                                         onClick={() => handleUndoClick(item)}
                                         className="text-blue-600 hover:text-blue-700"
                                         title="Undo Split/Merge"
                                     >
                                         <Undo className="mr-2 h-4 w-4" /> Undo
                                     </Button>
                                 ) : (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleOpenSplitDialog(item)}
                                    >
                                        <Split className="mr-2 h-4 w-4" /> Split Story
                                    </Button>
                                )}
                            </div>
                            {/* Add fields for Estimation later */}
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
           )}
        </CardContent>
          {groomingItems.length > 0 && ( // Only show footer if items are displayed
             <CardFooter className="border-t pt-4 flex justify-end">
                 <Button onClick={handleSaveAll} disabled={!hasUnsavedChanges}>
                     <Save className="mr-2 h-4 w-4" /> Save All Changes
                 </Button>
             </CardFooter>
          )}
      </Card>

        {/* Split Backlog Item Dialog */}
        {splittingTask && (
            <SplitBacklogItemDialog
                isOpen={isSplitDialogOpen}
                onOpenChange={setIsSplitDialogOpen}
                originalTask={splittingTask}
                onConfirmSplit={handleConfirmSplit}
                allProjectBacklogItems={initialBacklog} // Pass all items for ID generation
            />
        )}

         {/* Merge Backlog Items Dialog */}
         <MergeBacklogDialog
             isOpen={isMergeDialogOpen}
             onOpenChange={setIsMergeDialogOpen}
             availableBacklogItems={mergeCandidates} // Pass only non-historical items
             onConfirmMerge={handleConfirmMerge}
             generateNextBacklogId={generateNextBacklogId} // Pass helper
             allProjectBacklogItems={initialBacklog} // Pass all items for ID check
         />
    </>
  );
}
