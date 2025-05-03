

// Represents a single task within a sprint plan
export interface Task {
  id: string; // Unique ID for the task item
  description: string;
  storyPoints?: number | string; // Can be number or empty string from input
  assignee?: string;
  status?: string; // e.g., 'To Do', 'In Progress', 'Done'
}

// Represents the planning data for a single sprint
export interface SprintPlanning {
  goal: string;
  newTasks: Task[];
  spilloverTasks: Task[];
  definitionOfDone: string;
  testingStrategy: string;
}


export interface SprintDetailItem {
  id: string; // Unique ID for the detail item
  ticketNumber: string;
  developer: string;
  storyPoints: number;
  devTime: string; // e.g., "2d", "4h", "1w"
}

export interface Sprint {
  sprintNumber: number;
  committedPoints: number;
  completedPoints: number;
  totalDays: number; // Derived from duration
  startDate: string; // YYYY-MM-DD format
  endDate: string; // YYYY-MM-DD format, derived from startDate and duration
  duration: string; // e.g., "1 Week", "2 Weeks"
  details?: SprintDetailItem[]; // Optional array for detailed ticket info
  planning?: SprintPlanning; // Optional object for planning details
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

// Initial empty state for SprintPlanning within a sprint
export const initialSprintPlanning: SprintPlanning = {
  goal: '',
  newTasks: [],
  spilloverTasks: [],
  definitionOfDone: '',
  testingStrategy: '',
};