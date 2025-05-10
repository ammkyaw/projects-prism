import { useCallback } from 'react';
import type {
  SprintPlanning,
  SprintStatus,
  Project,
  Task,
  ToastFun,
  Sprint,
  Member,
  HolidayCalendar,
  Team,
  TaskType,
  SeverityType,
} from '@/types/sprint-data';
import {
  initialSprintPlanning,
  initialSprintData,
  taskPriorities,
  taskStatuses,
  taskTypes,
  severities,
  initialBacklogTask, // Import initialBacklogTask
} from '@/types/sprint-data';
import { isValid, parseISO, isPast } from 'date-fns';
import { generateNextBacklogIdHelper } from '@/lib/utils'; // Import the helper

interface UseSprintsActionsProps {
  selectedProject: Project | null;
  updateProjectData: (updatedProject: Project) => void;
  toast: ToastFun;
  clientNow: Date | null;
  projects: Project[];
  selectedProjectId: string | null;
}

// Helper function to parse estimated time string (e.g., "2d", "1w 3d") into days
const parseEstimatedTimeToDays = (
  timeString: string | undefined | null
): number | null => {
  if (!timeString) return null;
  timeString = timeString.trim().toLowerCase();
  let totalDays = 0;

  const parts = timeString.match(/(\d+w)?\s*(\d+d)?/);
  if (!parts || (parts[1] === undefined && parts[2] === undefined)) {
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
      totalDays += weeks * 5;
    }
  }

  if (dayPart) {
    const days = parseInt(dayPart.replace('d', ''), 10);
    if (!isNaN(days)) {
      totalDays += days;
    }
  }

  if (totalDays === 0 && /^\d+$/.test(timeString)) {
    const simpleDays = parseInt(timeString, 10);
    if (!isNaN(simpleDays) && simpleDays >= 0) {
      return simpleDays;
    }
  }

  return totalDays >= 0
    ? totalDays
    : timeString === '0' || timeString === '0d'
      ? 0
      : null;
};

// Helper function to finalize tasks, ensuring storyPoints are number or null
export const finalizeTasks = (
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
      if (!isNaN(parsed) && parsed >= 0) {
        storyPoints = parsed;
      } else {
        errors.push(
          `${taskPrefix}: Invalid Story Points. Must be a non-negative number.`
        );
      }
    }

    const devEstimatedTime = row.devEstimatedTime?.trim() || null;
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
    const currentTaskType = row.taskType ?? 'New Feature'; // Get task type
    const currentSeverity = row.severity ?? null; // Get severity

    if (!ticketNumber) errors.push(`${taskPrefix}: Ticket # is required.`);
    if (!startDate)
      errors.push(`${taskPrefix}: Start Date is required for timeline.`);
    if (!currentTaskType || !taskTypes.includes(currentTaskType as any)) {
      // Validate task type
      errors.push(`${taskPrefix}: Invalid Task Type.`);
    }
    if (
      currentTaskType === 'Bug' &&
      (!currentSeverity || !severities.includes(currentSeverity))
    ) {
      errors.push(
        `${taskPrefix}: Severity is required and must be valid for Bugs.`
      );
    }

    if (
      devEstimatedTime &&
      parseEstimatedTimeToDays(devEstimatedTime) === null
    ) {
      errors.push(
        `${taskPrefix}: Invalid Dev Est. Time. Use formats like '2d', '1w 3d', '5'.`
      );
    }
    if (qaEstimatedTime && parseEstimatedTimeToDays(qaEstimatedTime) === null) {
      errors.push(
        `${taskPrefix}: Invalid QA Est. Time. Use formats like '2d', '1w 3d', '5'.`
      );
    }
    if (bufferTime && parseEstimatedTimeToDays(bufferTime) === null) {
      errors.push(
        `${taskPrefix}: Invalid Buffer Time. Use formats like '2d', '1w 3d', '5'.`
      );
    }
    if (!status || !taskStatuses.includes(status)) {
      errors.push(`${taskPrefix}: Invalid status.`);
    }
    if (startDate && !isValid(parseISO(startDate)))
      errors.push(`${taskPrefix}: Invalid Start Date format (YYYY-MM-DD).`);
    if (completedDate && !isValid(parseISO(completedDate)))
      errors.push(`${taskPrefix}: Invalid Completed Date format (YYYY-MM-DD).`);

    if (errors.length > 0 && !errors.every(e => e.startsWith(taskPrefix))) return; // Stop processing this row if critical errors found

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

export const useSprintsActions = ({
  selectedProject,
  updateProjectData,
  toast,
  clientNow,
  projects,
  selectedProjectId,
}: UseSprintsActionsProps) => {
  const handleSavePlanningAndUpdateStatus = useCallback(
    (
      sprintNumber: number,
      planningData: SprintPlanning,
      newStatus?: SprintStatus
    ) => {
      if (!selectedProject) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'No project selected.',
        });
        return;
      }

      const currentProjectName = selectedProject.name;
      let statusUpdateMessage = '';
      let otherActiveSprintExists = false;

      const tempSprints = [...(selectedProject.sprintData.sprints ?? [])];

      if (newStatus === 'Active') {
        otherActiveSprintExists = tempSprints.some(
          (s) => s.sprintNumber !== sprintNumber && s.status === 'Active'
        );
        if (otherActiveSprintExists) {
          toast({
            variant: 'destructive',
            title: 'Active Sprint Limit',
            description: `Only one sprint can be active at a time. Sprint ${tempSprints.find(s => s.status === 'Active')?.sprintNumber} is already active.`,
          });
          return;
        }
      }

      const { tasks: finalNewTasks, errors: newErrors } = finalizeTasks(
        planningData.newTasks || [],
        'new',
        sprintNumber
      );
      const { tasks: finalSpilloverTasks, errors: spillErrors } = finalizeTasks(
        planningData.spilloverTasks || [],
        'spillover',
        sprintNumber
      );
      const allErrors = [...newErrors, ...spillErrors];

      if (allErrors.length > 0) {
        toast({
          variant: 'destructive',
          title: 'Validation Error in Tasks',
          description: allErrors.join('\n'),
        });
        return;
      }

      const validatedPlanning: SprintPlanning = {
        ...planningData,
        newTasks: finalNewTasks,
        spilloverTasks: finalSpilloverTasks,
      };

      const updatedSprints = tempSprints.map((s) => {
        if (s.sprintNumber === sprintNumber) {
          let finalStatus = s.status;
          if (newStatus && newStatus !== s.status) {
            finalStatus = newStatus;
            statusUpdateMessage = ` Sprint ${sprintNumber} status updated to ${newStatus}.`;
          }

          const committedPoints = [
            ...(validatedPlanning.newTasks || []),
            ...(validatedPlanning.spilloverTasks || []),
          ].reduce((sum, task) => sum + (Number(task.storyPoints) || 0), 0);

          return {
            ...s,
            planning: validatedPlanning,
            status: finalStatus,
            committedPoints: committedPoints,
          };
        }
        return s;
      });

      const updatedProject: Project = {
        ...selectedProject,
        sprintData: {
          ...(selectedProject.sprintData ?? initialSprintData),
          sprints: updatedSprints,
        },
      };

      updateProjectData(updatedProject);

      if (!otherActiveSprintExists) {
        setTimeout(() => {
          toast({
            title: 'Success',
            description: `Planning data saved for Sprint ${sprintNumber}.${statusUpdateMessage} in project '${currentProjectName}'`,
          });
        }, 50);
      }
    },
    [selectedProject, updateProjectData, toast]
  );

  const handleCreateAndPlanSprint = useCallback(
    (
      sprintDetails: Omit<
        Sprint,
        | 'details'
        | 'planning'
        | 'status'
        | 'committedPoints'
        | 'completedPoints'
      >,
      planningData: SprintPlanning
    ) => {
      if (!selectedProject) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'No project selected.',
        });
        return;
      }

      const projectNameForToast = selectedProject.name;
      const currentSprints = selectedProject.sprintData.sprints ?? [];
      const numPlanned = currentSprints.filter(
        (s) => s.status === 'Planned'
      ).length;
      const numActive = currentSprints.filter(
        (s) => s.status === 'Active'
      ).length;

      if (
        (numActive > 0 && numPlanned >=1) || // 1 active, 1 planned
        (numActive === 0 && numPlanned >=2)    // 0 active, 2 planned
      ) {
        toast({
          variant: 'destructive',
          title: 'Sprint Limit Reached',
          description:
            'Cannot plan new sprint. Limit is 2 Planned (if no active) or 1 Planned + 1 Active.',
        });
        return;
      }


      if (
        currentSprints.some(
          (s) => s.sprintNumber === sprintDetails.sprintNumber
        )
      ) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: `Sprint number ${sprintDetails.sprintNumber} already exists in project '${projectNameForToast}'.`,
        });
        return;
      }

      const { tasks: finalNewTasks, errors: newErrors } = finalizeTasks(
        planningData.newTasks || [],
        'new',
        sprintDetails.sprintNumber
      );
      const { tasks: finalSpilloverTasks, errors: spillErrors } = finalizeTasks(
        planningData.spilloverTasks || [],
        'spillover',
        sprintDetails.sprintNumber
      );
      const allTaskErrors = [...newErrors, ...spillErrors];

      if (allTaskErrors.length > 0) {
        toast({
          variant: 'destructive',
          title: 'Validation Error in Tasks',
          description: allTaskErrors.join('\n'),
        });
        return;
      }

      const validatedPlanning: SprintPlanning = {
        ...planningData,
        newTasks: finalNewTasks,
        spilloverTasks: finalSpilloverTasks,
      };

      const committedPoints = [
        ...(validatedPlanning.newTasks || []),
        ...(validatedPlanning.spilloverTasks || []),
      ].reduce((sum, task) => sum + (Number(task.storyPoints) || 0), 0);

      const newSprint: Sprint = {
        ...sprintDetails,
        committedPoints: committedPoints,
        completedPoints: 0,
        status: 'Planned',
        details: [],
        planning: validatedPlanning,
      };

      const updatedSprints = [...currentSprints, newSprint];
      updatedSprints.sort((a, b) => a.sprintNumber - b.sprintNumber);

      const updatedProject: Project = {
        ...selectedProject,
        sprintData: {
          ...(selectedProject.sprintData ?? initialSprintData),
          sprints: updatedSprints,
          daysInSprint: Math.max(
            selectedProject.sprintData?.daysInSprint || 0,
            newSprint.totalDays
          ),
        },
      };

      updateProjectData(updatedProject);

      setTimeout(() => {
        toast({
          title: 'Success',
          description: `Sprint ${sprintDetails.sprintNumber} created and planned for project '${projectNameForToast}'.`,
        });
      }, 50);
    },
    [selectedProject, updateProjectData, toast]
  );

  const handleCompleteSprint = useCallback(
    (sprintNumber: number, latestPlanning: SprintPlanning) => {
      if (!selectedProject) {
        toast({ variant: 'destructive', title: 'Error', description: 'No project selected.' });
        return;
      }
      const currentProjectName = selectedProject.name;
      const sprintToComplete = selectedProject.sprintData.sprints.find(s => s.sprintNumber === sprintNumber);

      if (!sprintToComplete || sprintToComplete.status !== 'Active') {
        toast({ variant: 'destructive', title: 'Error', description: "Only 'Active' sprints can be completed." });
        return;
      }

      const allTasksInCompletedSprint = [
        ...(latestPlanning.newTasks || []),
        ...(latestPlanning.spilloverTasks || []),
      ];

      const doneTasks = allTasksInCompletedSprint.filter(task => task.status === 'Done');
      const undoneTasksOriginal = allTasksInCompletedSprint.filter(task => task.status !== 'Done');
      const completedPoints = doneTasks.reduce((sum, task) => sum + (Number(task.storyPoints) || 0), 0);

      let updatedSprints = [...selectedProject.sprintData.sprints];
      let updatedBacklog = [...(selectedProject.backlog || [])];
      let spilloverMessage = "";

      const currentSprintIndex = updatedSprints.findIndex(s => s.sprintNumber === sprintNumber);

      if (undoneTasksOriginal.length > 0) {
        const nextSprintNumberVal = sprintNumber + 1;
        const nextSprintIndex = updatedSprints.findIndex(s => s.sprintNumber === nextSprintNumberVal);

        const tasksToMoveOrRevert = undoneTasksOriginal.map(task => ({
          ...task,
          id: task.backlogId ? task.id : `spill_${task.id}_${Date.now()}`, // Preserve ID if from backlog, new ID for spill context
          status: 'To Do' as Task['status'],
          startDate: null,
          completedDate: null,
        }));

        if (nextSprintIndex !== -1 && (updatedSprints[nextSprintIndex].status === 'Planned' || updatedSprints[nextSprintIndex].status === 'Active')) {
          const nextSprint = { ...updatedSprints[nextSprintIndex] };
          nextSprint.planning = {
            ...(nextSprint.planning || initialSprintPlanning),
            spilloverTasks: [
              ...(nextSprint.planning?.spilloverTasks || []),
              ...tasksToMoveOrRevert,
            ],
          };
          updatedSprints[nextSprintIndex] = nextSprint;
          spilloverMessage = `${undoneTasksOriginal.length} undone task(s) moved to Sprint ${nextSprintNumberVal} as spillover.`;
        } else {
          const tasksForBacklog: Task[] = [];
          tasksToMoveOrRevert.forEach(task => {
            if (task.backlogId) {
              const backlogItemIndex = updatedBacklog.findIndex(b => b.backlogId === task.backlogId && b.movedToSprint === sprintNumber);
              if (backlogItemIndex !== -1) {
                updatedBacklog[backlogItemIndex] = {
                  ...updatedBacklog[backlogItemIndex],
                  movedToSprint: null,
                  historyStatus: null,
                  needsGrooming: true,
                  readyForSprint: false,
                };
              } else {
                // If original backlog item not found (e.g., it was a spillover task itself), create new backlog item
                tasksForBacklog.push({
                  ...initialBacklogTask,
                  ...task,
                  id: `reverted_backlog_${task.id}_${Date.now()}`,
                  backlogId: generateNextBacklogIdHelper([...updatedBacklog, ...tasksForBacklog]),
                  status: null, movedToSprint: null, historyStatus: null, needsGrooming: true, readyForSprint: false, startDate: null, completedDate: null,
                });
              }
            } else {
              // Task created directly in sprint, create new backlog item
              tasksForBacklog.push({
                ...initialBacklogTask,
                ...task,
                id: `reverted_backlog_${task.id}_${Date.now()}`,
                backlogId: generateNextBacklogIdHelper([...updatedBacklog, ...tasksForBacklog]),
                status: null, movedToSprint: null, historyStatus: null, needsGrooming: true, readyForSprint: false, startDate: null, completedDate: null,
              });
            }
          });
          if (tasksForBacklog.length > 0) {
            updatedBacklog.push(...tasksForBacklog);
          }
          updatedBacklog.sort((a, b) => taskPriorities.indexOf(a.priority!) - taskPriorities.indexOf(b.priority!) || (a.backlogId ?? '').localeCompare(b.backlogId ?? ''));
          spilloverMessage = `${undoneTasksOriginal.length} undone task(s) moved to the project backlog.`;
        }
      }

      // Update the completed sprint status and its planning data (only done tasks)
      updatedSprints[currentSprintIndex] = {
        ...sprintToComplete,
        status: 'Completed' as SprintStatus,
        completedPoints: completedPoints,
        planning: {
          ...latestPlanning,
          newTasks: latestPlanning.newTasks?.filter(t => t.status === 'Done') || [],
          spilloverTasks: latestPlanning.spilloverTasks?.filter(t => t.status === 'Done') || [],
        },
      };

      const updatedProject: Project = {
        ...selectedProject,
        backlog: updatedBacklog,
        sprintData: {
          ...selectedProject.sprintData,
          sprints: updatedSprints,
        },
      };

      updateProjectData(updatedProject);
      toast({
        title: 'Success',
        description: `Sprint ${sprintNumber} marked as Completed. ${spilloverMessage}`,
        duration: 7000, // Longer duration for more info
      });
    },
    [selectedProject, updateProjectData, toast]
  );


  const handleDeleteSprint = useCallback(
    (sprintNumber: number) => {
      if (!selectedProject) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'No project selected.',
        });
        return;
      }
      const currentProjectName = selectedProject.name;
      const filteredSprints = (selectedProject.sprintData.sprints ?? []).filter(
        (s) => s.sprintNumber !== sprintNumber
      );

      const updatedProject: Project = {
        ...selectedProject,
        sprintData: {
          ...(selectedProject.sprintData ?? initialSprintData),
          sprints: filteredSprints,
        },
      };
      // Recalculate totalStoryPoints and daysInSprint based on remaining sprints
      const totalPoints = updatedProject.sprintData.sprints.reduce(
        (sum, s) => sum + (s.completedPoints || 0),
        0
      );
      const maxDays =
        updatedProject.sprintData.sprints.length > 0
          ? Math.max(
              ...updatedProject.sprintData.sprints.map((s) => s.totalDays || 0)
            )
          : 0;

      updatedProject.sprintData.totalStoryPoints = totalPoints;
      updatedProject.sprintData.daysInSprint = maxDays;

      updateProjectData(updatedProject);
      toast({
        title: 'Sprint Deleted',
        description: `Sprint ${sprintNumber} deleted from project '${currentProjectName}'.`,
      });
    },
    [selectedProject, updateProjectData, toast]
  );

  return {
    handleSavePlanningAndUpdateStatus,
    handleCreateAndPlanSprint,
    handleCompleteSprint,
    handleDeleteSprint,
  };
};
