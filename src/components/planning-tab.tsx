
"use client";

import type { ChangeEvent, FormEvent } from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { PlusCircle, Trash2 } from 'lucide-react';
import type { Sprint, SprintPlanning, Task } from '@/types/sprint-data';
import { initialSprintPlanning } from '@/types/sprint-data';
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface PlanningTabProps {
  sprints: Sprint[];
  onSavePlanning: (sprintNumber: number, data: SprintPlanning) => void;
  projectName: string;
}

// Internal state structure for task rows
interface TaskRow extends Task {
  _internalId: string; // For React key management
}

const createEmptyTaskRow = (): TaskRow => ({
  _internalId: `task_${Date.now()}_${Math.random()}`,
  id: '', // Will be assigned based on internal ID or existing ID
  description: '',
  storyPoints: '', // Use string initially for easier input handling
  assignee: '',
  status: 'To Do', // Default status
});

export default function PlanningTab({ sprints, onSavePlanning, projectName }: PlanningTabProps) {
  const [selectedSprintNumber, setSelectedSprintNumber] = useState<number | null>(null);
  const [planningData, setPlanningData] = useState<SprintPlanning>(initialSprintPlanning);
  const [newTasks, setNewTasks] = useState<TaskRow[]>([]);
  const [spilloverTasks, setSpilloverTasks] = useState<TaskRow[]>([]);
  const { toast } = useToast();

  const selectedSprint = sprints.find(s => s.sprintNumber === selectedSprintNumber);

  // Load planning data when a sprint is selected
  useEffect(() => {
    if (selectedSprint) {
      const loadedPlanning = selectedSprint.planning ?? initialSprintPlanning;
      setPlanningData(loadedPlanning);
      setNewTasks(
        (loadedPlanning.newTasks || []).map((task, index) => ({
          ...task,
          storyPoints: task.storyPoints?.toString() ?? '',
          _internalId: task.id || `initial_new_${index}_${Date.now()}`,
        }))
      );
      setSpilloverTasks(
         (loadedPlanning.spilloverTasks || []).map((task, index) => ({
          ...task,
          storyPoints: task.storyPoints?.toString() ?? '',
          _internalId: task.id || `initial_spill_${index}_${Date.now()}`,
        }))
      );
       // Add an empty row if no tasks exist for easier entry
        if ((loadedPlanning.newTasks || []).length === 0) {
            setNewTasks([createEmptyTaskRow()]);
        }
        if ((loadedPlanning.spilloverTasks || []).length === 0) {
            setSpilloverTasks([createEmptyTaskRow()]);
        }

    } else {
      // Reset form if no sprint is selected
      setPlanningData(initialSprintPlanning);
      setNewTasks([createEmptyTaskRow()]);
      setSpilloverTasks([createEmptyTaskRow()]);
    }
  }, [selectedSprint]);

  const handleSprintSelect = (value: string) => {
    const sprintNum = parseInt(value, 10);
    setSelectedSprintNumber(isNaN(sprintNum) ? null : sprintNum);
  };

  const handleInputChange = (field: keyof SprintPlanning, value: string) => {
    setPlanningData(prev => ({ ...prev, [field]: value }));
  };

  // --- Task Row Management ---

  const addTaskRow = (type: 'new' | 'spillover') => {
    if (type === 'new') {
      setNewTasks(prev => [...prev, createEmptyTaskRow()]);
    } else {
      setSpilloverTasks(prev => [...prev, createEmptyTaskRow()]);
    }
  };

  const removeTaskRow = (type: 'new' | 'spillover', internalId: string) => {
    const updater = type === 'new' ? setNewTasks : setSpilloverTasks;
    updater(prevRows => {
        const newRows = prevRows.filter(row => row._internalId !== internalId);
        // Keep at least one empty row if all are removed
        return newRows.length > 0 ? newRows : [createEmptyTaskRow()];
    });
  };

  const handleTaskInputChange = (
    type: 'new' | 'spillover',
    internalId: string,
    field: keyof Omit<Task, 'id'>,
    value: string | number
  ) => {
    const updater = type === 'new' ? setNewTasks : setSpilloverTasks;
    updater(rows =>
      rows.map(row =>
        row._internalId === internalId ? { ...row, [field]: value } : row
      )
    );
  };

  // --- Save Handler ---

  const handleSave = () => {
    if (selectedSprintNumber === null) {
      toast({ variant: "destructive", title: "Error", description: "Please select a sprint first." });
      return;
    }

    let hasErrors = false;

    const finalizeTasks = (taskRows: TaskRow[]): Task[] => {
        const finalTasks: Task[] = [];
        taskRows.forEach((row) => {
            // Skip completely empty rows silently
            if (!row.description && !row.storyPoints && !row.assignee) {
                return;
            }

            const description = row.description.trim();
            const storyPointsRaw = row.storyPoints?.toString().trim();
            const storyPoints = storyPointsRaw ? parseInt(storyPointsRaw, 10) : undefined;
            const assignee = row.assignee?.trim();
            const status = row.status?.trim();

            if (!description) {
                 toast({ variant: "destructive", title: "Task Error", description: `Task description is required for row starting with "${row.description.substring(0,10)}...".`});
                 hasErrors = true;
                 return;
            }
            if (storyPointsRaw && (isNaN(storyPoints as number) || (storyPoints as number) < 0)) {
                 toast({ variant: "destructive", title: "Task Error", description: `Invalid Story Points for task "${description}". Must be a non-negative number.`});
                 hasErrors = true;
                 return;
            }

            finalTasks.push({
                id: row.id || row._internalId, // Preserve existing ID or use internal one
                description,
                storyPoints: storyPoints,
                assignee: assignee || undefined,
                status: status || 'To Do',
            });
        });
        return finalTasks;
    };

    const finalNewTasks = finalizeTasks(newTasks);
    const finalSpilloverTasks = finalizeTasks(spilloverTasks);

    if (hasErrors) return;

    const finalPlanningData: SprintPlanning = {
        goal: planningData.goal.trim(),
        newTasks: finalNewTasks,
        spilloverTasks: finalSpilloverTasks,
        definitionOfDone: planningData.definitionOfDone.trim(),
        testingStrategy: planningData.testingStrategy.trim(),
    };

    onSavePlanning(selectedSprintNumber, finalPlanningData);
     // Optional: Re-initialize rows from saved data if needed, or keep the form as is
     // setNewTasks(finalNewTasks.map(...));
     // setSpilloverTasks(finalSpilloverTasks.map(...));
  };

   // Helper to render task rows
   const renderTaskTable = (type: 'new' | 'spillover', tasks: TaskRow[]) => (
     <div className="space-y-4">
        {/* Table Header for larger screens */}
        <div className="hidden md:grid grid-cols-[2fr_100px_1fr_1fr_40px] gap-x-3 items-center pb-2 border-b">
            <Label className="text-xs font-medium text-muted-foreground">Description*</Label>
            <Label className="text-xs font-medium text-muted-foreground text-right">Story Pts</Label>
            <Label className="text-xs font-medium text-muted-foreground">Assignee</Label>
            <Label className="text-xs font-medium text-muted-foreground">Status</Label>
            <div /> {/* Placeholder for delete */}
        </div>

        {/* Task Rows */}
        <div className="space-y-4 md:space-y-2">
            {tasks.map((row) => (
            <div key={row._internalId} className="grid grid-cols-2 md:grid-cols-[2fr_100px_1fr_1fr_40px] gap-x-3 gap-y-2 items-start border-b md:border-none pb-4 md:pb-0 last:border-b-0">
                {/* Description */}
                <div className="md:col-span-1 col-span-2">
                    <Label htmlFor={`desc-${type}-${row._internalId}`} className="md:hidden text-xs font-medium">Description*</Label>
                    <Input
                        id={`desc-${type}-${row._internalId}`}
                        value={row.description}
                        onChange={e => handleTaskInputChange(type, row._internalId, 'description', e.target.value)}
                        placeholder="Task description"
                        className="h-9"
                    />
                </div>
                {/* Story Points */}
                <div className="md:col-span-1 col-span-1">
                    <Label htmlFor={`sp-${type}-${row._internalId}`} className="md:hidden text-xs font-medium">Story Pts</Label>
                    <Input
                        id={`sp-${type}-${row._internalId}`}
                        type="number"
                        value={row.storyPoints}
                        onChange={e => handleTaskInputChange(type, row._internalId, 'storyPoints', e.target.value)}
                        placeholder="Pts"
                        className="h-9 text-right"
                        min="0"
                    />
                </div>
                {/* Assignee */}
                 <div className="md:col-span-1 col-span-1">
                    <Label htmlFor={`assignee-${type}-${row._internalId}`} className="md:hidden text-xs font-medium">Assignee</Label>
                    <Input
                        id={`assignee-${type}-${row._internalId}`}
                        value={row.assignee}
                        onChange={e => handleTaskInputChange(type, row._internalId, 'assignee', e.target.value)}
                        placeholder="Developer"
                        className="h-9"
                    />
                </div>
                {/* Status */}
                <div className="md:col-span-1 col-span-1">
                    <Label htmlFor={`status-${type}-${row._internalId}`} className="md:hidden text-xs font-medium">Status</Label>
                     <Select
                       value={row.status}
                       onValueChange={(value) => handleTaskInputChange(type, row._internalId, 'status', value)}
                     >
                        <SelectTrigger id={`status-${type}-${row._internalId}`} className="h-9">
                          <SelectValue placeholder="Select Status" />
                        </SelectTrigger>
                        <SelectContent>
                           <SelectItem value="To Do">To Do</SelectItem>
                           <SelectItem value="In Progress">In Progress</SelectItem>
                           <SelectItem value="Done">Done</SelectItem>
                           <SelectItem value="Blocked">Blocked</SelectItem>
                        </SelectContent>
                     </Select>
                </div>
                {/* Delete Button */}
                <div className="flex items-center justify-end md:col-span-1 col-span-2 md:self-center md:mt-0 mt-1">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeTaskRow(type, row._internalId)}
                        className="h-9 w-9 text-muted-foreground hover:text-destructive"
                        aria-label={`Remove ${type} task row`}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>
            ))}
        </div>
        <Button type="button" onClick={() => addTaskRow(type)} variant="outline" size="sm" className="mt-4">
            <PlusCircle className="mr-2 h-4 w-4" />
            Add {type === 'new' ? 'New' : 'Spillover'} Task
        </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
             <div>
                <CardTitle>Sprint Planning: {projectName}</CardTitle>
                <CardDescription>Define goals, tasks, DoD, and testing strategy for a sprint.</CardDescription>
             </div>
            <div className="flex items-center gap-4 w-full sm:w-auto">
                <Select
                    value={selectedSprintNumber?.toString() ?? ""}
                    onValueChange={handleSprintSelect}
                    disabled={sprints.length === 0}
                    >
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Select Sprint" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                        <SelectLabel>Sprints</SelectLabel>
                        {sprints.sort((a,b) => a.sprintNumber - b.sprintNumber).map(sprint => (
                            <SelectItem key={sprint.sprintNumber} value={sprint.sprintNumber.toString()}>
                            Sprint {sprint.sprintNumber} ({sprint.startDate})
                            </SelectItem>
                        ))}
                        {sprints.length === 0 && <SelectItem value="no-sprints" disabled>No sprints found</SelectItem>}
                        </SelectGroup>
                    </SelectContent>
                </Select>
                <Button onClick={handleSave} disabled={selectedSprintNumber === null}>Save Planning</Button>
            </div>
          </div>
        </CardHeader>

        {selectedSprintNumber !== null && selectedSprint ? (
          <CardContent className="space-y-6">
            {/* Sprint Goal */}
            <div className="space-y-2">
              <Label htmlFor="sprint-goal" className="text-base font-semibold">Sprint Goal</Label>
              <Textarea
                id="sprint-goal"
                placeholder="Define the primary objective for this sprint..."
                value={planningData.goal}
                onChange={(e) => handleInputChange('goal', e.target.value)}
                rows={3}
              />
            </div>

             {/* New Tasks Table */}
             <Card>
                 <CardHeader>
                     <CardTitle>New Tasks for Sprint</CardTitle>
                 </CardHeader>
                 <CardContent>
                     {renderTaskTable('new', newTasks)}
                 </CardContent>
                 <CardFooter>
                    <p className="text-xs text-muted-foreground">* Description required.</p>
                </CardFooter>
             </Card>

              {/* Spillover Tasks Table */}
             <Card>
                 <CardHeader>
                     <CardTitle>Spillover Tasks from Previous Sprint</CardTitle>
                 </CardHeader>
                 <CardContent>
                     {renderTaskTable('spillover', spilloverTasks)}
                 </CardContent>
                 <CardFooter>
                    <p className="text-xs text-muted-foreground">* Description required.</p>
                </CardFooter>
             </Card>

            {/* Definition of Done */}
            <div className="space-y-2">
              <Label htmlFor="definition-of-done" className="text-base font-semibold">Definition of Done (DoD)</Label>
              <Textarea
                id="definition-of-done"
                placeholder="Specify the criteria that must be met for a task to be considered 'Done'..."
                value={planningData.definitionOfDone}
                onChange={(e) => handleInputChange('definitionOfDone', e.target.value)}
                rows={4}
              />
            </div>

            {/* Testing Strategy */}
            <div className="space-y-2">
              <Label htmlFor="testing-strategy" className="text-base font-semibold">Testing Strategy</Label>
              <Textarea
                id="testing-strategy"
                placeholder="Outline the approach for testing during this sprint (e.g., unit tests, integration tests, manual QA)..."
                value={planningData.testingStrategy}
                onChange={(e) => handleInputChange('testingStrategy', e.target.value)}
                rows={4}
              />
            </div>

          </CardContent>
        ) : (
          <CardContent>
            <p className="text-muted-foreground text-center py-8">
              {sprints.length > 0 ? 'Select a sprint from the dropdown above to view or edit its planning details.' : 'Create sprints in the \'Entry\' tab first.'}
            </p>
          </CardContent>
        )}
          <CardFooter className="border-t pt-4 flex justify-end">
             <Button onClick={handleSave} disabled={selectedSprintNumber === null}>Save Planning</Button>
          </CardFooter>
      </Card>
    </div>
  );
}