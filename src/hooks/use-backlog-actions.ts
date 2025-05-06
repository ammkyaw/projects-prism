import { useCallback } from 'react';
import type { Project, Task, ToastFun, HistoryStatus, Sprint } from '@/types/sprint-data';
import { initialSprintPlanning, taskPriorities } from '@/types/sprint-data';
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


  // Handler to move a backlog item to a sprint
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
      ...backlogItem,
      id: `sprint_task_${Date.now()}_${Math.random()}`,
      status: 'To Do',
      startDate: null,
      devEstimatedTime: backlogItem.devEstimatedTime ?? '',
      qaEstimatedTime: backlogItem.qaEstimatedTime ?? '2d',
      bufferTime: backlogItem.bufferTime ?? '1d',
      assignee: backlogItem.assignee,
      reviewer: backlogItem.reviewer,
      movedToSprint: null,
      historyStatus: null,
      needsGrooming: false,
      readyForSprint: false,
      backlogId: backlogItem.backlogId ?? '',
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
      toast({ title: "Item Moved", description: `Backlog item '${movedItemDetails}' moved to Sprint ${targetSprintNumber}. Marked in backlog.` });
    }
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

    const projectIndex = projects.findIndex(p => p.id === selectedProjectId);
    if (projectIndex === -1) {
      console.error("Project not found during revert");
      return; // Should not happen if selectedProject exists
    }

    const currentProject = { ...selectedProject }; // Clone to modify

    let foundAndRemoved = false;
    let taskToRemoveDetails: Partial<Task> = {};

    // Find the task in the specified sprint's planning.newTasks
    let targetSprintIndex = currentProject.sprintData.sprints.findIndex(s => s.sprintNumber === sprintNumber);
    if (targetSprintIndex === -1) {
      console.warn(`Sprint ${sprintNumber} not found.`);
      showToast({ variant: "warning", title: "Sprint Not Found", description: `Could not find Sprint ${sprintNumber}.` });
      return;
    }

    let targetSprint = { ...currentProject.sprintData.sprints[targetSprintIndex] }; // Clone sprint
    let updatedNewTasks = [...(targetSprint.planning?.newTasks || [])];
    let taskIndex = updatedNewTasks.findIndex(t => t.id === taskId);

    if (taskIndex !== -1) {
      const taskToRemove = updatedNewTasks[taskIndex];
      taskToRemoveDetails = { ...taskToRemove }; // Capture details before removing
      revertedTaskDetails = `${taskToRemove.backlogId || taskToRemove.ticketNumber} (${taskToRemove.title || 'No Title'})`;
      foundAndRemoved = true;
      updatedNewTasks.splice(taskIndex, 1); // Remove the task
    } else {
      console.warn(`Task ID ${taskId} not found in Sprint ${sprintNumber} new tasks.`);
      showToast({ variant: "warning", title: "Task Not Found", description: `Could not find task ID ${taskId} in Sprint ${sprintNumber} planning.` });
      return;
    }

    // Update the sprint with the modified tasks
    targetSprint.planning = {
      ...(targetSprint.planning || initialSprintPlanning),
      newTasks: updatedNewTasks,
    };
    const updatedSprints = [...currentProject.sprintData.sprints];
    updatedSprints[targetSprintIndex] = targetSprint;


    // Find the corresponding item in the backlog and reset its 'movedToSprint' status
    const updatedBacklog = (currentProject.backlog || []).map(item => {
      const isMatch = taskBacklogId ? item.backlogId === taskBacklogId : item.ticketNumber === taskToRemoveDetails.ticketNumber;

      if (isMatch && item.movedToSprint === sprintNumber && item.historyStatus === 'Move') {
        updatePerformed = true; // Mark that we found and updated the backlog item
        return { ...item, movedToSprint: null, historyStatus: null }; // Reset movedToSprint and historyStatus
      }
      return item;
    });

    // If the backlog item was not found to be updated, show a warning
    if (!updatePerformed) {
      console.warn(`Could not find corresponding backlog item for task ${revertedTaskDetails} (Backlog ID: ${taskBacklogId}) that was marked as moved to sprint ${sprintNumber}. Task removed from sprint only.`);
      showToast({ variant: "warning", title: "Task Removed from Sprint", description: `Task '${revertedTaskDetails}' removed from Sprint ${sprintNumber}, but its corresponding backlog item couldn't be updated (may have been deleted or modified).` });
    } else {
      showToast({ title: "Task Reverted", description: `Task '${revertedTaskDetails}' removed from Sprint ${sprintNumber} and returned to backlog.` });
    }

    // Create the final updated project object
    const finalUpdatedProject: Project = {
      ...currentProject,
      backlog: updatedBacklog,
      sprintData: {
        ...currentProject.sprintData,
        sprints: updatedSprints,
      }
    };

    updateProjectData(finalUpdatedProject);


  }, [selectedProject, updateProjectData, toast, projects, selectedProjectId]);


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
      movedToSprint: null,
      splitFromId: null,
    };

    // 2. Prepare new split tasks with unique IDs and backlog IDs
    const newSplitTasksWithIds = splitTasks.map((task, index) => {
      const suffix = String.fromCharCode(97 + index);
      const newSplitBacklogId = `${originalItem.backlogId}-${suffix}`;
      const newId = `split_${originalTaskId}_${newSplitBacklogId}_${Date.now()}`; // Ensure unique persistent ID

      return {
        ...task,
        id: newId,
        backlogId: newSplitBacklogId,
        ticketNumber: newSplitBacklogId,
        needsGrooming: true,
        readyForSprint: false,
        splitFromId: originalItem.id, // Link back to the original task ID
      };
    });

    newIds = newSplitTasksWithIds.map(t => t.backlogId || t.id);

    // 3. Update the backlog array: Replace original with historical, add new splits
    const updatedBacklog = [
      ...(selectedProject.backlog?.slice(0, originalBacklogIndex) ?? []),
      markedOriginalItem,
      ...newSplitTasksWithIds,
      ...(selectedProject.backlog?.slice(originalBacklogIndex + 1) ?? []),
    ];

    const updatedProject: Project = {
      ...selectedProject,
      backlog: updatedBacklog.sort((a, b) => (taskPriorities.indexOf(a.priority!) - taskPriorities.indexOf(b.priority!)) || (a.backlogId ?? '').localeCompare(b.backlogId ?? '')),
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
      // TODO: Add confirmation dialog before deleting from Firestore
      const updatedBacklog = (selectedProject.backlog ?? []).filter(item => item.id !== itemId);
      const updatedProject: Project = { ...selectedProject, backlog: updatedBacklog };
      updateProjectData(updatedProject);
      toast({ title: "Backlog Item Deleted", description: "The item has been removed from the backlog." });
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

      const mergeEventId = `merge_${Date.now()}`;
      let mergedItemDetails: string[] = [];
      let firstOriginalBacklogId: string | undefined = '';
      const itemsToMarkHistorical: Task[] = [];

      let currentBacklog = [...(selectedProject.backlog ?? [])];

      // Mark original items as merged
      const activeBacklogAfterRemoval = currentBacklog.filter(item => {
          if (taskIdsToMerge.includes(item.id)) {
              if (!firstOriginalBacklogId) {
                 firstOriginalBacklogId = item.backlogId;
              }
              mergedItemDetails.push(`${item.backlogId} (${item.title || 'No Title'})`);
              itemsToMarkHistorical.push({
                  ...item,
                  historyStatus: 'Merge' as HistoryStatus,
                  movedToSprint: null,
                  mergeEventId: mergeEventId,
              });
              return false; // Remove from active backlog
          }
          return true; // Keep in active backlog
      });


      const newMergedBacklogId = `${firstOriginalBacklogId || 'merged'}-m`;

      const newMergedTaskWithId: Task = {
         ...mergedTask,
         id: `merged_${Date.now()}_${Math.random()}`,
         backlogId: newMergedBacklogId,
         ticketNumber: newMergedBacklogId,
         needsGrooming: true,
         readyForSprint: false,
         mergeEventId: mergeEventId,
      };

      // Combine active backlog, new merged task, and historical items
       const finalBacklog = [
          ...activeBacklogAfterRemoval,
          newMergedTaskWithId,
          ...itemsToMarkHistorical
       ];

      const updatedProject: Project = {
          ...selectedProject,
          backlog: finalBacklog.sort((a, b) => (taskPriorities.indexOf(a.priority!) - taskPriorities.indexOf(b.priority!)) || (a.backlogId ?? '').localeCompare(b.backlogId ?? '')),
      };

      updateProjectData(updatedProject);

      toast({
          title: "Items Merged",
          description: `Items [${mergedItemDetails.join(', ')}] marked as Merged. New item '${mergedTask.title}' created.`,
          duration: 5000,
      });

   }, [selectedProject, updateProjectData, toast]);

   // Handler to undo a backlog action (Split/Merge)
    const handleUndoBacklogAction = useCallback((taskId: string) => {
        if (!selectedProject) {
            toast({ variant: "destructive", title: "Error", description: "No project selected." });
            return;
        }

        let undoneActionType: HistoryStatus | null;
        let undoneItemDetails: string | null = null;
        let restoredItemIds: string[] = [];
        let removedItemIds: string[] = [];
        let actionSuccess = false;

        const showToast = (options: any) => setTimeout(() => toast(options), 50);

        let currentBacklog = [...(selectedProject.backlog || [])];
        const triggerItem = currentBacklog.find(item => item.id === taskId);

        if (!triggerItem) {
            console.error("Undo Trigger item not found:", taskId);
            showToast({ variant: "destructive", title: "Error", description: "Cannot perform undo: Item not found." });
            return;
        }

        console.log("Attempting to undo action for item:\n", triggerItem);

        let originalItemToRestore: Task | null | undefined;
        let itemsToRemove: Task[] = [];
        let itemsToRestore: Task[] = [];
        let mergeEventId: string | undefined | null = null;

        // Determine action and related items based on the *trigger item*\n        
        if (triggerItem.historyStatus === 'Split') {
            undoneActionType = 'Split';
            originalItemToRestore = triggerItem;
            itemsToRemove = currentBacklog.filter(item => item.splitFromId === originalItemToRestore?.id);
        } else if (triggerItem.historyStatus === 'Merge') {
            undoneActionType = 'Merge';
            mergeEventId = triggerItem.mergeEventId;
            if (!mergeEventId) {
                console.error("Cannot undo merge: Missing mergeEventId on historical item", taskId);
                showToast({ variant: "destructive", title: "Error", description: "Cannot undo merge action (missing link)." });
                return;
            }
            itemsToRemove = currentBacklog.filter(item => item.mergeEventId === mergeEventId && !item.historyStatus);
            itemsToRestore = currentBacklog.filter(item => item.mergeEventId === mergeEventId && item.historyStatus === 'Merge');
        } else if (triggerItem.splitFromId) {
            undoneActionType = 'Split';
            originalItemToRestore = currentBacklog.find(item => item.id === triggerItem.splitFromId && item.historyStatus === 'Split');
            if (!originalItemToRestore) {
                console.error("Cannot undo split: Original item not found for split item", taskId);
                showToast({ variant: "destructive", title: "Error", description: "Cannot undo split action (original missing)." });
                return;
            }
            itemsToRemove = currentBacklog.filter(item => item.splitFromId === originalItemToRestore?.id);
        } else if (triggerItem.mergeEventId && !triggerItem.historyStatus) {
            undoneActionType = 'Merge';
            mergeEventId = triggerItem.mergeEventId;
            itemsToRemove = [triggerItem];
            itemsToRestore = currentBacklog.filter(item => item.mergeEventId === mergeEventId && item.historyStatus === 'Merge');
        } else {
            console.error("Item not eligible for undo:", taskId, triggerItem);
            showToast({ variant: "destructive", title: "Error", description: "Cannot undo this action (item not eligible)." });
            return;
        }

        // Set details for toast message
        if (undoneActionType === 'Split') {
           undoneItemDetails = originalItemToRestore ? `${originalItemToRestore.backlogId} (${originalItemToRestore.title || 'No Title'})` : `Split items related to ${triggerItem.backlogId}`;
        } else if (undoneActionType === 'Merge') {
           undoneItemDetails = mergeEventId ? `Merged Items (Event: ${mergeEventId})` : `Merge related to ${triggerItem.backlogId}`;
        }

        // Perform the updates only if an action type was determined
        if (undoneActionType) {
            actionSuccess = true;

            const removedIdsSet = new Set(itemsToRemove.map(t => t.id));
            removedItemIds = itemsToRemove.map(t => t.backlogId || t.id);

            // Filter out the items created by the action
            let updatedBacklog = currentBacklog.filter(item => !removedIdsSet.has(item.id));

            const itemsToMakeActive = undoneActionType === 'Split' ? [originalItemToRestore] : itemsToRestore;
            const restoredIdsSet = new Set(itemsToMakeActive.filter(Boolean).map(t => t!.id));
            restoredItemIds = itemsToMakeActive.filter(Boolean).map(t => t!.backlogId || t!.id);

            // Restore original items: Remove historyStatus and related IDs
            updatedBacklog = updatedBacklog.map(item => {
                if (restoredIdsSet.has(item.id)) {
                     console.log("Restoring item:", item.id, item.backlogId);
                    return { ...item, historyStatus: null, splitFromId: null, mergeEventId: null, movedToSprint: null };
                }
                return item;
            });

             // Validation checks
            if (undoneActionType === 'Merge' && itemsToRestore.length === 0 && mergeEventId) {
                console.error(`Undo Merge: Could not find original items for mergeEventId ${mergeEventId}`);
                 showToast({ variant: "warning", title: "Undo Incomplete", description: "Could not restore original merged items." });
                 actionSuccess = false;
                 return;
            }
            if (itemsToRemove.length === 0 && (undoneActionType === 'Split' || undoneActionType === 'Merge')) {
                 console.warn(`Undo ${undoneActionType}: Could not find the resulting item(s) to remove. Originals restored.`);
                 showToast({ variant: "warning", title: "Undo Warning", description: `Resulting ${undoneActionType === 'Split' ? 'split' : 'merged'} item(s) not found, originals restored.` });
            }

            const updatedProject: Project = {
               ...selectedProject,
               backlog: updatedBacklog.sort((a, b) => (taskPriorities.indexOf(a.priority!) - taskPriorities.indexOf(b.priority!)) || (a.backlogId ?? '').localeCompare(b.backlogId ?? '')),
            };
            updateProjectData(updatedProject);

        } else {
            console.error("Undo Error: Could not determine action type for item", taskId);
            showToast({ variant: "destructive", title: "Error", description: "Could not process the undo request." });
            return;
        }

         // Show appropriate toast after the state update attempt
        if (actionSuccess && undoneItemDetails && undoneActionType) {
            const restoredCount = restoredItemIds.length;
            const removedCount = removedItemIds.length;
            showToast({
                title: `${undoneActionType} Undone`,
                description: `Action related to '${undoneItemDetails}' undone. ${restoredCount} item(s) restored, ${removedCount} item(s) removed.`,
                duration: 5000,
            });
         }

    }, [selectedProject, updateProjectData, toast]);


  return {
    handleSaveNewBacklogItems,
    handleUpdateSavedBacklogItem,
    handleMoveToSprint,
    handleRevertTaskToBacklog,
    handleSplitBacklogItem,
    handleDeleteSavedBacklogItem,
    handleMergeBacklogItems,
    handleUndoBacklogAction,
  };
};