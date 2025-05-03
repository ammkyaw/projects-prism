
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

// Represents the data specific to a single sprint cycle within a project
export interface SprintData {
  sprints: Sprint[]; // Array of simplified sprint objects for this project
  totalStoryPoints: number; // Sum of completedPoints across all sprints in this project
  daysInSprint: number; // Max totalDays across all sprints in this project (might be less relevant now)
}

// Represents a single project containing its own sprint data
export interface Project {
    id: string; // Unique identifier for the project (e.g., UUID or timestamp-based)
    name: string;
    sprintData: SprintData;
}

// The top-level data structure stored will be an array of Project objects
export type AppData = Project[];

// Initial empty state for SprintData within a new project
export const initialSprintData: SprintData = {
  sprints: [],
  totalStoryPoints: 0,
  daysInSprint: 0,
};
