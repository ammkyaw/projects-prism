
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
import { PlusCircle, Trash2, PlayCircle, Edit, Circle, CalendarIcon as CalendarIconLucide, XCircle, GanttChartSquare, Info, PackagePlus } from 'lucide-react'; // Renamed CalendarIcon, Added PackagePlus
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
const parseEstimatedTimeToDays = (timeString: string | undefined): number | null => {
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

// Helper function to calculate end date skipping weekends
const calculateEndDateSkippingWeekends = (startDate: Date, workingDays: number): Date => {
   let currentDate = startDate;
   let workingDaysCounted = 0;

   // If 0 working days, the end date is the start date itself (or the next working day if start is weekend)
   if (workingDays <= 0) {
       while (getDay(currentDate) === 0 || getDay(currentDate) === 6) {
           currentDate = addDays(currentDate, 1);
       }
       return currentDate;
   }

   // Adjust start date if it falls on a weekend BEFORE starting the count
   while (getDay(currentDate) === 0 || getDay(currentDate) === 6) {
     currentDate = addDays(currentDate, 1);
   }

   // Loop until the required number of working days are counted
   // Need to count the start day itself if it's a working day
   while (workingDaysCounted < workingDays) {
        if (getDay(currentDate) !== 0 && getDay(currentDate) !== 6) {
            workingDaysCounted++;
        }

        // Only advance the date if we haven't reached the target number of working days yet
        if (workingDaysCounted < workingDays) {
             currentDate = addDays(currentDate, 1);
             // Skip subsequent weekends while advancing
             while (getDay(currentDate) === 0 || getDay(currentDate) === 6) {
                 currentDate = addDays(currentDate, 1);
             }
        }
   }

  return currentDate;
};


interface SprintPlanningTabProps {
  sprints: Sprint[];
  onSavePlanning: (sprintNumber: number, data: SprintPlanning, newStatus?: SprintStatus) => void;
  onCreateAndPlanSprint: (sprintDetails: Omit<Sprint, 'details' | 'planning' | 'status' | 'committedPoints' | 'completedPoints'>, planningData: SprintPlanning) => void;
  projectName: string;
  members: Member[];
  holidayCalendars: HolidayCalendar[]; // Add holiday calendars prop
  teams: Team[]; // Add teams prop
  backlog: Task[]; // Add backlog prop
}

interface TaskRow extends Task {
  _internalId: string;
  startDateObj?: Date | undefined;
}

interface NewSprintFormState {
    sprintNumber: string;
    startDate: Date | undefined;
    duration: string;
}

const createEmptyTaskRow = (): TaskRow => ({
  _internalId: `task_${Date.now()}_${Math.random()}`,
  id: '',
  ticketNumber: '', // Changed from description
  storyPoints: '',
  devEstimatedTime: '', // Renamed
  qaEstimatedTime: '2d', // Default QA time
  bufferTime: '1d', // Default buffer time
  assignee: '',
  reviewer: '', // Added reviewer
  status: 'To Do',
  startDate: undefined,
  startDateObj: undefined,
});


export default function SprintPlanningTab({ sprints, onSavePlanning, onCreateAndPlanSprint, projectName, members, holidayCalendars, teams, backlog }: SprintPlanningTabProps) {
  const [selectedSprintNumber, setSelectedSprintNumber] = useState<number | null>(null);
  const [planningData, setPlanningData] = useState<SprintPlanning>(initialSprintPlanning);
  const [newTasks, setNewTasks] = useState<TaskRow[]>([]);
  const [spilloverTasks, setSpilloverTasks] = useState<TaskRow[]>([]);
  const [isCreatingNewSprint, setIsCreatingNewSprint] = useState(false);
  const [newSprintForm, setNewSprintForm] = useState<NewSprintFormState>({ sprintNumber: '', startDate: undefined, duration: '' });
  const [isBacklogDialogOpen, setIsBacklogDialogOpen] = useState(false); // State for backlog dialog
  const [selectedBacklogIds, setSelectedBacklogIds] = useState<Set<string>>(new Set()); // State for selected backlog item IDs
  const { toast } = useToast();

  const selectedSprint = useMemo(() => sprints.find(s => s.sprintNumber === selectedSprintNumber), [sprints, selectedSprintNumber]);
  const isSprintCompleted = selectedSprint?.status === 'Completed';
  const isSprintActive = selectedSprint?.status === 'Active';
  const isSprintPlanned = selectedSprint?.status === 'Planned';

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
             task.devEstimatedTime !== undefined && // Check if dev time exists
             task.qaEstimatedTime !== undefined && // Check if qa time exists
             task.bufferTime !== undefined && // Check if buffer time exists
             isValid(parseISO(task.startDate)) &&
             parseEstimatedTimeToDays(task.devEstimatedTime) !== null && // Check if parsable
             parseEstimatedTimeToDays(task.qaEstimatedTime) !== null &&
             parseEstimatedTimeToDays(task.bufferTime) !== null
         )
         .map(task => ({ ...task })); // Map to Task type, ensuring required fields exist due to filter
   }, [newTasks, spilloverTasks]);


  const nextSprintNumber = useMemo(() => {
    if (sprints.length === 0) return '1';
    const maxNumber = Math.max(...sprints.map(s => s.sprintNumber));
    return (maxNumber + 1).toString();
  }, [sprints]);

  const resetForms = useCallback(() => {
      setPlanningData(initialSprintPlanning);
      setNewTasks([]); // Start with empty new tasks (will be added from backlog)
      setSpilloverTasks([]); // Initialize spillover as empty
  }, []);

  const parseDateString = (dateString: string | undefined): Date | undefined => {
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
          ...task,
          ticketNumber: task.ticketNumber ?? '', // Use ticketNumber
          storyPoints: task.storyPoints?.toString() ?? '',
          devEstimatedTime: task.devEstimatedTime ?? '', // Use new field
          qaEstimatedTime: task.qaEstimatedTime ?? '2d', // Default QA time
          bufferTime: task.bufferTime ?? '1d', // Default buffer time
          assignee: task.assignee ?? '',
          reviewer: task.reviewer ?? '', // Add reviewer
          status: task.status ?? 'To Do',
          startDate: task.startDate,
          startDateObj: parseDateString(task.startDate),
          _internalId: task.id || `initial_${type}_${index}_${Date.now()}`,
       });

      setNewTasks((loadedPlanning.newTasks || []).map((task, index) => mapTaskToRow(task, index, 'new')));
      setSpilloverTasks((loadedPlanning.spilloverTasks || []).map((task, index) => mapTaskToRow(task, index, 'spill')));

      // Ensure newTasks is empty if no tasks were loaded (no initial empty row needed)
      if ((loadedPlanning.newTasks || []).length === 0) {
          setNewTasks([]);
      }

      // Ensure spilloverTasks is empty if none loaded
       if ((loadedPlanning.spilloverTasks || []).length === 0) {
          setSpilloverTasks([]);
       }


    } else if (!isCreatingNewSprint) {
        resetForms();
    }
  }, [selectedSprint, isCreatingNewSprint, resetForms]); // Removed isSprintCompleted as dependency, handled inside if


  useEffect(() => {
    if (isCreatingNewSprint) {
        setSelectedSprintNumber(null);
        resetForms();
        setNewSprintForm({ sprintNumber: nextSprintNumber, startDate: undefined, duration: '' });
    } else {
        setNewSprintForm({ sprintNumber: '', startDate: undefined, duration: '' });
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
      resetForms();
      setSelectedSprintNumber(null);
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
    // Only allow adding spillover tasks manually
    if (type === 'spillover') {
        setSpilloverTasks(prev => [...prev, createEmptyTaskRow()]);
    } else {
        // Optionally, show a toast or log if trying to add new task manually
        console.warn("New tasks should be added from the backlog.");
        toast({ variant: "default", title: "Info", description: "Add new tasks using the 'Add from Backlog' button." });
    }
  };

  const removeTaskRow = (type: 'new' | 'spillover', internalId: string) => {
     if (isSprintCompleted && !isCreatingNewSprint) return;
    const updater = type === 'new' ? setNewTasks : setSpilloverTasks;
    updater(prevRows => {
        const newRows = prevRows.filter(row => row._internalId !== internalId);
        // No longer need to keep an empty row for 'new' tasks
        // if (type === 'new' && newRows.length === 0) {
        //     return [createEmptyTaskRow()];
        // }
        return newRows;
    });
  };

 // Function to find the team lead for a given member
 const findTeamLead = useCallback((memberName: string | undefined): string | undefined => {
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
    field: keyof Omit<Task, 'id'>,
    value: string | number | undefined
  ) => {
     if (isSprintCompleted && !isCreatingNewSprint) return;
    const updater = type === 'new' ? setNewTasks : setSpilloverTasks;
    updater(rows =>
      rows.map(row => {
          if (row._internalId === internalId) {
              const updatedRow = { ...row, [field]: value ?? '' };

              // Auto-assign reviewer if assignee changes and is a Software Engineer
              if (field === 'assignee' && typeof value === 'string') {
                  const assigneeName = value;
                  const assigneeMember = members.find(m => m.name === assigneeName);
                  if (assigneeMember?.role === 'Software Engineer') {
                      const leadName = findTeamLead(assigneeName);
                      updatedRow.reviewer = leadName ?? ''; // Assign lead or empty string
                  } else {
                      // If assignee is not SE or unassigned, clear the reviewer
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
    field: 'startDate',
    date: Date | undefined
  ) => {
      if (isSprintCompleted && !isCreatingNewSprint) return;
      const updater = type === 'new' ? setNewTasks : setSpilloverTasks;
      updater(rows =>
          rows.map(row => {
              if (row._internalId === internalId) {
                  const dateString = date ? format(date, 'yyyy-MM-dd') : undefined;
                  return { ...row, [field]: dateString, [`${field}Obj`]: date };
              }
              return row;
          })
      );
  };

   // Handler for opening the backlog selection dialog
   const handleOpenBacklogDialog = () => {
     if (isSprintCompleted && !isCreatingNewSprint) return;
     setSelectedBacklogIds(new Set()); // Reset selection
     setIsBacklogDialogOpen(true);
   };

   // Handler for selecting/deselecting backlog items in the dialog
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

   // Handler for adding selected backlog items to the 'newTasks'
   const handleAddSelectedBacklogItems = () => {
     if (selectedBacklogIds.size === 0) {
       toast({ variant: "default", title: "No items selected", description: "Please select items from the backlog to add." });
       return;
     }

     const itemsToAdd = backlog
       .filter(task => selectedBacklogIds.has(task.id))
       .map((task): TaskRow => ({ // Convert Task to TaskRow
         ...task,
         _internalId: `backlog_added_${task.id}_${Date.now()}`,
         status: 'To Do', // Set status to 'To Do' when moved from backlog
         startDate: undefined, // Clear start date, needs planning
         startDateObj: undefined,
         storyPoints: task.storyPoints?.toString() ?? '', // Ensure string
         qaEstimatedTime: task.qaEstimatedTime ?? '2d', // Apply defaults if missing
         bufferTime: task.bufferTime ?? '1d',
       }));

     setNewTasks(prev => {
       // Filter out any placeholder/empty rows if adding items
       const filteredPrev = prev.filter(p => p.ticketNumber?.trim() || p.storyPoints?.toString().trim());
       return [...filteredPrev, ...itemsToAdd];
     });

     toast({ title: "Items Added", description: `${itemsToAdd.length} backlog item(s) added to the sprint plan.` });
     setIsBacklogDialogOpen(false); // Close dialog
   };


  const finalizeTasks = (taskRows: TaskRow[], taskType: 'new' | 'spillover'): { tasks: Task[], errors: string[] } => {
      const finalTasks: Task[] = [];
      const errors: string[] = [];
      taskRows.forEach((row, index) => {
          const taskPrefix = `${taskType === 'new' ? 'New' : 'Spillover'} Task (Row ${index + 1})`;
          // Skip rows that appear empty (essential fields missing)
          if (
              !row.ticketNumber?.trim() &&
              !row.storyPoints?.toString().trim() &&
              !row.devEstimatedTime?.trim() &&
              !row.startDate
          ) {
              // Allow saving if it's the only row and it's empty, but don't add it to finalTasks
              if (taskRows.length === 1) return;
              // Otherwise, skip this effectively empty row
              return;
          }

          const ticketNumber = row.ticketNumber?.trim();
          const storyPointsRaw = row.storyPoints?.toString().trim();
          const storyPoints = storyPointsRaw ? parseInt(storyPointsRaw, 10) : undefined;
          const devEstimatedTime = row.devEstimatedTime?.trim() || undefined;
          const qaEstimatedTime = row.qaEstimatedTime?.trim() || '2d'; // Ensure default if empty
          const bufferTime = row.bufferTime?.trim() || '1d'; // Ensure default if empty
          const assignee = row.assignee?.trim() || undefined;
          const reviewer = row.reviewer?.trim() || undefined; // Added reviewer
          const status = row.status?.trim() as Task['status'];
          const startDate = row.startDate;
          const title = row.title?.trim(); // Include title
          const description = row.description?.trim(); // Include description
          const priority = row.priority; // Include priority

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

          finalTasks.push({
              id: row.id || `task_${selectedSprintNumber ?? 'new'}_${taskType === 'new' ? 'n' : 's'}_${Date.now()}_${index}`,
              ticketNumber: ticketNumber || '',
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
              priority: priority,
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

     onSavePlanning(selectedSprintNumber, finalPlanningData);
 };

  const handleCreateAndSaveNewSprint = () => {
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
       const alreadyActiveSprint = sprints.find(s => s.status === 'Active');
       if (alreadyActiveSprint) {
           toast({ variant: "destructive", title: "Error", description: `Sprint ${alreadyActiveSprint.sprintNumber} is already active. Complete or replan it first.` });
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
      <div className="overflow-x-auto"> {/* Add horizontal scroll */}
         {/* Adjusted grid layout for narrower Ticket # and other fields */}
         <div className="min-w-[1150px] space-y-4"> {/* Adjusted min-width */}
             {/* Grid column definitions */}
            <div className="hidden md:grid grid-cols-[100px_70px_100px_100px_100px_150px_150px_120px_100px_40px] gap-x-2 items-center pb-2 border-b"> {/* Reduced Ticket # width */}
                <Label className="text-xs font-medium text-muted-foreground">Ticket #*</Label>
                <Label className="text-xs font-medium text-muted-foreground text-right">Story Pts</Label>
                <Label className="text-xs font-medium text-muted-foreground text-right">Dev Est</Label>
                <Label className="text-xs font-medium text-muted-foreground text-right">QA Est</Label>
                <Label className="text-xs font-medium text-muted-foreground text-right">Buffer</Label>
                <Label className="text-xs font-medium text-muted-foreground">Assignee</Label>
                <Label className="text-xs font-medium text-muted-foreground">Reviewer</Label>
                <Label className="text-xs font-medium text-muted-foreground">Status</Label>
                <Label className="text-xs font-medium text-muted-foreground text-center">Start Date*</Label>
                <div />
            </div>
            <div className="space-y-4 md:space-y-2">
                {taskRows.map((row) => (
                // Match the grid column definition here
                <div key={row._internalId} className="grid grid-cols-2 md:grid-cols-[100px_70px_100px_100px_100px_150px_150px_120px_100px_40px] gap-x-2 gap-y-2 items-start border-b md:border-none pb-4 md:pb-0 last:border-b-0"> {/* Reduced Ticket # width */}
                     {/* Ticket Number */}
                    <div className="md:col-span-1 col-span-2">
                        <Label htmlFor={`ticket-${type}-${row._internalId}`} className="md:hidden text-xs font-medium">Ticket #*</Label>
                        <Input
                            id={`ticket-${type}-${row._internalId}`}
                            value={row.ticketNumber}
                            onChange={e => handleTaskInputChange(type, row._internalId, 'ticketNumber', e.target.value)}
                            placeholder="e.g., 12345"
                            className="h-9 w-full" // Ensure width is handled by grid
                            disabled={disabled}
                            required
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
                            className="h-9 text-right w-full"
                            min="0"
                             disabled={disabled}
                        />
                    </div>
                     {/* Dev Estimated Time */}
                     <div className="md:col-span-1 col-span-1">
                        <Label htmlFor={`devEstTime-${type}-${row._internalId}`} className="md:hidden text-xs font-medium">Dev Est</Label>
                        <Input
                            id={`devEstTime-${type}-${row._internalId}`}
                            value={row.devEstimatedTime}
                            onChange={e => handleTaskInputChange(type, row._internalId, 'devEstimatedTime', e.target.value)}
                            placeholder="e.g., 2d"
                            className="h-9 text-right w-full"
                            disabled={disabled}
                        />
                    </div>
                     {/* QA Estimated Time */}
                     <div className="md:col-span-1 col-span-1">
                        <Label htmlFor={`qaEstTime-${type}-${row._internalId}`} className="md:hidden text-xs font-medium">QA Est</Label>
                        <Input
                            id={`qaEstTime-${type}-${row._internalId}`}
                            value={row.qaEstimatedTime}
                            onChange={e => handleTaskInputChange(type, row._internalId, 'qaEstimatedTime', e.target.value)}
                            placeholder="e.g., 2d"
                            className="h-9 text-right w-full"
                            disabled={disabled}
                        />
                    </div>
                      {/* Buffer Time */}
                      <div className="md:col-span-1 col-span-1">
                        <Label htmlFor={`bufferTime-${type}-${row._internalId}`} className="md:hidden text-xs font-medium">Buffer</Label>
                        <Input
                            id={`bufferTime-${type}-${row._internalId}`}
                            value={row.bufferTime}
                            onChange={e => handleTaskInputChange(type, row._internalId, 'bufferTime', e.target.value)}
                            placeholder="e.g., 1d"
                            className="h-9 text-right w-full"
                            disabled={disabled}
                        />
                    </div>
                     {/* Assignee */}
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
                    {/* Reviewer */}
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
                     {/* Status */}
                    <div className="md:col-span-1 col-span-1">
                        <Label htmlFor={`status-${type}-${row._internalId}`} className="md:hidden text-xs font-medium">Status</Label>
                         <Select
                           value={row.status}
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
                     {/* Start Date */}
                     <div className="md:col-span-1 col-span-1">
                        <Label htmlFor={`startDate-${type}-${row._internalId}`} className="md:hidden text-xs font-medium">Start Date*</Label>
                        {renderDatePicker(type, row, 'startDate', disabled)}
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
                             disabled={disabled}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
                ))}
                 {/* Conditionally render Add/Backlog buttons based on type */}
                 {!disabled && (
                     <div className="flex gap-2 mt-4">
                         {/* Add Spillover button only for 'spillover' tasks section */}
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
                         {/* Add Backlog button only for 'new' tasks section */}
                         {type === 'new' && (
                             <Dialog open={isBacklogDialogOpen} onOpenChange={setIsBacklogDialogOpen}>
                                 <DialogTrigger asChild>
                                     <Button
                                         type="button"
                                         variant="secondary"
                                         size="sm"
                                         disabled={disabled || backlog.length === 0}
                                         // onClick={handleOpenBacklogDialog} // Moved onClick to trigger
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
                                                 // .filter(t => t.status === 'Backlog' || t.status === 'To Do') // Assuming backlog items don't have status set this way
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
               <CardTitle className="flex items-center gap-2"><GanttChartSquare className="h-5 w-5 text-muted-foreground" /> Sprint Timeline</CardTitle>
               <CardDescription>Visualization of planned tasks based on estimates. Add start dates and estimates to see tasks here.</CardDescription>
           </CardHeader>
           <CardContent className="min-h-[200px]">
                {tasksForChart.length > 0 ? (
                    <SprintTimelineChart
                       tasks={tasksForChart}
                       sprintStartDate={currentSprintStartDate}
                       sprintEndDate={currentSprintEndDate}
                       members={members}
                       holidayCalendars={holidayCalendars} // Pass holiday calendars
                    />
                ) : (
                    <div className="flex items-center justify-center text-muted-foreground h-full p-4 text-center">
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
                 {sprints.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No existing sprints found. Plan a new sprint above.</p>
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
                                          if (selectedSprintNumber !== sprint.sprintNumber) {
                                               handleSelectExistingSprint(sprint.sprintNumber);
                                          }
                                          // Use setTimeout to ensure state update happens before calling start sprint
                                          setTimeout(() => handleStartSprint(), 0);
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


             {selectedSprint && (
                <>
                    <CardContent className="space-y-6 border-t pt-6 mt-6">
                       <h3 className="text-xl font-semibold">Planning Details for Sprint {selectedSprintNumber}</h3>
                       {renderPlanningForm(isSprintCompleted)}
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
