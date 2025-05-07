
import { useCallback } from 'react';
import type { Project, Member, HolidayCalendar, Team, ToastFun } from '@/types/sprint-data';

interface UseSettingsActionsProps {
  selectedProject: Project | null;
  updateProjectData: (updatedProject: Project) => void;
  toast: ToastFun;
}

export const useSettingsActions = ({
  selectedProject,
  updateProjectData,
  toast,
}: UseSettingsActionsProps) => {

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

  return {
    handleSaveMembers,
    handleSaveHolidayCalendars,
    handleSaveTeams,
  };
};
