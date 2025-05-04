
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react'; // Added useMemo
import type { Task } from '@/types/sprint-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea'; // Added Textarea
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from '@/components/ui/checkbox'; // Import Checkbox
import { Info, Edit, Save, XCircle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { taskPriorities } from '@/types/sprint-data'; // Import priorities
import { cn } from '@/lib/utils';

interface BacklogGroomingTabProps {
  projectId: string;
  projectName: string;
  initialBacklog: Task[]; // Receive initial backlog (all items)
  onSaveBacklog: (backlog: Task[]) => void; // Callback to save changes (saves ALL items, not just groomed)
}

interface EditableBacklogItem extends Task {
  _internalId: string;
  isEditing?: boolean;
}

export default function BacklogGroomingTab({ projectId, projectName, initialBacklog, onSaveBacklog }: BacklogGroomingTabProps) {
  const [allEditableBacklog, setAllEditableBacklog] = useState<EditableBacklogItem[]>([]); // Store ALL items
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const { toast } = useToast();

   // Filtered list for display (only items needing grooming)
   const groomingItems = useMemo(() => allEditableBacklog.filter(item => item.needsGrooming), [allEditableBacklog]);


   // Initialize state when initialBacklog changes
   useEffect(() => {
       setAllEditableBacklog(
           (initialBacklog || []).map((task, index) => ({ // Add null check for initialBacklog
               ...task,
               _internalId: task.id || `groom_${index}_${Date.now()}`,
               storyPoints: task.storyPoints?.toString() ?? '', // Ensure story points are string for input
               needsGrooming: task.needsGrooming ?? false, // Ensure boolean
               readyForSprint: task.readyForSprint ?? false, // Ensure boolean
               isEditing: false,
           }))
       );
       setHasUnsavedChanges(false); // Reset changes on new data load
   }, [initialBacklog]);

   // Track unsaved changes by comparing current state with initial props
   useEffect(() => {
        const cleanBacklog = (tasks: Task[]): Omit<Task, 'id' | 'status'>[] =>
           (tasks || []).map(({ id, status, ...rest }: any) => ({ // Add null check
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

       const originalBacklogString = JSON.stringify(cleanBacklog(initialBacklog || [])); // Add null check
       const currentBacklogString = JSON.stringify(
            cleanBacklog(
                allEditableBacklog // Compare with the FULL current editable state
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

  const handleInputChange = (internalId: string, field: keyof Omit<EditableBacklogItem, '_internalId' | 'id' | 'isEditing' | 'needsGrooming' | 'readyForSprint'>, value: string | number | undefined) => {
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

  const handleSaveAll = () => {
    let hasErrors = false;
    const finalBacklog: Task[] = [];
    const backlogIds = new Set<string>();

    allEditableBacklog.forEach((item, index) => { // Iterate over ALL items
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
        if (backlogId && backlogIds.has(backlogId.toLowerCase())) itemErrors.push(`Row ${index + 1}: Duplicate Backlog ID "${backlogId}"`);
        if (!title) itemErrors.push(`Row ${index + 1}: Title required`);
         if (storyPointsRaw && (isNaN(storyPoints as number) || (storyPoints as number) < 0)) itemErrors.push(`Row ${index + 1}: Invalid Story Points`);

        if (itemErrors.length > 0) {
            toast({ variant: "destructive", title: "Validation Error", description: itemErrors.join(', ') });
            hasErrors = true;
            return; // Stop processing this item
        }

        if (backlogId) backlogIds.add(backlogId.toLowerCase());

        finalBacklog.push({
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
        });
    });

    if (hasErrors) {
        return;
    }

    // Sort before saving
    finalBacklog.sort((a, b) => (taskPriorities.indexOf(a.priority!) - taskPriorities.indexOf(b.priority!)) || (a.backlogId ?? '').localeCompare(b.backlogId ?? ''));

    onSaveBacklog(finalBacklog); // Save the entire updated backlog
    setHasUnsavedChanges(false);
    // Collapse all edit forms after saving
    setAllEditableBacklog(prev => prev.map(item => ({ ...item, isEditing: false })));
    toast({ title: "Success", description: "Backlog grooming changes saved." });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
            <div>
               <CardTitle className="flex items-center gap-2"><Edit className="h-5 w-5 text-primary" /> Backlog Grooming</CardTitle> {/* Updated Icon */}
               <CardDescription>Refine backlog items marked as 'Needs Grooming' for project '{projectName}'. Add details, estimate effort, mark as ready for sprint.</CardDescription>
            </div>
            <Button onClick={handleSaveAll} disabled={!hasUnsavedChanges}>
                <Save className="mr-2 h-4 w-4" /> Save All Changes
            </Button>
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
                         {/* Flags for Grooming/Ready */}
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
                            </div>
                          </div>
                          {/* Add fields for Estimation, Splitting later */}
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
  );
}

