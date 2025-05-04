
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Import Select components
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlusCircle, Trash2, Split, Copy } from 'lucide-react';
import type { Task } from '@/types/sprint-data';
import { taskPriorities, initialBacklogTask } from '@/types/sprint-data';
import { useToast } from "@/hooks/use-toast";
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface SplitBacklogItemDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  originalTask: Task; // The task being split
  onConfirmSplit: (originalTaskId: string, splitTasks: Task[]) => void;
  allProjectBacklogItems: Task[]; // Needed for checking ID uniqueness (though less critical with suffixes)
}

interface SplitTaskRow extends Partial<Task> {
  _internalId: string;
}

// Helper to generate the next alphabetical suffix
const getNextSuffix = (currentCount: number): string => {
  return String.fromCharCode(97 + currentCount); // 97 is 'a'
};

const createEmptySplitTaskRow = (baseTask: Task, suffix: string): SplitTaskRow => {
    const newBacklogId = `${baseTask.backlogId}-${suffix}`;
    return {
        _internalId: `split_${baseTask.id}_${newBacklogId}_${Date.now()}`,
        id: '', // New ID needed on save
        backlogId: newBacklogId, // Auto-generated ID
        title: `${baseTask.title} (${suffix.toUpperCase()})` ?? `Split Task ${suffix.toUpperCase()}`,
        description: baseTask.description ?? '',
        acceptanceCriteria: '', // Start AC fresh
        storyPoints: '', // Reset story points, needs re-estimation
        priority: baseTask.priority ?? 'Medium',
        taskType: baseTask.taskType,
        createdDate: format(new Date(), 'yyyy-MM-dd'),
        initiator: baseTask.initiator,
        dependsOn: baseTask.dependsOn ? [...baseTask.dependsOn] : [], // Copy dependencies
        needsGrooming: true, // Mark new items as needing grooming
        readyForSprint: false,
    };
};

export default function SplitBacklogItemDialog({
  isOpen,
  onOpenChange,
  originalTask,
  onConfirmSplit,
  allProjectBacklogItems, // Keep for potential future validation, though suffixes reduce collision risk
}: SplitBacklogItemDialogProps) {
  const [splitTaskRows, setSplitTaskRows] = useState<SplitTaskRow[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && originalTask) {
      // Initialize with two split tasks by default when dialog opens
      setSplitTaskRows([
        createEmptySplitTaskRow(originalTask, getNextSuffix(0)), // Suffix 'a'
        createEmptySplitTaskRow(originalTask, getNextSuffix(1)), // Suffix 'b'
      ]);
    } else {
      setSplitTaskRows([]); // Reset when closed
    }
  }, [isOpen, originalTask]);

  const handleAddSplitTaskRow = () => {
    const nextSuffix = getNextSuffix(splitTaskRows.length);
    setSplitTaskRows(prev => [...prev, createEmptySplitTaskRow(originalTask, nextSuffix)]);
  };

  const handleRemoveSplitTaskRow = (internalId: string) => {
    setSplitTaskRows(prevRows => {
      const newRows = prevRows.filter(row => row._internalId !== internalId);
      // Need at least one row to confirm split
      if (newRows.length === 0) {
        toast({ variant: "destructive", title: "Error", description: "Cannot remove the last split item." });
        return prevRows;
      }
       // Re-assign suffixes after removal to maintain sequence (a, b, c...)
       return newRows.map((row, index) => ({
           ...row,
           backlogId: `${originalTask.backlogId}-${getNextSuffix(index)}`,
           title: `${originalTask.title} (${getNextSuffix(index).toUpperCase()})`
       }));
    });
  };

  const handleInputChange = (internalId: string, field: keyof Omit<SplitTaskRow, '_internalId' | 'id'>, value: string | number | undefined) => { // Adjust fields as needed
    setSplitTaskRows(rows =>
      rows.map(row => (row._internalId === internalId ? { ...row, [field]: value ?? '' } : row))
    );
  };

   const handlePriorityChange = (internalId: string, value: string) => {
     handleInputChange(internalId, 'priority', value);
   };

   const handleCopyDescription = (internalId: string) => {
       if (originalTask.description) {
           handleInputChange(internalId, 'description', originalTask.description);
       }
   };

   const handleCopyAC = (internalId: string) => {
       if (originalTask.acceptanceCriteria) {
           handleInputChange(internalId, 'acceptanceCriteria', originalTask.acceptanceCriteria);
       }
   };

  const handleConfirm = () => {
    let hasErrors = false;
    const finalSplitTasks: Task[] = [];

     // Validate at least one split task exists
     if (splitTaskRows.length === 0) {
         toast({ variant: "destructive", title: "Validation Error", description: "At least one split task is required." });
         return;
     }

    splitTaskRows.forEach((row, index) => {
      const backlogId = row.backlogId?.trim(); // Now auto-generated
      const title = row.title?.trim();
      const storyPointsRaw = row.storyPoints?.toString().trim();
      const storyPoints = storyPointsRaw ? parseInt(storyPointsRaw, 10) : undefined;
      const priority = row.priority ?? 'Medium';

      let rowErrors: string[] = [];
      if (!backlogId) rowErrors.push(`Split Task ${index + 1}: Backlog ID generation failed.`); // Should not happen
      if (!title) rowErrors.push(`Split Task ${index + 1}: Title required.`);
      if (storyPointsRaw && (isNaN(storyPoints as number) || (storyPoints as number) < 0)) {
        rowErrors.push(`Split Task ${index + 1}: Invalid Story Points.`);
      }
      if (!priority || !taskPriorities.includes(priority as any)) {
         rowErrors.push(`Split Task ${index + 1}: Invalid Priority.`);
      }


      if (rowErrors.length > 0) {
        toast({
          variant: "destructive",
          title: `Error in Split Task ${index + 1}`,
          description: rowErrors.join(', ')
        });
        hasErrors = true;
        return; // Stop processing this row
      }

      // Convert SplitTaskRow back to Task structure for saving
      finalSplitTasks.push({
        id: '', // Generate new ID on save in parent
        backlogId: backlogId,
        ticketNumber: backlogId, // Use backlogId as initial ticketNumber
        title: title,
        description: row.description?.trim(),
        acceptanceCriteria: row.acceptanceCriteria?.trim(),
        storyPoints: storyPoints,
        priority: priority as Task['priority'],
        taskType: row.taskType ?? originalTask.taskType,
        createdDate: row.createdDate ?? format(new Date(), 'yyyy-MM-dd'),
        initiator: row.initiator ?? originalTask.initiator,
        dependsOn: row.dependsOn ?? [],
        needsGrooming: true, // Always true for newly split items
        readyForSprint: false, // Always false for newly split items
        movedToSprint: undefined, // Ensure not moved
        historyStatus: undefined, // Ensure no history status initially
        // Fields not typically set during split
        devEstimatedTime: undefined,
        qaEstimatedTime: undefined,
        bufferTime: undefined,
        assignee: undefined,
        reviewer: undefined,
        status: undefined,
        startDate: undefined,
      });
    });

    if (hasErrors) {
      return;
    }

    if (finalSplitTasks.length === 0) {
        toast({ variant: "destructive", title: "Validation Error", description: "No valid split tasks were created." });
        return;
    }

    onConfirmSplit(originalTask.id, finalSplitTasks);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl"> {/* Larger width */}
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Split className="h-5 w-5 text-primary" /> Split Backlog Item: {originalTask.backlogId}
          </DialogTitle>
          <DialogDescription>
            Divide '{originalTask.title}' into smaller tasks. IDs will be auto-generated ({originalTask.backlogId}-a, {originalTask.backlogId}-b, etc.). New items need re-estimation and grooming.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] w-full rounded-md border p-4 mt-4">
          <div className="space-y-6">
            {splitTaskRows.map((row, index) => (
              <div key={row._internalId} className="border p-4 rounded-md relative bg-background">
                 <Button
                     type="button"
                     variant="ghost"
                     size="icon"
                     onClick={() => handleRemoveSplitTaskRow(row._internalId)}
                     className="absolute top-2 right-2 h-7 w-7 text-muted-foreground hover:text-destructive"
                     aria-label="Remove this split task"
                     disabled={splitTaskRows.length <= 1} // Cannot remove the last one
                 >
                     <Trash2 className="h-4 w-4" />
                 </Button>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                     <div className="space-y-1">
                        <Label htmlFor={`split-id-${row._internalId}`}>Backlog ID</Label>
                        <Input
                           id={`split-id-${row._internalId}`}
                           value={row.backlogId ?? ''}
                           readOnly // Auto-generated
                           className="bg-muted cursor-default"
                        />
                     </div>
                    <div className="space-y-1 md:col-span-2">
                       <Label htmlFor={`split-title-${row._internalId}`}>Title*</Label>
                       <Input
                          id={`split-title-${row._internalId}`}
                          value={row.title ?? ''}
                          onChange={e => handleInputChange(row._internalId, 'title', e.target.value)}
                          placeholder="Split Task Title"
                       />
                    </div>
                     <div className="space-y-1">
                         <Label htmlFor={`split-priority-${row._internalId}`}>Priority*</Label>
                         <Select value={row.priority ?? 'Medium'} onValueChange={(value) => handlePriorityChange(row._internalId, value)}>
                             <SelectTrigger id={`split-priority-${row._internalId}`}>
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
                         <Label htmlFor={`split-sp-${row._internalId}`}>Story Points</Label>
                         <Input
                             id={`split-sp-${row._internalId}`}
                             type="number"
                             value={row.storyPoints ?? ''}
                             onChange={e => handleInputChange(row._internalId, 'storyPoints', e.target.value)}
                             placeholder="Est. SP"
                             min="0"
                         />
                     </div>
                 </div>
                  <div className="space-y-1 mb-4">
                     <div className="flex justify-between items-center">
                        <Label htmlFor={`split-desc-${row._internalId}`}>Description</Label>
                        <Button variant="outline" size="xs" onClick={() => handleCopyDescription(row._internalId)} disabled={!originalTask.description} title="Copy original description">
                            <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <Textarea
                          id={`split-desc-${row._internalId}`}
                          value={row.description ?? ''}
                          onChange={e => handleInputChange(row._internalId, 'description', e.target.value)}
                          placeholder="Detailed description..."
                          rows={3}
                      />
                  </div>
                   <div className="space-y-1">
                       <div className="flex justify-between items-center">
                          <Label htmlFor={`split-ac-${row._internalId}`}>Acceptance Criteria</Label>
                           <Button variant="outline" size="xs" onClick={() => handleCopyAC(row._internalId)} disabled={!originalTask.acceptanceCriteria} title="Copy original AC">
                              <Copy className="h-3 w-3" />
                           </Button>
                        </div>
                       <Textarea
                           id={`split-ac-${row._internalId}`}
                           value={row.acceptanceCriteria ?? ''}
                           onChange={e => handleInputChange(row._internalId, 'acceptanceCriteria', e.target.value)}
                           placeholder="Acceptance criteria..."
                           rows={3}
                       />
                   </div>
              </div>
            ))}
            <Button type="button" onClick={handleAddSplitTaskRow} variant="outline" size="sm">
              <PlusCircle className="mr-2 h-4 w-4" /> Add Another Split Task
            </Button>
          </div>
        </ScrollArea>

        <DialogFooter className="mt-4">
          <DialogClose asChild>
            <Button type="button" variant="outline">Cancel</Button>
          </DialogClose>
          <Button type="button" onClick={handleConfirm} disabled={splitTaskRows.length === 0}>
            Confirm Split
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
