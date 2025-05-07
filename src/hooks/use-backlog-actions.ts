
import { useCallback } from 'react';
import type { Project, Task, ToastFun, HistoryStatus, Sprint } from '@/types/sprint-data';
import { initialSprintPlanning, taskPriorities, initialBacklogTask } from '@/types/sprint-data'; // Add initialBacklogTask
import { useToast } from '@/hooks/use-toast'; // Assuming toast is from this hook
import { useProjects } from '@/hooks/use-projects'; // Assuming projects data is from this hook

interface UseBacklogActionsProps {
  selectedProject: Project | null;
  updateProjectData: (updatedProject: Project) => void;
  toast: ToastFun;
  projects: Project[];
  selectedProjectId: string | null;
}

export const useBacklogActions = ({
  selectedProject,
  updateProjectData,
  toast,
  projects,
  selectedProjectId,
}: UseBacklogActionsProps) => {

  // Handler to save NEW backlog items (from the new items table)
  const handleSaveNewBacklogItems = useCallback((newItems: Task[]) => {
      if (!selectedProject) {
          toast({ variant: "destructive", title: "Error", description: "No project selected." });
          return;
      }
      const existingBacklog = selectedProject.backlog ?? [];
      // Assign persistent IDs to new items before adding (using a temporary approach)
      const itemsWithIds = newItems.map((item, index) => ({
          ...item,
          id: item.id || `backlog_${selectedProject.id}_${Date.now()}_${index}`, // Generate ID if missing
      }));
      const updatedBacklog = [...existingBacklog, ...itemsWithIds];
      updatedBacklog.sort((a, b) => (taskPriorities.indexOf(a.priority!) - taskPriorities.indexOf(b.priority!)) || (a.backlogId ?? '').localeCompare(b.backlogId ?? ''));

      const updatedProject: Project = { ...selectedProject, backlog: updatedBacklog };
      updateProjectData(updatedProject);
      // Toast handled in BacklogTab save function
  }, [selectedProject, updateProjectData, toast]);

  // Handler to update a specific SAVED backlog item
   const handleUpdateSavedBacklogItem = useCallback((updatedItem: Task) => {
      if (!selectedProject) {
          toast({ variant: "destructive", title: "Error", description: "No project selected." });
          return;
      }
      const updatedBacklog = (selectedProject.backlog ?? []).map(item => item.id === updatedItem.id ? updatedItem : item);
      const updatedProject: Project = { ...selectedProject, backlog: updatedBacklog };
      updateProjectData(updatedProject);
      // Optional: Add success toast
   }, [selectedProject, updateProjectData, toast]);


  // Handler to move a backlog item to a sprint (potentially from backlog management tab)
  const handleMoveToSprint = useCallback((backlogItemId: string, targetSprintNumber: number) => {
    if (!selectedProject) {
      toast({ variant: "destructive", title: "Error", description: "No project selected." });
      return;
    }
    const currentProjectName = selectedProject.name;
    let movedItemDetails: string | null = null;

    const backlogItemIndex = (selectedProject.backlog ?? []).findIndex(item => item.id === backlogItemId);
    if (backlogItemIndex === -1) {
      console.error("Backlog item not found:", backlogItemId);
      toast({ variant: "destructive", title: "Error", description: "Backlog item not found." });
      return;
    }
    const backlogItem = selectedProject.backlog![backlogItemIndex];
    movedItemDetails = `${backlogItem.backlogId} (${backlogItem.title || 'No Title'})`;

    const targetSprintIndex = (selectedProject.sprintData.sprints ?? []).findIndex(s => s.sprintNumber === targetSprintNumber);
    if (targetSprintIndex === -1) {
      console.error("Target sprint not found:", targetSprintNumber);
      toast({ variant: "destructive", title: "Error", description: "Target sprint not found." });
      return;
    }

    // Create the task for the sprint
    const sprintTask: Task = {
      ...initialBacklogTask,
      ...backlogItem,
      id: `sprint_task_${backlogItem.id}_${Date.now()}`, // Ensure a new unique ID for the sprint task instance
      status: 'To Do',
      startDate: null, // Will be planned in the sprint
      movedToSprint: null, // This field is for backlog item history
      historyStatus: null, // This field is for backlog item history
      needsGrooming: false, // Assuming item is ready if added to sprint
    };

    // Update item in backlog to mark it as moved
    const updatedBacklog = selectedProject.backlog!.map((item, index) =>
      index === backlogItemIndex
        ? { ...item, movedToSprint: targetSprintNumber, historyStatus: 'Move' as HistoryStatus }
        : item
    );

    // Add item to the target sprint's newTasks
    const updatedSprints = [...selectedProject.sprintData.sprints];
    const targetSprint = updatedSprints[targetSprintIndex];
    const updatedPlanning = {
      ...(targetSprint.planning ?? initialSprintPlanning),
      newTasks: [...(targetSprint.planning?.newTasks ?? []), sprintTask],
    };
    updatedSprints[targetSprintIndex] = { ...targetSprint, planning: updatedPlanning };

    const updatedProject: Project = {
      ...selectedProject,
      backlog: updatedBacklog,
      sprintData: {
        ...selectedProject.sprintData,
        sprints: updatedSprints,
      }
    };

    updateProjectData(updatedProject);

    if (movedItemDetails) {
      toast({ title: "Item Moved", description: `Backlog item '${movedItemDetails}' moved to Sprint ${targetSprintNumber}. Marked in backlog history.` });
    }
  }, [selectedProject, updateProjectData, toast]);


  // Updated function to handle moving multiple selected backlog items to a sprint plan
  // This now ALSO updates the main project state and returns the tasks for the sprint plan.
  const handleMoveSelectedBacklogItemsToSprint = useCallback((
    backlogItemIds: string[],
    targetSprintNumber: number
  ): Task[] => { // Returns the tasks to be added to the sprint plan
    if (!selectedProject) {
      toast({ variant: "destructive", title: "Error", description: "No project selected." });
      return [];
    }
     const targetSprintIndex = (selectedProject.sprintData.sprints ?? []).findIndex(s => s.sprintNumber === targetSprintNumber);
     if (targetSprintIndex === -1) {
       toast({ variant: "destructive", title: "Error", description: `Target Sprint ${targetSprintNumber} not found.` });
       return [];
     }

    const tasksForSprintPlan: Task[] = [];
    let updatedBacklog = [...(selectedProject.backlog ?? [])];
    let itemsMovedDetails: string[] = [];

    backlogItemIds.forEach(itemId => {
      const itemIndex = updatedBacklog.findIndex(item => item.id === itemId);
      if (itemIndex !== -1) {
        const originalItem = updatedBacklog[itemIndex];

        // Ensure it's not already moved or historical
        if (originalItem.movedToSprint || originalItem.historyStatus) {
            console.warn(`Item ${originalItem.backlogId} already processed or in history, skipping move.`);
            return; // Skip this item
        }

        itemsMovedDetails.push(`${originalItem.backlogId} (${originalItem.title || 'No Title'})`);

        // 1. Mark the original backlog item as moved
        updatedBacklog[itemIndex] = {
          ...originalItem,
          movedToSprint: targetSprintNumber,
          historyStatus: 'Move' as HistoryStatus, // Mark as moved
          readyForSprint: false, // Item is no longer "ready" in the backlog view
          needsGrooming: false, // Moved items don't need backlog grooming
        };

        // 2. Create a new task object for the sprint plan
        const sprintTask: Task = {
          ...initialBacklogTask, // Start with defaults to ensure all Task fields are present
          ...originalItem,       // Spread original item details
          id: `sprint_task_instance_${originalItem.id}_${Date.now()}`, // New unique ID for the SPRINT TASK instance
          status: 'To Do',         // Default status for new sprint tasks
          startDate: null,         // Needs to be planned within the sprint
          completedDate: null,
          // Estimates can be carried over or reset based on preference
          devEstimatedTime: originalItem.devEstimatedTime ?? '',
          qaEstimatedTime: originalItem.qaEstimatedTime ?? '2d', // Default if not set
          bufferTime: originalItem.bufferTime ?? '1d',     // Default if not set
          // Ensure history/move fields are reset for the sprint task context
          movedToSprint: null,
          historyStatus: null,
          needsGrooming: false,    // Item is being planned, so grooming is done/not applicable here
          readyForSprint: true,    // Implicitly true by being added to sprint plan
          splitFromId: null,       // Reset split/merge info for the new sprint task instance
          mergeEventId: null,
          // Carry over other relevant fields
          title: originalItem.title,
          description: originalItem.description,
          acceptanceCriteria: originalItem.acceptanceCriteria,
          storyPoints: originalItem.storyPoints,
          priority: originalItem.priority,
          taskType: originalItem.taskType,
          createdDate: originalItem.createdDate,
          initiator: originalItem.initiator,
          dependsOn: originalItem.dependsOn,
          backlogId: originalItem.backlogId, // Carry over the original backlog ID for reference
          ticketNumber: originalItem.ticketNumber // Carry over ticket number
        };
        tasksForSprintPlan.push(sprintTask);
      } else {
        console.warn(`Backlog item with ID ${itemId} not found during move from backlog to sprint plan.`);
      }
    });

    if (tasksForSprintPlan.length === 0 && backlogItemIds.length > 0) {
        toast({ variant: "warning", title: "No New Items Moved", description: "Selected items might have already been processed or were not found in the active backlog." });
        return [];
    }

    // Update the target sprint's newTasks
    const updatedSprints = [...selectedProject.sprintData.sprints];
    const targetSprint = updatedSprints[targetSprintIndex];
    const updatedPlanning = {
        ...(targetSprint.planning ?? initialSprintPlanning),
        newTasks: [...(targetSprint.planning?.newTasks ?? []), ...tasksForSprintPlan], // Add the newly created tasks
    };
    updatedSprints[targetSprintIndex] = { ...targetSprint, planning: updatedPlanning };

    const finalBacklog = updatedBacklog.sort((a,b) => taskPriorities.indexOf(a.priority!) - taskPriorities.indexOf(b.priority!) || (a.backlogId ?? '').localeCompare(b.backlogId ?? ''));

    const updatedProjectDataState: Project = {
      ...selectedProject,
      backlog: finalBacklog, // Update the backlog with moved items marked
      sprintData: {
          ...selectedProject.sprintData,
          sprints: updatedSprints // Update the sprints array with new tasks added to the target sprint
      }
    };

    updateProjectData(updatedProjectDataState); // Persist changes to backlog AND sprint planning

    if (itemsMovedDetails.length > 0) {
        toast({
            title: "Items Added to Sprint Plan",
            description: `${itemsMovedDetails.length} item(s) added to Sprint ${targetSprintNumber} plan. Original items marked in backlog history.`
        });
    }

    return tasksForSprintPlan; // Return the tasks added to the sprint plan
  }, [selectedProject, updateProjectData, toast]);


  // Handler to revert a task from sprint planning back to the backlog
  const handleRevertTaskToBacklog = useCallback((sprintNumber: number, taskId: string, taskBacklogId: string | null) => {
    if (!selectedProject) {
      toast({ variant: "destructive", title: "Error", description: "No project selected." });
      return;
    }

    let revertedTaskDetails: string | null = null;
    let updatePerformed = false; // Track if an update actually happened

    const showToast = (options: any) => setTimeout(() => toast(options), 0);


    const currentProject = { ...selectedProject }; // Clone to modify

    let foundAndRemovedFromSprint = false;
    let taskToRemoveDetails: Partial<Task> = {};

    // Find the task in the specified sprint's planning.newTasks or spilloverTasks
    let targetSprintIndex = currentProject.sprintData.sprints.findIndex(s => s.sprintNumber === sprintNumber);
    if (targetSprintIndex === -1) {
      console.warn(`Sprint ${sprintNumber} not found for reverting task.`);
      showToast({ variant: "warning", title: "Sprint Not Found", description: `Could not find Sprint ${sprintNumber}.` });
      return;
    }

    let targetSprint = { ...currentProject.sprintData.sprints[targetSprintIndex] }; // Clone sprint
    let updatedNewTasks = [...(targetSprint.planning?.newTasks || [])];
    let updatedSpilloverTasks = [...(targetSprint.planning?.spilloverTasks || [])];

    let taskIndexInNew = updatedNewTasks.findIndex(t => t.id === taskId);
    if (taskIndexInNew !== -1) {
      const taskToRemove = updatedNewTasks[taskIndexInNew];
      taskToRemoveDetails = { ...taskToRemove };
      revertedTaskDetails = `${taskToRemove.backlogId || taskToRemove.ticketNumber} (${taskToRemove.title || 'No Title'})`;
      foundAndRemovedFromSprint = true;
      updatedNewTasks.splice(taskIndexInNew, 1);
    } else {
      let taskIndexInSpillover = updatedSpilloverTasks.findIndex(t => t.id === taskId);
      if (taskIndexInSpillover !== -1) {
        const taskToRemove = updatedSpilloverTasks[taskIndexInSpillover];
        taskToRemoveDetails = { ...taskToRemove };
        revertedTaskDetails = `${taskToRemove.backlogId || taskToRemove.ticketNumber} (${taskToRemove.title || 'No Title'})`;
        foundAndRemovedFromSprint = true;
        updatedSpilloverTasks.splice(taskIndexInSpillover, 1);
      } else {
        console.warn(`Task ID ${taskId} not found in Sprint ${sprintNumber} planning (new or spillover).`);
        showToast({ variant: "warning", title: "Task Not Found in Sprint", description: `Could not find task ID ${taskId} in Sprint ${sprintNumber} planning.` });
        return;
      }
    }

    targetSprint.planning = {
      ...(targetSprint.planning || initialSprintPlanning),
      newTasks: updatedNewTasks,
      spilloverTasks: updatedSpilloverTasks,
    };
    const updatedSprints = [...currentProject.sprintData.sprints];
    updatedSprints[targetSprintIndex] = targetSprint;

    // Find the corresponding item in the backlog (must match backlogId) and reset its status
    const updatedBacklog = (currentProject.backlog || []).map(item => {
      if (taskBacklogId && item.backlogId === taskBacklogId && item.movedToSprint === sprintNumber && item.historyStatus === 'Move') {
        updatePerformed = true;
        return { ...item, movedToSprint: null, historyStatus: null, readyForSprint: false }; // Reset flags
      }
      return item;
    });

    if (!updatePerformed) {
      console.warn(`Could not find corresponding original backlog item for task ${revertedTaskDetails} (Backlog ID: ${taskBacklogId}) that was marked as moved to sprint ${sprintNumber}. Task removed from sprint only.`);
      showToast({ variant: "warning", title: "Task Removed from Sprint", description: `Task '${revertedTaskDetails}' removed from Sprint ${sprintNumber}. Its original backlog item was not found or not marked as 'Moved'.` });
    } else {
      showToast({ title: "Task Reverted to Backlog", description: `Task '${revertedTaskDetails}' removed from Sprint ${sprintNumber} and restored to the active backlog.` });
    }

    const finalUpdatedProject: Project = {
      ...currentProject,
      backlog: updatedBacklog.sort((a, b) => taskPriorities.indexOf(a.priority!) - taskPriorities.indexOf(b.priority!) || (a.backlogId ?? '').localeCompare(b.backlogId ?? '')),
      sprintData: {
        ...currentProject.sprintData,
        sprints: updatedSprints,
      }
    };
    updateProjectData(finalUpdatedProject);
  }, [selectedProject, updateProjectData, toast]);


  // Handler to split a backlog item
  const handleSplitBacklogItem = useCallback((originalTaskId: string, splitTasks: Task[]) => {
    if (!selectedProject) {
      toast({ variant: "destructive", title: "Error", description: "No project selected." });
      return;
    }

    let originalTaskDetails: string | null = null;
    let newIds: string[] = [];

    const originalBacklogIndex = (selectedProject.backlog ?? []).findIndex(item => item.id === originalTaskId);
    if (originalBacklogIndex === -1) {
      console.error("Original backlog item not found for splitting:", originalTaskId);
      toast({ variant: "destructive", title: "Error", description: "Original item not found." });
      return;
    }

    const originalItem = selectedProject.backlog![originalBacklogIndex];
    originalTaskDetails = `${originalItem.backlogId} (${originalItem.title || 'No Title'})`;

    // 1. Mark the original item with 'Split' status in history
    const markedOriginalItem = {
      ...originalItem,
      historyStatus: 'Split' as HistoryStatus,
      movedToSprint: null, // Ensure it's not marked as moved
      splitFromId: null, // Original item does not split from itself
      readyForSprint: false, // Original item is no longer active
      needsGrooming: false, // Original item is historical
    };

    // 2. Prepare new split tasks with unique IDs and backlog IDs
    const newSplitTasksWithIds = splitTasks.map((task, index) => {
      const newId = `split_instance_${originalItem.id}_${task.backlogId}_${Date.now()}`; // Ensure unique persistent ID for the new instance

      return {
        ...initialBacklogTask, // Ensure all fields are present
        ...task,
        id: newId,
        // backlogId and ticketNumber are already set in SplitDialog
        needsGrooming: true, // Newly split items need grooming
        readyForSprint: false,
        splitFromId: originalItem.id, // Link back to the original task ID
        movedToSprint: null,
        historyStatus: null,
      };
    });

    newIds = newSplitTasksWithIds.map(t => t.backlogId || t.id);

    // 3. Update the backlog array: Replace original with historical, add new splits
    let updatedBacklog = selectedProject.backlog ? [...selectedProject.backlog] : [];
    updatedBacklog[originalBacklogIndex] = markedOriginalItem; // Replace original
    updatedBacklog.push(...newSplitTasksWithIds); // Add new split items

    const finalBacklog = updatedBacklog.sort((a, b) => (taskPriorities.indexOf(a.priority!) - taskPriorities.indexOf(b.priority!)) || (a.backlogId ?? '').localeCompare(b.backlogId ?? ''));


    const updatedProject: Project = {
      ...selectedProject,
      backlog: finalBacklog,
    };

    updateProjectData(updatedProject);

    if (originalTaskDetails) {
      toast({
        title: "Item Split",
        description: `Backlog item '${originalTaskDetails}' marked as Split. New items added: ${newIds.join(', ')}.`,
        duration: 5000,
      });
    }
  }, [selectedProject, updateProjectData, toast]);


  // Handler to delete a specific SAVED backlog item
   const handleDeleteSavedBacklogItem = useCallback((itemId: string) => {
      if (!selectedProject) {
          toast({ variant: "destructive", title: "Error", description: "No project selected." });
          return;
      }
      const itemToDelete = (selectedProject.backlog ?? []).find(item => item.id === itemId);
      if (!itemToDelete) {
          toast({ variant: "destructive", title: "Error", description: "Item not found for deletion." });
          return;
      }
      // Instead of filtering, mark as historical with a "Deleted" like status or simply remove if truly permanent
      // For now, let's assume permanent deletion of active items. Historical items should not be deleted this way.
      if (itemToDelete.historyStatus || itemToDelete.movedToSprint) {
          toast({ variant: "warning", title: "Cannot Delete", description: "Historical or moved items cannot be deleted from here. Manage them in History or Sprint." });
          return;
      }

      const updatedBacklog = (selectedProject.backlog ?? []).filter(item => item.id !== itemId);
      const updatedProject: Project = { ...selectedProject, backlog: updatedBacklog };
      updateProjectData(updatedProject);
      toast({ title: "Backlog Item Deleted", description: `Item '${itemToDelete.backlogId}' has been removed.` });
   }, [selectedProject, updateProjectData, toast]);


   // Handler to merge backlog items
   const handleMergeBacklogItems = useCallback((taskIdsToMerge: string[], mergedTask: Task) => {
      if (!selectedProject) {
        toast({ variant: "destructive", title: "Error", description: "No project selected." });
        return;
      }
      if (taskIdsToMerge.length < 2) {
         toast({ variant: "destructive", title: "Error", description: "At least two items must be selected for merging." });
         return;
      }

      const mergeEventId = `merge_evt_${Date.now()}`; // Unique ID for this merge operation
      let mergedItemDetails: string[] = [];

      let currentBacklog = [...(selectedProject.backlog ?? [])];
      const itemsToMarkHistorical: Task[] = [];
      const activeBacklogAfterProcessing: Task[] = [];


      currentBacklog.forEach(item => {
          if (taskIdsToMerge.includes(item.id)) {
              if (item.historyStatus || item.movedToSprint) {
                  // This should ideally be prevented by the dialog UI, but double-check
                  console.warn(`Item ${item.backlogId} is already historical or moved, cannot merge.`);
                  activeBacklogAfterProcessing.push(item); // Keep it as is
                  return;
              }
              mergedItemDetails.push(`${item.backlogId} (${item.title || 'No Title'})`);
              itemsToMarkHistorical.push({
                  ...item,
                  historyStatus: 'Merge' as HistoryStatus,
                  movedToSprint: null, // Ensure not marked as moved
                  mergeEventId: mergeEventId, // Link to the merge event
                  readyForSprint: false, // Original item is no longer active
                  needsGrooming: false, // Original item is historical
              });
          } else {
              activeBacklogAfterProcessing.push(item); // Keep non-merged items
          }
      });

      if (itemsToMarkHistorical.length < 2) {
        toast({ variant: "destructive", title: "Merge Error", description: "Not enough valid items selected for merging." });
        return;
      }


      const newMergedTaskWithDetails: Task = {
         ...initialBacklogTask, // Base defaults
         ...mergedTask, // User-provided details for the new task
         id: `merged_item_${mergeEventId}_${Date.now()}`, // Unique ID for the new merged item
         // backlogId and ticketNumber should be set by the MergeDialog based on suffix logic
         needsGrooming: true, // New merged item needs grooming
         readyForSprint: false,
         mergeEventId: mergeEventId, // Link the new item to the same merge event
         movedToSprint: null,
         historyStatus: null,
      };

       const finalBacklog = [
          ...activeBacklogAfterProcessing, // Items not part of the merge
          newMergedTaskWithDetails,        // The new merged item
          ...itemsToMarkHistorical         // Original items now marked as historical
       ];

      const updatedProject: Project = {
          ...selectedProject,
          backlog: finalBacklog.sort((a, b) => (taskPriorities.indexOf(a.priority!) - taskPriorities.indexOf(b.priority!)) || (a.backlogId ?? '').localeCompare(b.backlogId ?? '')),
      };

      updateProjectData(updatedProject);

      toast({
          title: "Items Merged",
          description: `Items [${mergedItemDetails.join(', ')}] marked as Merged. New item '${newMergedTaskWithDetails.title}' created.`,
          duration: 7000,
      });

   }, [selectedProject, updateProjectData, toast]);

   // Handler to undo a backlog action (Split/Merge)
    const handleUndoBacklogAction = useCallback((itemWithHistoryId: string) => {
        if (!selectedProject) {
            toast({ variant: "destructive", title: "Error", description: "No project selected." });
            return;
        }

        let actionUndone = false;
        let message = "Could not complete undo action.";

        const itemTriggeringUndo = (selectedProject.backlog || []).find(item => item.id === itemWithHistoryId);

        if (!itemTriggeringUndo) {
            toast({ variant: "destructive", title: "Error", description: "Item to undo not found." });
            return;
        }

        let updatedBacklog = [...(selectedProject.backlog || [])];

        if (itemTriggeringUndo.historyStatus === 'Split') {
            // This is the original item that was split. We need to find its children.
            const splitChildren = updatedBacklog.filter(task => task.splitFromId === itemTriggeringUndo.id);
            if (splitChildren.length > 0) {
                // Remove children, restore original
                updatedBacklog = updatedBacklog.filter(task => task.splitFromId !== itemTriggeringUndo.id); // Remove children
                const originalIndex = updatedBacklog.findIndex(task => task.id === itemTriggeringUndo.id);
                if (originalIndex !== -1) {
                    updatedBacklog[originalIndex] = {
                        ...updatedBacklog[originalIndex],
                        historyStatus: null,
                        splitFromId: null,
                        needsGrooming: true, // Might need regrooming
                    };
                    actionUndone = true;
                    message = `Split undone for '${itemTriggeringUndo.backlogId}'. Child items removed.`;
                }
            } else {
                message = `Cannot undo split for '${itemTriggeringUndo.backlogId}': Split items not found.`;
            }
        } else if (itemTriggeringUndo.splitFromId) {
            // This is one of the split children. We need to find the original and other children.
            const originalSplitItemId = itemTriggeringUndo.splitFromId;
            const originalItemIndex = updatedBacklog.findIndex(task => task.id === originalSplitItemId && task.historyStatus === 'Split');

            if (originalItemIndex !== -1) {
                const originalItem = updatedBacklog[originalItemIndex];
                // Remove all children of this split
                updatedBacklog = updatedBacklog.filter(task => task.splitFromId !== originalSplitItemId);
                // Restore original
                updatedBacklog[originalItemIndex] = {
                    ...originalItem,
                    historyStatus: null,
                    splitFromId: null,
                    needsGrooming: true,
                };
                actionUndone = true;
                message = `Split undone for original item '${originalItem.backlogId}'. Child items removed.`;
            } else {
                 message = `Cannot undo split for '${itemTriggeringUndo.backlogId}': Original split item not found.`;
            }
        } else if (itemTriggeringUndo.historyStatus === 'Merge') {
            // This is one of the original items that was merged. We need to find the resulting merged item and other originals.
            const eventId = itemTriggeringUndo.mergeEventId;
            if (eventId) {
                const itemsFromMergeEvent = updatedBacklog.filter(task => task.mergeEventId === eventId);
                const resultingMergedItem = itemsFromMergeEvent.find(task => !task.historyStatus); // The one that is NOT historical
                const originalMergedItems = itemsFromMergeEvent.filter(task => task.historyStatus === 'Merge');

                if (resultingMergedItem && originalMergedItems.length > 0) {
                    // Remove the resulting merged item
                    updatedBacklog = updatedBacklog.filter(task => task.id !== resultingMergedItem.id);
                    // Restore original items
                    updatedBacklog = updatedBacklog.map(task => {
                        if (originalMergedItems.some(orig => orig.id === task.id)) {
                            return { ...task, historyStatus: null, mergeEventId: null, needsGrooming: true };
                        }
                        return task;
                    });
                    actionUndone = true;
                    message = `Merge undone. Event ID '${eventId}'. Items restored.`;
                } else {
                     message = `Cannot undo merge for event '${eventId}': Resulting or original items not found.`;
                }
            } else {
                 message = `Cannot undo merge for '${itemTriggeringUndo.backlogId}': Merge event ID missing.`;
            }
        } else if (itemTriggeringUndo.mergeEventId && !itemTriggeringUndo.historyStatus) {
             // This is the resulting merged item. We need to find the originals.
             const eventId = itemTriggeringUndo.mergeEventId;
             const originalMergedItems = updatedBacklog.filter(task => task.mergeEventId === eventId && task.historyStatus === 'Merge');

             if (originalMergedItems.length > 0) {
                 // Remove this resulting merged item
                 updatedBacklog = updatedBacklog.filter(task => task.id !== itemTriggeringUndo.id);
                 // Restore originals
                 updatedBacklog = updatedBacklog.map(task => {
                     if (originalMergedItems.some(orig => orig.id === task.id)) {
                         return { ...task, historyStatus: null, mergeEventId: null, needsGrooming: true };
                     }
                     return task;
                 });
                 actionUndone = true;
                 message = `Merge undone. Event ID '${eventId}'. Items restored.`;
             } else {
                  message = `Cannot undo merge for '${itemTriggeringUndo.backlogId}': Original items for merge event not found.`;
             }
        } else {
             message = `Item '${itemTriggeringUndo.backlogId}' is not eligible for undo (no clear split/merge history).`;
        }


        if (actionUndone) {
            const updatedProject: Project = {
               ...selectedProject,
               backlog: updatedBacklog.sort((a, b) => (taskPriorities.indexOf(a.priority!) - taskPriorities.indexOf(b.priority!)) || (a.backlogId ?? '').localeCompare(b.backlogId ?? '')),
            };
            updateProjectData(updatedProject);
            toast({ title: "Action Undone", description: message, duration: 5000 });
        } else {
            toast({ variant: "warning", title: "Undo Failed", description: message, duration: 5000 });
        }

    }, [selectedProject, updateProjectData, toast]);


  return {
    handleSaveNewBacklogItems,
    handleUpdateSavedBacklogItem,
    handleMoveToSprint,
    handleMoveSelectedBacklogItemsToSprint,
    handleRevertTaskToBacklog,
    handleSplitBacklogItem,
    handleDeleteSavedBacklogItem,
    handleMergeBacklogItems,
    handleUndoBacklogAction,
  };
};
