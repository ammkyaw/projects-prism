import { useCallback } from 'react';
import type {
  Project,
  Member,
  HolidayCalendar,
  Team,
  ToastFun,
  StoryPointScale, // Import StoryPointScale
  RiskItem, // Import RiskItem
  RiskLikelihood,
  RiskImpact,
} from '@/types/sprint-data';
import {
  riskLikelihoodValues,
  riskImpactValues,
} from '@/types/sprint-data'; // Import the missing values

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
  const handleSaveMembers = useCallback(
    (updatedMembers: Member[]) => {
      if (!selectedProject) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'No project selected.',
        });
        return;
      }
      const updatedProject: Project = {
        ...selectedProject,
        members: updatedMembers,
      };
      updateProjectData(updatedProject);
      toast({
        title: 'Success',
        description: `Members updated for project '${selectedProject.name}'.`,
      });
    },
    [selectedProject, updateProjectData, toast]
  );

  const handleSaveHolidayCalendars = useCallback(
    (updatedCalendars: HolidayCalendar[]) => {
      if (!selectedProject) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'No project selected.',
        });
        return;
      }

      const currentProjectName = selectedProject.name;
      let membersToUpdate: Member[] = [];

      const updatedMembers = (selectedProject.members || []).map((member) => {
        const calendarExists = updatedCalendars.some(
          (cal) => cal.id === member.holidayCalendarId
        );
        if (member.holidayCalendarId && !calendarExists) {
          membersToUpdate.push(member);
          return { ...member, holidayCalendarId: null };
        }
        return member;
      });

      const updatedProject: Project = {
        ...selectedProject,
        holidayCalendars: updatedCalendars,
        members: updatedMembers,
      };

      updateProjectData(updatedProject);

      setTimeout(() => {
        toast({
          title: 'Success',
          description: `Holiday calendars updated for project '${currentProjectName}'.`,
        });
        membersToUpdate.forEach((member) => {
          toast({
            variant: 'warning',
            title: 'Calendar Unassigned',
            description: `Holiday calendar assigned to ${member.name} was deleted or is no longer available.`,
          });
        });
      }, 0);
    },
    [selectedProject, updateProjectData, toast]
  );

  const handleSaveTeams = useCallback(
    (updatedTeams: Team[]) => {
      if (!selectedProject) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'No project selected.',
        });
        return;
      }
      const currentProjectName = selectedProject.name;

      const validTeams = updatedTeams.map((team) => {
        const validMembers = team.members.filter((tm) =>
          (selectedProject.members || []).some((m) => m.id === tm.memberId)
        );
        let validLead = team.leadMemberId;
        if (
          validLead &&
          !(selectedProject.members || []).some((m) => m.id === validLead)
        ) {
          console.warn(
            `Lead member ID ${validLead} for team ${team.name} not found. Resetting.`
          );
          validLead = null;
        }
        return { ...team, members: validMembers, leadMemberId: validLead };
      });

      const updatedProject: Project = { ...selectedProject, teams: validTeams };
      updateProjectData(updatedProject);
      toast({
        title: 'Success',
        description: `Teams updated for project '${currentProjectName}'.`,
      });
    },
    [selectedProject, updateProjectData, toast]
  );

  // Handler to save configurations for the *selected* project
  const handleSaveConfigurations = useCallback(
    (
      scale: StoryPointScale,
      newCustomTaskTypes: string[],
      newCustomTicketStatuses: string[]
    ) => {
      if (!selectedProject) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'No project selected.',
        });
        return;
      }
      const updatedProject: Project = {
        ...selectedProject,
        storyPointScale: scale,
        customTaskTypes: newCustomTaskTypes,
        customTicketStatuses: newCustomTicketStatuses,
      };
      updateProjectData(updatedProject);
      toast({
        title: 'Success',
        description: `Configurations updated for project '${selectedProject.name}'.`,
      });
    },
    [selectedProject, updateProjectData, toast]
  );

  // Handler to save a new risk item (or update if ID exists implicitly through `riskDetails` if editing)
  const handleSaveRisk = useCallback(
    (riskDetails: Omit<RiskItem, 'id' | 'riskScore'>, existingId?: string) => {
      if (!selectedProject) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'No project selected to manage risks for.',
        });
        return;
      }

      // Use the likelihood and impact from the submitted details for calculation.
      // If updating, these values in `riskDetails` would be the latest from the form.
      const likelihoodValue =
        riskLikelihoodValues[riskDetails.likelihood as RiskLikelihood] || 0;
      const impactValue =
        riskImpactValues[riskDetails.impact as RiskImpact] || 0;

      const riskScore = likelihoodValue * impactValue;

      let updatedRisks: RiskItem[];
      let toastMessage = '';

      if (existingId) {
        // Updating an existing risk
        const riskToUpdate = selectedProject.risks?.find(
          (r) => r.id === existingId
        );
        if (!riskToUpdate) {
          toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Risk item to update not found.',
          });
          return;
        }
        updatedRisks = (selectedProject.risks || []).map((r) =>
          r.id === existingId
            ? { ...riskToUpdate, ...riskDetails, riskScore }
            : r
        );
        toastMessage = `Risk "${riskDetails.title}" has been updated.`;
      } else {
        // Adding a new risk
        const newRiskWithId: RiskItem = {
          ...riskDetails,
          id: `risk_${Date.now()}_${Math.random()
            .toString(36)
            .substring(2, 7)}`,
          riskScore,
        };
        updatedRisks = [...(selectedProject.risks || []), newRiskWithId];
        toastMessage = `Risk "${newRiskWithId.title}" has been registered.`;
      }

      const updatedProject: Project = {
        ...selectedProject,
        risks: updatedRisks,
      };
      updateProjectData(updatedProject);
      toast({
        title: existingId ? 'Risk Updated' : 'Risk Registered',
        description: toastMessage,
      });
    },
    [selectedProject, updateProjectData, toast]
  );

  return {
    handleSaveMembers,
    handleSaveHolidayCalendars,
    handleSaveTeams,
    handleSaveConfigurations,
    handleSaveRisk,
  };
};