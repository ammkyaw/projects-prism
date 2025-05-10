// src/app/prism/page.tsx
'use client';

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Download,
  BarChart,
  ListPlus,
  PlusCircle,
  NotebookPen,
  Users,
  Trash2,
  CalendarDays,
  Edit,
  UsersRound,
  Package,
  LayoutDashboard,
  IterationCw,
  Layers,
  BarChartBig,
  Settings,
  Eye,
  GitCommitVertical,
  History,
  Loader2,
  AlertTriangle,
  ClipboardCheck,
  ArrowUpDown,
  HelpCircle, // Added HelpCircle for the new button
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter as AlertDFooter, // Renamed to avoid conflict with CardFooter
  AlertDialogHeader as AlertDHeader, // Renamed
  AlertDialogTitle as AlertDTitle, // Renamed
} from '@/components/ui/alert-dialog';

// Main Content Components (Tabs)
import DashboardTab from '@/components/backlog/dashboard-tab';
import RiskTab from '@/components/risk/risk-tab';
import EvaluationTab from '@/components/evaluation/evaluation-tab';

// Sprint Sub-Tab Components
import SprintSummaryTab from '@/components/sprints/sprint-summary-tab';
import SprintPlanningTab from '@/components/sprints/sprint-planning-tab';
import SprintRetrospectiveTab from '@/components/sprints/sprint-retrospective-tab';

// Backlog Sub-Tab Components
import BacklogTab from '@/components/backlog/backlog-tab';
import BacklogGroomingTab from '@/components/backlog/backlog-grooming-tab';
import HistoryTab from '@/components/backlog/history-tab';

// Settings Sub-tab Components
import MembersTab from '@/components/settings/members-tab';
import TeamsTab from '@/components/settings/teams-tab';
import HolidaysTab from '@/components/settings/holidays-tab';
import AddMembersDialog from '@/components/dialogs/add-members-dialog';

// Analytics Sub-Tab Components
import AnalyticsChartsTab from '@/components/analytics/analytics-charts-tab';
import AnalyticsReportsTab from '@/components/analytics/analytics-reports-tab';

import type {
  Project,
  Member,
  Task,
  ToastFun,
  Sprint,
} from '@/types/sprint-data';
import { initialSprintData } from '@/types/sprint-data';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useSprintsActions } from '@/hooks/use-sprints-actions';
import { useBacklogActions } from '@/hooks/use-backlog-actions';
import { useSettingsActions } from '@/hooks/use-settings-actions';
import { generateNextBacklogIdHelper } from '@/lib/utils';
import { ModeToggle } from '@/components/mode-toggle';
import {
  useProjects,
  useUpdateProject,
  useDeleteProject,
} from '@/hooks/use-projects';
import { handleExport } from '@/lib/export';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import QueryProvider from '@/components/query-provider';
import HelpModal from '@/components/help/help-modal'; // Added HelpModal import
import FloatingHelpButton from '@/components/help/floating-help-button'; // Added FloatingHelpButton import

export default function PrismPageWrapper() {
  return (
    <QueryProvider>
      <PrismPage />
    </QueryProvider>
  );
}

function PrismPage() {
  const router = useRouter();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null
  );
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [newProjectName, setNewProjectName] = useState<string>('');
  const [isNewProjectDialogOpen, setIsNewProjectDialogOpen] =
    useState<boolean>(false);
  const [isAddMembersDialogOpen, setIsAddMembersDialogOpen] =
    useState<boolean>(false);
  const [newlyCreatedProjectId, setNewlyCreatedProjectId] = useState<
    string | null
  >(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState<boolean>(false);
  const [projectToDeleteId, setProjectToDeleteId] = useState<string | null>(
    null
  );
  const [confirmProjectName, setConfirmProjectName] = useState<string>('');
  const [clientNow, setClientNow] = useState<Date | null>(null);
  const { toast } = useToast();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [loginToastShown, setLoginToastShown] = useState(false);
  const [
    selectedSprintForPlanning,
    setSelectedSprintForPlanning,
  ] = useState<Sprint | null>(null);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false); // State for Help Modal

  const {
    data: projects = [],
    isLoading: isLoadingProjects,
    error: projectsError,
    isSuccess: isProjectsSuccess,
  } = useProjects();
  const updateProjectMutation = useUpdateProject();
  const deleteProjectMutation = useDeleteProject();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
        router.push('/');
      }
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    setClientNow(new Date());
  }, []);

  useEffect(() => {
    if (isAuthenticated && isProjectsSuccess && !loginToastShown) {
      setTimeout(() => {
        toast({
          title: 'Login Successful',
          description: 'Welcome to Projects Prism!',
        });
        setLoginToastShown(true);
      }, 100);
    }

    if (!isLoadingProjects && projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
    } else if (!isLoadingProjects && projects.length === 0) {
      setSelectedProjectId(null);
    }
  }, [
    isLoadingProjects,
    projects,
    selectedProjectId,
    isAuthenticated,
    isProjectsSuccess,
    loginToastShown,
    toast,
  ]);

  const selectedProject = useMemo(() => {
    return projects.find((p) => p.id === selectedProjectId) ?? null;
  }, [projects, selectedProjectId]);

  const plannableSprints = useMemo(() => {
    if (!selectedProject) return [];
    return (selectedProject.sprintData?.sprints ?? []).filter(
      (s) => s.status === 'Active' || s.status === 'Planned'
    );
  }, [selectedProject]);

  const defaultSubTabs: Record<string, string> = {
    sprints: 'overview',
    backlog: 'management',
    analytics: 'charts',
    settings: 'members',
  };

  const activeMainTab = useMemo(() => {
    return activeTab.split('/')[0];
  }, [activeTab]);

  const handleMainTabChange = useCallback(
    (mainTabKey: string) => {
      setSelectedSprintForPlanning(null);
      if (['dashboard', 'risk', 'evaluation'].includes(mainTabKey)) {
        setActiveTab(mainTabKey);
      } else {
        const defaultSub = defaultSubTabs[mainTabKey] || '';
        setActiveTab(`${mainTabKey}/${defaultSub}`);
      }
    },
    [defaultSubTabs]
  );

  const navigateToSprintPlanning = useCallback((sprintToPlan: Sprint) => {
    setSelectedSprintForPlanning(sprintToPlan);
    setActiveTab('sprints/planning');
  }, []);

  const handleBackToOverview = useCallback(() => {
    setActiveTab('sprints/overview');
    setSelectedSprintForPlanning(null); // Clear selected sprint when going back
  }, []);

  useEffect(() => {
    if (activeMainTab !== 'sprints' || activeTab !== 'sprints/planning') {
      setSelectedSprintForPlanning(null);
    }
  }, [activeMainTab, activeTab]);

  const updateProjectData = useCallback(
    (updatedProject: Project) => {
      if (!updatedProject.id) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Project ID missing, cannot update.',
        });
        return;
      }
      updateProjectMutation.mutate(updatedProject, {
        onError: (error) => {
          toast({
            variant: 'destructive',
            title: 'Save Error',
            description: `Failed to save changes: ${error.message}`,
          });
        },
      });
    },
    [updateProjectMutation, toast]
  );

  const {
    handleSavePlanningAndUpdateStatus,
    handleCreateAndPlanSprint,
    handleCompleteSprint,
    handleDeleteSprint,
  } = useSprintsActions({
    selectedProject,
    updateProjectData,
    toast,
    clientNow,
    projects,
    selectedProjectId,
  });

  const {
    handleSaveNewBacklogItems,
    handleUpdateSavedBacklogItem,
    handleMoveToSprint,
    handleMoveSelectedBacklogItemsToSprint,
    handleRevertTaskToBacklog,
    handleSplitBacklogItem,
    handleDeleteSavedBacklogItem,
    handleMergeBacklogItems,
    handleUndoBacklogAction,
  } = useBacklogActions({
    selectedProject,
    updateProjectData,
    toast,
    projects,
    selectedProjectId,
  });

  const { handleSaveMembers, handleSaveHolidayCalendars, handleSaveTeams } =
    useSettingsActions({
      selectedProject,
      updateProjectData,
      toast,
    });

  const handleAddMembersToNewProject = useCallback(
    (addedMembers: Member[]) => {
      if (!newlyCreatedProjectId) return;
      const projectToUpdate = projects.find(
        (p) => p.id === newlyCreatedProjectId
      );
      if (!projectToUpdate) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Newly created project not found.',
        });
        setIsAddMembersDialogOpen(false);
        setNewlyCreatedProjectId(null);
        return;
      }
      const updatedProject: Project = {
        ...projectToUpdate,
        members: [...(projectToUpdate.members || []), ...addedMembers],
      };
      updateProjectData(updatedProject);
      toast({
        title: 'Members Added',
        description: `Members added to project '${projectToUpdate.name}'.`,
      });
      setIsAddMembersDialogOpen(false);
      setNewlyCreatedProjectId(null);
    },
    [
      newlyCreatedProjectId,
      projects,
      updateProjectData,
      toast,
      setIsAddMembersDialogOpen,
      setNewlyCreatedProjectId,
    ]
  );

  const handleCreateNewProject = () => {
    const trimmedName = newProjectName.trim();
    if (!trimmedName) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Project name cannot be empty.',
      });
      return;
    }
    if (
      projects.some((p) => p.name.toLowerCase() === trimmedName.toLowerCase())
    ) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: `Project with name "${trimmedName}" already exists.`,
      });
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
        setSelectedProjectId(variables.id);
        setNewProjectName('');
        setIsNewProjectDialogOpen(false);
        setNewlyCreatedProjectId(variables.id);
        setActiveTab('dashboard');
        setTimeout(() => {
          toast({
            title: 'Project Created',
            description: `Project "${trimmedName}" created successfully.`,
          });
          setIsAddMembersDialogOpen(true);
        }, 50);
      },
      onError: (error) => {
        toast({
          variant: 'destructive',
          title: 'Create Error',
          description: `Failed to create project: ${error.message}`,
        });
      },
    });
  };

  const handleOpenDeleteDialog = (projectId: string | null) => {
    if (!projectId) return;
    setProjectToDeleteId(projectId);
    setConfirmProjectName('');
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDeleteProject = () => {
    if (!projectToDeleteId) return;
    const project = projects.find((p) => p.id === projectToDeleteId);
    if (!project) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Project not found.',
      });
      setIsDeleteDialogOpen(false);
      setProjectToDeleteId(null);
      return;
    }
    if (
      confirmProjectName.trim().toLowerCase() !== project.name.toLowerCase()
    ) {
      toast({
        variant: 'destructive',
        title: 'Confirmation Failed',
        description: 'Project name does not match.',
      });
      return;
    }
    deleteProjectMutation.mutate(projectToDeleteId, {
      onSuccess: () => {
        toast({
          title: 'Project Deleted',
          description: `Project "${project.name}" has been deleted.`,
        });
        setIsDeleteDialogOpen(false);
        setProjectToDeleteId(null);
        if (selectedProjectId === projectToDeleteId) {
          const remainingProjects = projects.filter(
            (p) => p.id !== projectToDeleteId
          );
          setSelectedProjectId(
            remainingProjects.length > 0 ? remainingProjects[0].id : null
          );
        }
      },
      onError: (error) => {
        toast({
          variant: 'destructive',
          title: 'Delete Error',
          description: `Failed to delete project: ${error.message}`,
        });
        setIsDeleteDialogOpen(false);
        setProjectToDeleteId(null);
      },
    });
  };

  const tabsConfig: Record<
    string,
    {
      label: string;
      icon: React.ElementType;
      component?: React.ElementType;
      subTabs?: Record<
        string,
        { label: string; icon: React.ElementType; component: React.ElementType }
      >;
    }
  > = {
    dashboard: {
      label: 'Dashboard',
      icon: LayoutDashboard,
      component: DashboardTab,
    },
    sprints: {
      label: 'Sprints',
      icon: IterationCw,
      subTabs: {
        overview: {
          label: 'Overview',
          icon: Eye,
          component: SprintSummaryTab,
        },
        planning: {
          label: 'Planning',
          icon: NotebookPen,
          component: SprintPlanningTab,
        },
        retrospective: {
          label: 'Retrospective',
          icon: GitCommitVertical,
          component: SprintRetrospectiveTab,
        },
      },
    },
    backlog: {
      label: 'Backlog',
      icon: Layers,
      subTabs: {
        management: {
          label: 'Management',
          icon: Package,
          component: BacklogTab,
        },
        grooming: {
          label: 'Grooming',
          icon: Edit,
          component: BacklogGroomingTab,
        },
        history: { label: 'History', icon: History, component: HistoryTab },
      },
    },
    risk: { label: 'Risk', icon: AlertTriangle, component: RiskTab },
    evaluation: {
      label: 'Evaluation',
      icon: ClipboardCheck,
      component: EvaluationTab,
    },
    analytics: {
      label: 'Analytics',
      icon: BarChartBig,
      subTabs: {
        charts: {
          label: 'Charts',
          icon: BarChart,
          component: AnalyticsChartsTab,
        },
        reports: {
          label: 'Reports',
          icon: ListPlus,
          component: AnalyticsReportsTab,
        },
      },
    },
    settings: {
      label: 'Settings',
      icon: Settings,
      subTabs: {
        members: { label: 'Members', icon: Users, component: MembersTab },
        teams: { label: 'Teams', icon: UsersRound, component: TeamsTab },
        holidays: {
          label: 'Holidays',
          icon: CalendarDays,
          component: HolidaysTab,
        },
      },
    },
  };

  const renderActiveTabContent = () => {
    if (isAuthenticated === null) {
      return (
        <Card className="flex min-h-[400px] flex-col items-center justify-center border-2 border-dashed">
          <CardHeader className="text-center">
            <CardTitle>Authenticating...</CardTitle>
            <CardDescription>Please wait.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </CardContent>
        </Card>
      );
    }

    if (!selectedProject) {
      if (isLoadingProjects) {
        return (
          <Card className="flex min-h-[400px] flex-col items-center justify-center border-2 border-dashed">
            <CardHeader className="text-center">
              <CardTitle>Loading Project Data...</CardTitle>
              <CardDescription>
                Please wait while the application loads.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </CardContent>
          </Card>
        );
      }
      if (projectsError) {
        return (
          <Card className="flex min-h-[400px] flex-col items-center justify-center border-2 border-dashed border-destructive">
            <CardHeader className="text-center">
              <CardTitle className="text-destructive">
                Error Loading Projects
              </CardTitle>
              <CardDescription>
                Could not load project data. Please check your connection or
                Firebase setup.
              </CardDescription>
              <CardDescription className="mt-2 text-xs text-muted-foreground">
                {projectsError.message}
              </CardDescription>
            </CardHeader>
          </Card>
        );
      }
      if (projects.length === 0) {
        return (
          <Card className="flex min-h-[400px] flex-col items-center justify-center border-2 border-dashed">
            <CardHeader className="text-center">
              <CardTitle>No Projects Found</CardTitle>
              <CardDescription>
                Create your first project using the 'New Project' button above.
              </CardDescription>
            </CardHeader>
          </Card>
        );
      }
      return (
        <Card className="flex min-h-[400px] flex-col items-center justify-center border-2 border-dashed">
          <CardHeader className="text-center">
            <CardTitle>No Project Selected</CardTitle>
            <CardDescription>
              Please select a project from the dropdown above, or create a new
              one.
            </CardDescription>
          </CardHeader>
        </Card>
      );
    }

    const [mainKey, subKey] = activeTab.split('/');
    const mainConfig = tabsConfig[mainKey as keyof typeof tabsConfig];
    if (!mainConfig) return null;

    let ActiveComponent: React.ElementType | undefined;
    let componentProps: any = {
      projectId: selectedProject.id,
      projectName: selectedProject.name,
    };

    if (mainConfig.subTabs && subKey) {
      const subConfig =
        mainConfig.subTabs[subKey as keyof typeof mainConfig.subTabs];
      if (!subConfig) return null;
      ActiveComponent = subConfig.component;

      switch (`${mainKey}/${subKey}`) {
        case 'sprints/overview':
          componentProps = {
            ...componentProps,
            sprintData: selectedProject.sprintData,
            onDeleteSprint: handleDeleteSprint,
            onViewSprintPlanning: navigateToSprintPlanning,
          };
          break;
        case 'sprints/planning':
          const availableBacklogItems =
            selectedProject.backlog?.filter(
              (task) => !task.movedToSprint && !task.historyStatus
            ) ?? [];
          componentProps = {
            ...componentProps,
            sprints: selectedProject.sprintData.sprints ?? [],
            initialSelectedSprint: selectedSprintForPlanning,
            onSavePlanning: handleSavePlanningAndUpdateStatus,
            onCreateAndPlanSprint: handleCreateAndPlanSprint,
            onCompleteSprint: handleCompleteSprint,
            members: selectedProject.members ?? [],
            holidayCalendars: selectedProject.holidayCalendars ?? [],
            teams: selectedProject.teams ?? [],
            backlog: availableBacklogItems,
            onRevertTask: handleRevertTaskToBacklog,
            onAddBacklogItems: handleMoveSelectedBacklogItemsToSprint,
            onBackToOverview: handleBackToOverview, // Pass new prop
          };
          break;
        case 'sprints/retrospective':
          componentProps = {
            ...componentProps,
            sprints: selectedProject.sprintData.sprints ?? [],
          };
          break;
        case 'backlog/management':
          componentProps = {
            ...componentProps,
            initialBacklog: selectedProject.backlog ?? [],
            onSaveNewItems: handleSaveNewBacklogItems,
            onUpdateSavedItem: handleUpdateSavedBacklogItem,
            onDeleteSavedItem: handleDeleteSavedBacklogItem,
            members: selectedProject.members ?? [],
            sprints: selectedProject.sprintData.sprints ?? [],
            onMoveToSprint: handleMoveToSprint,
            generateNextBacklogId: generateNextBacklogIdHelper,
            allProjectBacklogItems: selectedProject.backlog ?? [],
          };
          break;
        case 'backlog/grooming':
          componentProps = {
            ...componentProps,
            initialBacklog:
              selectedProject.backlog?.filter((task) => !task.historyStatus) ??
              [],
            onSaveBacklog: (groomedBacklog: Task[]) => {
              const historicalItems = (selectedProject.backlog ?? []).filter(
                (task) => task.historyStatus
              );
              const fullBacklog = [...groomedBacklog, ...historicalItems];
              const updatedProject: Project = {
                ...selectedProject,
                backlog: fullBacklog,
              };
              updateProjectData(updatedProject);
              toast({
                title: 'Backlog Groomed',
                description: 'Changes saved.',
              });
            },
            onSplitBacklogItem: handleSplitBacklogItem,
            onMergeBacklogItems: handleMergeBacklogItems,
            onUndoBacklogAction: handleUndoBacklogAction,
            generateNextBacklogId: generateNextBacklogIdHelper,
            allProjectBacklogItems: selectedProject.backlog ?? [],
          };
          break;
        case 'backlog/history':
          componentProps = {
            ...componentProps,
            historyItems:
              selectedProject.backlog?.filter((task) => !!task.historyStatus) ??
              [],
            onUndoBacklogAction: handleUndoBacklogAction,
          };
          break;
        case 'analytics/charts':
          componentProps = {
            ...componentProps,
            sprintData: selectedProject.sprintData,
            members: selectedProject.members ?? [],
          };
          break;
        case 'analytics/reports':
          componentProps = {
            ...componentProps,
            sprintData: selectedProject.sprintData,
          };
          break;
        case 'settings/members':
          componentProps = {
            ...componentProps,
            initialMembers: selectedProject.members ?? [],
            onSaveMembers: handleSaveMembers,
            holidayCalendars: selectedProject.holidayCalendars ?? [],
          };
          break;
        case 'settings/teams':
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
          componentProps = {};
          break;
      }
    } else {
      ActiveComponent = mainConfig.component;
      if (mainKey === 'dashboard') {
        componentProps = {
          ...componentProps,
          sprintData: selectedProject.sprintData,
        };
      } else if (mainKey === 'risk') {
        componentProps = {
          ...componentProps,
          sprintData: selectedProject.sprintData,
          backlog: selectedProject.backlog,
        };
      } else if (mainKey === 'evaluation') {
        componentProps = {
          ...componentProps,
          sprintData: selectedProject.sprintData,
          backlog: selectedProject.backlog,
          members: selectedProject.members,
        };
      }
    }

    if (!ActiveComponent) {
      console.error(
        `Error: ActiveComponent is undefined for tab: ${activeTab}. MainKey: ${mainKey}, SubKey: ${subKey}`
      );
      return (
        <div>Error: Tab component not found. Please check configuration.</div>
      );
    }
    return <ActiveComponent {...componentProps} />;
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2 md:gap-4">
          <h1 className="text-lg font-semibold text-primary md:text-2xl">
            Projects Prism
          </h1>
          <Select
            value={selectedProjectId ?? undefined}
            onValueChange={(value) => {
              if (value === 'loading' || value === 'no-projects') return;
              setSelectedProjectId(value);
              setActiveTab('dashboard');
              setSelectedSprintForPlanning(null);
            }}
            disabled={isLoadingProjects || projects.length === 0}
          >
            <SelectTrigger className="w-[150px] md:w-[200px]">
              <SelectValue
                placeholder={
                  isLoadingProjects
                    ? 'Loading...'
                    : projects.length === 0
                      ? 'No projects yet'
                      : 'Select a project'
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Projects</SelectLabel>
                {isLoadingProjects ? (
                  <SelectItem value="loading" disabled>
                    Loading projects...
                  </SelectItem>
                ) : projects.length > 0 ? (
                  projects.map((project) => (
                    <div
                      key={project.id}
                      className="flex items-center justify-between pr-2"
                    >
                      <SelectItem value={project.id} className="flex-1">
                        {project.name}
                      </SelectItem>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="ml-2 h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDeleteDialog(project.id);
                        }}
                        aria-label={`Delete project ${project.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <SelectItem value="no-projects" disabled>
                    No projects yet
                  </SelectItem>
                )}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Dialog
            open={isNewProjectDialogOpen}
            onOpenChange={setIsNewProjectDialogOpen}
          >
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="p-2 md:px-3 md:py-2"
              >
                <PlusCircle className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">New Project</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
                <DialogDescription>
                  Enter a name for your new project. Click create when you're
                  done.
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
                <Button
                  type="button"
                  onClick={handleCreateNewProject}
                  disabled={updateProjectMutation.isPending}
                >
                  {updateProjectMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Project'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          {selectedProject &&
            (selectedProject.sprintData?.sprints?.length > 0 ||
              selectedProject.members?.length > 0 ||
              selectedProject.holidayCalendars?.length > 0 ||
              selectedProject.teams?.length > 0 ||
              selectedProject.backlog?.length > 0) && (
              <Button
                onClick={() => handleExport(selectedProject, toast as ToastFun)}
                variant="outline"
                size="sm"
                className="p-2 md:px-3 md:py-2"
              >
                <Download className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Export Project Data</span>
              </Button>
            )}
          <ModeToggle />
        </div>
      </header>

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDHeader>
            <AlertDTitle>
              Delete Project "
              {projects.find((p) => p.id === projectToDeleteId)?.name}"?
            </AlertDTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              project and all its associated data.
              <br />
              To confirm, please type the project name below:
              <strong className="mt-1 block">
                {projects.find((p) => p.id === projectToDeleteId)?.name}
              </strong>
            </AlertDialogDescription>
          </AlertDHeader>
          <div className="py-2">
            <Input
              id="confirm-project-name"
              value={confirmProjectName}
              onChange={(e) => setConfirmProjectName(e.target.value)}
              placeholder="Type project name to confirm"
              className="mt-2"
            />
          </div>
          <AlertDFooter>
            <AlertDialogCancel onClick={() => setProjectToDeleteId(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteProject}
              disabled={
                deleteProjectMutation.isPending ||
                confirmProjectName.trim().toLowerCase() !==
                  (projects
                    .find((p) => p.id === projectToDeleteId)
                    ?.name.toLowerCase() ?? ' ')
              }
              className={cn(buttonVariants({ variant: 'destructive' }))}
            >
              {deleteProjectMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Project'
              )}
            </AlertDialogAction>
          </AlertDFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AddMembersDialog
        isOpen={isAddMembersDialogOpen}
        onOpenChange={setIsAddMembersDialogOpen}
        onSaveMembers={handleAddMembersToNewProject}
        existingMembers={[]}
        projectId={newlyCreatedProjectId}
      />

      <main className="flex-1 p-6">
        {isLoadingProjects ? (
          <Card className="flex min-h-[400px] flex-col items-center justify-center border-2 border-dashed">
            <CardHeader className="text-center">
              <CardTitle>Loading Project Data...</CardTitle>
              <CardDescription>
                Please wait while the application loads.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </CardContent>
          </Card>
        ) : (
          <Tabs
            value={activeMainTab}
            onValueChange={handleMainTabChange}
            className="w-full"
          >
            <TabsList className="sticky top-16 z-10 mb-6 grid w-full grid-cols-4 bg-background shadow-sm sm:grid-cols-7">
              {Object.entries(tabsConfig).map(([key, config]) => (
                <TabsTrigger
                  key={key}
                  value={key}
                  className={cn(
                    'data-[state=active]:border-primary data-[state=active]:shadow-none',
                    'hover:border-primary hover:shadow-sm', // Hover effect
                    key === activeMainTab
                      ? 'border-b-2 border-primary' // Active tab style
                      : 'border-b-2 border-transparent' // Inactive tab style
                  )}
                >
                  <config.icon className="h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline">{config.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="mt-4">
              {tabsConfig[activeMainTab as keyof typeof tabsConfig]
                ?.subTabs && (
                <Tabs
                  value={activeTab}
                  onValueChange={setActiveTab}
                  className="mb-6 w-full"
                >
                  <TabsList
                    className={cn(
                      'grid w-full',
                      `grid-cols-${Object.keys(tabsConfig[activeMainTab as keyof typeof tabsConfig].subTabs!).length}`
                    )}
                  >
                    {Object.entries(
                      tabsConfig[activeMainTab as keyof typeof tabsConfig]
                        .subTabs!
                    ).map(([subKey, subConfig]) => {
                      let label = subConfig.label;
                      if (
                        activeMainTab === 'sprints' &&
                        subKey === 'planning' &&
                        selectedSprintForPlanning &&
                        selectedSprintForPlanning.status === 'Completed'
                      ) {
                        label = 'Details';
                      }
                      return (
                        <TabsTrigger
                          key={`${activeMainTab}/${subKey}`}
                          value={`${activeMainTab}/${subKey}`}
                        >
                          <subConfig.icon className="h-4 w-4 md:mr-2" />
                          <span className="hidden md:inline">{label}</span>
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>
                </Tabs>
              )}
              {renderActiveTabContent()}
            </div>
          </Tabs>
        )}
      </main>

      <footer className="border-t p-4 text-center text-xs text-muted-foreground">
        Projects Prism - Agile Reporting Made Easy
      </footer>

      {/* Help Modal and Floating Button */}
      <HelpModal isOpen={isHelpModalOpen} onOpenChange={setIsHelpModalOpen} />
      <FloatingHelpButton onOpen={() => setIsHelpModalOpen(true)} />
    </div>
  );
}
