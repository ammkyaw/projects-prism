
"use client";

import type { ChangeEvent } from 'react';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'; // Added useRef
import * as XLSX from 'xlsx';
import { Button, buttonVariants } from '@/components/ui/button'; // Import buttonVariants
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, HomeIcon, BarChart, ListPlus, PlusCircle, NotebookPen, Users, Trash2, CalendarDays, Edit, UsersRound, Package, LayoutDashboard, IterationCw, Layers, BarChartBig, Settings, Activity, Eye, Filter, GitCommitVertical } from 'lucide-react'; // Added new icons
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";


// Main Content Components (Tabs) - Renamed and New Placeholders
import DashboardTab from '@/components/dashboard-tab'; // Renamed from HomeTab
import BacklogTab from '@/components/backlog-tab';
// PlanningTab is now part of Sprints section
import MembersTab from '@/components/teams/members-tab'; // Updated path
import HolidaysTab from '@/components/settings/holidays-tab'; // Updated path
import TeamsTab from '@/components/teams/teams-tab'; // Updated path
import AddMembersDialog from '@/components/add-members-dialog';

// Placeholder Sub-Tab Components
import SprintSummaryTab from '@/components/sprints/sprint-summary-tab'; // Updated path
import SprintPlanningTab from '@/components/sprints/sprint-planning-tab'; // New component for planning
import SprintRetrospectiveTab from '@/components/sprints/sprint-retrospective-tab'; // Updated path
import BacklogPrioritizationTab from '@/components/backlog/backlog-prioritization-tab'; // Updated path
import BacklogGroomingTab from '@/components/backlog/backlog-grooming-tab'; // Corrected import path
import AnalyticsChartsTab from '@/components/analytics-charts-tab';
import AnalyticsReportsTab from '@/components/analytics-reports-tab'; // Updated path


import type { SprintData, Sprint, AppData, Project, SprintDetailItem, SprintPlanning, Member, SprintStatus, Task, HolidayCalendar, PublicHoliday, Team, TeamMember } from '@/types/sprint-data'; // Updated Task type reference
import { initialSprintData, initialSprintPlanning, taskStatuses, initialTeam, initialBacklogTask, taskPriorities } from '@/types/sprint-data'; // Import taskPriorities
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { addDays, format, parseISO, isPast, isValid } from 'date-fns';

// Helper function (remains the same)
const calculateSprintMetrics = (startDateStr: string | undefined, duration: string | undefined): { totalDays: number, endDate: string } => {
    let totalDays = 0;
    let calendarDaysToAdd = 0;

    if (!duration || !startDateStr) return { totalDays: 0, endDate: 'N/A' };


    switch (duration) {
        case "1 Week": totalDays = 5; calendarDaysToAdd = 6; break;
        case "2 Weeks": totalDays = 10; calendarDaysToAdd = 13; break;
        case "3 Weeks": totalDays = 15; calendarDaysToAdd = 20; break;
        case "4 Weeks": totalDays = 20; calendarDaysToAdd = 27; break;
        default: return { totalDays: 0, endDate: 'N/A' };
    }

     if (!isValid(parseISO(startDateStr))) {
         return { totalDays: 0, endDate: 'N/A' };
     }

    try {
        const startDate = parseISO(startDateStr);
        const endDate = addDays(startDate, calendarDaysToAdd);
        return { totalDays, endDate: format(endDate, 'yyyy-MM-dd') };
    } catch (e) {
        console.error("Error calculating end date:", e);
        return { totalDays, endDate: 'N/A' };
    }
};

// Helper to create an empty task row for validation/defaults
const createEmptyTaskRow = (): Task => ({
  id: '',
  ticketNumber: '',
  description: '',
  status: 'To Do',
  qaEstimatedTime: '2d',
  bufferTime: '1d',
});


export default function Home() {
  const [projects, setProjects] = useState<AppData>([]); // State for all projects
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  // Combined state for active main and sub tab. Format: "main/sub" or just "main"
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [newProjectName, setNewProjectName] = useState<string>('');
  const [isNewProjectDialogOpen, setIsNewProjectDialogOpen] = useState<boolean>(false); // Set default to false
  const [isAddMembersDialogOpen, setIsAddMembersDialogOpen] = useState<boolean>(false);
  const [newlyCreatedProjectId, setNewlyCreatedProjectId] = useState<string | null>(null); // Track ID for Add Members dialog
  const { toast } = useToast();
  // const [resetManualFormKey, setResetManualFormKey] = useState(0); // State to trigger form reset (No longer needed as Entry tab removed)
  const [clientNow, setClientNow] = useState<Date | null>(null); // For client-side date comparison
  const [isLoading, setIsLoading] = useState(true); // Add loading state

  // Get current date on client mount to avoid hydration issues
  useEffect(() => {
     setClientNow(new Date());
  }, []);

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
      if (mainTabKey === 'dashboard') {
         setActiveTab('dashboard');
      } else {
         const defaultSub = defaultSubTabs[mainTabKey] || ''; // Fallback to empty string if no default
         setActiveTab(`${mainTabKey}/${defaultSub}`);
      }
  };

  // Get the active main tab key from the combined state
  const activeMainTab = useMemo(() => activeTab.split('/')[0], [activeTab]);


  // Effect to load data from localStorage on mount with improved validation and logging
  useEffect(() => {
    console.log("Attempting to load data from localStorage...");
    setIsLoading(true); // Start loading
    try {
       const savedData = localStorage.getItem('appData');
       if (savedData) {
         console.log("Found data in localStorage:", savedData.substring(0, 500) + '...'); // Log truncated data
         let parsedData: any; // Use any initially for safe parsing
         try {
           parsedData = JSON.parse(savedData);
           console.log("Successfully parsed localStorage data");

           // --- Robust Validation ---
           if (!Array.isArray(parsedData)) {
             console.error("Validation Error: Stored data is not an array. Data:", parsedData);
             throw new Error("Stored data is not an array.");
           }

           const validatedProjects: Project[] = [];

           for (const projectData of parsedData) {
             // Validate basic project structure
             if (
               !projectData || typeof projectData !== 'object' ||
               !projectData.id || typeof projectData.id !== 'string' ||
               !projectData.name || typeof projectData.name !== 'string'
             ) {
               console.warn("Skipping invalid project data (basic structure):", projectData);
               continue; // Skip this invalid project
             }
             console.log(`Validating project: ${projectData.name} (ID: ${projectData.id})`);

             // --- Validate and Sanitize Members ---
             const validatedMembers: Member[] = [];
             if (Array.isArray(projectData.members)) {
               projectData.members.forEach((memberData: any) => {
                 if (
                   memberData && typeof memberData === 'object' &&
                   memberData.id && typeof memberData.id === 'string' && // Corrected type check
                   memberData.name && typeof memberData.name === 'string' &&
                   memberData.role && typeof memberData.role === 'string'
                 ) {
                   validatedMembers.push({
                     id: memberData.id,
                     name: memberData.name,
                     role: memberData.role,
                     holidayCalendarId: typeof memberData.holidayCalendarId === 'string' || memberData.holidayCalendarId === null ? memberData.holidayCalendarId : null, // Allow null
                   });
                 } else {
                   console.warn(`Skipping invalid member data in project ${projectData.id}:`, memberData);
                 }
               });
             } else {
                console.warn(`Project ${projectData.id} has invalid or missing 'members' array.`);
             }

             // --- Validate and Sanitize Holiday Calendars ---
             const validatedCalendars: HolidayCalendar[] = [];
             if (Array.isArray(projectData.holidayCalendars)) {
               projectData.holidayCalendars.forEach((calData: any) => {
                 if (
                   calData && typeof calData === 'object' &&
                   calData.id && typeof calData.id === 'string' &&
                   calData.name && typeof calData.name === 'string' &&
                   Array.isArray(calData.holidays)
                 ) {
                   const validatedHolidays: PublicHoliday[] = [];
                   calData.holidays.forEach((holData: any) => {
                     if (
                       holData && typeof holData === 'object' &&
                       holData.id && typeof holData.id === 'string' &&
                       holData.name && typeof holData.name === 'string' &&
                       holData.date && typeof holData.date === 'string' &&
                       isValid(parseISO(holData.date)) // Validate date format
                     ) {
                       validatedHolidays.push({
                         id: holData.id,
                         name: holData.name,
                         date: holData.date,
                       });
                     } else {
                       console.warn(`Skipping invalid holiday data in calendar ${calData.id} (project ${projectData.id}):`, holData);
                     }
                   });
                   validatedCalendars.push({
                     id: calData.id,
                     name: calData.name,
                     countryCode: typeof calData.countryCode === 'string' ? calData.countryCode : undefined, // Accept string or undefined
                     holidays: validatedHolidays,
                   });
                 } else {
                   console.warn(`Skipping invalid calendar data in project ${projectData.id}:`, calData);
                 }
               });
             } else {
               // Allow missing holidayCalendars, default to empty array later
             }

              // --- Validate and Sanitize Teams ---
              const validatedTeams: Team[] = [];
              if (Array.isArray(projectData.teams)) {
                projectData.teams.forEach((teamData: any) => {
                  if (
                    teamData && typeof teamData === 'object' &&
                    teamData.id && typeof teamData.id === 'string' &&
                    teamData.name && typeof teamData.name === 'string' &&
                    Array.isArray(teamData.members)
                  ) {
                    const validatedTeamMembers: TeamMember[] = [];
                    teamData.members.forEach((tmData: any) => {
                      if (tmData && typeof tmData === 'object' && tmData.memberId && typeof tmData.memberId === 'string') {
                        // Check if memberId actually exists in the validatedMembers list
                        if (validatedMembers.some(m => m.id === tmData.memberId)) {
                          validatedTeamMembers.push({ memberId: tmData.memberId });
                        } else {
                           console.warn(`Skipping invalid team member reference (member ID ${tmData.memberId} not found) in team ${teamData.id} (project ${projectData.id}):`, tmData);
                        }
                      } else {
                         console.warn(`Skipping invalid team member data in team ${teamData.id} (project ${projectData.id}):`, tmData);
                      }
                    });
                    // Validate leadMemberId exists if present
                    let leadMemberId = (typeof teamData.leadMemberId === 'string' || teamData.leadMemberId === null) ? teamData.leadMemberId : null;
                    if (leadMemberId && !validatedMembers.some(m => m.id === leadMemberId)) {
                         console.warn(`Invalid leadMemberId (${leadMemberId}) in team ${teamData.id} (project ${projectData.id}). Resetting to null.`);
                         leadMemberId = null;
                    }

                    validatedTeams.push({
                      id: teamData.id,
                      name: teamData.name,
                      members: validatedTeamMembers,
                      leadMemberId: leadMemberId,
                    });
                  } else {
                     console.warn(`Skipping invalid team data in project ${projectData.id}:`, teamData);
                  }
                });
              } else {
                // Allow missing teams, default to empty array later
              }

              // --- Validate and Sanitize Backlog ---
             const validatedBacklog: Task[] = [];
             if (Array.isArray(projectData.backlog)) {
                 projectData.backlog.forEach((taskData: any) => {
                     // Basic validation: ID and backlogId/ticketNumber
                     if (
                         taskData && typeof taskData === 'object' &&
                         taskData.id && typeof taskData.id === 'string' &&
                         (taskData.backlogId || taskData.ticketNumber) // Must have one of these
                         // Other fields are optional or validated below
                     ) {
                         const backlogId = typeof taskData.backlogId === 'string' ? taskData.backlogId : typeof taskData.ticketNumber === 'string' ? taskData.ticketNumber : taskData.id;
                         validatedBacklog.push({
                             id: taskData.id,
                             backlogId: backlogId,
                             ticketNumber: typeof taskData.ticketNumber === 'string' ? taskData.ticketNumber : backlogId, // Default ticketNumber to backlogId if missing
                             title: typeof taskData.title === 'string' ? taskData.title : undefined,
                             description: typeof taskData.description === 'string' ? taskData.description : undefined,
                             acceptanceCriteria: typeof taskData.acceptanceCriteria === 'string' ? taskData.acceptanceCriteria : undefined, // Added acceptance criteria
                             storyPoints: (typeof taskData.storyPoints === 'number' || typeof taskData.storyPoints === 'string') ? taskData.storyPoints : undefined,
                             priority: typeof taskData.priority === 'string' && taskPriorities.includes(taskData.priority as any) ? taskData.priority as Task['priority'] : 'Medium', // Validate and default priority
                             taskType: typeof taskData.taskType === 'string' ? taskData.taskType as Task['taskType'] : undefined,
                             createdDate: typeof taskData.createdDate === 'string' && isValid(parseISO(taskData.createdDate)) ? taskData.createdDate : undefined,
                             initiator: typeof taskData.initiator === 'string' ? taskData.initiator : undefined,
                             dependsOn: Array.isArray(taskData.dependsOn) ? taskData.dependsOn.filter((dep: any): dep is string => typeof dep === 'string') : undefined,
                              // Sprint-specific fields should be undefined in backlog
                             devEstimatedTime: undefined,
                             qaEstimatedTime: undefined,
                             bufferTime: undefined,
                             assignee: undefined,
                             reviewer: undefined,
                             status: undefined, // No status in backlog context
                             startDate: undefined,
                         });
                     } else {
                         console.warn(`Skipping invalid backlog task data in project ${projectData.id}:`, taskData);
                     }
                 });
             } else {
                 // Allow missing backlog, default to empty array later
             }


             // --- Validate and Sanitize SprintData ---
             let validatedSprintData: SprintData = { ...initialSprintData }; // Start with defaults
             if (projectData.sprintData && typeof projectData.sprintData === 'object') {
                 if (Array.isArray(projectData.sprintData.sprints)) {
                       const validatedSprints: Sprint[] = [];
                       projectData.sprintData.sprints.forEach((sprintData: any) => {
                           if (
                               sprintData && typeof sprintData === 'object' &&
                               typeof sprintData.sprintNumber === 'number' && !isNaN(sprintData.sprintNumber) &&
                               typeof sprintData.startDate === 'string' && isValid(parseISO(sprintData.startDate)) &&
                               typeof sprintData.duration === 'string'
                               // Optional fields checked below
                           ) {
                               let status: SprintStatus = sprintData.status ?? 'Planned';
                               const metrics = calculateSprintMetrics(sprintData.startDate, sprintData.duration);

                               // Auto-complete based on date if status is not already 'Completed'
                               if (metrics.endDate !== 'N/A' && clientNow && isPast(parseISO(metrics.endDate)) && status !== 'Completed') {
                                   status = 'Completed';
                               }

                                // Validate Planning Tasks (new and spillover) - Now these are sprint tasks
                                const validateTasks = (tasks: any[] | undefined): Task[] => {
                                   if (!Array.isArray(tasks)) return [];
                                   const emptyTask = createEmptyTaskRow(); // Use sprint task defaults
                                   return tasks.map((taskData: any) => {
                                       if (!taskData || typeof taskData !== 'object') return null; // Skip invalid task data
                                       const ticketNumber = typeof taskData.ticketNumber === 'string' ? taskData.ticketNumber : taskData.backlogId ?? `task_${Date.now()}`;
                                       return {
                                           id: typeof taskData.id === 'string' ? taskData.id : `task_load_${Date.now()}_${Math.random()}`,
                                           backlogId: typeof taskData.backlogId === 'string' ? taskData.backlogId : undefined, // Keep original backlog id if present
                                           ticketNumber: ticketNumber,
                                           title: typeof taskData.title === 'string' ? taskData.title : undefined,
                                           description: typeof taskData.description === 'string' ? taskData.description : undefined,
                                           acceptanceCriteria: typeof taskData.acceptanceCriteria === 'string' ? taskData.acceptanceCriteria : undefined,
                                           storyPoints: (typeof taskData.storyPoints === 'number' || typeof taskData.storyPoints === 'string') ? taskData.storyPoints : emptyTask.storyPoints,
                                           devEstimatedTime: typeof taskData.devEstimatedTime === 'string' ? taskData.devEstimatedTime : emptyTask.devEstimatedTime,
                                           qaEstimatedTime: typeof taskData.qaEstimatedTime === 'string' ? taskData.qaEstimatedTime : emptyTask.qaEstimatedTime,
                                           bufferTime: typeof taskData.bufferTime === 'string' ? taskData.bufferTime : emptyTask.bufferTime,
                                           assignee: typeof taskData.assignee === 'string' ? taskData.assignee : emptyTask.assignee,
                                           reviewer: typeof taskData.reviewer === 'string' ? taskData.reviewer : emptyTask.reviewer,
                                           status: typeof taskData.status === 'string' && taskStatuses.includes(taskData.status as any) ? taskData.status : emptyTask.status,
                                           startDate: typeof taskData.startDate === 'string' && isValid(parseISO(taskData.startDate)) ? taskData.startDate : emptyTask.startDate,
                                           priority: typeof taskData.priority === 'string' && taskPriorities.includes(taskData.priority as any) ? taskData.priority as Task['priority'] : 'Medium', // Validate and default priority
                                           dependsOn: Array.isArray(taskData.dependsOn) ? taskData.dependsOn.filter((dep: any): dep is string => typeof dep === 'string') : undefined,
                                           // Backlog specific fields should not be present in sprint tasks unless needed for context
                                           taskType: undefined, // Not typically stored in sprint task
                                           createdDate: undefined,
                                           initiator: undefined,
                                           // Legacy fields - keep optional for compatibility
                                           devTime: typeof taskData.devTime === 'string' ? taskData.devTime : undefined,
                                       };
                                   }).filter((task): task is Task => task !== null); // Filter out nulls
                               };


                               // Validate planning object structure
                               const loadedPlanning = sprintData.planning;
                               const validatedPlanning: SprintPlanning = {
                                   goal: (loadedPlanning && typeof loadedPlanning.goal === 'string') ? loadedPlanning.goal : initialSprintPlanning.goal,
                                   newTasks: validateTasks(loadedPlanning?.newTasks),
                                   spilloverTasks: validateTasks(loadedPlanning?.spilloverTasks),
                                   definitionOfDone: (loadedPlanning && typeof loadedPlanning.definitionOfDone === 'string') ? loadedPlanning.definitionOfDone : initialSprintPlanning.definitionOfDone,
                                   testingStrategy: (loadedPlanning && typeof loadedPlanning.testingStrategy === 'string') ? loadedPlanning.testingStrategy : initialSprintPlanning.testingStrategy,
                               };


                               // Validate Sprint Details (legacy)
                               const validatedDetails: SprintDetailItem[] = [];
                               if (Array.isArray(sprintData.details)) {
                                   sprintData.details.forEach((detailData: any) => {
                                       if (
                                           detailData && typeof detailData === 'object' &&
                                           typeof detailData.id === 'string' &&
                                           typeof detailData.ticketNumber === 'string' &&
                                           typeof detailData.developer === 'string' &&
                                           typeof detailData.storyPoints === 'number' && !isNaN(detailData.storyPoints) &&
                                           typeof detailData.devTime === 'string'
                                       ) {
                                           validatedDetails.push({
                                               id: detailData.id,
                                               ticketNumber: detailData.ticketNumber,
                                               developer: detailData.developer,
                                               storyPoints: detailData.storyPoints,
                                               devTime: detailData.devTime,
                                           });
                                       } else {
                                           console.warn(`Skipping invalid sprint detail in sprint ${sprintData.sprintNumber} (project ${projectData.id}):`, detailData);
                                       }
                                   });
                               }


                               validatedSprints.push({
                                   sprintNumber: sprintData.sprintNumber,
                                   startDate: sprintData.startDate,
                                   endDate: metrics.endDate,
                                   duration: sprintData.duration,
                                   committedPoints: typeof sprintData.committedPoints === 'number' ? sprintData.committedPoints : 0,
                                   completedPoints: typeof sprintData.completedPoints === 'number' ? sprintData.completedPoints : 0,
                                   totalDays: metrics.totalDays,
                                   status: status,
                                   details: validatedDetails, // Use validated details
                                   planning: validatedPlanning, // Use validated planning
                               });
                           } else {
                               console.warn(`Skipping invalid sprint data in project ${projectData.id}:`, sprintData);
                           }
                       });

                        validatedSprintData = {
                           sprints: validatedSprints.sort((a, b) => a.sprintNumber - b.sprintNumber), // Keep sorted
                           totalStoryPoints: validatedSprints.reduce((sum, s) => sum + s.completedPoints, 0),
                           daysInSprint: validatedSprints.length > 0 ? Math.max(...validatedSprints.map(s => s.totalDays)) : 0,
                        };
                 } else {
                      console.warn(`Invalid or missing 'sprints' array within sprintData for project ${projectData.id}:`, projectData.sprintData);
                 }
             } else {
               console.warn(`Invalid or missing sprintData structure in project ${projectData.id}:`, projectData.sprintData);
             }

             // Add the validated project
             validatedProjects.push({
               id: projectData.id,
               name: projectData.name,
               members: validatedMembers.sort((a, b) => a.name.localeCompare(b.name)), // Keep sorted
               holidayCalendars: validatedCalendars.sort((a, b) => a.name.localeCompare(b.name)), // Keep sorted
               teams: validatedTeams.sort((a, b) => a.name.localeCompare(b.name)), // Add validated teams, sorted
               backlog: validatedBacklog.sort((a, b) => (taskPriorities.indexOf(a.priority!) - taskPriorities.indexOf(b.priority!)) || (a.backlogId ?? '').localeCompare(b.backlogId ?? '')), // Add validated backlog, sorted by priority then backlogId
               sprintData: validatedSprintData,
             });
             console.log(`Successfully validated and added project: ${projectData.name}`);
           }

           // --- End Robust Validation ---

           console.log("Validation complete. Final projects:", validatedProjects);
           setProjects(validatedProjects);

           // Set selected project ID: prioritize last viewed, then first project, then null
           const lastProjectId = localStorage.getItem('selectedProjectId');
           console.log("Last selected project ID from localStorage:", lastProjectId);
           if (lastProjectId && validatedProjects.some(p => p.id === lastProjectId)) {
             console.log(`Setting selected project ID to last viewed: ${lastProjectId}`);
             setSelectedProjectId(lastProjectId);
           } else if (validatedProjects.length > 0) {
             console.log(`Setting selected project ID to first project: ${validatedProjects[0].id}`);
             setSelectedProjectId(validatedProjects[0].id);
           } else {
             console.log("No valid projects found or last selected invalid. Setting selected project ID to null.");
             setSelectedProjectId(null);
           }

         } catch (error: any) {
             console.error("CRITICAL: Failed to parse or validate project data from localStorage. Error:", error.message, error.stack);
             // Avoid clearing localStorage immediately unless the data is truly unrecoverable/malformed JSON
             if (error instanceof SyntaxError) {
                console.warn("SyntaxError encountered. Clearing corrupted localStorage data.");
                localStorage.removeItem('appData');
                localStorage.removeItem('selectedProjectId');
             } else {
                console.warn("Validation error encountered. Data might be partially invalid. Retaining localStorage data for inspection.", error);
             }
             setProjects([]);
             setSelectedProjectId(null);
             toast({
               variant: "destructive",
               title: "Data Load Error",
               description: `Could not load project data. Storage might contain invalid data. Error: ${error?.message || 'Unknown error'}. Please check console for details.`,
             });
         } finally {
              console.log("Finished loading data attempt.");
              setIsLoading(false); // End loading
         }
       } else {
         console.log("No data found in localStorage ('appData'). Initializing empty state.");
         setProjects([]);
         setSelectedProjectId(null);
         setIsLoading(false); // End loading
       }
    } catch (err) {
       console.error("Error accessing localStorage:", err);
       toast({
         variant: "destructive",
         title: "Storage Error",
         description: "Could not access local storage. Data cannot be loaded or saved.",
       });
       setProjects([]);
       setSelectedProjectId(null);
       setIsLoading(false);
    }
  }, [clientNow, toast]); // Dependency on clientNow ensures it runs after mount, toast for notifications

    // Effect to save data to localStorage whenever projects change
    useEffect(() => {
        // Only run save logic after initial load is complete
        if (!isLoading) {
            console.log("Projects state changed, attempting to save to localStorage...");
            try {
                const dataToSave = JSON.stringify(projects);
                console.log("Stringified data to save:", dataToSave.substring(0, 500) + '...'); // Log truncated data
                localStorage.setItem('appData', dataToSave);
                console.log("Successfully saved project data to localStorage.");
            } catch (error: any) {
                console.error("CRITICAL: Failed to save project data to localStorage. Error:", error.message, error.stack);
                toast({
                    variant: "destructive",
                    title: "Save Error",
                    description: "Could not save project data locally. Data might be too large or storage is unavailable.",
                });
            }
        } else {
            console.log("Skipping save to localStorage during initial load.");
        }
    }, [projects, isLoading, toast]); // Add isLoading dependency

    // Effect to save the selected project ID
    useEffect(() => {
        if (!isLoading) { // Only save after initial load
            try {
                if (selectedProjectId) {
                    console.log(`Saving selected project ID to localStorage: ${selectedProjectId}`);
                    localStorage.setItem('selectedProjectId', selectedProjectId);
                } else {
                    console.log("No project selected, removing selectedProjectId from localStorage.");
                    // Remove if no project is selected to avoid stale references
                    localStorage.removeItem('selectedProjectId');
                }
            } catch (err) {
                console.error("Error accessing localStorage for selectedProjectId:", err);
                 toast({
                   variant: "destructive",
                   title: "Storage Error",
                   description: "Could not save selected project.",
                 });
            }
        } else {
            console.log("Skipping saving selected project ID during initial load.");
        }
    }, [selectedProjectId, isLoading, toast]);


  // Find the currently selected project object
  const selectedProject = useMemo(() => {
    const project = projects.find(p => p.id === selectedProjectId) ?? null;
    console.log("Selected project determined:", project?.name ?? 'None');
    return project;
  }, [projects, selectedProjectId]);

  // Handler to save planning data AND potentially update sprint status (used by PlanningTab)
   const handleSavePlanningAndUpdateStatus = useCallback((sprintNumber: number, planningData: SprintPlanning, newStatus?: SprintStatus) => {
     if (!selectedProjectId) {
        toast({ variant: "destructive", title: "Error", description: "No project selected." });
        return;
     }
     let currentProjectName = 'N/A';
     let statusUpdateMessage = '';

     setProjects(prevProjects => {
        const updatedProjects = prevProjects.map(p => {
          if (p.id === selectedProjectId) {
              currentProjectName = p.name; // Capture project name here
              let tempSprints = [...(p.sprintData.sprints ?? [])]; // Create a mutable copy (handle null/undefined)

              // First pass: Deactivate other sprints if the target is becoming active
              if (newStatus === 'Active') {
                  tempSprints = tempSprints.map(otherS =>
                      otherS.sprintNumber !== sprintNumber && otherS.status === 'Active'
                          ? { ...otherS, status: 'Planned' }
                          : otherS
                  );
              }

              // Second pass: Update the target sprint's planning and status
              const updatedSprints = tempSprints.map(s => {
                  if (s.sprintNumber === sprintNumber) {
                      let finalStatus = s.status;
                      if (newStatus && newStatus !== s.status) {
                          finalStatus = newStatus;
                          statusUpdateMessage = ` Sprint ${sprintNumber} status updated to ${newStatus}.`;
                      }
                      // Ensure task IDs are present and correctly typed before saving
                       const emptyTask = createEmptyTaskRow();
                      const validatedPlanning: SprintPlanning = {
                           ...planningData,
                           newTasks: (planningData.newTasks || []).map(task => ({
                              ...task,
                              id: task.id || `task_save_new_${Date.now()}_${Math.random()}`,
                              devEstimatedTime: task.devEstimatedTime ?? emptyTask.devEstimatedTime, // Preserve or default
                              qaEstimatedTime: task.qaEstimatedTime ?? emptyTask.qaEstimatedTime,
                              bufferTime: task.bufferTime ?? emptyTask.bufferTime,
                           })),
                           spilloverTasks: (planningData.spilloverTasks || []).map(task => ({
                              ...task,
                              id: task.id || `task_save_spill_${Date.now()}_${Math.random()}`,
                              devEstimatedTime: task.devEstimatedTime ?? emptyTask.devEstimatedTime, // Preserve or default
                              qaEstimatedTime: task.qaEstimatedTime ?? emptyTask.qaEstimatedTime,
                              bufferTime: task.bufferTime ?? emptyTask.bufferTime,
                           })),
                      };
                      return { ...s, planning: validatedPlanning, status: finalStatus };
                  }
                  return s;
              });

              return {
                  ...p,
                  sprintData: {
                      ...(p.sprintData ?? initialSprintData), // Use initialSprintData if sprintData is null/undefined
                      sprints: updatedSprints,
                  },
              };
          }
          return p;
        });
        // Trigger save effect by returning a new array reference
        return [...updatedProjects];
     });
     toast({ title: "Success", description: `Planning data saved for Sprint ${sprintNumber}.${statusUpdateMessage} in project '${currentProjectName}'` });
   }, [selectedProjectId, toast]);


  // Handler to create a new sprint and save its initial planning data (used by PlanningTab)
  const handleCreateAndPlanSprint = useCallback((
    sprintDetails: Omit<Sprint, 'details' | 'planning' | 'status' | 'committedPoints' | 'completedPoints'>,
    planningData: SprintPlanning
  ) => {
    if (!selectedProjectId) {
       toast({ variant: "destructive", title: "Error", description: "No project selected." });
       return;
    }
    let projectNameForToast = 'N/A';
    let projectWasUpdated = false;

    setProjects(prevProjects => {
       const updatedProjects = prevProjects.map(p => {
        if (p.id === selectedProjectId) {
            projectNameForToast = p.name;
            if ((p.sprintData.sprints ?? []).some(s => s.sprintNumber === sprintDetails.sprintNumber)) { // Handle null/undefined
                console.error(`Sprint number ${sprintDetails.sprintNumber} already exists for project ${p.name}.`);
                 // Error handled by returning original 'p'
                return p;
            }

             // Validate planning data before creating
             const emptyTask = createEmptyTaskRow();
             const validatedPlanning: SprintPlanning = {
                ...planningData,
                 newTasks: (planningData.newTasks || []).map(task => ({
                    ...task,
                    id: task.id || `task_create_new_${Date.now()}_${Math.random()}`,
                    devEstimatedTime: task.devEstimatedTime ?? emptyTask.devEstimatedTime,
                    qaEstimatedTime: task.qaEstimatedTime ?? emptyTask.qaEstimatedTime,
                    bufferTime: task.bufferTime ?? emptyTask.bufferTime,
                 })),
                 spilloverTasks: (planningData.spilloverTasks || []).map(task => ({
                    ...task,
                    id: task.id || `task_create_spill_${Date.now()}_${Math.random()}`,
                    devEstimatedTime: task.devEstimatedTime ?? emptyTask.devEstimatedTime,
                    qaEstimatedTime: task.qaEstimatedTime ?? emptyTask.qaEstimatedTime,
                    bufferTime: task.bufferTime ?? emptyTask.bufferTime,
                 })),
             };

            const newSprint: Sprint = {
                ...sprintDetails,
                committedPoints: 0,
                completedPoints: 0,
                status: 'Planned',
                details: [],
                planning: validatedPlanning,
            };

            const updatedSprints = [...(p.sprintData.sprints ?? []), newSprint]; // Handle null/undefined
            updatedSprints.sort((a, b) => a.sprintNumber - b.sprintNumber);
            projectWasUpdated = true; // Mark that an update occurred

            return {
                ...p,
                sprintData: {
                    ...(p.sprintData ?? initialSprintData), // Use initialSprintData if sprintData is null/undefined
                    sprints: updatedSprints,
                    daysInSprint: Math.max(p.sprintData?.daysInSprint || 0, newSprint.totalDays), // Handle null/undefined
                },
            };
        }
        return p;
      });

      // If no update happened (e.g., sprint number existed), return the previous state
      if (!projectWasUpdated) {
         // Using setTimeout to ensure toast doesn't interfere with rendering updates
         setTimeout(() => {
            toast({ variant: "destructive", title: "Error", description: `Sprint number ${sprintDetails.sprintNumber} already exists in project '${projectNameForToast}'.` });
         }, 0);
          return prevProjects;
      }

       // Return the updated projects array
       return updatedProjects;
    });

     // Show toast *after* setProjects has potentially completed its update cycle
     if (projectWasUpdated) {
         // Using setTimeout to ensure toast doesn't interfere with rendering updates
         setTimeout(() => {
              toast({ title: "Success", description: `Sprint ${sprintDetails.sprintNumber} created and planned for project '${projectNameForToast}'.` });
         }, 0);
     }

  }, [selectedProjectId, toast]);


  // Handler to save members for the *selected* project
  const handleSaveMembers = useCallback((updatedMembers: Member[]) => {
    if (!selectedProjectId) {
      toast({ variant: "destructive", title: "Error", description: "No project selected." });
      return;
    }
    let currentProjectName = 'N/A';
    setProjects(prevProjects => {
      const updatedProjects = prevProjects.map(p => {
        if (p.id === selectedProjectId) {
          currentProjectName = p.name; // Capture name
          return { ...p, members: updatedMembers };
        }
        return p;
      });
      return updatedProjects;
    });
    toast({ title: "Success", description: `Members updated for project '${currentProjectName}'.` });
  }, [selectedProjectId, toast]);

   // Handler to save holiday calendars for the *selected* project
   const handleSaveHolidayCalendars = useCallback((updatedCalendars: HolidayCalendar[]) => {
     if (!selectedProjectId) {
         toast({ variant: "destructive", title: "Error", description: "No project selected." });
         return;
     }

     let currentProjectName = 'N/A';
     let membersToUpdate: Member[] = [];

     setProjects(prevProjects => {
         const updatedProjects = prevProjects.map(p => {
             if (p.id === selectedProjectId) {
                 currentProjectName = p.name; // Capture name
                 // Keep track of members whose calendars might change
                 membersToUpdate = (p.members || []).map(member => {
                     if (member.holidayCalendarId && !updatedCalendars.some(cal => cal.id === member.holidayCalendarId)) {
                         return { ...member, holidayCalendarId: null }; // Mark for update
                     }
                     return member;
                 }).filter((m, index) => m.holidayCalendarId !== (p.members || [])[index].holidayCalendarId); // Only keep those that changed

                 const updatedMembers = (p.members || []).map(member => ({
                     ...member,
                     holidayCalendarId: member.holidayCalendarId && updatedCalendars.some(cal => cal.id === member.holidayCalendarId) ? member.holidayCalendarId : null,
                 }));

                 return { ...p, holidayCalendars: updatedCalendars, members: updatedMembers };
             }
             return p;
         });
         return updatedProjects;
     });

     // Show toasts *after* the state update
      setTimeout(() => {
         toast({ title: "Success", description: `Holiday calendars updated for project '${currentProjectName}'.` });
         membersToUpdate.forEach(member => {
             toast({ variant: "warning", title: "Calendar Unassigned", description: `Holiday calendar assigned to ${member.name} was deleted or is no longer available.` });
         });
      }, 0);

 }, [selectedProjectId, toast]);

   // Handler to save teams for the *selected* project
   const handleSaveTeams = useCallback((updatedTeams: Team[]) => {
     if (!selectedProjectId) {
         toast({ variant: "destructive", title: "Error", description: "No project selected." });
         return;
     }
     let currentProjectName = 'N/A';
     setProjects(prevProjects => {
         const updatedProjects = prevProjects.map(p => {
             if (p.id === selectedProjectId) {
                 currentProjectName = p.name; // Capture name
                 // Optionally, add validation here to ensure team members and leads still exist
                 const validTeams = updatedTeams.map(team => {
                     const validMembers = team.members.filter(tm => (p.members || []).some(m => m.id === tm.memberId));
                     let validLead = team.leadMemberId;
                     if (validLead && !(p.members || []).some(m => m.id === validLead)) {
                          console.warn(`Lead member ID ${validLead} for team ${team.name} not found. Resetting.`);
                          validLead = null;
                     }
                     return { ...team, members: validMembers, leadMemberId: validLead };
                 });
                 return { ...p, teams: validTeams };
             }
             return p;
         });
         return updatedProjects;
     });
     toast({ title: "Success", description: `Teams updated for project '${currentProjectName}'.` });
   }, [selectedProjectId, toast]);

    // Handler to save backlog data for the selected project
   const handleSaveBacklog = useCallback((updatedBacklog: Task[]) => {
       if (!selectedProjectId) {
           toast({ variant: "destructive", title: "Error", description: "No project selected." });
           return;
       }
       let currentProjectName = 'N/A';
       setProjects(prevProjects => {
           const updatedProjects = prevProjects.map(p => {
               if (p.id === selectedProjectId) {
                   currentProjectName = p.name; // Capture name
                   // Validate tasks before saving? (Ensure IDs, required fields, etc.)
                   const validatedBacklog = updatedBacklog.map(task => ({
                       ...task,
                       id: task.id || `backlog_save_${Date.now()}_${Math.random()}`, // Ensure ID
                       // Status is not saved for backlog items
                       priority: task.priority ?? 'Medium', // Ensure priority
                   }));
                   return { ...p, backlog: validatedBacklog };
               }
               return p;
           });
           return updatedProjects;
       });
       toast({ title: "Success", description: `Backlog updated for project '${currentProjectName}'.` });
   }, [selectedProjectId, toast]);


   // Handler to move a backlog item to a sprint
   const handleMoveToSprint = useCallback((backlogItemId: string, targetSprintNumber: number) => {
       if (!selectedProjectId) {
           toast({ variant: "destructive", title: "Error", description: "No project selected." });
           return;
       }
       let currentProjectName = 'N/A';
       let movedItemDetails: string | null = null;

       setProjects(prevProjects => {
           const updatedProjects = prevProjects.map(p => {
               if (p.id === selectedProjectId) {
                    currentProjectName = p.name; // Capture name
                   const backlogItemIndex = (p.backlog ?? []).findIndex(item => item.id === backlogItemId);
                   if (backlogItemIndex === -1) {
                       console.error("Backlog item not found:", backlogItemId);
                       // Don't show toast here, maybe already removed?
                       return p; // Return unchanged project
                   }

                   const backlogItem = p.backlog![backlogItemIndex];
                   movedItemDetails = `${backlogItem.backlogId} (${backlogItem.title || 'No Title'})`; // For toast message

                   const targetSprintIndex = (p.sprintData.sprints ?? []).findIndex(s => s.sprintNumber === targetSprintNumber);
                   if (targetSprintIndex === -1) {
                        console.error("Target sprint not found:", targetSprintNumber);
                        toast({ variant: "destructive", title: "Error", description: "Target sprint not found." });
                        return p; // Return unchanged project
                   }

                   // Create the task for the sprint
                   const sprintTask: Task = {
                       ...backlogItem,
                       id: `sprint_task_${Date.now()}_${Math.random()}`, // New ID for the sprint task instance
                       status: 'To Do', // Set initial status for sprint
                       startDate: undefined, // Sprint start date is set during planning
                       devEstimatedTime: backlogItem.devEstimatedTime ?? '', // Carry over estimates if they exist, else empty
                       qaEstimatedTime: backlogItem.qaEstimatedTime ?? '2d', // Default QA time
                       bufferTime: backlogItem.bufferTime ?? '1d', // Default Buffer time
                       // Carry over other relevant fields if needed (assignee, reviewer, etc.)
                       assignee: backlogItem.assignee,
                       reviewer: backlogItem.reviewer,
                       // Clear backlog-specific fields that shouldn't be in sprint context
                       taskType: undefined,
                       createdDate: undefined,
                       initiator: undefined,
                   };

                   // Remove item from backlog
                   const updatedBacklog = [...p.backlog!];
                   updatedBacklog.splice(backlogItemIndex, 1);

                   // Add item to the target sprint's newTasks
                   const updatedSprints = [...p.sprintData.sprints];
                   const targetSprint = updatedSprints[targetSprintIndex];
                   const updatedPlanning = {
                       ...(targetSprint.planning ?? initialSprintPlanning),
                       newTasks: [...(targetSprint.planning?.newTasks ?? []), sprintTask],
                   };
                   updatedSprints[targetSprintIndex] = { ...targetSprint, planning: updatedPlanning };

                   return {
                       ...p,
                       backlog: updatedBacklog,
                       sprintData: {
                           ...p.sprintData,
                           sprints: updatedSprints,
                       }
                   };
               }
               return p;
           });
           return updatedProjects;
       });

       if (movedItemDetails) {
         toast({ title: "Item Moved", description: `Backlog item '${movedItemDetails}' moved to Sprint ${targetSprintNumber}.` });
       }
   }, [selectedProjectId, toast]);


  // Handler to add members to the *newly created* project (from dialog)
   const handleAddMembersToNewProject = useCallback((addedMembers: Member[]) => {
       if (!newlyCreatedProjectId) return;
       let newProjectName = 'the new project';

       setProjects(prevProjects => {
         const updatedProjects = prevProjects.map(p => {
           if (p.id === newlyCreatedProjectId) {
             newProjectName = p.name; // Capture name
             return { ...p, members: [...(p.members || []), ...addedMembers] };
           }
           return p;
         });
         return updatedProjects;
       });
        // Using setTimeout to avoid potential nested updates
       setTimeout(() => {
          toast({ title: "Members Added", description: `Members added to project '${newProjectName}'.` });
          setIsAddMembersDialogOpen(false); // Close the dialog
          setNewlyCreatedProjectId(null); // Reset the tracked ID
       }, 50); // Adjusted timeout
   }, [newlyCreatedProjectId, toast]);

  // Handler to delete a sprint
  const handleDeleteSprint = useCallback((sprintNumber: number) => {
    if (!selectedProjectId) {
      toast({ variant: "destructive", title: "Error", description: "No project selected." });
      return;
    }
    let currentProjectName = 'N/A';
    setProjects(prevProjects => {
      const updatedProjects = prevProjects.map(p => {
        if (p.id === selectedProjectId) {
          currentProjectName = p.name; // Capture name
          const filteredSprints = (p.sprintData.sprints ?? []).filter(s => s.sprintNumber !== sprintNumber); // Handle null/undefined
          return {
            ...p,
            sprintData: {
              ...(p.sprintData ?? initialSprintData), // Use initialSprintData if sprintData is null/undefined
              sprints: filteredSprints,
              // Recalculate overall metrics if needed
              totalStoryPoints: filteredSprints.reduce((sum, s) => sum + s.completedPoints, 0),
              daysInSprint: filteredSprints.length > 0 ? Math.max(...filteredSprints.map(s => s.totalDays)) : 0,
            },
          };
        }
        return p;
      });
      return updatedProjects;
    });
    toast({ title: "Sprint Deleted", description: `Sprint ${sprintNumber} deleted from project '${currentProjectName}'.` });
  }, [selectedProjectId, toast]);


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

       // Sprint Details Sheet (Legacy)
       const detailsExist = selectedProject.sprintData?.sprints?.some(s => s.details && s.details.length > 0);
       if (detailsExist) {
           const allDetails: any[] = [];
           selectedProject.sprintData.sprints.forEach(sprint => {
               (sprint.details || []).forEach(detail => {
                   allDetails.push({
                       'SprintNumber': sprint.sprintNumber,
                       'TicketNumber': detail.ticketNumber,
                       'Developer': detail.developer,
                       'StoryPoints': detail.storyPoints,
                       'DevelopmentTime': detail.devTime,
                   });
               });
           });
           if (allDetails.length > 0) {
               const wsDetails = XLSX.utils.json_to_sheet(allDetails);
               XLSX.utils.book_append_sheet(wb, wsDetails, 'Sprint Details (Legacy)');
           }
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
                      // Include legacy fields if they exist, marked as legacy
                      'DevTime (Legacy)': task.devTime,
                    });


                   sprint.planning.newTasks.forEach(task => planningTasksData.push(mapTaskToRow(task, 'New')));
                   sprint.planning.spilloverTasks.forEach(task => planningTasksData.push(mapTaskToRow(task, 'Spillover')));
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
      members: [], // Initialize with empty members array
      holidayCalendars: [], // Initialize with empty holiday calendars
      teams: [], // Initialize with empty teams array
      backlog: [], // Initialize with empty backlog array
    };

    // Update projects state first
    setProjects(prevProjects => [...prevProjects, newProject]);
    setSelectedProjectId(newProject.id);
    setNewProjectName('');
    setIsNewProjectDialogOpen(false);
    setNewlyCreatedProjectId(newProject.id); // Track the new project ID for dialog
    setActiveTab("dashboard"); // Set dashboard as active after creating

    // Defer the toast and dialog opening slightly
     setTimeout(() => {
        toast({ title: "Project Created", description: `Project "${trimmedName}" created successfully.` });
        setIsAddMembersDialogOpen(true); // Open the dialog AFTER state update
    }, 50); // Increased timeout slightly
  };

  // Define the tab structure
  const tabsConfig = {
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
              prioritization: { label: "Prioritization", icon: Filter, component: BacklogPrioritizationTab },
              grooming: { label: "Grooming", icon: Edit, component: BacklogGroomingTab },
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
            case 'dashboard': // Main dashboard tab
               componentProps = { ...componentProps, sprintData: selectedProject.sprintData };
               break;
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
                    backlog: selectedProject.backlog ?? [],
                 };
                break;
            case 'sprints/retrospective':
                 // Add props for Retrospective tab if needed
                 componentProps = { ...componentProps, sprints: selectedProject.sprintData.sprints ?? [] };
                 break;
            case 'backlog/management':
                componentProps = {
                    ...componentProps,
                    initialBacklog: selectedProject.backlog ?? [],
                    onSaveBacklog: handleSaveBacklog,
                    members: selectedProject.members ?? [],
                    sprints: selectedProject.sprintData.sprints ?? [],
                    onMoveToSprint: handleMoveToSprint,
                 };
                break;
            case 'backlog/prioritization':
                componentProps = { ...componentProps, backlog: selectedProject.backlog ?? [] };
                break;
            case 'backlog/grooming':
                // Add props for these tabs if needed
                componentProps = {
                     ...componentProps,
                     initialBacklog: selectedProject.backlog ?? [], // Ensure default []
                     onSaveBacklog: handleSaveBacklog
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
               // Handle main tab case (e.g., dashboard)
                if (!mainConfig.subTabs) {
                    ActiveComponent = mainConfig.component;
                     if (mainKey === 'dashboard') {
                        componentProps = { ...componentProps, sprintData: selectedProject.sprintData };
                     }
                    // Add props for other main tabs without subtabs if any in the future
                } else {
                   // Default to first sub-tab if only main key is provided but it has subtabs
                    const firstSubKey = Object.keys(mainConfig.subTabs)[0];
                    const firstSubConfig = mainConfig.subTabs[firstSubKey as keyof typeof mainConfig.subTabs];
                    ActiveComponent = firstSubConfig.component;
                    // Recalculate props based on default sub tab
                    // This might need adjustments based on which props each default sub-tab needs
                    // Example: if default for sprints is summary:
                    if (mainKey === 'sprints') {
                       componentProps = { ...componentProps, sprintData: selectedProject.sprintData, onDeleteSprint: handleDeleteSprint };
                    }
                    // Add similar logic for other default sub-tabs
                }
        }
    } else {
        // Handle main tabs without sub-tabs (like Dashboard)
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
            <h1 className="text-2xl font-semibold text-primary">Sprint Stats</h1>
             <Select
               value={selectedProjectId ?? undefined}
               onValueChange={(value) => {
                  if (value === 'loading') return; // Prevent selecting the loading indicator
                   console.log(`Project selected: ${value}`);
                   setSelectedProjectId(value);
                   setActiveTab("dashboard"); // Reset to dashboard tab on project change
                   // setResetManualFormKey(prevKey => prevKey + 1); // No longer needed
               }}
               disabled={isLoading || projects.length === 0} // Disable while loading or if no projects
             >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={isLoading ? "Loading..." : "Select a project"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Projects</SelectLabel>
                     {isLoading ? (
                       <SelectItem value="loading" disabled>Loading projects...</SelectItem>
                     ) : projects.length > 0 ? (
                        projects.map(project => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
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
                                placeholder="E.g., Website Redesign"
                                autoFocus
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" onClick={handleCreateNewProject}>Create Project</Button>
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
        </div>
      </header>

      {/* Add Members Dialog */}
      <AddMembersDialog
        isOpen={isAddMembersDialogOpen}
        onOpenChange={setIsAddMembersDialogOpen}
        onSaveMembers={handleAddMembersToNewProject} // Use the specific handler for new projects
        existingMembers={[]} // Start with no members for a new project
        projectId={newlyCreatedProjectId} // Pass the ID of the newly created project
      />


      <main className="flex-1 p-6">
         {isLoading ? (
             <Card className="flex flex-col items-center justify-center min-h-[400px] border-dashed border-2">
                 <CardHeader className="text-center">
                     <CardTitle>Loading Project Data...</CardTitle>
                     <CardDescription>Please wait while the application loads.</CardDescription>
                 </CardHeader>
             </Card>
         ) : (
             <Tabs value={activeMainTab} onValueChange={handleMainTabChange} className="w-full">
                {/* Main Tabs List */}
               <TabsList className="grid w-full grid-cols-6 mb-6">
                 {Object.entries(tabsConfig).map(([key, config]) => (
                     <TabsTrigger key={key} value={key}>
                        <config.icon className="mr-2 h-4 w-4" /> {config.label}
                     </TabsTrigger>
                 ))}
               </TabsList>

                {/* Sub Tabs and Content Area */}
                {selectedProject ? (
                    <div className="mt-4">
                         {/* Render Sub Tabs only if the active main tab has them */}
                         {tabsConfig[activeMainTab as keyof typeof tabsConfig]?.subTabs && (
                             <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mb-6">
                                <TabsList className="grid w-full grid-cols-3"> {/* Adjust cols based on max subtabs */}
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
                 ) : (
                    // Render the "No Project Selected" card if no project is selected
                     <Card className="flex flex-col items-center justify-center min-h-[400px] border-dashed border-2 mt-4">
                        <CardHeader className="text-center">
                           <CardTitle>No Project Selected</CardTitle>
                           <CardDescription>Please select a project from the dropdown above, or create a new one.</CardDescription>
                        </CardHeader>
                     </Card>
                 )}
             </Tabs>
          )}
      </main>

      <footer className="text-center p-4 text-xs text-muted-foreground border-t">
          Sprint Stats - Agile Reporting Made Easy
      </footer>
    </div>
  );
}


    