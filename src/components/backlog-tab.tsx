
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Trash2, Package, Save, ArrowUpDown } from 'lucide-react';
import type { Task, Member } from '@/types/sprint-data';
import { taskStatuses, taskPriorities, initialBacklogTask } from '@/types/sprint-data';
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface BacklogTabProps {
  projectId: string;
  projectName: string;
  initialBacklog: Task[];
  onSaveBacklog: (backlog: Task[]) => void;
  members: Member[]; // Pass members for assignee dropdown
}

interface BacklogRow extends Task {
  _internalId: string; // For React key management
}

const createEmptyBacklogRow = (): BacklogRow => ({
  ...initialBacklogTask,
  _internalId: `backlog_${Date.now()}_${Math.random()}`,
  id: '', // Will be assigned on save if needed
});

export default function BacklogTab({ projectId, projectName, initialBacklog, onSaveBacklog, members }: BacklogTabProps) {
  const [backlogRows, setBacklogRows] = useState<BacklogRow[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const { toast } = useToast();

  // Initialize or update rows based on initialBacklog prop
  useEffect(() => {
    const mappedBacklog = initialBacklog.map((task, index) => ({
        ...task,
        _internalId: task.id || `initial_backlog_${index}_${Date.now()}`,
        storyPoints: task.storyPoints?.toString() ?? '', // Ensure string for input
        status: task.status ?? 'Backlog', // Default status
        priority: task.priority ?? 'Medium', // Default priority
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
        const cleanBacklog = (tasks: Task[]): Omit<Task, 'id'>[] =>
           tasks.map(({ id, ...rest }) => ({
               ...rest,
               ticketNumber: rest.ticketNumber.trim(),
               title: rest.title?.trim() || '',
               description: rest.description?.trim() || '',
               storyPoints: rest.storyPoints?.toString().trim() || '',
               status: rest.status ?? 'Backlog',
               priority: rest.priority ?? 'Medium',
               assignee: rest.assignee || undefined,
               reviewer: rest.reviewer || undefined,
               devEstimatedTime: rest.devEstimatedTime || undefined,
               qaEstimatedTime: rest.qaEstimatedTime || undefined,
               bufferTime: rest.bufferTime || undefined,
           })).sort((a, b) => a.ticketNumber.localeCompare(b.ticketNumber)); // Sort consistently

       const originalBacklogString = JSON.stringify(cleanBacklog(initialBacklog));
       const currentBacklogString = JSON.stringify(
           cleanBacklog(
               backlogRows.filter(row => row.ticketNumber?.trim() || row.title?.trim() || row.storyPoints) // Filter empty before comparing
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

  const handleInputChange = (internalId: string, field: keyof Omit<Task, 'id'>, value: string | number | undefined) => {
    setBacklogRows(rows =>
      rows.map(row => (row._internalId === internalId ? { ...row, [field]: value ?? '' } : row))
    );
  };

  const handleSelectChange = (internalId: string, field: 'status' | 'priority' | 'assignee' | 'reviewer', value: string) => {
     let finalValue: string | undefined | null = value;
     if (value === 'none' || value === 'unassigned') {
        finalValue = undefined; // Treat 'none' or 'unassigned' as undefined for saving
     }
    handleInputChange(internalId, field, finalValue);
  };

  const handleSave = () => {
    let hasErrors = false;
    const finalBacklog: Task[] = [];
    const ticketNumbers = new Set<string>(); // To check for duplicate ticket numbers

    backlogRows.forEach((row, index) => {
      // Skip completely empty rows silently
      if (!row.ticketNumber?.trim() && !row.title?.trim() && !row.storyPoints?.toString().trim()) {
        return;
      }

      const ticketNumber = row.ticketNumber.trim();
      const title = row.title?.trim();
      const description = row.description?.trim();
      const storyPointsRaw = row.storyPoints?.toString().trim();
      const storyPoints = storyPointsRaw ? parseInt(storyPointsRaw, 10) : undefined;
      const devEstimatedTime = row.devEstimatedTime?.trim() || undefined;
      const qaEstimatedTime = row.qaEstimatedTime?.trim() || undefined;
      const bufferTime = row.bufferTime?.trim() || undefined;
      const assignee = row.assignee || undefined;
      const reviewer = row.reviewer || undefined;
      const status = row.status ?? 'Backlog';
      const priority = row.priority ?? 'Medium';

      let rowErrors: string[] = [];
      if (!ticketNumber) rowErrors.push("Ticket # required");
      if (ticketNumbers.has(ticketNumber.toLowerCase())) rowErrors.push(`Duplicate Ticket #${ticketNumber}`);
      if (storyPointsRaw && (isNaN(storyPoints as number) || (storyPoints as number) < 0)) rowErrors.push("Invalid Story Points");
      if (status && !taskStatuses.includes(status)) rowErrors.push("Invalid Status");
      if (priority && !taskPriorities.includes(priority)) rowErrors.push("Invalid Priority");
      // Basic format validation for estimates (optional, can enhance)
      // ... (similar validation as in PlanningTab if desired) ...

      if (rowErrors.length > 0) {
        toast({
          variant: "destructive",
          title: `Error in Backlog Row ${index + 1}`,
          description: rowErrors.join(', ')
        });
        hasErrors = true;
        return; // Stop processing this row
      }

       ticketNumbers.add(ticketNumber.toLowerCase()); // Add valid number to set

      finalBacklog.push({
        id: row.id || `backlog_${projectId}_${Date.now()}_${index}`, // Generate ID if new
        ticketNumber,
        title,
        description,
        storyPoints,
        devEstimatedTime,
        qaEstimatedTime,
        bufferTime,
        assignee,
        reviewer,
        status,
        priority,
        // startDate, dependsOn can be added later if needed for backlog planning
      });
    });

    if (hasErrors) {
      return;
    }

    // Sort backlog by priority then ticket number before saving
    finalBacklog.sort((a, b) => (taskPriorities.indexOf(a.priority) - taskPriorities.indexOf(b.priority)) || a.ticketNumber.localeCompare(b.ticketNumber));


    onSaveBacklog(finalBacklog);
    setHasUnsavedChanges(false); // Reset unsaved changes flag after successful save
     // Update state to reflect sorted/cleaned data with potentially new IDs
     setBacklogRows(finalBacklog.map((task, index) => ({
        ...task,
        storyPoints: task.storyPoints?.toString() ?? '',
        _internalId: task.id || `saved_backlog_${index}_${Date.now()}` // Use saved ID or generate new internal ID
     })));
     if (finalBacklog.length === 0) {
        setBacklogRows([createEmptyBacklogRow()]); // Ensure one empty row if saved backlog is empty
     }

  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5 text-primary" /> Project Backlog: {projectName}</CardTitle>
            <CardDescription>Manage tasks that are not yet planned for a specific sprint. Add, edit, prioritize, and estimate backlog items.</CardDescription>
          </div>
          <Button onClick={handleSave} disabled={!hasUnsavedChanges}>
             <Save className="mr-2 h-4 w-4" /> Save Backlog
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Backlog Table Header */}
        {/* Consider making this horizontally scrollable on smaller screens */}
         <div className="overflow-x-auto">
            <div className="min-w-[1000px] space-y-4"> {/* Ensure minimum width */}
                <div className="hidden md:grid grid-cols-[100px_1fr_70px_100px_150px_120px_40px] gap-x-3 items-center pb-2 border-b">
                    <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><ArrowUpDown className="h-3 w-3" /> Ticket #*</Label>
                    <Label className="text-xs font-medium text-muted-foreground">Title</Label>
                    <Label className="text-xs font-medium text-muted-foreground text-right">Story Pts</Label>
                    <Label className="text-xs font-medium text-muted-foreground">Priority</Label>
                    <Label className="text-xs font-medium text-muted-foreground">Assignee</Label>
                    <Label className="text-xs font-medium text-muted-foreground">Status</Label>
                    <div /> {/* Placeholder for delete */}
                </div>

                {/* Backlog Rows */}
                <div className="space-y-4 md:space-y-2">
                {backlogRows.map((row) => (
                    <div key={row._internalId} className="grid grid-cols-2 md:grid-cols-[100px_1fr_70px_100px_150px_120px_40px] gap-x-3 gap-y-2 items-start border-b md:border-none pb-4 md:pb-0 last:border-b-0">
                    {/* Ticket Number */}
                    <div className="md:col-span-1 col-span-1">
                        <Label htmlFor={`backlog-ticket-${row._internalId}`} className="md:hidden text-xs font-medium">Ticket #*</Label>
                        <Input
                            id={`backlog-ticket-${row._internalId}`}
                            value={row.ticketNumber}
                            onChange={e => handleInputChange(row._internalId, 'ticketNumber', e.target.value)}
                            placeholder="TKT-123"
                            className="h-9"
                            required
                        />
                    </div>
                    {/* Title */}
                    <div className="md:col-span-1 col-span-2">
                        <Label htmlFor={`backlog-title-${row._internalId}`} className="md:hidden text-xs font-medium">Title</Label>
                        <Input
                            id={`backlog-title-${row._internalId}`}
                            value={row.title ?? ''}
                            onChange={e => handleInputChange(row._internalId, 'title', e.target.value)}
                            placeholder="Task Title"
                            className="h-9"
                        />
                    </div>
                    {/* Story Points */}
                    <div className="md:col-span-1 col-span-1">
                        <Label htmlFor={`backlog-sp-${row._internalId}`} className="md:hidden text-xs font-medium">Story Pts</Label>
                        <Input
                            id={`backlog-sp-${row._internalId}`}
                            type="number"
                            value={row.storyPoints}
                            onChange={e => handleInputChange(row._internalId, 'storyPoints', e.target.value)}
                            placeholder="Pts"
                            className="h-9 text-right"
                            min="0"
                        />
                    </div>
                     {/* Priority */}
                     <div className="md:col-span-1 col-span-1">
                         <Label htmlFor={`backlog-priority-${row._internalId}`} className="md:hidden text-xs font-medium">Priority</Label>
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
                      {/* Assignee */}
                      <div className="md:col-span-1 col-span-1">
                         <Label htmlFor={`backlog-assignee-${row._internalId}`} className="md:hidden text-xs font-medium">Assignee</Label>
                         <Select
                             value={row.assignee ?? 'unassigned'}
                             onValueChange={(value) => handleSelectChange(row._internalId, 'assignee', value)}
                             disabled={members.length === 0}
                         >
                             <SelectTrigger id={`backlog-assignee-${row._internalId}`} className="h-9">
                                 <SelectValue placeholder="Assignee" />
                             </SelectTrigger>
                             <SelectContent>
                                <SelectItem value="unassigned" className="text-muted-foreground">-- Unassigned --</SelectItem>
                                {members.map(member => (
                                    <SelectItem key={member.id} value={member.name}>{member.name}</SelectItem>
                                ))}
                                {members.length === 0 && <SelectItem value="no-members" disabled>No members</SelectItem>}
                             </SelectContent>
                         </Select>
                      </div>
                     {/* Status */}
                     <div className="md:col-span-1 col-span-1">
                        <Label htmlFor={`backlog-status-${row._internalId}`} className="md:hidden text-xs font-medium">Status</Label>
                         <Select value={row.status ?? 'Backlog'} onValueChange={(value) => handleSelectChange(row._internalId, 'status', value)}>
                             <SelectTrigger id={`backlog-status-${row._internalId}`} className="h-9">
                                 <SelectValue placeholder="Status" />
                             </SelectTrigger>
                             <SelectContent>
                                 {/* Allow only Backlog or To Do for new items? */}
                                 {taskStatuses.filter(s => s === 'Backlog' || s === 'To Do').map(option => (
                                     <SelectItem key={option} value={option}>{option}</SelectItem>
                                 ))}
                                  {/* Optionally show other statuses if editing an existing backlog item */}
                                 {row.id && !['Backlog', 'To Do'].includes(row.status ?? '') && (
                                     <SelectItem value={row.status ?? ''}>{row.status}</SelectItem>
                                 )}
                             </SelectContent>
                         </Select>
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
                    {/* Collapsible Description/Estimates Row - FUTURE */}
                    {/*
                    <div className="col-span-full">
                         <Textarea placeholder="Add description..." rows={2} ... />
                         <div className="grid grid-cols-3 gap-2 mt-2">
                             <Input placeholder="Dev Est (e.g., 2d)" ... />
                             <Input placeholder="QA Est (e.g., 1d)" ... />
                             <Input placeholder="Buffer (e.g., 0.5d)" ... />
                         </div>
                    </div>
                    */}
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
  );
}
