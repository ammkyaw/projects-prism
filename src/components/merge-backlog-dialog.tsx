
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GitMerge, ArrowLeft, Check } from 'lucide-react';
import type { Task } from '@/types/sprint-data';
import { taskPriorities, taskTypes, initialBacklogTask } from '@/types/sprint-data';
import { useToast } from "@/hooks/use-toast";
import { format, isValid, parseISO, getYear } from 'date-fns'; // Import isValid, parseISO, getYear
import { cn } from '@/lib/utils';

interface MergeBacklogDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  availableBacklogItems: Task[]; // All items available for merging
  onConfirmMerge: (taskIdsToMerge: string[], mergedTask: Task) => void;
}

// Helper to generate the next merged backlog ID (reuse logic, ensure '-m' suffix)
const generateNextBacklogId = (allProjectBacklogItems: Task[], baseId?: string, suffix?: string): string => {
    // Merged IDs always get a new base ID + '-m'
   const currentYear = getYear(new Date()).toString().slice(-2);
   const prefix = `BL-${currentYear}`;
   let maxNum = 0;
   allProjectBacklogItems.forEach(item => {
     const id = item.backlogId;
     if (id && id.startsWith(prefix) && !id.includes('-') && !id.includes('m')) {
       const numPart = parseInt(id.substring(prefix.length), 10);
       if (!isNaN(numPart) && numPart > maxNum) {
         maxNum = numPart;
       }
     }
   });
   const nextNum = maxNum + 1;
   const nextNumPadded = nextNum.toString().padStart(4, '0');
   return `${prefix}${nextNumPadded}-m`;
 };

 // Helper function to get the highest priority among selected tasks
 const getHighestPriority = (tasks: Task[]): Task['priority'] => {
   if (!tasks || tasks.length === 0) return 'Medium';
   let highestIndex = taskPriorities.indexOf('Lowest'); // Start with lowest possible
   tasks.forEach(task => {
     const currentIndex = taskPriorities.indexOf(task.priority || 'Medium');
     if (currentIndex < highestIndex) {
       highestIndex = currentIndex;
     }
   });
   return taskPriorities[highestIndex];
 };

export default function MergeBacklogDialog({
  isOpen,
  onOpenChange,
  availableBacklogItems,
  onConfirmMerge,
}: MergeBacklogDialogProps) {
  const [step, setStep] = useState<'select' | 'confirm'>('select');
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [mergedTaskDetails, setMergedTaskDetails] = useState<Partial<Task>>({}); // Store details for the new merged task
  const { toast } = useToast();

  // Reset state when dialog opens or closes
  useEffect(() => {
    if (isOpen) {
      setStep('select');
      setSelectedTaskIds(new Set());
      setMergedTaskDetails({});
    }
  }, [isOpen]);

  const handleTaskToggle = (taskId: string, isChecked: boolean) => {
    setSelectedTaskIds(prev => {
      const newSelection = new Set(prev);
      if (isChecked) {
        newSelection.add(taskId);
      } else {
        newSelection.delete(taskId);
      }
      return newSelection;
    });
  };

  const handleNextStep = () => {
    if (selectedTaskIds.size < 2) {
      toast({ variant: "destructive", title: "Selection Error", description: "Please select at least two backlog items to merge." });
      return;
    }
    // Pre-populate the merged task details
    const selectedTasks = availableBacklogItems.filter(task => selectedTaskIds.has(task.id));
    const titles = selectedTasks.map(t => t.title || `Item ${t.backlogId}`).join(' + ');
    const descriptions = selectedTasks.map(t => t.description || '').filter(Boolean).join('\n\n---\n\n');
    const acceptanceCriteria = selectedTasks.map(t => t.acceptanceCriteria || '').filter(Boolean).join('\n\n---\n\n');

    setMergedTaskDetails({
      title: `Merged: ${titles}`,
      priority: getHighestPriority(selectedTasks), // Default to highest priority among selected
      description: descriptions,
      acceptanceCriteria: acceptanceCriteria,
      taskType: selectedTasks[0]?.taskType || 'New Feature', // Take type from first item or default
      initiator: selectedTasks[0]?.initiator, // Optional: Maybe take initiator from first? Or leave blank?
      dependsOn: [...new Set(selectedTasks.flatMap(t => t.dependsOn || []))], // Combine unique dependencies
      createdDate: format(new Date(), 'yyyy-MM-dd'), // Set created date to now
      storyPoints: undefined, // Requires re-estimation
    });
    setStep('confirm');
  };

  const handleBackStep = () => {
    setStep('select');
  };

  const handleConfirm = () => {
    // Validate required fields for the new merged task
    const { title, priority, taskType, createdDate } = mergedTaskDetails;
    if (!title?.trim()) {
        toast({ variant: "destructive", title: "Validation Error", description: "Merged task Title is required." });
        return;
    }
     if (!priority || !taskPriorities.includes(priority as any)) {
         toast({ variant: "destructive", title: "Validation Error", description: "Invalid Priority selected." });
         return;
     }
      if (!taskType || !taskTypes.includes(taskType as any)) {
          toast({ variant: "destructive", title: "Validation Error", description: "Invalid Task Type selected." });
          return;
      }
       if (!createdDate || !isValid(parseISO(createdDate))) {
            toast({ variant: "destructive", title: "Validation Error", description: "Invalid Created Date." });
            return;
       }


    const finalMergedTask: Task = {
       ...initialBacklogTask, // Start with defaults
       ...mergedTaskDetails, // Apply edited details
       id: '', // Will be set by parent
       backlogId: '', // Will be set by parent using generateNextBacklogId
       ticketNumber: '', // Will be set by parent
       needsGrooming: true, // Merged items always need grooming
       readyForSprint: false,
    };

    onConfirmMerge(Array.from(selectedTaskIds), finalMergedTask);
    onOpenChange(false); // Close dialog
  };

   const handleInputChange = (field: keyof Omit<Task, 'id' | 'backlogId' | 'ticketNumber' | 'historyStatus' | 'movedToSprint' | 'status' | 'startDate'>, value: string | number | string[] | undefined) => {
        setMergedTaskDetails(prev => ({ ...prev, [field]: value ?? '' }));
   };

   const handlePriorityChange = (value: string) => {
        handleInputChange('priority', value as Task['priority']);
   };

   const handleTaskTypeChange = (value: string) => {
        handleInputChange('taskType', value as Task['taskType']);
   };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5 text-primary" /> Merge Backlog Items
          </DialogTitle>
          {step === 'select' && (
             <DialogDescription>
                 Select two or more backlog items to merge into a single new item. Original items will be moved to History.
             </DialogDescription>
           )}
           {step === 'confirm' && (
             <DialogDescription>
                 Review and edit the details for the new merged backlog item. Original items will be marked as 'Merged' in History.
             </DialogDescription>
           )}
        </DialogHeader>

        {/* Step 1: Select Items */}
        {step === 'select' && (
          <>
            <div className="py-4">
              {availableBacklogItems.length === 0 ? (
                 <p className="text-sm text-muted-foreground text-center italic py-4">No backlog items available to merge.</p>
              ) : (
                <ScrollArea className="h-72 w-full rounded-md border p-4">
                  <div className="space-y-2">
                    {availableBacklogItems
                      .sort((a, b) => (taskPriorities.indexOf(a.priority || 'Medium') - taskPriorities.indexOf(b.priority || 'Medium')) || (a.backlogId ?? '').localeCompare(b.backlogId ?? ''))
                      .map(task => (
                      <div key={task.id} className="flex items-center space-x-2 py-2 border-b last:border-b-0">
                        <Checkbox
                          id={`merge-select-${task.id}`}
                          checked={selectedTaskIds.has(task.id)}
                          onCheckedChange={(checked) => handleTaskToggle(task.id, !!checked)}
                          aria-label={`Select ${task.title || task.backlogId} for merging`}
                        />
                        <Label htmlFor={`merge-select-${task.id}`} className="flex-1 cursor-pointer">
                          <span className="font-medium">{task.backlogId}</span> {task.title && `- ${task.title}`}
                          <span className="text-xs text-muted-foreground ml-2">({task.priority ?? 'Medium'})</span>
                        </Label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="button" onClick={handleNextStep} disabled={selectedTaskIds.size < 2}>
                Next ({selectedTaskIds.size} selected)
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step 2: Confirm Merged Item Details */}
        {step === 'confirm' && (
           <>
             <ScrollArea className="max-h-[60vh] w-full rounded-md border p-4 mt-4">
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1 md:col-span-2">
                           <Label htmlFor="merged-title">Title*</Label>
                           <Input
                              id="merged-title"
                              value={mergedTaskDetails.title ?? ''}
                              onChange={e => handleInputChange('title', e.target.value)}
                              placeholder="Title for the merged task"
                           />
                        </div>
                         <div className="space-y-1">
                             <Label htmlFor="merged-priority">Priority*</Label>
                             <Select value={mergedTaskDetails.priority ?? 'Medium'} onValueChange={handlePriorityChange}>
                                 <SelectTrigger id="merged-priority">
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
                             <Label htmlFor="merged-type">Task Type*</Label>
                             <Select value={mergedTaskDetails.taskType ?? 'New Feature'} onValueChange={handleTaskTypeChange}>
                                 <SelectTrigger id="merged-type">
                                     <SelectValue placeholder="Type" />
                                 </SelectTrigger>
                                 <SelectContent>
                                     {taskTypes.map(option => (
                                         <SelectItem key={option} value={option}>{option}</SelectItem>
                                     ))}
                                 </SelectContent>
                             </Select>
                         </div>
                         <div className="space-y-1">
                             <Label htmlFor="merged-sp">Story Points</Label>
                             <Input
                                 id="merged-sp"
                                 type="number"
                                 value={mergedTaskDetails.storyPoints ?? ''}
                                 onChange={e => handleInputChange('storyPoints', e.target.value)}
                                 placeholder="Est. SP"
                                 min="0"
                             />
                         </div>
                     </div>
                      <div className="space-y-1">
                          <Label htmlFor="merged-desc">Description</Label>
                          <Textarea
                              id="merged-desc"
                              value={mergedTaskDetails.description ?? ''}
                              onChange={e => handleInputChange('description', e.target.value)}
                              placeholder="Combined description (edit as needed)..."
                              rows={5}
                          />
                      </div>
                       <div className="space-y-1">
                           <Label htmlFor="merged-ac">Acceptance Criteria</Label>
                           <Textarea
                               id="merged-ac"
                               value={mergedTaskDetails.acceptanceCriteria ?? ''}
                               onChange={e => handleInputChange('acceptanceCriteria', e.target.value)}
                               placeholder="Combined acceptance criteria (edit as needed)..."
                               rows={5}
                           />
                       </div>
                       {/* Could add Initiator, Dependencies selection here if needed */}
                </div>
             </ScrollArea>
              <DialogFooter className="mt-4">
                 <Button type="button" variant="outline" onClick={handleBackStep}>
                     <ArrowLeft className="mr-2 h-4 w-4" /> Back
                 </Button>
                 <Button type="button" onClick={handleConfirm}>
                      <Check className="mr-2 h-4 w-4" /> Confirm Merge
                 </Button>
              </DialogFooter>
           </>
         )}
      </DialogContent>
    </Dialog>
  );
}
