import * as XLSX from 'xlsx';
import type { Project, Task, Sprint } from '@/types/sprint-data';

// Define a type for the toast function
type ToastFun = (props: {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}) => void;

/**
 * Exports project data (Sprints, Backlog, Members, Holidays, Teams) to an Excel file.
 *
 * @param project - The project data to export.
 * @param toast - The toast notification function from useToast hook.
 */
export const handleExport = (project: Project | null, toast: ToastFun) => {
  if (
    !project ||
    (!project.sprintData?.sprints?.length &&
      !project.members?.length &&
      !project.holidayCalendars?.length &&
      !project.teams?.length &&
      !project.backlog?.length)
  ) {
    toast({
      variant: 'destructive',
      title: 'Error',
      description: `No data available to export for project '${project?.name ?? 'N/A'}'.`,
    });
    return;
  }

  try {
    const wb = XLSX.utils.book_new();

    // Sprint Summary Sheet
    if (project.sprintData?.sprints?.length > 0) {
      const summaryData = project.sprintData.sprints.map((s) => ({
        SprintNumber: s.sprintNumber,
        StartDate: s.startDate,
        EndDate: s.endDate,
        Duration: s.duration,
        Status: s.status,
        TotalCommitment: s.committedPoints,
        TotalDelivered: s.completedPoints,
      }));
      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Sprint Summary');
    }

    // Planning Sheets (Summary and Tasks)
    const planningExists = project.sprintData?.sprints?.some(
      (s) =>
        s.planning &&
        (s.planning.goal ||
          s.planning.newTasks?.length > 0 ||
          s.planning.spilloverTasks?.length > 0 ||
          s.planning.definitionOfDone ||
          s.planning.testingStrategy)
    );
    if (planningExists) {
      const planningSummaryData: any[] = [];
      const planningTasksData: any[] = [];
      project.sprintData.sprints.forEach((sprint) => {
        if (sprint.planning) {
          planningSummaryData.push({
            SprintNumber: sprint.sprintNumber,
            Goal: sprint.planning.goal,
            DefinitionOfDone: sprint.planning.definitionOfDone,
            TestingStrategy: sprint.planning.testingStrategy,
          });
          // Helper function to map task to export row
          const mapTaskToRow = (task: Task, type: 'New' | 'Spillover') => ({
            SprintNumber: sprint.sprintNumber,
            Type: type,
            TaskID: task.id,
            TicketNumber: task.ticketNumber, // Use ticketNumber
            BacklogID: task.backlogId, // Include backlog ID
            Title: task.title,
            Description: task.description,
            StoryPoints: task.storyPoints,
            DevEstTime: task.devEstimatedTime,
            QAEstTime: task.qaEstimatedTime,
            BufferTime: task.bufferTime,
            Assignee: task.assignee,
            Reviewer: task.reviewer,
            Status: task.status,
            StartDate: task.startDate,
            Priority: task.priority,
          });

          (sprint.planning.newTasks || []).forEach((task) =>
            planningTasksData.push(mapTaskToRow(task, 'New'))
          );
          (sprint.planning.spilloverTasks || []).forEach((task) =>
            planningTasksData.push(mapTaskToRow(task, 'Spillover'))
          );
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
    if (project.backlog && project.backlog.length > 0) {
      const backlogData = project.backlog.map((task) => ({
        BacklogItemID: task.id,
        BacklogID: task.backlogId,
        Title: task.title,
        Description: task.description,
        TaskType: task.taskType,
        Priority: task.priority,
        Initiator: task.initiator,
        CreatedDate: task.createdDate,
        StoryPoints: task.storyPoints,
        DependsOn: (task.dependsOn || []).join(', '), // Flatten dependency array
        MovedToSprint: task.movedToSprint ?? '', // Add movedToSprint history
        HistoryStatus: task.historyStatus ?? '', // Add history status
        NeedsGrooming: task.needsGrooming ? 'Yes' : 'No', // Add flag
        ReadyForSprint: task.readyForSprint ? 'Yes' : 'No', // Add flag
        SplitFromID: task.splitFromId ?? '', // Export split info
        MergeEventID: task.mergeEventId ?? '', // Export merge info
        // Other backlog specific fields if needed
      }));
      const wsBacklog = XLSX.utils.json_to_sheet(backlogData);
      XLSX.utils.book_append_sheet(wb, wsBacklog, 'Backlog');
    }

    // Members Sheet
    if (project.members && project.members.length > 0) {
      const membersData = project.members.map((m) => ({
        MemberID: m.id,
        Name: m.name,
        Role: m.role,
        HolidayCalendarID: m.holidayCalendarId, // Added holiday calendar ID
      }));
      const wsMembers = XLSX.utils.json_to_sheet(membersData);
      XLSX.utils.book_append_sheet(wb, wsMembers, 'Members');
    }

    // Holiday Calendars Sheet
    if (project.holidayCalendars && project.holidayCalendars.length > 0) {
      const calendarsData: any[] = [];
      project.holidayCalendars.forEach((cal) => {
        cal.holidays.forEach((holiday) => {
          calendarsData.push({
            CalendarID: cal.id,
            CalendarName: cal.name,
            CountryCode: cal.countryCode,
            HolidayID: holiday.id,
            HolidayName: holiday.name,
            HolidayDate: holiday.date,
          });
        });
        // Add row for calendar itself if it has no holidays
        if (cal.holidays.length === 0) {
          calendarsData.push({
            CalendarID: cal.id,
            CalendarName: cal.name,
            CountryCode: cal.countryCode,
            HolidayID: '',
            HolidayName: '',
            HolidayDate: '',
          });
        }
      });
      const wsHolidays = XLSX.utils.json_to_sheet(calendarsData);
      XLSX.utils.book_append_sheet(wb, wsHolidays, 'Holiday Calendars');
    }

    // Teams Sheet
    if (project.teams && project.teams.length > 0) {
      const teamsData: any[] = [];
      project.teams.forEach((team) => {
        team.members.forEach((tm) => {
          teamsData.push({
            TeamID: team.id,
            TeamName: team.name,
            LeadMemberID: team.leadMemberId,
            MemberID: tm.memberId,
          });
        });
        // Add row for team itself if it has no members
        if (team.members.length === 0) {
          teamsData.push({
            TeamID: team.id,
            TeamName: team.name,
            LeadMemberID: team.leadMemberId,
            MemberID: '',
          });
        }
      });
      const wsTeams = XLSX.utils.json_to_sheet(teamsData);
      XLSX.utils.book_append_sheet(wb, wsTeams, 'Teams');
    }

    const projectNameSlug = project.name
      .replace(/[^a-z0-9]/gi, '_')
      .toLowerCase();
    XLSX.writeFile(wb, `sprint_stats_${projectNameSlug}_report.xlsx`);
    toast({
      title: 'Success',
      description: `Data for project '${project.name}' exported to Excel.`,
    });
  } catch (error) {
    console.error('Error exporting data:', error);
    toast({
      variant: 'destructive',
      title: 'Error',
      description: 'Failed to export data.',
    });
  }
};
