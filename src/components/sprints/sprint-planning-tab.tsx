
// src/components/sprints/sprint-planning-tab.tsx
'use client';

import type { ChangeEvent, FormEvent } from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  PlusCircle,
  Trash2,
  PlayCircle,
  Circle,
  CalendarIcon as CalendarIconLucide,
  XCircle,
  GanttChartSquare,
  Info,
  PackagePlus,
  CheckCircle,
  Undo,
  Users,
  CheckSquare,
  AlertTriangle,
  ArrowLeft, // Import ArrowLeft for Back button
} from 'lucide-react';
import type {
  Sprint,
  SprintPlanning,
  Task,
  Member,
  SprintStatus,
  HolidayCalendar,
  Team,
  TaskType,
  SeverityType,
} from '@/types/sprint-data';
import {
  initialSprintPlanning,
  taskPriorities,
  taskStatuses,
  taskTypes,
  severities,
} from '@/types/sprint-data';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  addDays,
  format,
  parseISO,
  isValid,
  differenceInDays,
  getDay,
} from 'date-fns';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import SprintTimelineChart from '@/components/charts/sprint-timeline-chart';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter as BacklogDialogFooter, // Renamed to avoid conflict with CardFooter
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
// Make finalizeTasks a local helper
const parseEstimatedTimeToDaysLocal = (
  timeString: string | undefined | null
): number | null => {
  if (!timeString) return null;
  timeString = timeString.trim().toLowerCase();
  let totalDays = 0;
  const parts = timeString.match(/(\d+w)?\s*(\d+d)?/);
  if (!parts || (parts[1] === undefined && parts[2] === undefined)) {
    const simpleDays = parseInt(timeString, 10);
    if (!isNaN(simpleDays) && simpleDays >= 0) return simpleDays;
    return null;
  }
  const weekPart = parts[1];
  const dayPart = parts[2];
  if (weekPart) {
    const weeks = parseInt(weekPart.replace('w', ''), 10);
    if (!isNaN(weeks)) totalDays += weeks * 5;
  }
  if (dayPart) {
    const days = parseInt(dayPart.replace('d', ''), 10);
    if (!isNaN(days)) totalDays += days;
  }
  if (totalDays === 0 && /^\d+$/.test(timeString)) {
    const simpleDays = parseInt(timeString, 10);
    if (!isNaN(simpleDays) && simpleDays >= 0) return simpleDays;
  }
  return totalDays >= 0
    ? totalDays
    : timeString === '0' || timeString === '0d'
      ? 0
      : null;
};

const finalizeTasksLocal = (
  taskRows: Task[],
  taskType: 'new' | 'spillover',
  sprintNumber: number | string | null
): { tasks: Task[]; errors: string[] } => {
  const finalTasks: Task[] = [];
  const errors: string[] = [];
  taskRows.forEach((row, index) => {
    const taskPrefix = `${taskType === 'new' ? 'New' : 'Spillover'} Task (Row ${index + 1})`;
    if (
      !row.ticketNumber?.trim() &&
      !row.storyPoints?.toString().trim() &&
      !row.devEstimatedTime?.trim() &&
      !row.reviewEstimatedTime?.trim() &&
      !row.qaEstimatedTime?.trim() &&
      !row.bufferTime?.trim() &&
      !row.startDate
    ) {
      if (
        taskRows.length === 1 &&
        !row.ticketNumber?.trim() &&
        !row.storyPoints?.toString().trim()
      )
        return;
      return;
    }
    const ticketNumber = row.ticketNumber?.trim();
    const storyPointsRaw = row.storyPoints?.toString().trim();
    let storyPoints: number | null = null;
    if (storyPointsRaw) {
      const parsed = parseInt(storyPointsRaw, 10);
      if (!isNaN(parsed) && parsed >= 0) storyPoints = parsed;
      else
        errors.push(
          `${taskPrefix}: Invalid Story Points. Must be a non-negative number.`
        );
    }
    const devEstimatedTime = row.devEstimatedTime?.trim() || null;
    const reviewEstimatedTime = row.reviewEstimatedTime?.trim() || '1d'; // Default to 1d
    const qaEstimatedTime = row.qaEstimatedTime?.trim() || '2d';
    const bufferTime = row.bufferTime?.trim() || '1d';
    const assignee = row.assignee?.trim() || '';
    const reviewer = row.reviewer?.trim() || '';
    const status = row.status?.trim() as Task['status'];
    const startDate = row.startDate;
    const completedDate = row.completedDate;
    const title = row.title?.trim();
    const description = row.description?.trim();
    const priority = row.priority;
    const currentTaskType = row.taskType ?? 'New Feature';
    const currentSeverity = row.severity ?? null;

    if (!ticketNumber) errors.push(`${taskPrefix}: Ticket # is required.`);
    if (!startDate)
      errors.push(`${taskPrefix}: Start Date is required for timeline.`);
    if (!currentTaskType || !taskTypes.includes(currentTaskType as any))
      errors.push(`${taskPrefix}: Invalid Task Type.`);
    if (
      currentTaskType === 'Bug' &&
      (!currentSeverity || !severities.includes(currentSeverity))
    )
      errors.push(
        `${taskPrefix}: Severity is required and must be valid for Bugs.`
      );
    if (
      devEstimatedTime &&
      parseEstimatedTimeToDaysLocal(devEstimatedTime) === null
    )
      errors.push(
        `${taskPrefix}: Invalid Dev Est. Time. Use formats like '2d', '1w 3d', '5'.`
      );
    if (
      reviewEstimatedTime &&
      parseEstimatedTimeToDaysLocal(reviewEstimatedTime) === null
    )
      errors.push(
        `${taskPrefix}: Invalid Review Est. Time. Use formats like '1d', '4h'.`
      );
    if (qaEstimatedTime && parseEstimatedTimeToDaysLocal(qaEstimatedTime) === null)
      errors.push(
        `${taskPrefix}: Invalid QA Est. Time. Use formats like '2d', '1w 3d', '5'.`
      );
    if (bufferTime && parseEstimatedTimeToDaysLocal(bufferTime) === null)
      errors.push(
        `${taskPrefix}: Invalid Buffer Time. Use formats like '2d', '1w 3d', '5'.`
      );
    if (!status || !taskStatuses.includes(status))
      errors.push(`${taskPrefix}: Invalid status.`);
    if (startDate && !isValid(parseISO(startDate)))
      errors.push(`${taskPrefix}: Invalid Start Date format (YYYY-MM-DD).`);
    if (completedDate && !isValid(parseISO(completedDate)))
      errors.push(`${taskPrefix}: Invalid Completed Date format (YYYY-MM-DD).`);

    if (errors.length > 0) {
      const criticalErrorForThisRow = errors.some((e) =>
        e.startsWith(taskPrefix)
      );
      if (criticalErrorForThisRow) return;
    }

    finalTasks.push({
      id:
        row.id ||
        `task_${sprintNumber ?? 'new'}_${taskType === 'new' ? 'n' : 's'}_${Date.now()}_${index}`,
      ticketNumber: ticketNumber || '',
      backlogId: row.backlogId,
      title: title,
      description: description,
      storyPoints: storyPoints,
      devEstimatedTime: devEstimatedTime,
      reviewEstimatedTime: reviewEstimatedTime,
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
      taskType: currentTaskType as TaskType,
      severity: currentTaskType === 'Bug' ? currentSeverity : null,
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

const DURATION_OPTIONS = ['1 Week', '2 Weeks', '3 Weeks', '4 Weeks'];

const calculateSprintMetrics = (
  startDateStr: string,
  duration: string
): { totalDays: number; endDate: string } => {
  let totalDays = 0;
  let calendarDaysToAdd = 0;
  switch (duration) {
    case '1 Week':
      totalDays = 5;
      calendarDaysToAdd = 6;
      break;
    case '2 Weeks':
      totalDays = 10;
      calendarDaysToAdd = 13;
      break;
    case '3 Weeks':
      totalDays = 15;
      calendarDaysToAdd = 20;
      break;
    case '4 Weeks':
      totalDays = 20;
      calendarDaysToAdd = 27;
      break;
    default:
      totalDays = 0;
      calendarDaysToAdd = -1;
  }
  if (
    !startDateStr ||
    calendarDaysToAdd < 0 ||
    !isValid(parseISO(startDateStr))
  ) {
    return { totalDays: 0, endDate: 'N/A' };
  }
  try {
    const startDate = parseISO(startDateStr);
    const endDate = addDays(startDate, calendarDaysToAdd);
    return { totalDays, endDate: format(endDate, 'yyyy-MM-dd') };
  } catch (e) {
    console.error('Error calculating end date:', e);
    return { totalDays: 0, endDate: 'N/A' };
  }
};

interface SprintPlanningTabProps {
  projectId: string;
  sprints: Sprint[];
  initialSelectedSprint?: Sprint | null;
  onSavePlanning: (
    sprintNumber: number,
    data: SprintPlanning,
    newStatus?: SprintStatus
  ) => void;
  onCreateAndPlanSprint: (
    sprintDetails: Omit<
      Sprint,
      'details' | 'planning' | 'status' | 'committedPoints' | 'completedPoints'
    >,
    planningData: SprintPlanning
  ) => void;
  projectName: string;
  members: Member[];
  holidayCalendars: HolidayCalendar[];
  teams: Team[];
  backlog: Task[];
  onRevertTask: (
    sprintNumber: number,
    taskId: string,
    taskBacklogId: string | null
  ) => void;
  onCompleteSprint: (
    sprintNumber: number,
    latestPlanning: SprintPlanning
  ) => void;
  onAddBacklogItems: (
    backlogItemIds: string[],
    targetSprintNumber: number
  ) => Task[];
  onBackToOverview?: () => void; // New prop
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
  ticketNumber: '',
  backlogId: '',
  storyPoints: '',
  devEstimatedTime: '',
  reviewEstimatedTime: '1d', // Default Review Est
  qaEstimatedTime: '2d',
  bufferTime: '1d',
  assignee: '',
  reviewer: '',
  status: 'To Do',
  startDate: null,
  startDateObj: null,
  completedDate: null,
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
  severity: null,
});

export default function SprintPlanningTab({
  projectId,
  sprints,
  initialSelectedSprint,
  onSavePlanning,
  onCreateAndPlanSprint,
  projectName,
  members,
  holidayCalendars,
  teams,
  backlog,
  onRevertTask,
  onCompleteSprint,
  onAddBacklogItems,
  onBackToOverview, // Destructure new prop
}: SprintPlanningTabProps) {
  const [selectedSprintNumber, setSelectedSprintNumber] = useState<
    number | null
  >(null);
  const [planningData, setPlanningData] = useState<SprintPlanning>(
    initialSprintPlanning
  );
  const [newTasks, setNewTasks] = useState<TaskRow[]>([]);
  const [spilloverTasks, setSpilloverTasks] = useState<TaskRow[]>([]);
  const [isCreatingNewSprint, setIsCreatingNewSprint] = useState(false);
  const [newSprintForm, setNewSprintForm] = useState<NewSprintFormState>({
    sprintNumber: '',
    startDate: null,
    duration: '',
  });
  const [isBacklogDialogOpen, setIsBacklogDialogOpen] = useState(false);
  const [selectedBacklogIds, setSelectedBacklogIds] = useState<Set<string>>(
    new Set()
  );
  const [timelineViewMode, setTimelineViewMode] = useState<'task' | 'assignee'>(
    'task'
  );
  const [isCompleteTaskDialogOpen, setIsCompleteTaskDialogOpen] =
    useState(false);
  const [completingTaskInfo, setCompletingTaskInfo] = useState<{
    task: TaskRow | null;
    taskType: 'new' | 'spillover' | null;
  }>({ task: null, taskType: null });
  const [selectedCompletedDate, setSelectedCompletedDate] = useState<
    Date | undefined
  >(new Date());
  const { toast } = useToast();

  const selectedSprint = useMemo(() => {
    if (isCreatingNewSprint) return null;
    if (initialSelectedSprint && initialSelectedSprint.status === 'Completed') {
      return initialSelectedSprint;
    }
    if (selectedSprintNumber === null) {
      const firstAvailable = sprints.find(
        (s) => s.status === 'Active' || s.status === 'Planned'
      );
      return firstAvailable ?? null;
    }
    return sprints.find((s) => s.sprintNumber === selectedSprintNumber) ?? null;
  }, [
    selectedSprintNumber,
    sprints,
    isCreatingNewSprint,
    initialSelectedSprint,
  ]);

  const availableSprintsForSelection = useMemo(() => {
    return sprints
      .filter((s) => s.status === 'Active' || s.status === 'Planned')
      .sort((a, b) => a.sprintNumber - b.sprintNumber);
  }, [sprints]);

  const isFormDisabled = selectedSprint?.status === 'Completed';

  const isSprintActive = selectedSprint?.status === 'Active';
  const isSprintPlanned = selectedSprint?.status === 'Planned';

  const sprintLimits = useMemo(() => {
    const numPlanned = sprints.filter((s) => s.status === 'Planned').length;
    const numActive = sprints.filter((s) => s.status === 'Active').length;
    const canPlanNew =
      (numActive === 0 && numPlanned < 2) ||
      (numActive === 1 && numPlanned < 1);
    const canStartNew = numActive === 0;
    return { numPlanned, numActive, canPlanNew, canStartNew };
  }, [sprints]);

  const currentSprintStartDate = useMemo(() => {
    if (isCreatingNewSprint && newSprintForm.startDate) {
      return format(newSprintForm.startDate, 'yyyy-MM-dd');
    }
    return selectedSprint?.startDate;
  }, [isCreatingNewSprint, newSprintForm.startDate, selectedSprint]);

  const currentSprintEndDate = useMemo(() => {
    if (
      isCreatingNewSprint &&
      newSprintForm.startDate &&
      newSprintForm.duration
    ) {
      return calculateSprintMetrics(
        format(newSprintForm.startDate, 'yyyy-MM-dd'),
        newSprintForm.duration
      ).endDate;
    }
    return selectedSprint?.endDate;
  }, [
    isCreatingNewSprint,
    newSprintForm.startDate,
    newSprintForm.duration,
    selectedSprint,
  ]);

  const tasksForChart: Task[] = useMemo(() => {
    const allTaskRows = [...newTasks, ...spilloverTasks];
    return allTaskRows
      .filter(
        (task) =>
          task.startDate &&
          task.devEstimatedTime !== undefined &&
          task.devEstimatedTime !== null &&
          isValid(parseISO(task.startDate ?? ''))
      )
      .map((task) => ({ ...task }) as Task);
  }, [newTasks, spilloverTasks]);

  const nextSprintNumber = useMemo(() => {
    if (sprints.length === 0) return '1';
    const maxNumber = Math.max(...sprints.map((s) => s.sprintNumber), 0);
    return (maxNumber + 1).toString();
  }, [sprints]);

  const resetForms = useCallback(() => {
    setPlanningData(initialSprintPlanning);
    setNewTasks([]);
    setSpilloverTasks([]);
  }, []);

  const parseDateString = (
    dateString: string | undefined | null
  ): Date | undefined => {
    if (!dateString) return undefined;
    try {
      const parsed = parseISO(dateString);
      return isValid(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  };

  useEffect(() => {
    if (initialSelectedSprint) {
      setSelectedSprintNumber(initialSelectedSprint.sprintNumber);
      setIsCreatingNewSprint(false);
    } else if (
      !selectedSprintNumber &&
      availableSprintsForSelection.length > 0
    ) {
      setSelectedSprintNumber(availableSprintsForSelection[0].sprintNumber);
    } else if (availableSprintsForSelection.length === 0) {
      setSelectedSprintNumber(null);
    }
  }, [
    sprints,
    initialSelectedSprint,
    availableSprintsForSelection,
    selectedSprintNumber,
  ]);

  useEffect(() => {
    if (selectedSprint && !isCreatingNewSprint) {
      const loadedPlanning = selectedSprint.planning ?? initialSprintPlanning;
      setPlanningData(loadedPlanning);
      const mapTaskToRow = (
        task: Task,
        index: number,
        type: 'new' | 'spill'
      ): TaskRow => ({
        ...createEmptyTaskRow(),
        ...task,
        ticketNumber: task.ticketNumber ?? '',
        backlogId: task.backlogId ?? '',
        storyPoints: task.storyPoints?.toString() ?? '',
        devEstimatedTime: task.devEstimatedTime ?? '',
        reviewEstimatedTime: task.reviewEstimatedTime ?? '1d', // Default review est
        qaEstimatedTime: task.qaEstimatedTime ?? '2d',
        bufferTime: task.bufferTime ?? '1d',
        assignee: task.assignee ?? '',
        reviewer: task.reviewer ?? '',
        status: task.status ?? 'To Do',
        taskType: task.taskType ?? 'New Feature',
        startDate: task.startDate,
        startDateObj: parseDateString(task.startDate),
        completedDate: task.completedDate ?? null,
        _internalId: task.id || `initial_${type}_${index}_${Date.now()}`,
        severity: task.severity ?? null,
      });
      setNewTasks(
        (loadedPlanning.newTasks || []).map((task, index) =>
          mapTaskToRow(task, index, 'new')
        )
      );
      setSpilloverTasks(
        (loadedPlanning.spilloverTasks || []).map((task, index) =>
          mapTaskToRow(task, index, 'spill')
        )
      );
      if ((loadedPlanning.newTasks || []).length === 0) setNewTasks([]);
      if ((loadedPlanning.spilloverTasks || []).length === 0)
        setSpilloverTasks([]);
    } else if (!isCreatingNewSprint && !selectedSprint) {
      resetForms();
    }
  }, [selectedSprint, isCreatingNewSprint, resetForms]);

  useEffect(() => {
    if (isCreatingNewSprint) {
      setSelectedSprintNumber(null);
      resetForms();
      setNewSprintForm({
        sprintNumber: nextSprintNumber,
        startDate: null,
        duration: '',
      });
    } else {
      if (
        !initialSelectedSprint ||
        initialSelectedSprint.status !== 'Completed'
      ) {
        setNewSprintForm({ sprintNumber: '', startDate: null, duration: '' });
      }
    }
  }, [
    isCreatingNewSprint,
    nextSprintNumber,
    resetForms,
    initialSelectedSprint,
  ]);

  const handleSelectExistingSprint = (sprintNumStr: string) => {
    const sprintNum = parseInt(sprintNumStr, 10);
    if (isNaN(sprintNum)) {
      setSelectedSprintNumber(null);
    } else {
      const sprintToSelect = sprints.find((s) => s.sprintNumber === sprintNum);
      if (sprintToSelect) {
        setIsCreatingNewSprint(false);
        setSelectedSprintNumber(sprintToSelect.sprintNumber);
      } else {
        setSelectedSprintNumber(null);
      }
    }
  };

  const handlePlanNewSprintClick = () => {
    if (!sprintLimits.canPlanNew) {
      toast({
        variant: 'destructive',
        title: 'Sprint Limit Reached',
        description:
          'Cannot plan new sprint. Limit is 2 Planned or 1 Planned + 1 Active.',
      });
      return;
    }
    setIsCreatingNewSprint(true);
    setSelectedSprintNumber(null);
  };

  const handleCancelNewSprint = () => {
    setIsCreatingNewSprint(false);
    resetForms();
    if (initialSelectedSprint) {
      setSelectedSprintNumber(initialSelectedSprint.sprintNumber);
    } else if (availableSprintsForSelection.length > 0) {
      setSelectedSprintNumber(availableSprintsForSelection[0].sprintNumber);
    } else {
      setSelectedSprintNumber(null);
    }
  };

  const handleInputChange = (
    field: keyof Omit<SprintPlanning, 'newTasks' | 'spilloverTasks'>,
    value: string
  ) => {
    if (isFormDisabled && !isCreatingNewSprint) return;
    setPlanningData((prev) => ({ ...prev, [field]: value }));
  };

  const handleNewSprintFormChange = (
    field: keyof NewSprintFormState,
    value: string | Date | null
  ) => {
    setNewSprintForm((prev) => ({ ...prev, [field]: value }));
  };

  const addTaskRow = (type: 'new' | 'spillover') => {
    if (isFormDisabled && !isCreatingNewSprint) return;
    if (type === 'spillover') {
      setSpilloverTasks((prev) => [...prev, createEmptyTaskRow()]);
    } else {
      toast({
        variant: 'default',
        title: 'Info',
        description: "Add new tasks using the 'Add from Backlog' button.",
      });
    }
  };

  const removeTaskRow = (type: 'new' | 'spillover', internalId: string) => {
    if (isFormDisabled && !isCreatingNewSprint) return;
    const updater = type === 'new' ? setNewTasks : setSpilloverTasks;
    const taskList = type === 'new' ? newTasks : spilloverTasks;
    const taskToRemove = taskList.find((row) => row._internalId === internalId);
    const targetSprintNum = selectedSprint?.sprintNumber;

    if (
      type === 'new' &&
      taskToRemove?.backlogId &&
      targetSprintNum !== undefined &&
      targetSprintNum !== null
    ) {
      onRevertTask(targetSprintNum, taskToRemove.id, taskToRemove.backlogId);
    }
    updater((prevRows) =>
      prevRows.filter((row) => row._internalId !== internalId)
    );
  };

  const findTeamLead = useCallback(
    (memberName: string | null): string | undefined => {
      if (!memberName) return undefined;
      const member = members.find((m) => m.name === memberName);
      if (!member) return undefined;
      const team = teams.find((t) =>
        t.members.some((tm) => tm.memberId === member.id)
      );
      if (!team || !team.leadMemberId) return undefined;
      const leadMember = members.find((m) => m.id === team.leadMemberId);
      return leadMember?.name;
    },
    [members, teams]
  );

  const handleTaskInputChange = (
    type: 'new' | 'spillover',
    internalId: string,
    field: keyof Omit<
      Task,
      'id' | 'completedDate' | 'startDateObj' | 'storyPoints'
    >,
    value: string | number | undefined | null
  ) => {
    if (isFormDisabled && !isCreatingNewSprint) return;
    const updater = type === 'new' ? setNewTasks : setSpilloverTasks;
    updater((rows) =>
      rows.map((row) => {
        if (row._internalId === internalId) {
          let finalValue: any = value ?? '';
          if (field === 'taskType') finalValue = value as TaskType;
          if (field === 'severity') finalValue = value as SeverityType | null;

          const updatedRow = { ...row, [field]: finalValue };
          if (field === 'assignee' && typeof value === 'string') {
            const assigneeName = value;
            const assigneeMember = members.find((m) => m.name === assigneeName);
            if (assigneeMember?.role === 'Software Engineer') {
              updatedRow.reviewer = findTeamLead(assigneeName) ?? '';
            } else {
              updatedRow.reviewer = '';
            }
          }
          if (field === 'taskType' && finalValue !== 'Bug') {
            updatedRow.severity = null;
          }
          return updatedRow;
        }
        return row;
      })
    );
  };

  const handleTaskStoryPointsChange = (
    type: 'new' | 'spillover',
    internalId: string,
    value: string
  ) => {
    if (isFormDisabled && !isCreatingNewSprint) return;
    const updater = type === 'new' ? setNewTasks : setSpilloverTasks;
    updater((rows) =>
      rows.map((row) =>
        row._internalId === internalId ? { ...row, storyPoints: value } : row
      )
    );
  };

  const handleTaskDateChange = (
    type: 'new' | 'spillover',
    internalId: string,
    field: 'startDate',
    date: Date | undefined
  ) => {
    if (isFormDisabled && !isCreatingNewSprint) return;
    const updater = type === 'new' ? setNewTasks : setSpilloverTasks;
    updater((rows) =>
      rows.map((row) => {
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

  const handleBacklogItemToggle = (itemId: string, checked: boolean) => {
    setSelectedBacklogIds((prev) => {
      const newSelection = new Set(prev);
      if (checked) newSelection.add(itemId);
      else newSelection.delete(itemId);
      return newSelection;
    });
  };

  const handleAddSelectedBacklogItems = () => {
    if (selectedBacklogIds.size === 0) {
      toast({
        variant: 'default',
        title: 'No items selected',
        description: 'Please select items from the backlog to add.',
      });
      return;
    }
    const currentSprintNum = isCreatingNewSprint
      ? parseInt(newSprintForm.sprintNumber, 10)
      : selectedSprint?.sprintNumber;
    if (
      currentSprintNum === null ||
      currentSprintNum === undefined ||
      isNaN(currentSprintNum)
    ) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Cannot determine target sprint number.',
      });
      return;
    }
    const addedTasksForPlan = onAddBacklogItems(
      Array.from(selectedBacklogIds),
      currentSprintNum
    );
    if (addedTasksForPlan.length > 0) {
      const itemsToAdd = addedTasksForPlan.map(
        (task): TaskRow => ({
          ...createEmptyTaskRow(),
          ...task,
          _internalId: `backlog_added_${task.id}_${Date.now()}`,
          startDateObj: parseDateString(task.startDate),
          storyPoints: task.storyPoints?.toString() ?? '',
          reviewEstimatedTime: task.reviewEstimatedTime ?? '1d',
          qaEstimatedTime: task.qaEstimatedTime ?? '2d',
          bufferTime: task.bufferTime ?? '1d',
          backlogId: task.backlogId ?? '',
          ticketNumber: task.ticketNumber ?? task.backlogId ?? '',
          taskType: task.taskType ?? 'New Feature',
          severity: task.severity ?? null,
        })
      );
      setNewTasks((prev) => {
        const filteredPrev = prev.filter(
          (p) => p.ticketNumber?.trim() || p.storyPoints?.toString().trim()
        );
        const uniqueToAdd = itemsToAdd.filter(
          (newItem) =>
            !filteredPrev.some((existing) => existing.id === newItem.id)
        );
        return [...filteredPrev, ...uniqueToAdd];
      });
    }
    setIsBacklogDialogOpen(false);
  };

  const handleSaveExistingSprintPlanning = () => {
    if (!selectedSprint || selectedSprintNumber === null) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No sprint selected.',
      });
      return;
    }
    if (isFormDisabled) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Cannot save planning for a completed sprint.',
      });
      return;
    }
    const { tasks: finalNewTasks, errors: newErrors } = finalizeTasksLocal(
      newTasks,
      'new',
      selectedSprintNumber
    );
    const { tasks: finalSpilloverTasks, errors: spillErrors } =
      finalizeTasksLocal(spilloverTasks, 'spillover', selectedSprintNumber);
    const allErrors = [...newErrors, ...spillErrors];
    if (allErrors.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Validation Error in Tasks',
        description: allErrors.join('\n'),
      });
      return;
    }
    const currentPlanningData: SprintPlanning = {
      goal: planningData.goal.trim(),
      newTasks: finalNewTasks,
      spilloverTasks: finalSpilloverTasks,
      definitionOfDone: planningData.definitionOfDone.trim(),
      testingStrategy: planningData.testingStrategy.trim(),
    };
    const currentStatus =
      selectedSprint?.status === 'Active'
        ? 'Active'
        : selectedSprint?.status === 'Planned'
          ? 'Planned'
          : undefined;
    onSavePlanning(selectedSprintNumber, currentPlanningData, currentStatus);
  };

  const handleCreateAndSaveNewSprint = () => {
    if (!sprintLimits.canPlanNew) {
      toast({
        variant: 'destructive',
        title: 'Sprint Limit Reached',
        description:
          'Cannot plan new sprint. Limit is 2 Planned or 1 Planned + 1 Active.',
      });
      return;
    }
    const sprintNumInt = parseInt(newSprintForm.sprintNumber, 10);
    const startDateObj = newSprintForm.startDate;
    const startDateStr = startDateObj ? format(startDateObj, 'yyyy-MM-dd') : '';
    const duration = newSprintForm.duration;
    let formErrors: string[] = [];
    if (isNaN(sprintNumInt) || sprintNumInt <= 0)
      formErrors.push('Invalid Sprint Number.');
    if (sprints.some((s) => s.sprintNumber === sprintNumInt))
      formErrors.push(`Sprint Number ${sprintNumInt} already exists.`);
    if (!startDateStr || !isValid(parseISO(startDateStr)))
      formErrors.push('Valid Start Date is required.');
    if (!duration || !DURATION_OPTIONS.includes(duration))
      formErrors.push('Valid Duration is required.');
    if (formErrors.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: formErrors.join('\n'),
      });
      return;
    }
    const { totalDays, endDate } = calculateSprintMetrics(
      startDateStr,
      duration
    );
    if (totalDays <= 0 || endDate === 'N/A') {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not calculate sprint end date.',
      });
      return;
    }
    const sprintDetails: Omit<
      Sprint,
      'details' | 'planning' | 'status' | 'committedPoints' | 'completedPoints'
    > = {
      sprintNumber: sprintNumInt,
      startDate: startDateStr,
      endDate: endDate,
      duration: duration,
      totalDays: totalDays,
    };
    const { tasks: finalNewTasks, errors: newErrors } = finalizeTasksLocal(
      newTasks,
      'new',
      sprintDetails.sprintNumber
    );
    const { tasks: finalSpilloverTasks, errors: spillErrors } =
      finalizeTasksLocal(spilloverTasks, 'spillover', sprintDetails.sprintNumber);
    const allErrors = [...newErrors, ...spillErrors];
    if (allErrors.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Validation Error in Tasks',
        description: allErrors.join('\n'),
      });
      return;
    }
    const currentPlanningData: SprintPlanning = {
      goal: planningData.goal.trim(),
      newTasks: finalNewTasks,
      spilloverTasks: finalSpilloverTasks,
      definitionOfDone: planningData.definitionOfDone.trim(),
      testingStrategy: planningData.testingStrategy.trim(),
    };
    onCreateAndPlanSprint(sprintDetails, currentPlanningData);
    setIsCreatingNewSprint(false);
  };

  const handleStartSprint = () => {
    if (!selectedSprint || !isSprintPlanned || selectedSprintNumber === null) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: "Only 'Planned' sprints can be started.",
      });
      return;
    }
    if (!sprintLimits.canStartNew) {
      toast({
        variant: 'destructive',
        title: 'Active Sprint Limit',
        description: `Only one sprint can be active at a time. Sprint ${sprints.find((s) => s.status === 'Active')?.sprintNumber} is already active.`,
      });
      return;
    }
    const { tasks: finalNewTasks, errors: newErrors } = finalizeTasksLocal(
      newTasks,
      'new',
      selectedSprintNumber
    );
    const { tasks: finalSpilloverTasks, errors: spillErrors } =
      finalizeTasksLocal(spilloverTasks, 'spillover', selectedSprintNumber);
    const allErrors = [...newErrors, ...spillErrors];
    if (allErrors.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Validation Error Before Starting',
        description: `Please fix planning errors before starting: ${allErrors.join(' ')}`,
      });
      return;
    }
    const finalPlanningData: SprintPlanning = {
      goal: planningData.goal.trim(),
      newTasks: finalNewTasks,
      spilloverTasks: finalSpilloverTasks,
      definitionOfDone: planningData.definitionOfDone.trim(),
      testingStrategy: planningData.testingStrategy.trim(),
    };
    onSavePlanning(selectedSprintNumber, finalPlanningData, 'Active');
  };

  const handleCompleteSprintClick = () => {
    if (!selectedSprint || !isSprintActive || selectedSprintNumber === null)
      return;
    const { tasks: finalNewTasks, errors: newErrors } = finalizeTasksLocal(
      newTasks,
      'new',
      selectedSprintNumber
    );
    const { tasks: finalSpilloverTasks, errors: spillErrors } =
      finalizeTasksLocal(spilloverTasks, 'spillover', selectedSprintNumber);
    const allErrors = [...newErrors, ...spillErrors];
    if (allErrors.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Validation Error Before Completing',
        description: `Please fix errors before completing: ${allErrors.join(' ')}`,
      });
      return;
    }
    const latestPlanningData: SprintPlanning = {
      goal: planningData.goal.trim(),
      newTasks: finalNewTasks,
      spilloverTasks: finalSpilloverTasks,
      definitionOfDone: planningData.definitionOfDone.trim(),
      testingStrategy: planningData.testingStrategy.trim(),
    };
    onCompleteSprint(selectedSprintNumber, latestPlanningData);
    setSelectedSprintNumber(null);
    resetForms();
  };

  const handleOpenCompleteTaskDialog = (
    task: TaskRow,
    taskType: 'new' | 'spillover'
  ) => {
    setCompletingTaskInfo({ task, taskType });
    setSelectedCompletedDate(
      task.completedDate ? parseDateString(task.completedDate) : new Date()
    );
    setIsCompleteTaskDialogOpen(true);
  };

  const handleConfirmCompleteTask = () => {
    const { task, taskType } = completingTaskInfo;
    if (!task || !taskType || !selectedCompletedDate) return;
    const updater = taskType === 'new' ? setNewTasks : setSpilloverTasks;
    updater((prevRows) =>
      prevRows.map((row) =>
        row._internalId === task._internalId
          ? {
              ...row,
              status: 'Done',
              completedDate: format(selectedCompletedDate, 'yyyy-MM-dd'),
            }
          : row
      )
    );
    setIsCompleteTaskDialogOpen(false);
    toast({
      title: 'Task Completed',
      description: `Task '${task.ticketNumber}' marked as Done.`,
    });
  };

  const getStatusBadgeVariant = (
    status: Sprint['status'] | undefined
  ): 'default' | 'secondary' | 'outline' | 'destructive' | null | undefined => {
    if (!status) return 'secondary';
    return status === 'Active'
      ? 'default'
      : status === 'Planned'
        ? 'secondary'
        : 'outline';
  };

  const getStatusColorClass = (
    status: Sprint['status'] | undefined
  ): string => {
    if (!status) return 'text-muted-foreground';
    return status === 'Active'
      ? 'text-primary'
      : status === 'Planned'
        ? 'text-muted-foreground'
        : 'text-green-600';
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
            variant={'outline'}
            className={cn(
              'h-9 w-full justify-start px-2 text-left text-xs font-normal',
              !dateValue && 'text-muted-foreground'
            )}
            disabled={disabled}
          >
            <CalendarIconLucide className="mr-1 h-3 w-3" />
            {dateValue ? format(dateValue, 'MM/dd') : <span>Pick</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="single"
            selected={dateValue}
            onSelect={(date) =>
              handleTaskDateChange(type, row._internalId, field, date as Date)
            }
            initialFocus
          />
        </PopoverContent>
      </Popover>
    );
  };

  const renderTaskTable = (
    type: 'new' | 'spillover',
    taskRows: TaskRow[],
    disabled: boolean
  ) => (
    <div className="overflow-x-auto">
      <div className="min-w-[2000px] space-y-4">
        <div className="hidden grid-cols-[100px_120px_120px_100px_70px_100px_100px_100px_100px_150px_150px_120px_100px_80px_40px] items-center gap-x-2 border-b pb-2 md:grid">
          <Label className="text-xs font-medium text-muted-foreground">
            Ticket #*
          </Label>
          <Label className="text-xs font-medium text-muted-foreground">
            Backlog ID
          </Label>
          <Label className="text-xs font-medium text-muted-foreground">
            Task Type*
          </Label>
          <Label className="text-xs font-medium text-muted-foreground">
            Severity
          </Label>
          <Label className="text-right text-xs font-medium text-muted-foreground">
            Story Pts
          </Label>
          <Label className="text-right text-xs font-medium text-muted-foreground">
            Dev Est
          </Label>
          <Label className="text-right text-xs font-medium text-muted-foreground">
            Review Est
          </Label>
          <Label className="text-right text-xs font-medium text-muted-foreground">
            QA Est
          </Label>
          <Label className="text-right text-xs font-medium text-muted-foreground">
            Buffer
          </Label>
          <Label className="text-xs font-medium text-muted-foreground">
            Assignee
          </Label>
          <Label className="text-xs font-medium text-muted-foreground">
            Reviewer
          </Label>
          <Label className="text-xs font-medium text-muted-foreground">
            Status
          </Label>
          <Label className="text-center text-xs font-medium text-muted-foreground">
            Start Date*
          </Label>
          <div />
          <div />
        </div>
        <div className="space-y-4 md:space-y-2">
          {taskRows.map((row) => (
            <div
              key={row._internalId}
              className="grid grid-cols-2 items-start gap-x-2 gap-y-2 border-b pb-4 last:border-b-0 md:grid-cols-[100px_120px_120px_100px_70px_100px_100px_100px_100px_150px_150px_120px_100px_80px_40px] md:border-none md:pb-0"
            >
              <div className="col-span-1 md:col-span-1">
                <Label
                  htmlFor={`ticket-${type}-${row._internalId}`}
                  className="text-xs font-medium md:hidden"
                >
                  Ticket #*
                </Label>
                <Input
                  id={`ticket-${type}-${row._internalId}`}
                  value={row.ticketNumber ?? ''}
                  onChange={(e) =>
                    handleTaskInputChange(
                      type,
                      row._internalId,
                      'ticketNumber',
                      e.target.value
                    )
                  }
                  placeholder="e.g., 12345"
                  className="h-9 w-full"
                  disabled={disabled}
                  required
                />
              </div>
              <div className="col-span-1 md:col-span-1">
                <Label
                  htmlFor={`backlogId-${type}-${row._internalId}`}
                  className="text-xs font-medium md:hidden"
                >
                  Backlog ID
                </Label>
                <Input
                  id={`backlogId-${type}-${row._internalId}`}
                  value={row.backlogId ?? ''}
                  readOnly
                  className="h-9 w-full cursor-default bg-muted/50"
                  title={row.backlogId}
                />
              </div>
              <div className="col-span-1 md:col-span-1">
                <Label
                  htmlFor={`taskType-${type}-${row._internalId}`}
                  className="text-xs font-medium md:hidden"
                >
                  Task Type*
                </Label>
                <Select
                  value={row.taskType ?? 'New Feature'}
                  onValueChange={(value) =>
                    handleTaskInputChange(
                      type,
                      row._internalId,
                      'taskType',
                      value
                    )
                  }
                  disabled={disabled}
                >
                  <SelectTrigger
                    id={`taskType-${type}-${row._internalId}`}
                    className="h-9 w-full"
                  >
                    <SelectValue placeholder="Select Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {taskTypes.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-1 md:col-span-1">
                <Label
                  htmlFor={`severity-${type}-${row._internalId}`}
                  className="text-xs font-medium md:hidden"
                >
                  Severity
                </Label>
                <Select
                  value={row.severity ?? 'none'}
                  onValueChange={(value) =>
                    handleTaskInputChange(
                      type,
                      row._internalId,
                      'severity',
                      value === 'none' ? null : (value as SeverityType)
                    )
                  }
                  disabled={disabled || row.taskType !== 'Bug'}
                >
                  <SelectTrigger
                    id={`severity-${type}-${row._internalId}`}
                    className="h-9 w-full"
                  >
                    <SelectValue placeholder="Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-muted-foreground">
                      -- Select --
                    </SelectItem>
                    {severities.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-1 md:col-span-1">
                <Label
                  htmlFor={`sp-${type}-${row._internalId}`}
                  className="text-xs font-medium md:hidden"
                >
                  Story Pts
                </Label>
                <Input
                  id={`sp-${type}-${row._internalId}`}
                  type="text"
                  value={row.storyPoints ?? ''}
                  onChange={(e) =>
                    handleTaskStoryPointsChange(
                      type,
                      row._internalId,
                      e.target.value
                    )
                  }
                  placeholder="Pts"
                  className="h-9 w-full text-right"
                  disabled={disabled}
                />
              </div>
              <div className="col-span-1 md:col-span-1">
                <Label
                  htmlFor={`devEstTime-${type}-${row._internalId}`}
                  className="text-xs font-medium md:hidden"
                >
                  Dev Est
                </Label>
                <Input
                  id={`devEstTime-${type}-${row._internalId}`}
                  value={row.devEstimatedTime ?? ''}
                  onChange={(e) =>
                    handleTaskInputChange(
                      type,
                      row._internalId,
                      'devEstimatedTime',
                      e.target.value
                    )
                  }
                  placeholder="e.g., 2d"
                  className="h-9 w-full text-right"
                  disabled={disabled}
                />
              </div>
              <div className="col-span-1 md:col-span-1">
                <Label
                  htmlFor={`reviewEstTime-${type}-${row._internalId}`}
                  className="text-xs font-medium md:hidden"
                >
                  Review Est
                </Label>
                <Input
                  id={`reviewEstTime-${type}-${row._internalId}`}
                  value={row.reviewEstimatedTime ?? ''}
                  onChange={(e) =>
                    handleTaskInputChange(
                      type,
                      row._internalId,
                      'reviewEstimatedTime',
                      e.target.value
                    )
                  }
                  placeholder="e.g., 1d"
                  className="h-9 w-full text-right"
                  disabled={disabled}
                />
              </div>
              <div className="col-span-1 md:col-span-1">
                <Label
                  htmlFor={`qaEstTime-${type}-${row._internalId}`}
                  className="text-xs font-medium md:hidden"
                >
                  QA Est
                </Label>
                <Input
                  id={`qaEstTime-${type}-${row._internalId}`}
                  value={row.qaEstimatedTime ?? ''}
                  onChange={(e) =>
                    handleTaskInputChange(
                      type,
                      row._internalId,
                      'qaEstimatedTime',
                      e.target.value
                    )
                  }
                  placeholder="e.g., 2d"
                  className="h-9 w-full text-right"
                  disabled={disabled}
                />
              </div>
              <div className="col-span-1 md:col-span-1">
                <Label
                  htmlFor={`bufferTime-${type}-${row._internalId}`}
                  className="text-xs font-medium md:hidden"
                >
                  Buffer
                </Label>
                <Input
                  id={`bufferTime-${type}-${row._internalId}`}
                  value={row.bufferTime ?? ''}
                  onChange={(e) =>
                    handleTaskInputChange(
                      type,
                      row._internalId,
                      'bufferTime',
                      e.target.value
                    )
                  }
                  placeholder="e.g., 1d"
                  className="h-9 w-full text-right"
                  disabled={disabled}
                />
              </div>
              <div className="col-span-1 md:col-span-1">
                <Label
                  htmlFor={`assignee-${type}-${row._internalId}`}
                  className="text-xs font-medium md:hidden"
                >
                  Assignee
                </Label>
                <Select
                  value={row.assignee ?? ''}
                  onValueChange={(value) =>
                    handleTaskInputChange(
                      type,
                      row._internalId,
                      'assignee',
                      value === 'unassigned' ? '' : value
                    )
                  }
                  disabled={disabled || members.length === 0}
                >
                  <SelectTrigger
                    id={`assignee-${type}-${row._internalId}`}
                    className="h-9 w-full"
                  >
                    <SelectValue placeholder="Select Assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      value="unassigned"
                      className="text-muted-foreground"
                    >
                      -- Unassigned --
                    </SelectItem>
                    {members.map((member) => (
                      <SelectItem key={member.id} value={member.name}>
                        {member.name}
                      </SelectItem>
                    ))}
                    {members.length === 0 && (
                      <SelectItem value="no-members" disabled>
                        No members in project
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-1 md:col-span-1">
                <Label
                  htmlFor={`reviewer-${type}-${row._internalId}`}
                  className="text-xs font-medium md:hidden"
                >
                  Reviewer
                </Label>
                <Select
                  value={row.reviewer ?? ''}
                  onValueChange={(value) =>
                    handleTaskInputChange(
                      type,
                      row._internalId,
                      'reviewer',
                      value === 'unassigned' ? '' : value
                    )
                  }
                  disabled={disabled || members.length === 0}
                >
                  <SelectTrigger
                    id={`reviewer-${type}-${row._internalId}`}
                    className="h-9 w-full"
                  >
                    <SelectValue placeholder="Select Reviewer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      value="unassigned"
                      className="text-muted-foreground"
                    >
                      -- Unassigned --
                    </SelectItem>
                    {members.map((member) => (
                      <SelectItem key={member.id} value={member.name}>
                        {member.name}
                      </SelectItem>
                    ))}
                    {members.length === 0 && (
                      <SelectItem value="no-members" disabled>
                        No members in project
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-1 md:col-span-1">
                <Label
                  htmlFor={`status-${type}-${row._internalId}`}
                  className="text-xs font-medium md:hidden"
                >
                  Status
                </Label>
                <Select
                  value={row.status ?? 'To Do'}
                  onValueChange={(value) =>
                    handleTaskInputChange(
                      type,
                      row._internalId,
                      'status',
                      value
                    )
                  }
                  disabled={disabled}
                >
                  <SelectTrigger
                    id={`status-${type}-${row._internalId}`}
                    className="h-9 w-full"
                  >
                    <SelectValue placeholder="Select Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {taskStatuses.map((statusOption) => (
                      <SelectItem key={statusOption} value={statusOption}>
                        {statusOption}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-1 md:col-span-1">
                <Label
                  htmlFor={`startDate-${type}-${row._internalId}`}
                  className="text-xs font-medium md:hidden"
                >
                  Start Date*
                </Label>
                {renderDatePicker(type, row, 'startDate', disabled)}
              </div>
              <div className="col-span-1 flex items-center justify-center md:col-span-1">
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
              <div className="col-span-2 mt-1 flex items-center justify-end md:col-span-1 md:mt-0 md:self-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeTaskRow(type, row._internalId)}
                  className={cn(
                    'h-9 w-9 text-muted-foreground hover:text-destructive',
                    type === 'new' && !!row.backlogId && 'hover:text-blue-600'
                  )}
                  aria-label={
                    type === 'new' && !!row.backlogId
                      ? 'Revert task to backlog'
                      : `Remove ${type} task row`
                  }
                  title={
                    type === 'new' && !!row.backlogId
                      ? 'Revert task to backlog'
                      : `Remove ${type} task row`
                  }
                  disabled={disabled}
                >
                  {type === 'new' && !!row.backlogId ? (
                    <Undo className="h-4 w-4" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          ))}
          {!disabled && (
            <div className="mt-4 flex gap-2">
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
                <Dialog
                  open={isBacklogDialogOpen}
                  onOpenChange={setIsBacklogDialogOpen}
                >
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
                        Select items from the project backlog to add to this
                        sprint plan. They will be added with 'To Do' status.
                      </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="h-72 w-full rounded-md border p-4">
                      {backlog.length > 0 ? (
                        backlog
                          .sort(
                            (a, b) =>
                              taskPriorities.indexOf(a.priority || 'Medium') -
                                taskPriorities.indexOf(
                                  b.priority || 'Medium'
                                ) ||
                              (a.ticketNumber ?? '').localeCompare(
                                b.ticketNumber ?? ''
                              )
                          )
                          .map((task) => (
                            <div
                              key={task.id}
                              className="flex items-center space-x-2 border-b py-2 last:border-b-0"
                            >
                              <Checkbox
                                id={`backlog-${task.id}`}
                                checked={selectedBacklogIds.has(task.id)}
                                onCheckedChange={(checked) =>
                                  handleBacklogItemToggle(task.id, !!checked)
                                }
                              />
                              <Label
                                htmlFor={`backlog-${task.id}`}
                                className="flex-1 cursor-pointer"
                              >
                                <span className="font-medium">
                                  {task.backlogId}
                                </span>{' '}
                                {task.title && `- ${task.title}`}
                                <span className="ml-2 text-xs text-muted-foreground">
                                  ({task.priority ?? 'Medium'})
                                </span>
                              </Label>
                            </div>
                          ))
                      ) : (
                        <p className="text-center italic text-muted-foreground">
                          No items currently in the backlog.
                        </p>
                      )}
                    </ScrollArea>
                    <BacklogDialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                      </DialogClose>
                      <Button
                        onClick={handleAddSelectedBacklogItems}
                        disabled={selectedBacklogIds.size === 0}
                      >
                        Add Selected ({selectedBacklogIds.size})
                      </Button>
                    </BacklogDialogFooter>
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
        <Label htmlFor="sprint-goal" className="text-base font-semibold">
          Sprint Goal
        </Label>
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
          <CardDescription>
            Tasks pulled from the backlog for this sprint.
          </CardDescription>
        </CardHeader>
        <CardContent>{renderTaskTable('new', newTasks, disabled)}</CardContent>
        <CardFooter>
          <p className="text-xs text-muted-foreground">
            * Required field: Ticket #, Task Type, Start Date. Other fields
            optional but recommended for planning/timeline.
          </p>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Spillover Tasks (From Previous Sprint)</CardTitle>
          <CardDescription>
            Tasks carried over from the previous sprint.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {renderTaskTable('spillover', spilloverTasks, disabled)}
        </CardContent>
        <CardFooter>
          <p className="text-xs text-muted-foreground">
            * Required field: Ticket #, Task Type, Start Date.
          </p>
        </CardFooter>
      </Card>

      <div className="space-y-2">
        <Label htmlFor="definition-of-done" className="text-base font-semibold">
          Definition of Done (DoD)
        </Label>
        <Textarea
          id="definition-of-done"
          placeholder="Specify the criteria that must be met for a task to be considered 'Done'..."
          value={planningData.definitionOfDone}
          onChange={(e) =>
            handleInputChange('definitionOfDone', e.target.value)
          }
          rows={4}
          disabled={disabled}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="testing-strategy" className="text-base font-semibold">
          Testing Strategy
        </Label>
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
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <GanttChartSquare className="h-5 w-5 text-muted-foreground" />{' '}
              Sprint Timeline
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant={timelineViewMode === 'task' ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => setTimelineViewMode('task')}
                title="View by Task"
                disabled={disabled && selectedSprint?.status !== 'Completed'}
              >
                <GanttChartSquare className="h-4 w-4" />
              </Button>
              <Button
                variant={
                  timelineViewMode === 'assignee' ? 'secondary' : 'ghost'
                }
                size="icon"
                onClick={() => setTimelineViewMode('assignee')}
                title="View by Assignee"
                disabled={disabled && selectedSprint?.status !== 'Completed'}
              >
                <Users className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <CardDescription>
            Visualization of planned tasks based on estimates. Add start dates
            and estimates to see tasks here.
          </CardDescription>
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
            <div className="flex h-full min-h-[200px] items-center justify-center p-4 text-center text-muted-foreground">
              <Info className="mr-2 h-5 w-5" />
              Add tasks with Start Date and Estimates (Dev, QA, Buffer) to
              visualize the timeline.
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );

  return (
    <div className="space-y-6">
      {selectedSprint?.status !== 'Completed' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {isCreatingNewSprint
                  ? 'Plan New Sprint'
                  : selectedSprint
                    ? `Planning Details for Sprint ${selectedSprint.sprintNumber}`
                    : 'Select or Plan Sprint'}
              </CardTitle>
              {!isCreatingNewSprint && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePlanNewSprintClick}
                  disabled={!sprintLimits.canPlanNew || isFormDisabled}
                  title={
                    !sprintLimits.canPlanNew
                      ? 'Sprint limit reached'
                      : 'Plan a New Sprint'
                  }
                >
                  <PlusCircle className="mr-2 h-4 w-4" /> Plan New Sprint
                </Button>
              )}
              {isCreatingNewSprint && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelNewSprint}
                  className="text-destructive hover:text-destructive"
                >
                  <XCircle className="mr-2 h-4 w-4" /> Cancel New Plan
                </Button>
              )}
            </div>
            {!isCreatingNewSprint && (
              <CardDescription>
                Select an existing sprint to plan or view its details, or plan a
                new one.
              </CardDescription>
            )}
          </CardHeader>

          {!isCreatingNewSprint && (
            <CardContent>
              {availableSprintsForSelection.length > 0 ? (
                <div className="mb-6 max-w-xs">
                  <Label htmlFor="select-sprint-to-plan">
                    Select Sprint to Plan/View
                  </Label>
                  <Select
                    value={selectedSprintNumber?.toString() ?? ''}
                    onValueChange={handleSelectExistingSprint}
                  >
                    <SelectTrigger id="select-sprint-to-plan">
                      <SelectValue placeholder="Select a sprint..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Plannable Sprints</SelectLabel>
                        {availableSprintsForSelection.map((sprint) => (
                          <SelectItem
                            key={sprint.sprintNumber}
                            value={sprint.sprintNumber.toString()}
                          >
                            Sprint {sprint.sprintNumber} ({sprint.status})
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <p className="py-4 text-center text-muted-foreground">
                  No Planned or Active sprints available to select. Plan a new
                  sprint.
                </p>
              )}
            </CardContent>
          )}

          {isCreatingNewSprint && (
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-3">
                <div>
                  <Label htmlFor="new-sprint-number">Sprint Number*</Label>
                  <Input
                    id="new-sprint-number"
                    type="number"
                    placeholder={nextSprintNumber}
                    value={newSprintForm.sprintNumber}
                    onChange={(e) =>
                      handleNewSprintFormChange('sprintNumber', e.target.value)
                    }
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
                        variant={'outline'}
                        className={cn(
                          'h-9 w-full justify-start text-left font-normal',
                          !newSprintForm.startDate && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIconLucide className="mr-2 h-4 w-4" />
                        {newSprintForm.startDate ? (
                          format(newSprintForm.startDate, 'PPP')
                        ) : (
                          <span>Pick a date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={newSprintForm.startDate}
                        onSelect={(date) =>
                          handleNewSprintFormChange('startDate', date as Date)
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label htmlFor="new-sprint-duration">Duration*</Label>
                  <Select
                    value={newSprintForm.duration}
                    onValueChange={(value) =>
                      handleNewSprintFormChange('duration', value)
                    }
                    required
                  >
                    <SelectTrigger
                      id="new-sprint-duration"
                      className="h-9 w-full"
                    >
                      <SelectValue placeholder="Select Duration" />
                    </SelectTrigger>
                    <SelectContent>
                      {DURATION_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {renderPlanningForm(false)}
            </CardContent>
          )}
          {isCreatingNewSprint && (
            <CardFooter className="flex justify-end border-t pt-4">
              <Button onClick={handleCreateAndSaveNewSprint}>
                Create and Save Sprint Plan
              </Button>
            </CardFooter>
          )}
        </Card>
      )}

      {!isCreatingNewSprint && selectedSprint && (
        <Card className="mt-6">
          {selectedSprint.status !== 'Completed' && (
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {`Planning for Sprint ${selectedSprint.sprintNumber}`}
                <Badge
                  variant={getStatusBadgeVariant(selectedSprint.status)}
                  className="ml-2 capitalize"
                >
                  <Circle
                    className={cn(
                      'mr-1 h-2 w-2 fill-current',
                      getStatusColorClass(selectedSprint.status)
                    )}
                  />
                  {selectedSprint.status}
                </Badge>
              </CardTitle>
              <CardDescription>
                Manage the goal, tasks, and other planning details for this
                sprint.
              </CardDescription>
            </CardHeader>
          )}
          <CardContent className="space-y-6">
            {renderPlanningForm(isFormDisabled)}
          </CardContent>
          <CardFooter className="flex justify-end gap-2 border-t pt-4">
            {isFormDisabled &&
              onBackToOverview && (
                <Button variant="outline" size="sm" onClick={onBackToOverview}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back to Overview
                </Button>
              )}
            {!isFormDisabled && isSprintPlanned && (
              <Button
                onClick={handleStartSprint}
                variant="secondary"
                size="sm"
                className="bg-green-600 text-white hover:bg-green-700"
                disabled={!sprintLimits.canStartNew || isFormDisabled}
                title={
                  !sprintLimits.canStartNew
                    ? 'Another sprint is already active'
                    : 'Start Sprint'
                }
              >
                <PlayCircle className="mr-2 h-4 w-4" /> Start Sprint
              </Button>
            )}
            {!isFormDisabled && isSprintActive && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-blue-600 text-blue-600 hover:bg-blue-50"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" /> Mark as Complete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Complete Sprint {selectedSprint.sprintNumber}?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This action will mark the sprint as 'Completed'. Completed
                      points will be calculated based on tasks marked 'Done'.
                      This cannot be easily undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleCompleteSprintClick}
                      disabled={selectedSprint.status === 'Completed'}
                    >
                      Complete Sprint
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {!isFormDisabled && (
              <Button onClick={handleSaveExistingSprintPlanning}>
                Save Planning
              </Button>
            )}
          </CardFooter>
        </Card>
      )}

      {!isCreatingNewSprint && !selectedSprint && !initialSelectedSprint && (
        <Card className="mt-6">
          <CardContent className="py-8 text-center text-muted-foreground">
            Select a sprint to plan or create a new one.
          </CardContent>
        </Card>
      )}

      <AlertDialog
        open={isCompleteTaskDialogOpen}
        onOpenChange={setIsCompleteTaskDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Complete Task: {completingTaskInfo.task?.ticketNumber}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Select the date this task was completed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="completed-date">Completion Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={'outline'}
                  className={cn(
                    'h-9 w-full justify-start text-left font-normal',
                    !selectedCompletedDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIconLucide className="mr-2 h-4 w-4" />
                  {selectedCompletedDate ? (
                    format(selectedCompletedDate, 'PPP')
                  ) : (
                    <span>Pick a date</span>
                  )}
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
            <AlertDialogCancel
              onClick={() =>
                setCompletingTaskInfo({ task: null, taskType: null })
              }
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCompleteTask}
              disabled={!selectedCompletedDate}
            >
              Confirm Completion
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
