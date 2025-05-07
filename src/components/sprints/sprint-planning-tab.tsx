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
import { PlusCircle, Trash2, PlayCircle, Edit, Circle, CalendarIcon as CalendarIconLucide, XCircle, GanttChartSquare, Info, PackagePlus, CheckCircle, Undo, View, User, Users, CheckSquare } from 'lucide-react'; // Added CheckSquare
import type { Sprint, SprintPlanning, Task, Member, SprintStatus, HolidayCalendar, Team } from '@/types/sprint-data'; // Added HolidayCalendar, Team
import { initialSprintPlanning, taskStatuses, predefinedRoles, taskPriorities } from '@/types/sprint-data'; // Added taskPriorities
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { addDays, format, parseISO, isValid, differenceInDays, getDay } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import SprintTimelineChart from '@/components/charts/sprint-timeline-chart';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog"; // Added Dialog components
import { Checkbox } from '@/components/ui/checkbox'; // Added Checkbox
import { ScrollArea } from '@/components/ui/scroll-area'; // Added ScrollArea
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"; // Updated import

const DURATION_OPTIONS = ["1 Week", "2 Weeks", "3 Weeks", "4 Weeks"];

// Helper to calculate working days and end date
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

// Helper function to parse estimated time string (e.g., "2d", "1w 3d") into days
const parseEstimatedTimeToDays = (timeString: string | undefined | null): number | null => {
  if (!timeString) return null;
  timeString = timeString.trim().toLowerCase();
  let totalDays = 0;

  const parts = timeString.match(/(\d+w)?\s*(\d+d)?/);
  if (!parts || (parts[1] === undefined && parts[2] === undefined)) {
      // Try parsing as just days if no 'w' or 'd' found
      const simpleDays = parseInt(timeString, 10);
      if (!isNaN(simpleDays) && simpleDays >= 0) {
          return simpleDays;
      }
      return null;
  }

  const weekPart = parts[1];
  const dayPart = parts[2];

  if (weekPart) {
    const weeks = parseInt(weekPart.replace('w', ''), 10);
    if (!isNaN(weeks)) {
      totalDays += weeks * 5; // Assuming 5 working days per week
    }
  }

  if (dayPart) {
    const days = parseInt(dayPart.replace('d', ''), 10);
    if (!isNaN(days)) {
      totalDays += days;
    }
  }

  // Handle case where only a number is entered (treat as days)
  if (totalDays === 0 && /^\d+$/.test(timeString)) {
       const simpleDays = parseInt(timeString, 10);
       if (!isNaN(simpleDays) && simpleDays >= 0) {
            return simpleDays;
       }
  }

  return totalDays >= 0 ? totalDays : null; // Allow 0 days
};


interface SprintPlanningTabProps {
  projectId: string; // Added projectId
  sprints: Sprint[];
  onSavePlanning: (sprintNumber: number, data: SprintPlanning, newStatus?: SprintStatus) => void;
  onCreateAndPlanSprint: (sprintDetails: Omit<Sprint, 'details' | 'planning' | 'status' | 'committedPoints' | 'completedPoints'>, planningData: SprintPlanning) => void;
  projectName: string;
  members: Member[];
  holidayCalendars: HolidayCalendar[]; // Add holiday calendars prop
  teams: Team[]; // Add teams prop
  backlog: Task[]; // Add backlog prop
  onRevertTask: (sprintNumber: number, taskId: string, taskBacklogId: string | null) => void; // Add revert callback
  onCompleteSprint: (sprintNumber: number) => void; // Add complete callback
}

interface TaskRow extends Task {
  _internalId: string;
  startDateObj?: Date | null;
}

interface NewSprintFormState {
    sprintNumber: string;
    startDate: Date | null;
    duration: string;
}

const createEmptyTaskRow = (): TaskRow => ({
  _internalId: `task_${Date.now()}_${Math.random()}`,
  id: '',
  ticketNumber: '', // Changed from description
  backlogId: '', // Initialize backlogId
  storyPoints: '',
  devEstimatedTime: '', // Renamed
  qaEstimatedTime: '2d', // Default QA time
  bufferTime: '1d', // Default buffer time
  assignee: '',
  reviewer: '', // Added reviewer
  status: 'To Do',
  startDate: null,
  startDateObj: null,
  completedDate: null, // Initialize completedDate
  // Ensure other fields possibly used by TaskRow are initialized
  title: '',
  description: '',
  acceptanceCriteria: '',
  priority: 'Medium',
  dependsOn: [],
  taskType: 'New Feature',
  createdDate: '',
  initiator: '',
  needsGrooming: false,
  readyForSprint: false,
  movedToSprint: null,
  historyStatus: null,
  splitFromId: null,
  mergeEventId: null,
});


export default function SprintPlanningTab({ projectId, sprints, onSavePlanning, onCreateAndPlanSprint, projectName, members, holidayCalendars, teams, backlog, onRevertTask, onCompleteSprint }: SprintPlanningTabProps) {
  const [selectedSprintNumber, setSelectedSprintNumber] = useState<number | null>(null);
  const [planningData, setPlanningData] = useState<SprintPlanning>(initialSprintPlanning);
  const [newTasks, setNewTasks] = useState<TaskRow[]>([]);
  const [spilloverTasks, setSpilloverTasks] = useState<TaskRow[]>([]);
  const [isCreatingNewSprint, setIsCreatingNewSprint] = useState(false);
  const [newSprintForm, setNewSprintForm] = useState<NewSprintFormState>({ sprintNumber: '', startDate: null, duration: '' });
  const [isBacklogDialogOpen, setIsBacklogDialogOpen] = useState(false); // State for backlog dialog
  const [selectedBacklogIds, setSelectedBacklogIds] = useState<Set<string>>(new Set()); // State for selected backlog item IDs
  const [timelineViewMode, setTimelineViewMode] = useState<'task' | 'assignee'>('task'); // State for timeline view
  const [isCompleteTaskDialogOpen, setIsCompleteTaskDialogOpen] = useState(false);
  const [completingTaskInfo, setCompletingTaskInfo] = useState<{ task: TaskRow | null; taskType: 'new' | 'spillover' | null }>({ task: null, taskType: null });
  const [selectedCompletedDate, setSelectedCompletedDate] = useState<Date | undefined>(new Date());
  const { toast } = useToast();

  // Filter out completed sprints for selection
  const availableSprints = useMemo(() => {
      return sprints.filter(s => s.status !== 'Completed').sort((a, b) => a.sprintNumber - b.sprintNumber);
  }, [sprints]);

  const selectedSprint = useMemo(() => sprints.find(s => s.sprintNumber === selectedSprintNumber), [sprints, selectedSprintNumber]);
  const isSprintCompleted = selectedSprint?.status === 'Completed';
  const isSprintActive = selectedSprint?.status === 'Active';
  const isSprintPlanned = selectedSprint?.status === 'Planned';

  // Determine if the current form should be disabled
  const isFormDisabled = isSprintCompleted; // Can edit active sprint, but completed is read-only

   // Calculate sprint planning limits status
   const sprintLimits = useMemo(() => {
       const numPlanned = sprints.filter(s => s.status === 'Planned').length;
       const numActive = sprints.filter(s => s.status === 'Active').length;
       const canPlanNew = !(numPlanned >= 2 || (numPlanned >= 1 && numActive >= 1));
       const canStartNew = numActive === 0; // Only allow starting if none are active
       return { numPlanned, numActive, canPlanNew, canStartNew };
   }, [sprints]);

  const currentSprintStartDate = useMemo(() => {
     if (isCreatingNewSprint && newSprintForm.startDate) {
         return format(newSprintForm.startDate, 'yyyy-MM-dd');
     }
     return selectedSprint?.startDate;
  }, [isCreatingNewSprint, newSprintForm.startDate, selectedSprint]);

  const currentSprintEndDate = useMemo(() => {
      if (isCreatingNewSprint && newSprintForm.startDate && newSprintForm.duration) {
          return calculateSprintMetrics(format(newSprintForm.startDate, 'yyyy-MM-dd'), newSprintForm.duration).endDate;
      }
      return selectedSprint?.endDate;
  }, [isCreatingNewSprint, newSprintForm.startDate, newSprintForm.duration, selectedSprint]);

   // Prepare tasks for the chart (only those with valid start date and estimates)
   const tasksForChart: Task[] = useMemo(() => {
       const allTaskRows = [...newTasks, ...spilloverTasks];

       return allTaskRows
         .filter(task =>
             task.startDate &&
             (task.devEstimatedTime !== undefined && task.devEstimatedTime !== null) &&
             (task.qaEstimatedTime !== undefined && task.qaEstimatedTime !== null) &&
             (task.bufferTime !== undefined && task.bufferTime !== null) &&
             isValid(parseISO(task.startDate?? '')) &&
             parseEstimatedTimeToDays(task.devEstimatedTime) !== null && 
             parseEstimatedTimeToDays(task.qaEstimatedTime) !== null &&
             parseEstimatedTimeToDays(task.bufferTime) !== null
         )
         .map(task => ({ ...task })); 
   }, [newTasks, spilloverTasks]);


  const nextSprintNumber = useMemo(() => {
    if (sprints.length === 0) return '1';
    const maxNumber = Math.max(...sprints.map(s => s.sprintNumber));
    return (maxNumber + 1).toString();
  }, [sprints]);

  const resetForms = useCallback(() => {
      setPlanningData(initialSprintPlanning);
      setNewTasks([]); 
      setSpilloverTasks([]); 
  }, []);

  const parseDateString = (dateString: string | undefined | null): Date | undefined => {
      if (!dateString) return undefined;
      try {
          const parsed = parseISO(dateString);
          return isValid(parsed) ? parsed : undefined;
      } catch {
          return undefined;
      }
  };

  useEffect(() => {
      if (selectedSprint && !isCreatingNewSprint) {
        const loadedPlanning = selectedSprint.planning ?? initialSprintPlanning;
        setPlanningData(loadedPlanning);

         const mapTaskToRow = (task: Task, index: number, type: 'new' | 'spill'): TaskRow => ({
            ...createEmptyTaskRow(), 
            ...task, 
            ticketNumber: task.ticketNumber ?? '', 
            backlogId: task.backlogId ?? '', 
            storyPoints: task.storyPoints?.toString() ?? '',
            devEstimatedTime: task.devEstimatedTime ?? '', 
            qaEstimatedTime: task.qaEstimatedTime ?? '2d', 
            bufferTime: task.bufferTime ?? '1d', 
            assignee: task.assignee ?? '',
            reviewer: task.reviewer ?? '', 
            status: task.status ?? 'To Do',
            startDate: task.startDate,
            startDateObj: parseDateString(task.startDate),
            completedDate: task.completedDate ?? null,
            _internalId: task.id || `initial_${type}_${index}_${Date.now()}`,
         });

        setNewTasks((loadedPlanning.newTasks || []).map((task, index) => mapTaskToRow(task, index, 'new')));
        setSpilloverTasks((loadedPlanning.spilloverTasks || []).map((task, index) => mapTaskToRow(task, index, 'spill')));

        if ((loadedPlanning.newTasks || []).length === 0) {
            setNewTasks([]);
        }

         if ((loadedPlanning.spilloverTasks || []).length === 0) {
            setSpilloverTasks([]);
         }

      } else if (!isCreatingNewSprint) {
          resetForms();
          if (selectedSprintNumber !== null && sprints.find(s => s.sprintNumber === selectedSprintNumber)?.status === 'Completed') {
            setSelectedSprintNumber(null); 
          }
      }
  }, [selectedSprintNumber, isCreatingNewSprint, resetForms, sprints]); 


  useEffect(() => {
    if (isCreatingNewSprint) {
        setSelectedSprintNumber(null);
        resetForms();
        setNewSprintForm({ sprintNumber: nextSprintNumber, startDate: null, duration: '' });
    } else {
        setNewSprintForm({ sprintNumber: '', startDate: null, duration: '' });
    }
  }, [isCreatingNewSprint, nextSprintNumber, resetForms]);

  const handleSelectExistingSprint = (sprintNumStr: string) => {
      const sprintNum = parseInt(sprintNumStr, 10);
      if (isNaN(sprintNum)) {
          setSelectedSprintNumber(null);
      } else {
          const sprintToSelect = sprints.find(s => s.sprintNumber === sprintNum);
          if (sprintToSelect && sprintToSelect.status !== 'Completed') {
            setIsCreatingNewSprint(false);
            setSelectedSprintNumber(sprintNum);
          } else if (sprintToSelect && sprintToSelect.status === 'Completed') {
            toast({ title: "Sprint Completed", description: "This sprint is completed and cannot be planned."});
            setSelectedSprintNumber(null); // Do not select if completed
          } else {
            setSelectedSprintNumber(null);
          }
      }
  };

  const handlePlanNewSprintClick = () => {
      if (!sprintLimits.canPlanNew) {
          toast({
              variant: "destructive",
              title: "Sprint Limit Reached",
              description: "Cannot plan new sprint. Limit is 2 Planned or 1 Planned + 1 Active.",
          });
          return;
      }
      setIsCreatingNewSprint(true);
  };

  const handleCancelNewSprint = () => {
      setIsCreatingNewSprint(false);
      resetForms();
      setSelectedSprintNumber(null);
  };

  const handleInputChange = (field: keyof Omit<SprintPlanning, 'newTasks' | 'spilloverTasks'>, value: string) => {
      if (isFormDisabled && !isCreatingNewSprint) return; 
      setPlanningData(prev => ({ ...prev, [field]: value }));
  };

  const handleNewSprintFormChange = (field: keyof NewSprintFormState, value: string | Date | undefined) => {
      setNewSprintForm(prev => ({ ...prev, [field]: value }));
  };

  const addTaskRow = (type: 'new' | 'spillover') => {
     if (isFormDisabled && !isCreatingNewSprint) return; 
    if (type === 'spillover') {
        setSpilloverTasks(prev => [...prev, createEmptyTaskRow()]);
    } else {
        console.warn("New tasks should be added from the backlog.");
        toast({ variant: "default", title: "Info", description: "Add new tasks using the 'Add from Backlog' button." });
    }
  };

 const removeTaskRow = (type: 'new' | 'spillover', internalId: string) => {
     if (isFormDisabled && !isCreatingNewSprint) return; 
     const updater = type === 'new' ? setNewTasks : setSpilloverTasks;
     const taskToRemove = (type === 'new' ? newTasks : spilloverTasks).find(row => row._internalId === internalId);

     if (type === 'new' && taskToRemove && taskToRemove.backlogId && selectedSprintNumber) {
          setTimeout(() => {
             onRevertTask(selectedSprintNumber, taskToRemove.id, taskToRemove.backlogId);
             updater(prevRows => prevRows.filter(row => row._internalId !== internalId));
          }, 0);
     } else {
         updater(prevRows => prevRows.filter(row => row._internalId !== internalId));
     }
 };


 const findTeamLead = useCallback((memberName: string | null): string | undefined => {
    if (!memberName) return undefined;

    const member = members.find(m => m.name === memberName);
    if (!member) return undefined;

    const team = teams.find(t => t.members.some(tm => tm.memberId === member.id));
    if (!team || !team.leadMemberId) return undefined;

    const leadMember = members.find(m => m.id === team.leadMemberId);
    return leadMember?.name;
  }, [members, teams]);


  const handleTaskInputChange = (
    type: 'new' | 'spillover',
    internalId: string,
    field: keyof Omit<Task, 'id' | 'completedDate'>, // Exclude completedDate from direct input
    value: string | number | undefined
  ) => {
     if (isFormDisabled && !isCreatingNewSprint) return; 
    const updater = type === 'new' ? setNewTasks : setSpilloverTasks;
    updater(rows =>
      rows.map(row => {
          if (row._internalId === internalId) {
              const updatedRow = { ...row, [field]: value ?? '' };

              if (field === 'assignee' && typeof value === 'string') {
                  const assigneeName = value;
                  const assigneeMember = members.find(m => m.name === assigneeName);
                  if (assigneeMember?.role === 'Software Engineer') {
                      const leadName = findTeamLead(assigneeName);
                      updatedRow.reviewer = leadName ?? ''; 
                  } else {
                      updatedRow.reviewer = '';
                  }
              }
              return updatedRow;
          }
          return row;
      })
    );
  };

  const handleTaskDateChange = (
    type: 'new' | 'spillover',
    internalId: string,
    field: 'startDate', // Only allow direct change for startDate
    date: Date | undefined
  ) => {
      if (isFormDisabled && !isCreatingNewSprint) return; 
      const updater = type === 'new' ? setNewTasks : setSpilloverTasks;
      updater(rows =>
          rows.map(row => {
              if (row._internalId === internalId) {
                  const dateString = date ? format(date, 'yyyy-MM-dd') : null;
                  return { ...row, [field]: dateString, [`${field}Obj`]: date };
              }
              return row;
          })
      );
  };

   const handleOpenBacklogDialog = () => {
     if (isFormDisabled && !isCreatingNewSprint) return; 
     setSelectedBacklogIds(new Set()); 
     setIsBacklogDialogOpen(true);
   };

   const handleBacklogItemToggle = (taskId: string, isChecked: boolean) => {
     setSelectedBacklogIds(prev => {
       const newSelection = new Set(prev);
       if (isChecked) {
         newSelection.add(taskId);
       } else {
         newSelection.delete(taskId);
       }
       return newSelection;
     });
   };

   const handleAddSelectedBacklogItems = () => {
     if (selectedBacklogIds.size === 0) {
       toast({ variant: "default", title: "No items selected", description: "Please select items from the backlog to add." });
       return;
     }

     const itemsToAdd = backlog
       .filter(task => selectedBacklogIds.has(task.id))
       .map((task): TaskRow => ({ 
         ...createEmptyTaskRow(), 
         ...task, 
         _internalId: `backlog_added_${task.id}_${Date.now()}`,
         status: 'To Do', 
         startDate: null, 
         startDateObj: null,
         storyPoints: task.storyPoints?.toString() ?? '', 
         qaEstimatedTime: task.qaEstimatedTime ?? '2d', 
         bufferTime: task.bufferTime ?? '1d',
         backlogId: task.backlogId ?? '', 
          ticketNumber: task.ticketNumber ?? task.backlogId ?? '', 
          title: task.title ?? '',
          description: task.description ?? '',
          acceptanceCriteria: task.acceptanceCriteria ?? '',
          priority: task.priority ?? 'Medium',
          dependsOn: task.dependsOn ?? [],
          taskType: task.taskType ?? 'New Feature',
          createdDate: task.createdDate ?? '',
          initiator: task.initiator ?? '',
          needsGrooming: task.needsGrooming ?? false,
          readyForSprint: task.readyForSprint ?? false,
       }));

     setNewTasks(prev => {
       const filteredPrev = prev.filter(p => p.ticketNumber?.trim() || p.storyPoints?.toString().trim());
       return [...filteredPrev, ...itemsToAdd];
     });

     toast({ title: "Items Added", description: `${itemsToAdd.length} backlog item(s) added to the sprint plan.` });
     setIsBacklogDialogOpen(false); 
   };


  const finalizeTasks = (taskRows: TaskRow[], taskType: 'new' | 'spillover'): { tasks: Task[], errors: string[] } => {
      const finalTasks: Task[] = [];
      const errors: string[] = [];
      taskRows.forEach((row, index) => {
          const taskPrefix = `${taskType === 'new' ? 'New' : 'Spillover'} Task (Row ${index + 1})`;
          if (
              !row.ticketNumber?.trim() &&
              !row.storyPoints?.toString().trim() &&
              !row.devEstimatedTime?.trim() &&
              !row.startDate
          ) {
              if (taskRows.length === 1 && !row.ticketNumber?.trim() && !row.storyPoints?.toString().trim()) return;
              return;
          }

          const ticketNumber = row.ticketNumber?.trim();
          const storyPointsRaw = row.storyPoints?.toString().trim();
          const storyPoints = storyPointsRaw ? parseInt(storyPointsRaw, 10) : undefined; // Changed null to undefined
          const devEstimatedTime = row.devEstimatedTime?.trim() || null; // Changed undefined to null
          const qaEstimatedTime = row.qaEstimatedTime?.trim() || '2d'; 
          const bufferTime = row.bufferTime?.trim() || '1d'; 
          const assignee = row.assignee?.trim() || ''; // Changed undefined to empty string
          const reviewer = row.reviewer?.trim() || ''; // Changed undefined to empty string
          const status = row.status?.trim() as Task['status'];
          const startDate = row.startDate;
          const completedDate = row.completedDate; // Include completedDate
          const title = row.title?.trim(); 
          const description = row.description?.trim(); 
          const priority = row.priority; 

          if (!ticketNumber) errors.push(`${taskPrefix}: Ticket # is required.`);
          if (!startDate) errors.push(`${taskPrefix}: Start Date is required for timeline.`);

          if (storyPointsRaw && (isNaN(storyPoints as number) || (storyPoints as number) < 0)) {
               errors.push(`${taskPrefix}: Invalid Story Points. Must be a non-negative number.`);
          }
           if (devEstimatedTime && parseEstimatedTimeToDays(devEstimatedTime) === null) {
                errors.push(`${taskPrefix}: Invalid Dev Est. Time. Use formats like '2d', '1w 3d', '5'.`);
           }
           if (qaEstimatedTime && parseEstimatedTimeToDays(qaEstimatedTime) === null) {
                errors.push(`${taskPrefix}: Invalid QA Est. Time. Use formats like '2d', '1w 3d', '5'.`);
           }
            if (bufferTime && parseEstimatedTimeToDays(bufferTime) === null) {
                errors.push(`${taskPrefix}: Invalid Buffer Time. Use formats like '2d', '1w 3d', '5'.`);
           }
          if (!status || !taskStatuses.includes(status)) {
              errors.push(`${taskPrefix}: Invalid status.`);
          }
           if (startDate && !isValid(parseISO(startDate))) errors.push(`${taskPrefix}: Invalid Start Date format (YYYY-MM-DD).`);
           if (completedDate && !isValid(parseISO(completedDate))) errors.push(`${taskPrefix}: Invalid Completed Date format (YYYY-MM-DD).`);


          finalTasks.push({
              id: row.id || `task_${selectedSprintNumber ?? 'new'}_${taskType === 'new' ? 'n' : 's'}_${Date.now()}_${index}`,
              ticketNumber: ticketNumber || '',
              backlogId: row.backlogId, 
              title: title,
              description: description,
              storyPoints: storyPoints,
              devEstimatedTime: devEstimatedTime,
              qaEstimatedTime: qaEstimatedTime,
              bufferTime: bufferTime,
              assignee: assignee,
              reviewer: reviewer,
              status: status,
              startDate: startDate,
              completedDate: completedDate,
              priority: priority,
              acceptanceCriteria: row.acceptanceCriteria,
              dependsOn: row.dependsOn,
              taskType: row.taskType,
              createdDate: row.createdDate,
              initiator: row.initiator,
              needsGrooming: row.needsGrooming,
              readyForSprint: row.readyForSprint,
              movedToSprint: row.movedToSprint,
              historyStatus: row.historyStatus,
              splitFromId: row.splitFromId,
              mergeEventId: row.mergeEventId,
          });
      });
      return { tasks: finalTasks, errors };
  };

 const handleSaveExistingSprintPlanning = () => {
     if (!selectedSprintNumber) {
        toast({ variant: "destructive", title: "Error", description: "No sprint selected." });
        return;
     }
      if (isFormDisabled) { 
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

     const currentStatus = selectedSprint?.status === 'Active' ? 'Active' : selectedSprint?.status === 'Planned' ? 'Planned' : undefined;

     onSavePlanning(selectedSprintNumber, finalPlanningData, currentStatus);
 };

  const handleCreateAndSaveNewSprint = () => {
      if (!sprintLimits.canPlanNew) {
          toast({
              variant: "destructive",
              title: "Sprint Limit Reached",
              description: "Cannot plan new sprint. Limit is 2 Planned or 1 Planned + 1 Active.",
          });
          return;
      }

      const sprintNumInt = parseInt(newSprintForm.sprintNumber, 10);
      const startDateObj = newSprintForm.startDate;
      const startDateStr = startDateObj ? format(startDateObj, 'yyyy-MM-dd') : '';
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
      setIsCreatingNewSprint(false);
  };


   const handleStartSprint = () => {
       if (!selectedSprint || !isSprintPlanned) {
           toast({ variant: "destructive", title: "Error", description: "Only 'Planned' sprints can be started." });
           return;
       }
       if (!sprintLimits.canStartNew) {
           toast({ variant: "destructive", title: "Active Sprint Limit", description: `Only one sprint can be active at a time. Sprint ${sprints.find(s => s.status === 'Active')?.sprintNumber} is already active.` });
           return;
       }

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

       onSavePlanning(selectedSprint.sprintNumber, finalPlanningData, 'Active');
   };

   const handleCompleteSprintClick = () => {
      if (!selectedSprintNumber || !isSprintActive) return;
      onCompleteSprint(selectedSprintNumber);
       setSelectedSprintNumber(null);
       resetForms();
   };

  // Handler for opening the "Complete Task" dialog
  const handleOpenCompleteTaskDialog = (task: TaskRow, taskType: 'new' | 'spillover') => {
    setCompletingTaskInfo({ task, taskType });
    setSelectedCompletedDate(task.completedDate ? parseDateString(task.completedDate) : new Date());
    setIsCompleteTaskDialogOpen(true);
  };

  // Handler for confirming task completion
  const handleConfirmCompleteTask = () => {
    const { task, taskType } = completingTaskInfo;
    if (!task || !taskType || !selectedCompletedDate) return;

    const updater = taskType === 'new' ? setNewTasks : setSpilloverTasks;
    updater(prevRows =>
      prevRows.map(row =>
        row._internalId === task._internalId
          ? { ...row, status: 'Done', completedDate: format(selectedCompletedDate, 'yyyy-MM-dd') }
          : row
      )
    );
    setIsCompleteTaskDialogOpen(false);
    toast({ title: "Task Completed", description: `Task '${task.ticketNumber}' marked as Done.` });
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


  const renderDatePicker = (
    type: 'new' | 'spillover',
    row: TaskRow,
    field: 'startDate',
    disabled: boolean
  ) => {
    const dateValue = row.startDateObj;

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant={"outline"}
                    className={cn(
                        "w-full justify-start text-left font-normal h-9 text-xs px-2",
                        !dateValue && "text-muted-foreground"
                    )}
                    disabled={disabled}
                >
                    <CalendarIconLucide className="mr-1 h-3 w-3" />
                    {dateValue ? format(dateValue, "MM/dd") : <span>Pick</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
                <Calendar
                    mode="single"
                    selected={dateValue}
                    onSelect={(date) => handleTaskDateChange(type, row._internalId, field, date)}
                    initialFocus
                />
            </PopoverContent>
        </Popover>
    );
};


   const renderTaskTable = (type: 'new' | 'spillover', taskRows: TaskRow[], disabled: boolean) => (
      <div className="overflow-x-auto"> 
         <div className="min-w-[1350px] space-y-4"> {/* Increased min-width for actions */}
            <div className="hidden md:grid grid-cols-[100px_100px_70px_100px_100px_100px_150px_150px_120px_100px_80px_40px] gap-x-2 items-center pb-2 border-b"> {/* Added Actions Header */}
                <Label className="text-xs font-medium text-muted-foreground">Ticket #*</Label>
                <Label className="text-xs font-medium text-muted-foreground">Backlog ID</Label> 
                <Label className="text-xs font-medium text-muted-foreground text-right">Story Pts</Label>
                <Label className="text-xs font-medium text-muted-foreground text-right">Dev Est</Label>
                <Label className="text-xs font-medium text-muted-foreground text-right">QA Est</Label>
                <Label className="text-xs font-medium text-muted-foreground text-right">Buffer</Label>
                <Label className="text-xs font-medium text-muted-foreground">Assignee</Label>
                <Label className="text-xs font-medium text-muted-foreground">Reviewer</Label>
                <Label className="text-xs font-medium text-muted-foreground">Status</Label>
                <Label className="text-xs font-medium text-muted-foreground text-center">Start Date*</Label>
                <Label className="text-xs font-medium text-muted-foreground text-center">Actions</Label> {/* New Header */}
                <div />
            </div>
            <div className="space-y-4 md:space-y-2">
                {taskRows.map((row) => (
                <div key={row._internalId} className="grid grid-cols-2 md:grid-cols-[100px_100px_70px_100px_100px_100px_150px_150px_120px_100px_80px_40px] gap-x-2 gap-y-2 items-start border-b md:border-none pb-4 md:pb-0 last:border-b-0"> 
                     <div className="md:col-span-1 col-span-1"> 
                        <Label htmlFor={`ticket-${type}-${row._internalId}`} className="md:hidden text-xs font-medium">Ticket #*</Label>
                        <Input
                            id={`ticket-${type}-${row._internalId}`}
                            value={row.ticketNumber ?? ''} 
                            onChange={e => handleTaskInputChange(type, row._internalId, 'ticketNumber', e.target.value)}
                            placeholder="e.g., 12345"
                            className="h-9 w-full" 
                            disabled={disabled}
                            required
                        />
                    </div>
                     <div className="md:col-span-1 col-span-1"> 
                        <Label htmlFor={`backlogid-${type}-${row._internalId}`} className="md:hidden text-xs font-medium">Backlog ID</Label>
                        <Input
                            id={`backlogid-${type}-${row._internalId}`}
                            value={row.backlogId ?? ''} 
                            readOnly
                            className="h-9 w-full bg-muted/50 cursor-default"
                            title={row.backlogId} 
                        />
                    </div>
                    <div className="md:col-span-1 col-span-1">
                        <Label htmlFor={`sp-${type}-${row._internalId}`} className="md:hidden text-xs font-medium">Story Pts</Label>
                        <Input
                            id={`sp-${type}-${row._internalId}`}
                            type="number"
                            value={row.storyPoints ?? ''} 
                            onChange={e => handleTaskInputChange(type, row._internalId, 'storyPoints', e.target.value)}
                            placeholder="Pts"
                            className="h-9 text-right w-full"
                            min="0"
                             disabled={disabled}
                        />
                    </div>
                     <div className="md:col-span-1 col-span-1">
                        <Label htmlFor={`devEstTime-${type}-${row._internalId}`} className="md:hidden text-xs font-medium">Dev Est</Label>
                        <Input
                            id={`devEstTime-${type}-${row._internalId}`}
                            value={row.devEstimatedTime ?? ''} 
                            onChange={e => handleTaskInputChange(type, row._internalId, 'devEstimatedTime', e.target.value)}
                            placeholder="e.g., 2d"
                            className="h-9 text-right w-full"
                            disabled={disabled}
                        />
                    </div>
                     <div className="md:col-span-1 col-span-1">
                        <Label htmlFor={`qaEstTime-${type}-${row._internalId}`} className="md:hidden text-xs font-medium">QA Est</Label>
                        <Input
                            id={`qaEstTime-${type}-${row._internalId}`}
                            value={row.qaEstimatedTime ?? ''} 
                            onChange={e => handleTaskInputChange(type, row._internalId, 'qaEstimatedTime', e.target.value)}
                            placeholder="e.g., 2d"
                            className="h-9 text-right w-full"
                            disabled={disabled}
                        />
                    </div>
                      <div className="md:col-span-1 col-span-1">
                        <Label htmlFor={`bufferTime-${type}-${row._internalId}`} className="md:hidden text-xs font-medium">Buffer</Label>
                        <Input
                            id={`bufferTime-${type}-${row._internalId}`}
                            value={row.bufferTime ?? ''} 
                            onChange={e => handleTaskInputChange(type, row._internalId, 'bufferTime', e.target.value)}
                            placeholder="e.g., 1d"
                            className="h-9 text-right w-full"
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
                            <SelectTrigger id={`assignee-${type}-${row._internalId}`} className="h-9 w-full">
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
                       <Label htmlFor={`reviewer-${type}-${row._internalId}`} className="md:hidden text-xs font-medium">Reviewer</Label>
                        <Select
                            value={row.reviewer ?? ''} 
                            onValueChange={(value) => handleTaskInputChange(type, row._internalId, 'reviewer', value === 'unassigned' ? undefined : value)}
                            disabled={disabled || members.length === 0}
                        >
                           <SelectTrigger id={`reviewer-${type}-${row._internalId}`} className="h-9 w-full">
                             <SelectValue placeholder="Select Reviewer" />
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
                           value={row.status ?? 'To Do'} 
                           onValueChange={(value) => handleTaskInputChange(type, row._internalId, 'status', value)}
                            disabled={disabled}
                         >
                            <SelectTrigger id={`status-${type}-${row._internalId}`} className="h-9 w-full">
                              <SelectValue placeholder="Select Status" />
                            </SelectTrigger>
                            <SelectContent>
                               {taskStatuses.map(statusOption => (
                                 <SelectItem key={statusOption} value={statusOption}>{statusOption}</SelectItem>
                               ))}
                            </SelectContent>
                         </Select>
                    </div>
                     <div className="md:col-span-1 col-span-1">
                        <Label htmlFor={`startDate-${type}-${row._internalId}`} className="md:hidden text-xs font-medium">Start Date*</Label>
                        {renderDatePicker(type, row, 'startDate', disabled)}
                     </div>
                      {/* Actions cell for Complete Task */}
                      <div className="md:col-span-1 col-span-1 flex items-center justify-center">
                         <Button
                             type="button"
                             variant="ghost"
                             size="icon"
                             onClick={() => handleOpenCompleteTaskDialog(row, type)}
                             className="h-9 w-9 text-green-600 hover:text-green-700"
                             aria-label="Complete Task"
                             title="Mark Task as Complete"
                             disabled={disabled || row.status === 'Done'}
                         >
                             <CheckSquare className="h-4 w-4" />
                         </Button>
                     </div>
                    <div className="flex items-center justify-end md:col-span-1 col-span-2 md:self-center md:mt-0 mt-1">
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeTaskRow(type, row._internalId)}
                            className="h-9 w-9 text-muted-foreground hover:text-destructive"
                            aria-label={`Remove ${type} task row`}
                             disabled={disabled || (type === 'new' && !!row.backlogId)} 
                             title={type === 'new' && !!row.backlogId ? "Revert task to backlog instead" : `Remove ${type} task row`}
                        >
                            {type === 'new' && !!row.backlogId ? <Undo className="h-4 w-4 text-blue-500" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                    </div>
                </div>
                ))}
                 {!disabled && (
                     <div className="flex gap-2 mt-4">
                         {type === 'spillover' && (
                            <Button
                                type="button"
                                onClick={() => addTaskRow(type)}
                                variant="outline"
                                size="sm"
                            >
                                <PlusCircle className="mr-2 h-4 w-4" /> Add Spillover Task
                            </Button>
                         )}
                         {type === 'new' && (
                             <Dialog open={isBacklogDialogOpen} onOpenChange={setIsBacklogDialogOpen}>
                                 <DialogTrigger asChild>
                                     <Button
                                         type="button"
                                         variant="secondary"
                                         size="sm"
                                         disabled={disabled || backlog.length === 0}
                                     >
                                         <PackagePlus className="mr-2 h-4 w-4" /> Add from Backlog
                                     </Button>
                                 </DialogTrigger>
                                  <DialogContent className="sm:max-w-[600px]">
                                     <DialogHeader>
                                         <DialogTitle>Add Tasks from Backlog</DialogTitle>
                                         <DialogDescription>
                                             Select items from the project backlog to add to this sprint plan. They will be added with 'To Do' status.
                                         </DialogDescription>
                                     </DialogHeader>
                                     <ScrollArea className="h-72 w-full rounded-md border p-4">
                                         {backlog.length > 0 ? (
                                             backlog
                                                 .sort((a, b) => (taskPriorities.indexOf(a.priority || 'Medium') - taskPriorities.indexOf(b.priority || 'Medium')) || (a.ticketNumber ?? '').localeCompare(b.ticketNumber ?? ''))
                                                 .map(task => (
                                                     <div key={task.id} className="flex items-center space-x-2 py-2 border-b last:border-b-0">
                                                         <Checkbox
                                                             id={`backlog-${task.id}`}
                                                             checked={selectedBacklogIds.has(task.id)}
                                                             onCheckedChange={(checked) => handleBacklogItemToggle(task.id, !!checked)}
                                                         />
                                                         <Label htmlFor={`backlog-${task.id}`} className="flex-1 cursor-pointer">
                                                              <span className="font-medium">{task.backlogId}</span> {task.title && `- ${task.title}`}
                                                              <span className="text-xs text-muted-foreground ml-2">({task.priority ?? 'Medium'})</span>
                                                         </Label>
                                                     </div>
                                                 ))
                                         ) : (
                                             <p className="text-center text-muted-foreground italic">No items currently in the backlog.</p>
                                         )}
                                     </ScrollArea>
                                     <DialogFooter>
                                          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                                         <Button onClick={handleAddSelectedBacklogItems} disabled={selectedBacklogIds.size === 0}>
                                             Add Selected ({selectedBacklogIds.size})
                                         </Button>
                                     </DialogFooter>
                                  </DialogContent>
                              </Dialog>
                         )}
                     </div>
                 )}
            </div>

        </div>
    </div>
  );

  const renderPlanningForm = (disabled: boolean) => (
     <>
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

         <Card>
             <CardHeader>
                 <CardTitle>New Tasks (from Backlog)</CardTitle>
                 <CardDescription>Tasks pulled from the backlog for this sprint.</CardDescription>
             </CardHeader>
             <CardContent>
                 {renderTaskTable('new', newTasks, disabled)}
             </CardContent>
             <CardFooter>
                <p className="text-xs text-muted-foreground">* Required field: Ticket #, Start Date. Other fields optional but recommended for planning/timeline.</p>
            </CardFooter>
         </Card>

         <Card>
             <CardHeader>
                 <CardTitle>Spillover Tasks (Optional)</CardTitle>
                 <CardDescription>Tasks carried over from the previous sprint.</CardDescription>
             </CardHeader>
             <CardContent>
                 {renderTaskTable('spillover', spilloverTasks, disabled)}
             </CardContent>
              <CardFooter>
                <p className="text-xs text-muted-foreground">* Required field: Ticket #, Start Date.</p>
            </CardFooter>
         </Card>

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

        <Card>
           <CardHeader>
               <div className="flex justify-between items-center">
                 <CardTitle className="flex items-center gap-2"><GanttChartSquare className="h-5 w-5 text-muted-foreground" /> Sprint Timeline</CardTitle>
                 <div className="flex items-center gap-2">
                    <Button variant={timelineViewMode === 'task' ? "secondary" : "ghost"} size="icon" onClick={() => setTimelineViewMode('task')} title="View by Task">
                       <GanttChartSquare className="h-4 w-4" />
                    </Button>
                    <Button variant={timelineViewMode === 'assignee' ? "secondary" : "ghost"} size="icon" onClick={() => setTimelineViewMode('assignee')} title="View by Assignee">
                       <Users className="h-4 w-4" />
                    </Button>
                 </div>
               </div>
               <CardDescription>Visualization of planned tasks based on estimates. Add start dates and estimates to see tasks here.</CardDescription>
           </CardHeader>
           <CardContent className="overflow-x-auto"> 
                {tasksForChart.length > 0 ? (
                    <SprintTimelineChart
                       tasks={tasksForChart}
                       sprintStartDate={currentSprintStartDate}
                       sprintEndDate={currentSprintEndDate}
                       members={members}
                       holidayCalendars={holidayCalendars} 
                       viewMode={timelineViewMode} 
                    />
                ) : (
                    <div className="flex items-center justify-center text-muted-foreground h-full p-4 text-center min-h-[200px]"> 
                        <Info className="mr-2 h-5 w-5" />
                        Add tasks with Start Date and Estimates (Dev, QA, Buffer) to visualize the timeline.
                    </div>
                )}
           </CardContent>
       </Card>
     </>
  );


  return (
    <div className="space-y-6">
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle>Plan New Sprint</CardTitle>
                    {!isCreatingNewSprint && (
                        <Button
                           variant="outline"
                           size="sm"
                           onClick={handlePlanNewSprintClick}
                           disabled={!sprintLimits.canPlanNew} 
                           title={!sprintLimits.canPlanNew ? "Sprint limit reached (Max 2 Planned or 1 Planned + 1 Active)" : "Plan a New Sprint"}
                         >
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
                                           <CalendarIconLucide className="mr-2 h-4 w-4" />
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

                     {renderPlanningForm(false)}

                </CardContent>
            )}
             {isCreatingNewSprint && (
                 <CardFooter className="border-t pt-4 flex justify-end">
                    <Button onClick={handleCreateAndSaveNewSprint}>Create and Save Sprint Plan</Button>
                </CardFooter>
            )}
        </Card>


      {!isCreatingNewSprint && (
          <Card>
            <CardHeader>
              <CardTitle>View & Plan Existing Sprints: {projectName}</CardTitle>
               <CardDescription>Select a sprint below to view or edit its plan. Completed sprints are read-only. Use the 'Start Sprint' button for 'Planned' sprints.</CardDescription>
            </CardHeader>
            <CardContent>
                 {availableSprints.length === 0 && !isCreatingNewSprint ? (
                    <p className="text-muted-foreground text-center py-8">No Planned or Active sprints found. Plan a new sprint above.</p>
                 ) : (
                     <div className="mb-6 max-w-xs"> 
                          <Label htmlFor="select-sprint">Select Sprint</Label>
                          <Select
                              value={selectedSprintNumber?.toString() ?? ''}
                              onValueChange={(value) => handleSelectExistingSprint(value)}
                           >
                               <SelectTrigger id="select-sprint">
                                   <SelectValue placeholder="Select a sprint to plan..." />
                               </SelectTrigger>
                               <SelectContent>
                                    {availableSprints.map(sprint => (
                                        <SelectItem key={sprint.sprintNumber} value={sprint.sprintNumber.toString()}>
                                             Sprint {sprint.sprintNumber} ({sprint.status})
                                        </SelectItem>
                                    ))}
                               </SelectContent>
                           </Select>
                     </div>
                 )}
             </CardContent>


             {selectedSprint && ( 
                <>
                    <CardContent className="space-y-6 border-t pt-6 mt-6">
                       <h3 className="text-xl font-semibold">Planning Details for Sprint {selectedSprintNumber}</h3>
                       {renderPlanningForm(isFormDisabled)}
                    </CardContent>
                    <CardFooter className="border-t pt-4 flex justify-end gap-2">
                         {isSprintPlanned && (
                             <Button
                                 onClick={handleStartSprint}
                                 variant="secondary"
                                 size="sm"
                                 className="bg-green-600 hover:bg-green-700 text-white"
                                 disabled={!sprintLimits.canStartNew} 
                                 title={!sprintLimits.canStartNew ? "Another sprint is already active" : "Start Sprint"}
                             >
                                 <PlayCircle className="mr-2 h-4 w-4" /> Start Sprint
                             </Button>
                         )}
                         {isSprintActive && (
                              <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                      <Button variant="outline" size="sm" className="border-blue-600 text-blue-600 hover:bg-blue-50">
                                          <CheckCircle className="mr-2 h-4 w-4" /> Mark as Complete
                                      </Button>
                                   </AlertDialogTrigger>
                                   <AlertDialogContent>
                                      <AlertDialogHeader>
                                         <AlertDialogTitle>Complete Sprint {selectedSprintNumber}?</AlertDialogTitle>
                                         <AlertDialogDescription>
                                            This action will mark the sprint as 'Completed'. Completed points will be calculated based on tasks marked 'Done'. This cannot be easily undone.
                                         </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                         <AlertDialogCancel>Cancel</AlertDialogCancel>
                                         <AlertDialogAction onClick={handleCompleteSprintClick} >
                                             Complete Sprint
                                         </AlertDialogAction>
                                      </AlertDialogFooter>
                                   </AlertDialogContent>
                              </AlertDialog>
                         )}
                         <Button onClick={handleSaveExistingSprintPlanning} disabled={isFormDisabled}>
                             Save Planning
                         </Button>
                     </CardFooter>
                 </>
             )}
          </Card>
        )}

      {/* Complete Task Dialog */}
      <AlertDialog open={isCompleteTaskDialogOpen} onOpenChange={setIsCompleteTaskDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete Task: {completingTaskInfo.task?.ticketNumber}</AlertDialogTitle>
            <AlertDialogDescription>
              Select the date this task was completed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="completed-date">Completion Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal h-9",
                    !selectedCompletedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIconLucide className="mr-2 h-4 w-4" />
                  {selectedCompletedDate ? format(selectedCompletedDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={selectedCompletedDate}
                  onSelect={setSelectedCompletedDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCompletingTaskInfo({ task: null, taskType: null })}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCompleteTask} disabled={!selectedCompletedDate}>Confirm Completion</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
