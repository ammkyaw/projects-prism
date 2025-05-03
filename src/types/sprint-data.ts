
export interface Sprint {
  sprintNumber: number;
  committedPoints: number;
  completedPoints: number; // Renamed from totalDelivered for consistency with charts/previous naming
  totalDays: number; // Derived from duration
  startDate: string; // YYYY-MM-DD format
  endDate: string; // YYYY-MM-DD format, derived from startDate and duration
  duration: string; // e.g., "1 Week", "2 Weeks"
  details?: string; // Optional details field
}

// Removed DeveloperDailyPoints interface as it's no longer collected

export interface SprintData {
  sprints: Sprint[]; // Array of simplified sprint objects
  totalStoryPoints: number; // Sum of completedPoints across all sprints
  daysInSprint: number; // Max totalDays across all sprints (might be less relevant now)
}
