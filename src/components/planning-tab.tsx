
"use client";

import type { ChangeEvent, FormEvent } from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Trash2, PlayCircle, Edit, Circle, CalendarIcon, XCircle, GanttChartSquare, Info } from 'lucide-react'; // Added icons
import type { Sprint, SprintPlanning, Task, Member, SprintStatus } from '@/types/sprint-data';
import { initialSprintPlanning, taskStatuses, predefinedRoles } from '@/types/sprint-data';
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { addDays, format, parseISO, isValid } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

const DURATION_OPTIONS = ["1 Week", "2 Weeks", "3 Weeks", "4 Weeks"];

// Helper to calculate working days and end date (moved inside or imported if needed elsewhere)
const calculateSprintMetrics = (startDateStr: string, duration: string): { totalDays: number, endDate: string } => {
    let totalDays = 0;
    let calendarDaysToAdd = 0;

    switch (duration) {
        case "1 Week": totalDays = 5; calendarDaysToAdd = 6; break;
        case "2 Weeks": totalDays = 10; calendarDaysToAdd = 13; break;
        case "3 Weeks": totalDays = 15; calendarDaysToAdd = 20; break;
        case "4 Weeks": totalDays = 20; calendarDaysToAdd = 27; break;
        default: totalDays = 0; calendarDaysToAdd = -1;
    }

    if (!startDateStr || calendarDaysToAdd < 0 || !isValid(parseISO(startDateStr))) {
        return { totalDays: 0, endDate: 'N/A' };
    }

    try {
        const startDate = parseISO(startDateStr);
        const endDate = addDays(startDate, calendarDaysToAdd);
        return { totalDays, endDate: format(endDate, 'yyyy-MM-dd') };
    } catch (e) {
        console.error("Error calculating end date:", e);
        return { totalDays: 0, endDate: 'N/A' };
    }
};


interface PlanningTabProps {
  sprints: Sprint[];
  onSavePlanning: (sprintNumber: number, data: SprintPlanning, newStatus?: SprintStatus) => void;
  onCreateAndPlanSprint: (sprintDetails: Omit<Sprint, 'details' | 'planning' | 'status' | 'committedPoints' | 'completedPoints'>, planningData: SprintPlanning) => void; // New handler
  projectName: string;
  members: Member[];
}

interface TaskRow extends Task {
  _internalId: string;
}

interface NewSprintFormState {
    sprintNumber: string;
    startDate: Date | undefined;
    duration: string;
}

const createEmptyTaskRow = (): TaskRow => ({
  _internalId: `task_${Date.now()}_${Math.random()}`,
  id: '',
  description: '',
  storyPoints: '',
  assignee: '',
  status: 'To Do',
});

export default function PlanningTab({ sprints, onSavePlanning, onCreateAndPlanSprint, projectName, members }: PlanningTabProps) {
  const [selectedSprintNumber, setSelectedSprintNumber] = useState<number | null>(null);
  const [planningData, setPlanningData] = useState<SprintPlanning>(initialSprintPlanning);
  const [newTasks, setNewTasks] = useState<TaskRow[]>([]);
  const [spilloverTasks, setSpilloverTasks] = useState<TaskRow[]>([]);
  const [isCreatingNewSprint, setIsCreatingNewSprint] = useState(false);
  const [newSprintForm, setNewSprintForm] = useState<NewSprintFormState>({ sprintNumber: '', startDate: undefined, duration: '' });
  const { toast } = useToast();

  const selectedSprint = useMemo(() => sprints.find(s => s.sprintNumber === selectedSprintNumber), [sprints, selectedSprintNumber]);
  const isSprintCompleted = selectedSprint?.status === 'Completed';
  const isSprintActive = selectedSprint?.status === 'Active';
  const isSprintPlanned = selectedSprint?.status === 'Planned';

  const nextSprintNumber = useMemo(() => {
    if (sprints.length === 0) return '1';
    const maxNumber = Math.max(...sprints.map(s => s.sprintNumber));
    return (maxNumber + 1).toString();
  }, [sprints]);

  // Reset forms when switching modes or sprints
  const resetForms = useCallback(() => {
      setPlanningData(initialSprintPlanning);
      setNewTasks([createEmptyTaskRow()]);
      setSpilloverTasks([createEmptyTaskRow()]);
  }, []);

  // Effect to load planning data when an existing sprint is selected
  useEffect(() => {
    if (selectedSprint && !isCreatingNewSprint) {
      const loadedPlanning = selectedSprint.planning ?? initialSprintPlanning;
      setPlanningData(loadedPlanning);
      setNewTasks(
        (loadedPlanning.newTasks || []).map((task, index) => ({
          ...task,
          storyPoints: task.storyPoints?.toString() ?? '',
          assignee: task.assignee ?? '',
          status: task.status ?? 'To Do',
          _internalId: task.id || `initial_new_${index}_${Date.now()}`,
        }))
      );
      setSpilloverTasks(
         (loadedPlanning.spilloverTasks || []).map((task, index) => ({
          ...task,
          storyPoints: task.storyPoints?.toString() ?? '',
          assignee: task.assignee ?? '',
          status: task.status ?? 'To Do',
          _internalId: task.id || `initial_spill_${index}_${Date.now()}`,
        }))
      );
      // Add empty row only if sprint is not completed and no tasks exist
      if (!isSprintCompleted) {
        if ((loadedPlanning.newTasks || []).length === 0) setNewTasks([createEmptyTaskRow()]);
        if ((loadedPlanning.spilloverTasks || []).length === 0) setSpilloverTasks([createEmptyTaskRow()]);
      } else {
        // If completed, ensure no empty rows are displayed
        if ((loadedPlanning.newTasks || []).length === 0) setNewTasks([]);
        if ((loadedPlanning.spilloverTasks || []).length === 0) setSpilloverTasks([]);
      }
    } else {
        resetForms();
    }
  }, [selectedSprint, isCreatingNewSprint, isSprintCompleted, resetForms]);


  // Effect to reset planning form when switching to create mode
  useEffect(() => {
    if (isCreatingNewSprint) {
        setSelectedSprintNumber(null); // Deselect any existing sprint
        resetForms();
        setNewSprintForm({ sprintNumber: nextSprintNumber, startDate: undefined, duration: '' });
    } else {
        setNewSprintForm({ sprintNumber: '', startDate: undefined, duration: '' }); // Clear new sprint form if switching back
    }
  }, [isCreatingNewSprint, nextSprintNumber, resetForms]);

  const handleSelectExistingSprint = (sprintNum: number) => {
      setIsCreatingNewSprint(false);
      setSelectedSprintNumber(sprintNum);
  };

  const handlePlanNewSprintClick = () => {
      setIsCreatingNewSprint(true);
  };

  const handleCancelNewSprint = () => {
      setIsCreatingNewSprint(false);
  };


  const handleInputChange = (field: keyof Omit<SprintPlanning, 'newTasks' | 'spilloverTasks'>, value: string) => {
      if (isSprintCompleted && !isCreatingNewSprint) return;
      setPlanningData(prev => ({ ...prev, [field]: value }));
  };

  const handleNewSprintFormChange = (field: keyof NewSprintFormState, value: string | Date | undefined) => {
      setNewSprintForm(prev => ({ ...prev, [field]: value }));
  };

  const addTaskRow = (type: 'new' | 'spillover') => {
     if (isSprintCompleted && !isCreatingNewSprint) return;
    const updater = type === 'new' ? setNewTasks : setSpilloverTasks;
    updater(prev => [...prev, createEmptyTaskRow()]);
  };

  const removeTaskRow = (type: 'new' | 'spillover', internalId: string) => {
     if (isSprintCompleted && !isCreatingNewSprint) return;
    const updater = type === 'new' ? setNewTasks : setSpilloverTasks;
    updater(prevRows => {
        const newRows = prevRows.filter(row => row._internalId !== internalId);
        return newRows.length > 0 ? newRows : [createEmptyTaskRow()];
    });
  };

  const handleTaskInputChange = (
    type: 'new' | 'spillover',
    internalId: string,
    field: keyof Omit<Task, 'id'>,
    value: string | number | undefined
  ) => {
     if (isSprintCompleted && !isCreatingNewSprint) return;
    const updater = type === 'new' ? setNewTasks : setSpilloverTasks;
    updater(rows =>
      rows.map(row =>
        row._internalId === internalId ? { ...row, [field]: value ?? '' } : row
      )
    );
  };

  const finalizeTasks = (taskRows: TaskRow[], taskType: 'new' | 'spillover'): { tasks: Task[], errors: string[] } => {
      const finalTasks: Task[] = [];
      const errors: string[] = [];
      taskRows.forEach((row, index) => {
          const taskPrefix = `${taskType === 'new' ? 'New' : 'Spillover'} Task (Row ${index + 1})`;
          // Skip completely empty rows silently unless there's only one row
           if (taskRows.length > 1 && !row.description && !row.storyPoints && !row.assignee && row.status === 'To Do') {
              return;
           }
           // If it's the only row and it's empty, also skip it
           if (taskRows.length === 1 && !row.description && !row.storyPoints && !row.assignee && row.status === 'To Do') {
                return;
            }


          const description = row.description?.trim();
          const storyPointsRaw = row.storyPoints?.toString().trim();
          const storyPoints = storyPointsRaw ? parseInt(storyPointsRaw, 10) : undefined;
          const assignee = row.assignee?.trim() || undefined;
          const status = row.status?.trim() as Task['status'];

          if (!description) errors.push(`${taskPrefix}: Description is required.`);
          if (storyPointsRaw && (isNaN(storyPoints as number) || (storyPoints as number) < 0)) {
               errors.push(`${taskPrefix}: Invalid Story Points. Must be a non-negative number.`);
          }
           if (!status || !taskStatuses.includes(status)) {
              errors.push(`${taskPrefix}: Invalid status.`);
           }
          finalTasks.push({
              id: row.id || `task_${selectedSprintNumber ?? 'new'}_${taskType === 'new' ? 'n' : 's'}_${Date.now()}_${index}`,
              description: description || '',
              storyPoints: storyPoints,
              assignee: assignee,
              status: status,
          });
      });
      return { tasks: finalTasks, errors };
  };

 const handleSaveExistingSprintPlanning = () => {
     if (!selectedSprintNumber) {
        toast({ variant: "destructive", title: "Error", description: "No sprint selected." });
        return;
     }
      if (isSprintCompleted) {
         toast({ variant: "destructive", title: "Error", description: "Cannot save planning for a completed sprint." });
         return;
     }

     const { tasks: finalNewTasks, errors: newErrors } = finalizeTasks(newTasks, 'new');
     const { tasks: finalSpilloverTasks, errors: spillErrors } = finalizeTasks(spilloverTasks, 'spillover');
     const allErrors = [...newErrors, ...spillErrors];

     if (allErrors.length > 0) {
         toast({ variant: "destructive", title: "Validation Error", description: allErrors.join("\n") });
         return;
     }

     const finalPlanningData: SprintPlanning = {
         goal: planningData.goal.trim(),
         newTasks: finalNewTasks,
         spilloverTasks: finalSpilloverTasks,
         definitionOfDone: planningData.definitionOfDone.trim(),
         testingStrategy: planningData.testingStrategy.trim(),
     };

     onSavePlanning(selectedSprintNumber, finalPlanningData); // Save only planning, status change is separate
 };

  const handleCreateAndSaveNewSprint = () => {
      const sprintNumInt = parseInt(newSprintForm.sprintNumber, 10);
      const startDateStr = newSprintForm.startDate ? format(newSprintForm.startDate, 'yyyy-MM-dd') : '';
      const duration = newSprintForm.duration;

      let formErrors: string[] = [];
      if (isNaN(sprintNumInt) || sprintNumInt <= 0) formErrors.push("Invalid Sprint Number.");
      if (sprints.some(s => s.sprintNumber === sprintNumInt)) formErrors.push(`Sprint Number ${sprintNumInt} already exists.`);
      if (!startDateStr || !isValid(parseISO(startDateStr))) formErrors.push("Valid Start Date is required.");
      if (!duration || !DURATION_OPTIONS.includes(duration)) formErrors.push("Valid Duration is required.");

      const { tasks: finalNewTasks, errors: newErrors } = finalizeTasks(newTasks, 'new');
      const { tasks: finalSpilloverTasks, errors: spillErrors } = finalizeTasks(spilloverTasks, 'spillover');
      const taskErrors = [...newErrors, ...spillErrors];

      if (formErrors.length > 0 || taskErrors.length > 0) {
          toast({ variant: "destructive", title: "Validation Error", description: [...formErrors, ...taskErrors].join("\n") });
          return;
      }

      const { totalDays, endDate } = calculateSprintMetrics(startDateStr, duration);
      if (totalDays <= 0 || endDate === 'N/A') {
          toast({ variant: "destructive", title: "Error", description: "Could not calculate sprint end date." });
          return;
      }

      const newSprintDetails: Omit<Sprint, 'details' | 'planning' | 'status' | 'committedPoints' | 'completedPoints'> = {
          sprintNumber: sprintNumInt,
          startDate: startDateStr,
          endDate: endDate,
          duration: duration,
          totalDays: totalDays,
      };

      const finalPlanningData: SprintPlanning = {
          goal: planningData.goal.trim(),
          newTasks: finalNewTasks,
          spilloverTasks: finalSpilloverTasks,
          definitionOfDone: planningData.definitionOfDone.trim(),
          testingStrategy: planningData.testingStrategy.trim(),
      };

      onCreateAndPlanSprint(newSprintDetails, finalPlanningData);
      setIsCreatingNewSprint(false); // Switch back to viewing existing sprints
      // Select the newly created sprint? Or leave it unselected? Let's leave unselected for now.
      // setSelectedSprintNumber(sprintNumInt);
  };


   const handleStartSprint = () => {
       if (!selectedSprint || !isSprintPlanned) {
           toast({ variant: "destructive", title: "Error", description: "Only 'Planned' sprints can be started." });
           return;
       }
       const alreadyActiveSprint = sprints.find(s => s.status === 'Active');
       if (alreadyActiveSprint) {
           toast({ variant: "destructive", title: "Error", description: `Sprint ${alreadyActiveSprint.sprintNumber} is already active. Complete or replan it first.` });
           return;
       }

       // Save current planning state *before* changing status
       const { tasks: finalNewTasks, errors: newErrors } = finalizeTasks(newTasks, 'new');
       const { tasks: finalSpilloverTasks, errors: spillErrors } = finalizeTasks(spilloverTasks, 'spillover');
       const allErrors = [...newErrors, ...spillErrors];

       if (allErrors.length > 0) {
           toast({ variant: "destructive", title: "Validation Error Before Starting", description: `Please fix planning errors before starting: ${allErrors.join(" ")}` });
           return;
       }

        const finalPlanningData: SprintPlanning = {
            goal: planningData.goal.trim(),
            newTasks: finalNewTasks,
            spilloverTasks: finalSpilloverTasks,
            definitionOfDone: planningData.definitionOfDone.trim(),
            testingStrategy: planningData.testingStrategy.trim(),
        };


       onSavePlanning(selectedSprint.sprintNumber, finalPlanningData, 'Active'); // Pass new status 'Active'
       // State will update via props, no need to manually set here
   };

   const getStatusBadgeVariant = (status: Sprint['status']): "default" | "secondary" | "outline" | "destructive" | null | undefined => {
        switch (status) {
           case 'Active': return 'default';
           case 'Planned': return 'secondary';
           case 'Completed': return 'outline';
           default: return 'secondary';
        }
     };

      const getStatusColorClass = (status: Sprint['status']): string => {
        switch (status) {
          case 'Active': return 'text-primary';
          case 'Planned': return 'text-muted-foreground';
          case 'Completed': return 'text-green-600';
          default: return 'text-muted-foreground';
        }
      };


   // Helper to render task rows
   const renderTaskTable = (type: 'new' | 'spillover', taskRows: TaskRow[], disabled: boolean) => (
     <div className="space-y-4">
        <div className="hidden md:grid grid-cols-[2fr_100px_1fr_1fr_40px] gap-x-3 items-center pb-2 border-b">
            <Label className="text-xs font-medium text-muted-foreground">Description*</Label>
            <Label className="text-xs font-medium text-muted-foreground text-right">Story Pts</Label>
            <Label className="text-xs font-medium text-muted-foreground">Assignee</Label>
            <Label className="text-xs font-medium text-muted-foreground">Status</Label>
            <div />
        </div>
        <div className="space-y-4 md:space-y-2">
            {taskRows.map((row) => (
            <div key={row._internalId} className="grid grid-cols-2 md:grid-cols-[2fr_100px_1fr_1fr_40px] gap-x-3 gap-y-2 items-start border-b md:border-none pb-4 md:pb-0 last:border-b-0">
                <div className="md:col-span-1 col-span-2">
                    <Label htmlFor={`desc-${type}-${row._internalId}`} className="md:hidden text-xs font-medium">Description*</Label>
                    <Input
                        id={`desc-${type}-${row._internalId}`}
                        value={row.description}
                        onChange={e => handleTaskInputChange(type, row._internalId, 'description', e.target.value)}
                        placeholder="Task description"
                        className="h-9"
                        disabled={disabled}
                    />
                </div>
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
                         disabled={disabled}
                    />
                </div>
                 <div className="md:col-span-1 col-span-1">
                    <Label htmlFor={`assignee-${type}-${row._internalId}`} className="md:hidden text-xs font-medium">Assignee</Label>
                     <Select
                         value={row.assignee ?? ''}
                         onValueChange={(value) => handleTaskInputChange(type, row._internalId, 'assignee', value === 'unassigned' ? undefined : value)}
                         disabled={disabled || members.length === 0}
                     >
                        <SelectTrigger id={`assignee-${type}-${row._internalId}`} className="h-9">
                          <SelectValue placeholder="Select Assignee" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="unassigned" className="text-muted-foreground">-- Unassigned --</SelectItem>
                           {members.map(member => (
                               <SelectItem key={member.id} value={member.name}>{member.name}</SelectItem>
                           ))}
                           {members.length === 0 && <SelectItem value="no-members" disabled>No members in project</SelectItem>}
                        </SelectContent>
                     </Select>
                </div>
                <div className="md:col-span-1 col-span-1">
                    <Label htmlFor={`status-${type}-${row._internalId}`} className="md:hidden text-xs font-medium">Status</Label>
                     <Select
                       value={row.status}
                       onValueChange={(value) => handleTaskInputChange(type, row._internalId, 'status', value)}
                        disabled={disabled}
                     >
                        <SelectTrigger id={`status-${type}-${row._internalId}`} className="h-9">
                          <SelectValue placeholder="Select Status" />
                        </SelectTrigger>
                        <SelectContent>
                           {taskStatuses.map(statusOption => (
                             <SelectItem key={statusOption} value={statusOption}>{statusOption}</SelectItem>
                           ))}
                        </SelectContent>
                     </Select>
                </div>
                <div className="flex items-center justify-end md:col-span-1 col-span-2 md:self-center md:mt-0 mt-1">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeTaskRow(type, row._internalId)}
                        className="h-9 w-9 text-muted-foreground hover:text-destructive"
                        aria-label={`Remove ${type} task row`}
                         disabled={disabled}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>
            ))}
        </div>
         {/* Add button only if not disabled */}
         {!disabled && (
            <Button
              type="button"
              onClick={() => addTaskRow(type)}
              variant="outline"
              size="sm"
              className="mt-4"
             >
                <PlusCircle className="mr-2 h-4 w-4" />
                Add {type === 'new' ? 'New' : 'Spillover'} Task
            </Button>
         )}
    </div>
  );

  const renderPlanningForm = (disabled: boolean) => (
     <>
        {/* Sprint Goal */}
        <div className="space-y-2">
          <Label htmlFor="sprint-goal" className="text-base font-semibold">Sprint Goal</Label>
          <Textarea
            id="sprint-goal"
            placeholder="Define the primary objective for this sprint..."
            value={planningData.goal}
            onChange={(e) => handleInputChange('goal', e.target.value)}
            rows={3}
            disabled={disabled}
          />
        </div>

         {/* New Tasks Table */}
         <Card>
             <CardHeader>
                 <CardTitle>New Tasks</CardTitle>
             </CardHeader>
             <CardContent>
                 {renderTaskTable('new', newTasks, disabled)}
             </CardContent>
             <CardFooter>
                <p className="text-xs text-muted-foreground">* Description required.</p>
            </CardFooter>
         </Card>

          {/* Spillover Tasks Table */}
         <Card>
             <CardHeader>
                 <CardTitle>Spillover Tasks</CardTitle>
             </CardHeader>
             <CardContent>
                 {renderTaskTable('spillover', spilloverTasks, disabled)}
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
             disabled={disabled}
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
             disabled={disabled}
          />
        </div>
     </>
  );


  return (
    <div className="space-y-6">
        {/* Section to Create New Sprint */}
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle>Plan New Sprint</CardTitle>
                    {!isCreatingNewSprint && (
                        <Button variant="outline" size="sm" onClick={handlePlanNewSprintClick}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Plan New Sprint
                        </Button>
                    )}
                     {isCreatingNewSprint && (
                        <Button variant="ghost" size="sm" onClick={handleCancelNewSprint} className="text-destructive hover:text-destructive">
                            <XCircle className="mr-2 h-4 w-4" /> Cancel
                        </Button>
                    )}
                </div>
                 <CardDescription>Define the details for a new upcoming sprint.</CardDescription>
            </CardHeader>
            {isCreatingNewSprint && (
                <CardContent className="space-y-6">
                     {/* New Sprint Basic Details */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div>
                            <Label htmlFor="new-sprint-number">Sprint Number*</Label>
                            <Input
                                id="new-sprint-number"
                                type="number"
                                placeholder={nextSprintNumber}
                                value={newSprintForm.sprintNumber}
                                onChange={e => handleNewSprintFormChange('sprintNumber', e.target.value)}
                                required
                                className="h-9"
                                min="1"
                            />
                         </div>
                         <div>
                              <Label htmlFor="new-sprint-start-date">Start Date*</Label>
                               <Popover>
                                   <PopoverTrigger asChild>
                                       <Button
                                           variant={"outline"}
                                           className={cn(
                                               "w-full justify-start text-left font-normal h-9",
                                               !newSprintForm.startDate && "text-muted-foreground"
                                           )}
                                       >
                                           <CalendarIcon className="mr-2 h-4 w-4" />
                                           {newSprintForm.startDate ? format(newSprintForm.startDate, "PPP") : <span>Pick a date</span>}
                                       </Button>
                                   </PopoverTrigger>
                                   <PopoverContent className="w-auto p-0">
                                       <Calendar
                                           mode="single"
                                           selected={newSprintForm.startDate}
                                           onSelect={(date) => handleNewSprintFormChange('startDate', date)}
                                           initialFocus
                                       />
                                   </PopoverContent>
                               </Popover>
                         </div>
                         <div>
                             <Label htmlFor="new-sprint-duration">Duration*</Label>
                              <Select value={newSprintForm.duration} onValueChange={(value) => handleNewSprintFormChange('duration', value)} required>
                                  <SelectTrigger id="new-sprint-duration" className="h-9 w-full">
                                      <SelectValue placeholder="Select Duration" />
                                  </SelectTrigger>
                                  <SelectContent>
                                      {DURATION_OPTIONS.map(option => (
                                          <SelectItem key={option} value={option}>{option}</SelectItem>
                                      ))}
                                  </SelectContent>
                              </Select>
                         </div>
                     </div>

                     {/* Render Planning Form for New Sprint */}
                     {renderPlanningForm(false)} {/* Planning form is enabled for new sprint */}

                      {/* Placeholder for Gantt Chart for New Sprint */}
                     <Card className="border-dashed border-2">
                          <CardHeader>
                              <CardTitle className="flex items-center gap-2"><GanttChartSquare className="h-5 w-5 text-muted-foreground" /> Sprint Timeline (Preview)</CardTitle>
                              <CardDescription>A timeline visualization will appear here once task dates and dependencies are added.</CardDescription>
                          </CardHeader>
                          <CardContent className="flex items-center justify-center text-muted-foreground min-h-[150px]">
                              <Info className="mr-2 h-5 w-5" />
                              (Gantt/Timeline visualization requires task start/end dates)
                          </CardContent>
                      </Card>

                </CardContent>
            )}
             {isCreatingNewSprint && (
                 <CardFooter className="border-t pt-4 flex justify-end">
                    <Button onClick={handleCreateAndSaveNewSprint}>Create and Save Sprint Plan</Button>
                </CardFooter>
            )}
        </Card>


      {/* Section for Existing Sprints */}
      {!isCreatingNewSprint && (
          <Card>
            <CardHeader>
              <CardTitle>View & Plan Existing Sprints: {projectName}</CardTitle>
               <CardDescription>Select a sprint below to view or edit its plan. Completed sprints are read-only. Use the 'Start Sprint' button for 'Planned' sprints.</CardDescription>
            </CardHeader>
            <CardContent>
                 {sprints.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No existing sprints found. Plan a new sprint above or add past sprints in the 'Entry' tab.</p>
                 ) : (
                    <div className="overflow-x-auto">
                       <Table>
                         <TableHeader>
                           <TableRow>
                             <TableHead className="w-[100px]">Sprint #</TableHead>
                             <TableHead>Start Date</TableHead>
                             <TableHead>End Date</TableHead>
                             <TableHead>Status</TableHead>
                             <TableHead className="w-[80px] text-center">Actions</TableHead>
                           </TableRow>
                         </TableHeader>
                         <TableBody>
                           {sprints.sort((a, b) => a.sprintNumber - b.sprintNumber).map((sprint) => (
                             <TableRow key={sprint.sprintNumber} className={cn(selectedSprintNumber === sprint.sprintNumber && "bg-muted")}>
                               <TableCell className="font-medium">{sprint.sprintNumber}</TableCell>
                               <TableCell>{sprint.startDate}</TableCell>
                               <TableCell>{sprint.endDate}</TableCell>
                               <TableCell>
                                 <Badge variant={getStatusBadgeVariant(sprint.status)} className="capitalize">
                                   <Circle className={cn("mr-1 h-2 w-2 fill-current", getStatusColorClass(sprint.status))} />
                                   {sprint.status}
                                 </Badge>
                               </TableCell>
                               <TableCell className="text-center space-x-1">
                                 <Button
                                   variant="ghost"
                                   size="icon"
                                   onClick={() => handleSelectExistingSprint(sprint.sprintNumber)}
                                   aria-label={`View/Edit Plan for Sprint ${sprint.sprintNumber}`}
                                   title="View/Edit Plan"
                                 >
                                   <Edit className="h-4 w-4" />
                                 </Button>
                                 {sprint.status === 'Planned' && (
                                    <Button
                                       variant="ghost"
                                       size="icon"
                                       onClick={() => {
                                          handleSelectExistingSprint(sprint.sprintNumber); // Select first if not already selected
                                          handleStartSprint();
                                       }}
                                       aria-label={`Start Sprint ${sprint.sprintNumber}`}
                                       title="Start Sprint"
                                       className="text-green-600 hover:text-green-700"
                                    >
                                      <PlayCircle className="h-4 w-4" />
                                    </Button>
                                 )}
                               </TableCell>
                             </TableRow>
                           ))}
                         </TableBody>
                       </Table>
                     </div>
                 )}
             </CardContent>


            {/* Planning Details Area for Selected Sprint */}
             {selectedSprint && (
                <>
                    <CardContent className="space-y-6 border-t pt-6 mt-6">
                       <h3 className="text-xl font-semibold">Planning Details for Sprint {selectedSprintNumber}</h3>
                       {renderPlanningForm(isSprintCompleted)}

                       {/* Placeholder for Gantt Chart for Existing Sprint */}
                       <Card className="border-dashed border-2">
                          <CardHeader>
                              <CardTitle className="flex items-center gap-2"><GanttChartSquare className="h-5 w-5 text-muted-foreground" /> Sprint Timeline (Visualization)</CardTitle>
                              <CardDescription>A timeline visualization of tasks will appear here. Requires task start/end dates and dependency information.</CardDescription>
                          </CardHeader>
                          <CardContent className="flex items-center justify-center text-muted-foreground min-h-[150px]">
                              <Info className="mr-2 h-5 w-5" />
                              (Gantt/Timeline visualization requires task dates/dependencies)
                          </CardContent>
                      </Card>
                    </CardContent>
                    <CardFooter className="border-t pt-4 flex justify-end gap-2">
                         {isSprintPlanned && (
                             <Button onClick={handleStartSprint} variant="secondary" size="sm" className="bg-green-600 hover:bg-green-700 text-white">
                                 <PlayCircle className="mr-2 h-4 w-4" /> Start Sprint
                             </Button>
                         )}
                         <Button onClick={handleSaveExistingSprintPlanning} disabled={isSprintCompleted}>
                             Save Planning
                         </Button>
                     </CardFooter>
                 </>
             )}
          </Card>
        )}

    </div>
  );
}
