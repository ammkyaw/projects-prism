
"use client";

import type { ChangeEvent } from 'react';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'; // Added useRef, React
import * as XLSX from 'xlsx';
import { Button, buttonVariants } from '@/components/ui/button'; // Import buttonVariants
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'; // Added CardContent
import { Download, HomeIcon, BarChart, ListPlus, PlusCircle, NotebookPen, Users, Trash2, CalendarDays, Edit, UsersRound, Package, LayoutDashboard, IterationCw, Layers, BarChartBig, Settings, Activity, Eye, Filter, GitCommitVertical, History, CheckCircle, Undo, ArrowUpDown, ListChecks } from 'lucide-react'; // Added ArrowUpDown, ListChecks icons
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";


// Main Content Components (Tabs) - Renamed and New Placeholders
import DashboardTab from '@/components/dashboard-tab'; // Renamed from HomeTab
import BacklogTab from '@/components/backlog/backlog-tab'; // Updated path
import BacklogPrioritizationTab from '@/components/backlog/backlog-prioritization-tab'; // Updated path
import BacklogGroomingTab from '@/components/backlog/backlog-grooming-tab'; // Corrected import path
import HistoryTab from '@/components/backlog/history-tab'; // Import HistoryTab component

// Team and Settings Tabs
import MembersTab from '@/components/teams/members-tab'; // Updated path
import HolidaysTab from '@/components/settings/holidays-tab'; // Updated path
import TeamsTab from '@/components/teams/teams-tab'; // Updated path
import AddMembersDialog from '@/components/add-members-dialog';

// Sprint Sub-Tab Components
import SprintSummaryTab from '@/components/sprints/sprint-summary-tab'; // Updated path
import SprintPlanningTab from '@/components/sprints/sprint-planning-tab'; // New component for planning
import SprintRetrospectiveTab from '@/components/sprints/sprint-retrospective-tab'; // Updated path

// Analytics Sub-Tab Components
import AnalyticsChartsTab from '@/components/analytics-charts-tab';
import AnalyticsReportsTab from '@/components/analytics/analytics-reports-tab'; // Updated path


import type { SprintData, Sprint, AppData, Project, SprintDetailItem, SprintPlanning, Member, SprintStatus, Task, HolidayCalendar, PublicHoliday, Team, TeamMember, HistoryStatus } from '@/types/sprint-data'; // Added HistoryStatus
import { initialSprintData, initialSprintPlanning, taskStatuses, initialTeam, initialBacklogTask, taskPriorities } from '@/types/sprint-data'; // Import taskPriorities
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { addDays, format, parseISO, isPast, isValid, getYear } from 'date-fns'; // Added getYear
import { ModeToggle } from '@/components/mode-toggle'; // Import ModeToggle
import { useProjects, useUpdateProject, useDeleteProject } from '@/hooks/use-projects'; // Import React Query hooks

// Helper function to generate the next backlog ID based on *all* items (including historical and unsaved)
const generateNextBacklogIdHelper = (allProjectBacklogItems: Task[]): string => {
   const currentYear = getYear(new Date()).toString().slice(-2); // Get last two digits of the year
   const prefix = `BL-${currentYear}`;
   let maxNum = 0;

   allProjectBacklogItems.forEach(item => {
     const id = item.backlogId; // Use the actual backlogId
     // Consider only base BL-YYxxxx IDs from the current year
     // Use regex to extract the numeric part more reliably
     const match = id?.match(/^BL-\d{2}(\d{4})(?:-.*)?$/); // Match BL-YYNNNN or BL-YYNNNN-suffix
     if (id && id.startsWith(prefix) && match) {
         const numPart = parseInt(match[1], 10); // Get the NNNN part
         if (!isNaN(numPart) && numPart > maxNum) {
             maxNum = numPart;
         }
     }
   });

   const nextNum = maxNum + 1;
   const nextNumPadded = nextNum.toString().padStart(4, '0'); // Pad with leading zeros to 4 digits
   const newBaseId = `${prefix}${nextNumPadded}`;
   console.log("Generated next backlog ID:", newBaseId, "based on max:", maxNum); // Debug log
   return newBaseId;
 };


export default function Home() {
  // Local UI state
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [newProjectName, setNewProjectName] = useState<string>('');
  const [isNewProjectDialogOpen, setIsNewProjectDialogOpen] = useState<boolean>(false);
  const [isAddMembersDialogOpen, setIsAddMembersDialogOpen] = useState<boolean>(false);
  const [newlyCreatedProjectId, setNewlyCreatedProjectId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState<boolean>(false);
  const [projectToDeleteId, setProjectToDeleteId] = useState<string | null>(null);
  const [confirmProjectName, setConfirmProjectName] = useState<string>('');
  const [clientNow, setClientNow] = useState<Date | null>(null);
  const { toast } = useToast();

  // React Query hooks for data management
  const { data: projects = [], isLoading: isLoadingProjects, error: projectsError } = useProjects();
  const updateProjectMutation = useUpdateProject();
  const deleteProjectMutation = useDeleteProject();

  // Get current date on client mount to avoid hydration issues
  useEffect(() => {
     setClientNow(new Date());
  }, []);

   // Effect to select the first project when data loads or changes, if none selected
   useEffect(() => {
     if (!isLoadingProjects && projects.length > 0 && !selectedProjectId) {
       setSelectedProjectId(projects[0].id);
       console.log("No project selected, defaulting to first project:", projects[0].id);
     } else if (!isLoadingProjects && projects.length === 0) {
        setSelectedProjectId(null); // Clear selection if no projects exist
     }
     // Do NOT reset selectedProjectId if it already exists and is valid within the loaded projects
   }, [isLoadingProjects, projects, selectedProjectId]);


  // Find the currently selected project object
  const selectedProject = useMemo(() => {
    const project = projects.find(p => p.id === selectedProjectId) ?? null;
    console.log("Selected project determined:", project?.name ?? 'None');
    return project;
  }, [projects, selectedProjectId]);

  // Define default sub-tabs for each main tab
  const defaultSubTabs: Record<string, string> = {
      sprints: 'summary',
      backlog: 'management',
      analytics: 'charts',
      teams: 'members',
      settings: 'holidays',
  };

  // Update activeTab logic for main tabs
  const handleMainTabChange = (mainTabKey: string) => {
      if (mainTabKey === 'dashboard') { // Only dashboard is a main tab without subtabs now
         setActiveTab(mainTabKey);
      } else {
         const defaultSub = defaultSubTabs[mainTabKey] || ''; // Fallback to empty string if no default
         setActiveTab(`${mainTabKey}/${defaultSub}`);
      }
  };

  // Get the active main tab key from the combined state
  const activeMainTab = useMemo(() => activeTab.split('/')[0], [activeTab]);

   // Helper function to update project data via mutation
   const updateProjectData = useCallback((updatedProject: Project) => {
        if (!updatedProject.id) {
            toast({ variant: "destructive", title: "Error", description: "Project ID missing, cannot update." });
            return;
        }
        updateProjectMutation.mutate(updatedProject, {
            onError: (error) => {
                toast({ variant: "destructive", title: "Save Error", description: `Failed to save changes: ${error.message}` });
            }
            // onSuccess is handled in the hook to invalidate query
        });
   }, [updateProjectMutation, toast]);


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
      setActiveTab('sprints/summary');
  }, [selectedProject, updateProjectData, toast, setActiveTab]);


  // Handler to save members for the *selected* project
  const handleSaveMembers = useCallback((updatedMembers: Member[]) => {
    if (!selectedProject) {
      toast({ variant: "destructive", title: "Error", description: "No project selected." });
      return;
    }
    const updatedProject: Project = { ...selectedProject, members: updatedMembers };
    updateProjectData(updatedProject);
    toast({ title: "Success", description: `Members updated for project '${selectedProject.name}'.` });
  }, [selectedProject, updateProjectData, toast]);

   // Handler to save holiday calendars for the *selected* project
   const handleSaveHolidayCalendars = useCallback((updatedCalendars: HolidayCalendar[]) => {
       if (!selectedProject) {
           toast({ variant: "destructive", title: "Error", description: "No project selected." });
           return;
       }

       const currentProjectName = selectedProject.name;
       let membersToUpdate: Member[] = [];

       // Check which members might lose their assigned calendar
       const updatedMembers = (selectedProject.members || []).map(member => {
           const calendarExists = updatedCalendars.some(cal => cal.id === member.holidayCalendarId);
           if (member.holidayCalendarId && !calendarExists) {
               membersToUpdate.push(member); // Track members whose calendar was removed
               return { ...member, holidayCalendarId: null }; // Unassign calendar
           }
           return member;
       });

       const updatedProject: Project = {
           ...selectedProject,
           holidayCalendars: updatedCalendars,
           members: updatedMembers,
       };

       updateProjectData(updatedProject);

       // Show toasts *after* the mutation call (optimistically)
       setTimeout(() => {
           toast({ title: "Success", description: `Holiday calendars updated for project '${currentProjectName}'.` });
           membersToUpdate.forEach(member => {
               toast({ variant: "warning", title: "Calendar Unassigned", description: `Holiday calendar assigned to ${member.name} was deleted or is no longer available.` });
           });
       }, 0);

   }, [selectedProject, updateProjectData, toast]);

   // Handler to save teams for the *selected* project
   const handleSaveTeams = useCallback((updatedTeams: Team[]) => {
       if (!selectedProject) {
           toast({ variant: "destructive", title: "Error", description: "No project selected." });
           return;
       }
       const currentProjectName = selectedProject.name;

       // Optionally, add validation here to ensure team members and leads still exist
       const validTeams = updatedTeams.map(team => {
           const validMembers = team.members.filter(tm => (selectedProject.members || []).some(m => m.id === tm.memberId));
           let validLead = team.leadMemberId;
           if (validLead && !(selectedProject.members || []).some(m => m.id === validLead)) {
                console.warn(`Lead member ID ${validLead} for team ${team.name} not found. Resetting.`);
                validLead = null;
           }
           return { ...team, members: validMembers, leadMemberId: validLead };
       });

       const updatedProject: Project = { ...selectedProject, teams: validTeams };
       updateProjectData(updatedProject);
       toast({ title: "Success", description: `Teams updated for project '${currentProjectName}'.` });
   }, [selectedProject, updateProjectData, toast]);

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
           startDate: undefined,
           devEstimatedTime: backlogItem.devEstimatedTime ?? '',
           qaEstimatedTime: backlogItem.qaEstimatedTime ?? '2d',
           bufferTime: backlogItem.bufferTime ?? '1d',
           assignee: backlogItem.assignee,
           reviewer: backlogItem.reviewer,
           movedToSprint: undefined,
           historyStatus: undefined,
           needsGrooming: undefined,
           readyForSprint: undefined,
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
   const handleRevertTaskToBacklog = useCallback((sprintNumber: number, taskId: string, taskBacklogId: string | undefined) => {
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
                return { ...item, movedToSprint: undefined, historyStatus: undefined }; // Reset movedToSprint and historyStatus
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


   }, [selectedProject, updateProjectData, toast, projects, selectedProjectId]); // Added projects and selectedProjectId


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
            movedToSprint: undefined,
            splitFromId: undefined,
        };

        // 2. Prepare new split tasks with unique IDs and backlog IDs
        const allItemsForIdGen = [...(selectedProject.backlog || []), ...splitTasks];

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
    }, [selectedProject, updateProjectData, toast]); // Removed generateNextBacklogId dependency


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
       let firstOriginalBacklogId: string | undefined = undefined;
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
                   movedToSprint: undefined,
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

    }, [selectedProject, updateProjectData, toast]); // Removed generateNextBacklogId dependency

    // Handler to undo a backlog action (Split/Merge)
     const handleUndoBacklogAction = useCallback((taskId: string) => {
         if (!selectedProject) {
             toast({ variant: "destructive", title: "Error", description: "No project selected." });
             return;
         }

         let undoneActionType: HistoryStatus | undefined;
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

         console.log("Attempting to undo action for item:", triggerItem);

         let originalItemToRestore: Task | undefined;
         let itemsToRemove: Task[] = [];
         let itemsToRestore: Task[] = [];
         let mergeEventId: string | undefined;

         // Determine action and related items based on the *trigger item*
         if (triggerItem.historyStatus === 'Split') {
             undoneActionType = 'Split';
             originalItemToRestore = triggerItem;
             itemsToRemove = currentBacklog.filter(item => item.splitFromId === originalItemToRestore!.id);
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
             itemsToRemove = currentBacklog.filter(item => item.splitFromId === originalItemToRestore!.id);
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
                     return { ...item, historyStatus: undefined, splitFromId: undefined, mergeEventId: undefined, movedToSprint: undefined };
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

     }, [selectedProject, updateProjectData, toast]); // Removed setProjects dependency


  // Handler to add members to the *newly created* project (from dialog)
   const handleAddMembersToNewProject = useCallback((addedMembers: Member[]) => {
       if (!newlyCreatedProjectId) return;

       const projectToUpdate = projects.find(p => p.id === newlyCreatedProjectId);
       if (!projectToUpdate) {
            toast({ variant: "destructive", title: "Error", description: "Newly created project not found." });
            setIsAddMembersDialogOpen(false);
            setNewlyCreatedProjectId(null);
            return;
       }

        const updatedProject: Project = {
           ...projectToUpdate,
           members: [...(projectToUpdate.members || []), ...addedMembers]
        };

       updateProjectData(updatedProject); // Update via mutation

       toast({ title: "Members Added", description: `Members added to project '${projectToUpdate.name}'.` });
       setIsAddMembersDialogOpen(false);
       setNewlyCreatedProjectId(null);

   }, [newlyCreatedProjectId, projects, updateProjectData, toast, setIsAddMembersDialogOpen, setNewlyCreatedProjectId]);

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
            totalStoryPoints: totalPoints,
            daysInSprint: maxDays,
        },
    };

    updateProjectData(updatedProject);
    toast({ title: "Sprint Deleted", description: `Sprint ${sprintNumber} deleted from project '${currentProjectName}'.` });
  }, [selectedProject, updateProjectData, toast]);


  // Export data for the currently selected project
  const handleExport = () => {
    if (!selectedProject || (!selectedProject.sprintData?.sprints?.length && !selectedProject.members?.length && !selectedProject.holidayCalendars?.length && !selectedProject.teams?.length && !selectedProject.backlog?.length)) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `No data available to export for project '${selectedProject?.name ?? 'N/A'}'.`,
      });
      return;
    }
     try {
      const wb = XLSX.utils.book_new();

       // Sprint Summary Sheet
       if (selectedProject.sprintData?.sprints?.length > 0) {
           const summaryData = selectedProject.sprintData.sprints.map(s => ({
             'SprintNumber': s.sprintNumber,
             'StartDate': s.startDate,
             'EndDate': s.endDate,
             'Duration': s.duration,
             'Status': s.status,
             'TotalCommitment': s.committedPoints,
             'TotalDelivered': s.completedPoints,
           }));
           const wsSummary = XLSX.utils.json_to_sheet(summaryData);
           XLSX.utils.book_append_sheet(wb, wsSummary, 'Sprint Summary');
       }

       // Planning Sheets (Summary and Tasks)
       const planningExists = selectedProject.sprintData?.sprints?.some(s => s.planning && (s.planning.goal || s.planning.newTasks?.length > 0 || s.planning.spilloverTasks?.length > 0 || s.planning.definitionOfDone || s.planning.testingStrategy));
       if (planningExists) {
           const planningSummaryData: any[] = [];
           const planningTasksData: any[] = [];
           selectedProject.sprintData.sprints.forEach(sprint => {
               if (sprint.planning) {
                   planningSummaryData.push({
                      'SprintNumber': sprint.sprintNumber,
                      'Goal': sprint.planning.goal,
                      'DefinitionOfDone': sprint.planning.definitionOfDone,
                      'TestingStrategy': sprint.planning.testingStrategy,
                   });
                   // Helper function to map task to export row
                    const mapTaskToRow = (task: Task, type: 'New' | 'Spillover') => ({
                      'SprintNumber': sprint.sprintNumber,
                      'Type': type,
                      'TaskID': task.id,
                      'TicketNumber': task.ticketNumber, // Use ticketNumber
                      'BacklogID': task.backlogId, // Include backlog ID
                      'Title': task.title,
                      'Description': task.description,
                      'StoryPoints': task.storyPoints,
                      'DevEstTime': task.devEstimatedTime,
                      'QAEstTime': task.qaEstimatedTime,
                      'BufferTime': task.bufferTime,
                      'Assignee': task.assignee,
                      'Reviewer': task.reviewer,
                      'Status': task.status,
                      'StartDate': task.startDate,
                      'Priority': task.priority,
                    });


                   (sprint.planning.newTasks || []).forEach(task => planningTasksData.push(mapTaskToRow(task, 'New')));
                    (sprint.planning.spilloverTasks || []).forEach(task => planningTasksData.push(mapTaskToRow(task, 'Spillover')));
               }
           });
            if (planningSummaryData.length > 0) {
               const wsPlanningSummary = XLSX.utils.json_to_sheet(planningSummaryData);
               XLSX.utils.book_append_sheet(wb, wsPlanningSummary, 'Planning Summary');
            }
            if (planningTasksData.length > 0) {
               const wsPlanningTasks = XLSX.utils.json_to_sheet(planningTasksData);
               XLSX.utils.book_append_sheet(wb, wsPlanningTasks, 'Planning Tasks');
            }
       }

        // Backlog Sheet
        if (selectedProject.backlog && selectedProject.backlog.length > 0) {
            const backlogData = selectedProject.backlog.map(task => ({
                'BacklogItemID': task.id,
                'BacklogID': task.backlogId,
                'Title': task.title,
                'Description': task.description,
                'TaskType': task.taskType,
                'Priority': task.priority,
                'Initiator': task.initiator,
                'CreatedDate': task.createdDate,
                'StoryPoints': task.storyPoints,
                'DependsOn': (task.dependsOn || []).join(', '), // Flatten dependency array
                'MovedToSprint': task.movedToSprint ?? '', // Add movedToSprint history
                'HistoryStatus': task.historyStatus ?? '', // Add history status
                 'NeedsGrooming': task.needsGrooming ? 'Yes' : 'No', // Add flag
                 'ReadyForSprint': task.readyForSprint ? 'Yes' : 'No', // Add flag
                  'SplitFromID': task.splitFromId ?? '', // Export split info
                  'MergeEventID': task.mergeEventId ?? '', // Export merge info
                 // Other backlog specific fields if needed
            }));
            const wsBacklog = XLSX.utils.json_to_sheet(backlogData);
            XLSX.utils.book_append_sheet(wb, wsBacklog, 'Backlog');
        }

       // Members Sheet
       if (selectedProject.members && selectedProject.members.length > 0) {
            const membersData = selectedProject.members.map(m => ({
                'MemberID': m.id,
                'Name': m.name,
                'Role': m.role,
                'HolidayCalendarID': m.holidayCalendarId, // Added holiday calendar ID
            }));
            const wsMembers = XLSX.utils.json_to_sheet(membersData);
            XLSX.utils.book_append_sheet(wb, wsMembers, 'Members');
       }

       // Holiday Calendars Sheet
       if (selectedProject.holidayCalendars && selectedProject.holidayCalendars.length > 0) {
           const calendarsData: any[] = [];
           selectedProject.holidayCalendars.forEach(cal => {
               cal.holidays.forEach(holiday => {
                  calendarsData.push({
                      'CalendarID': cal.id,
                      'CalendarName': cal.name,
                      'CountryCode': cal.countryCode,
                      'HolidayID': holiday.id,
                      'HolidayName': holiday.name,
                      'HolidayDate': holiday.date,
                  });
               });
               // Add row for calendar itself if it has no holidays
               if (cal.holidays.length === 0) {
                   calendarsData.push({
                       'CalendarID': cal.id,
                       'CalendarName': cal.name,
                       'CountryCode': cal.countryCode,
                       'HolidayID': '',
                       'HolidayName': '',
                       'HolidayDate': '',
                   });
               }
           });
            const wsHolidays = XLSX.utils.json_to_sheet(calendarsData);
            XLSX.utils.book_append_sheet(wb, wsHolidays, 'Holiday Calendars');
       }

        // Teams Sheet
        if (selectedProject.teams && selectedProject.teams.length > 0) {
            const teamsData: any[] = [];
            selectedProject.teams.forEach(team => {
                team.members.forEach(tm => {
                    teamsData.push({
                        'TeamID': team.id,
                        'TeamName': team.name,
                        'LeadMemberID': team.leadMemberId,
                        'MemberID': tm.memberId,
                    });
                });
                 // Add row for team itself if it has no members
                 if (team.members.length === 0) {
                    teamsData.push({
                        'TeamID': team.id,
                        'TeamName': team.name,
                        'LeadMemberID': team.leadMemberId,
                        'MemberID': '',
                    });
                 }
            });
            const wsTeams = XLSX.utils.json_to_sheet(teamsData);
            XLSX.utils.book_append_sheet(wb, wsTeams, 'Teams');
        }


      const projectNameSlug = selectedProject.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      XLSX.writeFile(wb, `sprint_stats_${projectNameSlug}_report.xlsx`);
      toast({ title: "Success", description: `Data for project '${selectedProject.name}' exported to Excel.` });
    } catch (error) {
      console.error("Error exporting data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to export data.",
      });
    }
  };

  // Handle creating a new project
  const handleCreateNewProject = () => {
    const trimmedName = newProjectName.trim();
    if (!trimmedName) {
        toast({ variant: "destructive", title: "Error", description: "Project name cannot be empty." });
        return;
    }
    if (projects.some(p => p.name.toLowerCase() === trimmedName.toLowerCase())) {
        toast({ variant: "destructive", title: "Error", description: `Project with name "${trimmedName}" already exists.` });
        return;
    }

    const newProject: Project = {
      id: `proj_${Date.now()}`,
      name: trimmedName,
      sprintData: initialSprintData,
      members: [],
      holidayCalendars: [],
      teams: [],
      backlog: [],
    };

    updateProjectMutation.mutate(newProject, {
      onSuccess: (data, variables) => {
        // variables is the project object passed to mutate
        setSelectedProjectId(variables.id);
        setNewProjectName('');
        setIsNewProjectDialogOpen(false);
        setNewlyCreatedProjectId(variables.id);
        setActiveTab("dashboard");

        // Defer the toast and dialog opening slightly
        setTimeout(() => {
          toast({ title: "Project Created", description: `Project "${trimmedName}" created successfully.` });
          setIsAddMembersDialogOpen(true); // Open the dialog AFTER state update
        }, 50);
      },
      onError: (error) => {
        toast({ variant: "destructive", title: "Create Error", description: `Failed to create project: ${error.message}` });
      }
    });
  };

   // Handler to open the delete project confirmation dialog
   const handleOpenDeleteDialog = (projectId: string | null) => {
       if (!projectId) return;
       setProjectToDeleteId(projectId);
       setConfirmProjectName(''); // Reset confirmation input
       setIsDeleteDialogOpen(true);
   };

   // Handler to confirm and delete a project
   const handleConfirmDeleteProject = () => {
       if (!projectToDeleteId) return;

       const project = projects.find(p => p.id === projectToDeleteId);
       if (!project) {
           toast({ variant: "destructive", title: "Error", description: "Project not found." });
           setIsDeleteDialogOpen(false);
           setProjectToDeleteId(null);
           return;
       }

       if (confirmProjectName.trim().toLowerCase() !== project.name.toLowerCase()) {
           toast({ variant: "destructive", title: "Confirmation Failed", description: "Project name does not match." });
           return;
       }

       deleteProjectMutation.mutate(projectToDeleteId, {
          onSuccess: () => {
             toast({ title: "Project Deleted", description: `Project "${project.name}" has been deleted.` });
             setIsDeleteDialogOpen(false);
             setProjectToDeleteId(null);
              // If the deleted project was the selected one, select the first available project or null
             if (selectedProjectId === projectToDeleteId) {
                const remainingProjects = projects.filter(p => p.id !== projectToDeleteId);
                setSelectedProjectId(remainingProjects.length > 0 ? remainingProjects[0].id : null);
             }
          },
          onError: (error) => {
             toast({ variant: "destructive", title: "Delete Error", description: `Failed to delete project: ${error.message}` });
              setIsDeleteDialogOpen(false); // Close dialog even on error
              setProjectToDeleteId(null);
          }
       });
   };


  // Define the tab structure
  const tabsConfig: Record<string, { label: string; icon: React.ElementType; component?: React.ElementType; subTabs?: Record<string, { label: string; icon: React.ElementType; component: React.ElementType }> }> = {
      dashboard: { label: "Dashboard", icon: LayoutDashboard, component: DashboardTab },
      sprints: {
          label: "Sprints", icon: IterationCw, subTabs: {
              summary: { label: "Summary", icon: Eye, component: SprintSummaryTab },
              planning: { label: "Planning", icon: NotebookPen, component: SprintPlanningTab },
              retrospective: { label: "Retrospective", icon: GitCommitVertical, component: SprintRetrospectiveTab },
          }
      },
      backlog: {
          label: "Backlog", icon: Layers, subTabs: {
              management: { label: "Management", icon: Package, component: BacklogTab },
              grooming: { label: "Grooming", icon: Edit, component: BacklogGroomingTab },
              history: { label: "History", icon: History, component: HistoryTab }, // Added History Sub-Tab
          }
      },
      analytics: {
          label: "Analytics", icon: BarChartBig, subTabs: {
              charts: { label: "Charts", icon: BarChart, component: AnalyticsChartsTab },
              reports: { label: "Reports", icon: ListPlus, component: AnalyticsReportsTab },
          }
      },
      teams: {
          label: "Teams", icon: Users, subTabs: {
              members: { label: "Members", icon: Users, component: MembersTab },
              teams: { label: "Teams", icon: UsersRound, component: TeamsTab },
          }
      },
      settings: {
          label: "Settings", icon: Settings, subTabs: {
              holidays: { label: "Holidays", icon: CalendarDays, component: HolidaysTab },
          }
      },
  };

  // Render the currently active tab content
  const renderActiveTabContent = () => {
    if (!selectedProject) {
      // Initial loading state from React Query
      if (isLoadingProjects) {
          return (
              <Card className="flex flex-col items-center justify-center min-h-[400px] border-dashed border-2">
                  <CardHeader className="text-center">
                      <CardTitle>Loading Project Data...</CardTitle>
                      <CardDescription>Please wait while the application loads.</CardDescription>
                  </CardHeader>
              </Card>
          );
      }
       // Error state from React Query
      if (projectsError) {
          return (
              <Card className="flex flex-col items-center justify-center min-h-[400px] border-dashed border-2 border-destructive">
                  <CardHeader className="text-center">
                      <CardTitle className="text-destructive">Error Loading Projects</CardTitle>
                      <CardDescription>Could not load project data. Please check your connection or Firebase setup.</CardDescription>
                      <CardDescription className="text-xs text-muted-foreground mt-2">{projectsError.message}</CardDescription>
                  </CardHeader>
              </Card>
          );
      }
       // No projects exist state
       if (projects.length === 0) {
            return (
                <Card className="flex flex-col items-center justify-center min-h-[400px] border-dashed border-2">
                  <CardHeader className="text-center">
                    <CardTitle>No Projects Found</CardTitle>
                    <CardDescription>Create your first project using the 'New Project' button above.</CardDescription>
                  </CardHeader>
                </Card>
            );
       }

       // No project selected (should ideally default to first, but handle as fallback)
      return (
        <Card className="flex flex-col items-center justify-center min-h-[400px] border-dashed border-2">
          <CardHeader className="text-center">
            <CardTitle>No Project Selected</CardTitle>
            <CardDescription>Please select a project from the dropdown above, or create a new one.</CardDescription>
          </CardHeader>
        </Card>
      );
    }

    const [mainKey, subKey] = activeTab.split('/');
    const mainConfig = tabsConfig[mainKey as keyof typeof tabsConfig];

    if (!mainConfig) return null; // Should not happen if activeTab is valid

    let ActiveComponent;
    let componentProps: any = { // Base props for all components
        projectId: selectedProject.id,
        projectName: selectedProject.name,
    };

    if (mainConfig.subTabs && subKey) {
        const subConfig = mainConfig.subTabs[subKey as keyof typeof mainConfig.subTabs];
        if (!subConfig) return null; // Invalid sub-tab
        ActiveComponent = subConfig.component;

        // Add specific props based on the sub-tab component
         switch (`${mainKey}/${subKey}`) {
            case 'sprints/summary':
               componentProps = { ...componentProps, sprintData: selectedProject.sprintData, onDeleteSprint: handleDeleteSprint };
               break;
            case 'sprints/planning':
                componentProps = {
                    ...componentProps,
                    sprints: selectedProject.sprintData.sprints ?? [],
                    onSavePlanning: handleSavePlanningAndUpdateStatus,
                    onCreateAndPlanSprint: handleCreateAndPlanSprint,
                    members: selectedProject.members ?? [],
                    holidayCalendars: selectedProject.holidayCalendars ?? [],
                    teams: selectedProject.teams ?? [],
                    backlog: selectedProject.backlog?.filter(task => !task.historyStatus && task.readyForSprint) ?? [], // Pass ready & non-historical items
                    onRevertTask: handleRevertTaskToBacklog, // Pass revert function
                    onCompleteSprint: handleCompleteSprint, // Pass complete function
                 };
                break;
            case 'sprints/retrospective':
                 componentProps = { ...componentProps, sprints: selectedProject.sprintData.sprints ?? [] };
                 break;
            case 'backlog/management':
                componentProps = {
                    ...componentProps,
                    initialBacklog: selectedProject.backlog ?? [], // Pass ALL items
                    onSaveNewItems: handleSaveNewBacklogItems, // Pass handler for new items
                    onUpdateSavedItem: handleUpdateSavedBacklogItem, // Pass handler for updates
                    onDeleteSavedItem: handleDeleteSavedBacklogItem, // Pass handler for deletion
                    members: selectedProject.members ?? [],
                    sprints: selectedProject.sprintData.sprints ?? [],
                    onMoveToSprint: handleMoveToSprint,
                    generateNextBacklogId: generateNextBacklogIdHelper, // Pass the helper
                 };
                break;
            case 'backlog/grooming':
                componentProps = {
                     ...componentProps,
                     initialBacklog: selectedProject.backlog ?? [], // Pass full backlog
                      // Grooming usually modifies existing items, requires saving the whole project
                      onSaveBacklog: (groomedBacklog: Task[]) => {
                           const updatedProject: Project = { ...selectedProject, backlog: groomedBacklog };
                           updateProjectData(updatedProject);
                           toast({ title: "Backlog Groomed", description: "Changes saved." });
                      },
                     onSplitBacklogItem: handleSplitBacklogItem, // Pass split handler
                     onMergeBacklogItems: handleMergeBacklogItems, // Pass merge handler
                     onUndoBacklogAction: handleUndoBacklogAction, // Pass undo handler
                     generateNextBacklogId: generateNextBacklogIdHelper, // Pass helper for merge dialog ID gen
                     allProjectBacklogItems: selectedProject.backlog ?? [], // Pass all items for uniqueness check
                 };
                break;
             case 'backlog/history': // Updated sub-tab path
                componentProps = {
                    ...componentProps,
                    historyItems: selectedProject.backlog?.filter(task => !!task.historyStatus) ?? [], // Pass items with history status
                    onUndoBacklogAction: handleUndoBacklogAction, // Pass undo handler
                 };
                break;
            case 'analytics/charts':
                 componentProps = { ...componentProps, sprintData: selectedProject.sprintData, members: selectedProject.members ?? [] };
                 break;
            case 'analytics/reports':
                 componentProps = { ...componentProps, sprintData: selectedProject.sprintData };
                 break;
            case 'teams/members':
                componentProps = {
                    ...componentProps,
                    initialMembers: selectedProject.members ?? [],
                    onSaveMembers: handleSaveMembers,
                    holidayCalendars: selectedProject.holidayCalendars ?? [],
                 };
                break;
            case 'teams/teams':
                 componentProps = {
                    ...componentProps,
                    initialTeams: selectedProject.teams ?? [],
                    allMembers: selectedProject.members ?? [],
                    onSaveTeams: handleSaveTeams,
                 };
                 break;
            case 'settings/holidays':
                 componentProps = {
                    ...componentProps,
                    initialCalendars: selectedProject.holidayCalendars ?? [],
                    onSaveCalendars: handleSaveHolidayCalendars,
                 };
                 break;
            default:
                ActiveComponent = () => <div>Unknown Tab</div>;
                componentProps = {};
                break;
        }
    } else {
        // Handle main tabs without sub-tabs (Dashboard)
        ActiveComponent = mainConfig.component;
         if (mainKey === 'dashboard') {
            componentProps = { ...componentProps, sprintData: selectedProject.sprintData };
         }
        // Add props for other main tabs if needed
    }


    return <ActiveComponent {...componentProps} />;
  };


  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between p-4 bg-card border-b shadow-sm">
        <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold text-primary">Projects Prism</h1>
             <Select
               value={selectedProjectId ?? undefined}
               onValueChange={(value) => {
                  if (value === 'loading' || value === 'no-projects') return; // Prevent selecting placeholder items
                   console.log(`Project selected: ${value}`);
                   setSelectedProjectId(value);
                   setActiveTab("dashboard"); // Reset to dashboard tab on project change
               }}
               disabled={isLoadingProjects || projects.length === 0} // Disable while loading or if no projects
             >
                <SelectTrigger className="w-[200px]"> {/* Increased width */}
                  <SelectValue placeholder={isLoadingProjects ? "Loading..." : (projects.length === 0 ? "No projects yet" : "Select a project")} />
                </SelectTrigger>
                <SelectContent>
                    <SelectGroup>
                        <SelectLabel>Projects</SelectLabel>
                        {isLoadingProjects ? (
                            <SelectItem value="loading" disabled>Loading projects...</SelectItem>
                        ) : projects.length > 0 ? (
                            projects.map(project => (
                                <div key={project.id} className="flex items-center justify-between pr-2">
                                    <SelectItem value={project.id} className="flex-1"> {/* Allow text to take space */}
                                        {project.name}
                                    </SelectItem>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 ml-2 text-muted-foreground hover:text-destructive"
                                        onClick={(e) => {
                                            e.stopPropagation(); // Prevent Select from closing
                                            handleOpenDeleteDialog(project.id);
                                        }}
                                        aria-label={`Delete project ${project.name}`}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))
                        ) : (
                            <SelectItem value="no-projects" disabled>No projects yet</SelectItem>
                        )}
                    </SelectGroup>
                </SelectContent>
             </Select>
             <Dialog open={isNewProjectDialogOpen} onOpenChange={setIsNewProjectDialogOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline" size="sm"><PlusCircle className="mr-2 h-4 w-4" /> New Project</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Create New Project</DialogTitle>
                        <DialogDescription>
                            Enter a name for your new project. Click create when you're done.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">
                                Name
                            </Label>
                            <Input
                                id="name"
                                value={newProjectName}
                                onChange={(e) => setNewProjectName(e.target.value)}
                                className="col-span-3"
                                placeholder="Auto-insurance"
                                autoFocus
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" onClick={handleCreateNewProject} disabled={updateProjectMutation.isPending}>
                           {updateProjectMutation.isPending ? 'Creating...' : 'Create Project'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
             </Dialog>
        </div>

        <div className="flex items-center gap-4">
          {selectedProject && (selectedProject.sprintData?.sprints?.length > 0 || selectedProject.members?.length > 0 || selectedProject.holidayCalendars?.length > 0 || selectedProject.teams?.length > 0 || selectedProject.backlog?.length > 0) && (
            <Button onClick={handleExport} variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export Project Data
            </Button>
          )}
          <ModeToggle /> {/* Add the dark mode toggle */}
        </div>
      </header>

       {/* Delete Project Confirmation Dialog */}
       <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
           <AlertDialogContent>
               <AlertDialogHeader>
                   <AlertDialogTitle>Delete Project "{projects.find(p => p.id === projectToDeleteId)?.name}"?</AlertDialogTitle>
                   <AlertDialogDescription>
                       This action cannot be undone. This will permanently delete the project and all its associated data (sprints, backlog, members, etc.).
                       <br />
                       To confirm, please type the project name below:
                       <strong className="block mt-1">{projects.find(p => p.id === projectToDeleteId)?.name}</strong>
                   </AlertDialogDescription>
               </AlertDialogHeader>
               <div className="py-2">
                    <Input
                        id="confirm-project-name"
                        value={confirmProjectName}
                        onChange={(e) => setConfirmProjectName(e.target.value)}
                        placeholder="Type project name to confirm"
                        className="mt-2"
                    />
               </div>
               <AlertDialogFooter>
                   <AlertDialogCancel onClick={() => setProjectToDeleteId(null)}>Cancel</AlertDialogCancel>
                   <AlertDialogAction
                       onClick={handleConfirmDeleteProject}
                       disabled={
                            deleteProjectMutation.isPending ||
                            confirmProjectName.trim().toLowerCase() !== (projects.find(p => p.id === projectToDeleteId)?.name.toLowerCase() ?? ' ')
                        }
                       className={cn(buttonVariants({ variant: "destructive" }))}
                   >
                       {deleteProjectMutation.isPending ? 'Deleting...' : 'Delete Project'}
                   </AlertDialogAction>
               </AlertDialogFooter>
           </AlertDialogContent>
       </AlertDialog>

      {/* Add Members Dialog */}
      <AddMembersDialog
        isOpen={isAddMembersDialogOpen}
        onOpenChange={setIsAddMembersDialogOpen}
        onSaveMembers={handleAddMembersToNewProject} // Use the specific handler for new projects
        existingMembers={[]} // Start with no members for a new project
        projectId={newlyCreatedProjectId} // Pass the ID of the newly created project
      />


      <main className="flex-1 p-6">
         {isLoadingProjects ? ( // Use React Query loading state
             <Card className="flex flex-col items-center justify-center min-h-[400px] border-dashed border-2">
                 <CardHeader className="text-center">
                     <CardTitle>Loading Project Data...</CardTitle>
                     <CardDescription>Please wait while the application loads.</CardDescription>
                 </CardHeader>
                  <CardContent>
                     {/* Optional: Add a spinner or loading indicator here */}
                 </CardContent>
             </Card>
         ) : (
             <Tabs value={activeMainTab} onValueChange={handleMainTabChange} className="w-full">
                {/* Main Tabs List - Updated grid cols (now 6 main tabs) */}
               <TabsList className="grid w-full grid-cols-6 mb-6">
                 {Object.entries(tabsConfig).map(([key, config]) => (
                     <TabsTrigger key={key} value={key}>
                        <config.icon className="mr-2 h-4 w-4" /> {config.label}
                     </TabsTrigger>
                 ))}
               </TabsList>

                {/* Sub Tabs and Content Area */}
                 <div className="mt-4">
                     {/* Render Sub Tabs only if the active main tab has them */}
                     {tabsConfig[activeMainTab as keyof typeof tabsConfig]?.subTabs && (
                         <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mb-6">
                            <TabsList className={cn(
                                "grid w-full",
                                // Adjust grid cols dynamically based on the number of subtabs
                                `grid-cols-${Object.keys(tabsConfig[activeMainTab as keyof typeof tabsConfig].subTabs!).length}`
                            )}>
                                {Object.entries(tabsConfig[activeMainTab as keyof typeof tabsConfig].subTabs!).map(([subKey, subConfig]) => (
                                    <TabsTrigger key={`${activeMainTab}/${subKey}`} value={`${activeMainTab}/${subKey}`}>
                                       <subConfig.icon className="mr-2 h-4 w-4" /> {subConfig.label}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                             {/* Content will be rendered below based on the combined activeTab state */}
                         </Tabs>
                     )}

                    {/* Render Content based on the full activeTab state */}
                    {renderActiveTabContent()}
                 </div>
             </Tabs>
          )}
      </main>

      <footer className="text-center p-4 text-xs text-muted-foreground border-t">
          Project Prism - Agile Reporting Made Easy
      </footer>
    </div>
  );

}
