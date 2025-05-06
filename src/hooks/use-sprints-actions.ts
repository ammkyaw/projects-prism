import { useCallback } from 'react';
import type { SprintPlanning, SprintStatus, Project, Task, ToastFun, Sprint, Member, HolidayCalendar, Team } from '@/types/sprint-data';
import { initialSprintPlanning, initialSprintData, taskPriorities } from '@/types/sprint-data';
import { isValid, parseISO, isPast } from 'date-fns';

interface UseSprintsActionsProps {
  selectedProject: Project | null;
  updateProjectData: (updatedProject: Project) => void;
  toast: ToastFun;
  clientNow: Date | null;
  projects: Project[];
  selectedProjectId: string | null;
}

export const useSprintsActions = ({ selectedProject, updateProjectData, toast, clientNow, projects, selectedProjectId }: UseSprintsActionsProps) => {

  // Handler to save planning data AND potentially update sprint status (used by PlanningTab)
  const handleSavePlanningAndUpdateStatus = useCallback((sprintNumber: number, planningData: SprintPlanning, newStatus?: SprintStatus) => {
    if (!selectedProject) {
      toast({ variant: "destructive", title: "Error", description: "No project selected." });
      return;
    }

    const currentProjectName = selectedProject.name; // Capture name
    let statusUpdateMessage = '';
    let otherActiveSprintExists = false;

    const tempSprints = [...(selectedProject.sprintData.sprints ?? [])]; // Handle null/undefined

    // Check if starting this sprint would violate the single active sprint rule
    if (newStatus === 'Active') {
      otherActiveSprintExists = tempSprints.some(s => s.sprintNumber !== sprintNumber && s.status === 'Active');
      if (otherActiveSprintExists) {
        toast({
          variant: "destructive",
          title: "Active Sprint Limit",
          description: `Only one sprint can be active at a time. Another sprint is already active.`,
        });
        return; // Prevent update
      }
    }

    const updatedSprints = tempSprints.map(s => {
      if (s.sprintNumber === sprintNumber) {
        let finalStatus = s.status;
        // Only update status if newStatus is provided and different
        if (newStatus && newStatus !== s.status) {
          finalStatus = newStatus;
          statusUpdateMessage = ` Sprint ${sprintNumber} status updated to ${newStatus}.`;
        } else if (!newStatus && s.status === 'Active' && clientNow && s.endDate && isValid(parseISO(s.endDate)) && isPast(parseISO(s.endDate))) {
          // Auto-complete logic (optional)
        }

        // Ensure task IDs are present and correctly typed before saving
        const validatedPlanning: SprintPlanning = {
          ...planningData,
          newTasks: (planningData.newTasks || []).map(task => ({
            ...task,
            id: task.id || `task_save_new_${Date.now()}_${Math.random()}`,
            qaEstimatedTime: task.qaEstimatedTime ?? '2d', // Default QA time
            bufferTime: task.bufferTime ?? '1d', // Default Buffer time
            backlogId: task.backlogId ?? '', // Ensure backlogId
          })),
          spilloverTasks: (planningData.spilloverTasks || []).map(task => ({
            ...task,
            id: task.id || `task_save_spill_${Date.now()}_${Math.random()}`,
            qaEstimatedTime: task.qaEstimatedTime ?? '2d', // Default QA time
            bufferTime: task.bufferTime ?? '1d', // Default buffer time
            backlogId: task.backlogId ?? '', // Ensure backlogId
          })),
        };

        // Calculate committed points based on saved tasks
        const committedPoints = [...(validatedPlanning.newTasks || []), ...(validatedPlanning.spilloverTasks || [])]
          .reduce((sum, task) => sum + (Number(task.storyPoints) || 0), 0);

        return { ...s, planning: validatedPlanning, status: finalStatus, committedPoints: committedPoints };
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

    updateProjectData(updatedProject); // Update via mutation hook

    // Show success toast if update was successful (mutation handles its own error toasts)
    if (!otherActiveSprintExists) {
      setTimeout(() => {
        toast({ title: "Success", description: `Planning data saved for Sprint ${sprintNumber}.${statusUpdateMessage} in project '${currentProjectName}'` });
      }, 50); // Slight delay
    }

  }, [selectedProject, updateProjectData, toast, clientNow]);


  // Handler to create a new sprint and save its initial planning data (used by PlanningTab)
  const handleCreateAndPlanSprint = useCallback((
    sprintDetails: Omit<Sprint, 'details' | 'planning' | 'status' | 'committedPoints' | 'completedPoints'>,
    planningData: SprintPlanning
  ) => {
    if (!selectedProject) {
      toast({ variant: "destructive", title: "Error", description: "No project selected." });
      return;
    }

    const projectNameForToast = selectedProject.name;
    const currentSprints = selectedProject.sprintData.sprints ?? [];
    const numPlanned = currentSprints.filter(s => s.status === 'Planned').length;
    const numActive = currentSprints.filter(s => s.status === 'Active').length;

    if ((numPlanned >= 2) || (numPlanned >= 1 && numActive >= 1)) {
      toast({
        variant: "destructive",
        title: "Sprint Limit Reached",
        description: "Cannot plan new sprint. Limit is 2 Planned or 1 Planned + 1 Active.",
      });
      return; // Prevent creation
    }

    if (currentSprints.some(s => s.sprintNumber === sprintDetails.sprintNumber)) {
      toast({ variant: "destructive", title: "Error", description: `Sprint number ${sprintDetails.sprintNumber} already exists in project '${projectNameForToast}'.` });
      return;
    }

    // Validate planning data before creating
    const validatedPlanning: SprintPlanning = {
      ...planningData,
      newTasks: (planningData.newTasks || []).map(task => ({
        ...task,
        id: task.id || `task_create_new_${Date.now()}_${Math.random()}`,
        qaEstimatedTime: task.qaEstimatedTime ?? '2d', // Default QA time
        bufferTime: task.bufferTime ?? '1d', // Default buffer time
        backlogId: task.backlogId ?? '', // Ensure backlogId
      })),
      spilloverTasks: (planningData.spilloverTasks || []).map(task => ({
        ...task,
        id: task.id || `task_create_spill_${Date.now()}_${Math.random()}`,
        qaEstimatedTime: task.qaEstimatedTime ?? '2d', // Default QA time
        bufferTime: task.bufferTime ?? '1d', // Default buffer time
        backlogId: task.backlogId ?? '', // Ensure backlogId
      })),
    };

    // Calculate committed points for the new sprint
    const committedPoints = [...(validatedPlanning.newTasks || []), ...(validatedPlanning.spilloverTasks || [])]
      .reduce((sum, task) => sum + (Number(task.storyPoints) || 0), 0);

    const newSprint: Sprint = {
      ...sprintDetails,
      committedPoints: committedPoints, // Set calculated committed points
      completedPoints: 0, // Initialize completed points
      status: 'Planned',
      details: [], // Keep empty
      planning: validatedPlanning,
    };

    const updatedSprints = [...currentSprints, newSprint];
    updatedSprints.sort((a, b) => a.sprintNumber - b.sprintNumber);

    const updatedProject: Project = {
      ...selectedProject,
      sprintData: {
        ...(selectedProject.sprintData ?? initialSprintData),
        sprints: updatedSprints,
        daysInSprint: Math.max(selectedProject.sprintData?.daysInSprint || 0, newSprint.totalDays),
      },
    };

    updateProjectData(updatedProject); // Update via mutation

    // Show success toast (mutation handles errors)
    setTimeout(() => {
      toast({ title: "Success", description: `Sprint ${sprintDetails.sprintNumber} created and planned for project '${projectNameForToast}'.` });
    }, 50);

  }, [selectedProject, updateProjectData, toast]);

  // Handler to complete a sprint
  const handleCompleteSprint = useCallback((sprintNumber: number) => {
    if (!selectedProject) {
      toast({ variant: "destructive", title: "Error", description: "No project selected." });
      return;
    }
    const currentProjectName = selectedProject.name;

    const updatedSprints = selectedProject.sprintData.sprints.map(s => {
      if (s.sprintNumber === sprintNumber && s.status === 'Active') {
        // Calculate completed points based on 'Done' tasks in the current planning state
        const completedPoints = [...(s.planning?.newTasks || []), ...(s.planning?.spilloverTasks || [])]
          .filter(task => task.status === 'Done')
          .reduce((sum, task) => sum + (Number(task.storyPoints) || 0), 0);

        return { ...s, status: 'Completed' as SprintStatus, completedPoints: completedPoints };
      }
      return s;
    });

    const updatedProject: Project = {
      ...selectedProject,
      sprintData: {
        ...selectedProject.sprintData,
        sprints: updatedSprints,
      },
    };

    updateProjectData(updatedProject);
    toast({ title: "Success", description: `Sprint ${sprintNumber} marked as Completed in project '${currentProjectName}'.` });
    // setActiveTab('sprints/summary'); // This state update should remain in page.tsx
  }, [selectedProject, updateProjectData, toast]);


  // Handler to delete a sprint
  const handleDeleteSprint = useCallback((sprintNumber: number) => {
    if (!selectedProject) {
      toast({ variant: "destructive", title: "Error", description: "No project selected." });
      return;
    }
    const currentProjectName = selectedProject.name;
    const filteredSprints = (selectedProject.sprintData.sprints ?? []).filter(s => s.sprintNumber !== sprintNumber);
    const totalPoints = filteredSprints.reduce((sum, s) => sum + s.completedPoints, 0);
    const maxDays = filteredSprints.length > 0 ? Math.max(...filteredSprints.map(s => s.totalDays)) : 0;

    const updatedProject: Project = {
      ...selectedProject,
      sprintData: {
        ...(selectedProject.sprintData ?? initialSprintData),
        sprints: filteredSprints,
        totalStoryPoints: totalPoints, // This calculation might need refinement depending on how totalStoryPoints is used
        daysInSprint: maxDays, // This calculation might need refinement
      },
    };

    updateProjectData(updatedProject);
    toast({ title: "Sprint Deleted", description: `Sprint ${sprintNumber} deleted from project '${currentProjectName}'.` });
  }, [selectedProject, updateProjectData, toast]);

  return {
    handleSavePlanningAndUpdateStatus,
    handleCreateAndPlanSprint,
    handleCompleteSprint,
    handleDeleteSprint,
  };
};

