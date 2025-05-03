
// Represents the status of a sprint
export type SprintStatus = 'Planned' | 'Active' | 'Completed';

// Represents a single team member
export interface Member {
  id: string; // Unique ID for the member
  name: string;
  role: string; // e.g., 'Project Manager', 'Software Engineer'
}

// Represents a single task within a sprint plan
export interface Task {
  id: string; // Unique ID for the task item
  description: string;
  storyPoints?: number | string; // Can be number or empty string from input
  estimatedTime?: string; // Optional: e.g., "2d", "4h", "1w 2d"
  assignee?: string; // Stores the Member's name
  status?: 'To Do' | 'In Progress' | 'Done' | 'Blocked'; // Added more specific statuses
  startDate?: string | undefined; // Optional: YYYY-MM-DD for Gantt chart
  dependsOn?: string[]; // Optional: Array of task IDs this task depends on
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
  developer: string; // Stores the Member's name
  storyPoints: number;
  devTime: string; // e.g., "2d", "4h", "1w" // Kept for legacy details, but planning uses estimatedTime
}

export interface Sprint {
  sprintNumber: number;
  committedPoints: number;
  completedPoints: number;
  totalDays: number; // Derived from duration
  startDate: string; // YYYY-MM-DD format
  endDate: string; // YYYY-MM-DD format, derived from startDate and duration
  duration: string; // e.g., "1 Week", "2 Weeks"
  status: SprintStatus; // Added sprint status
  details?: SprintDetailItem[]; // Optional array for detailed ticket info
  planning?: SprintPlanning; // Optional object for planning details
}

// Represents the data specific to a single sprint cycle within a project
export interface SprintData {
  sprints: Sprint[]; // Array of simplified sprint objects for this project
  totalStoryPoints: number; // Sum of completedPoints across all sprints in this project
  daysInSprint: number; // Max totalDays across all sprints in this project (might be less relevant now)
}

// Represents a single project containing its own sprint data and members
export interface Project {
    id: string; // Unique identifier for the project (e.g., UUID or timestamp-based)
    name: string;
    sprintData: SprintData;
    members: Member[]; // Array of team members associated with the project
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

// Predefined roles for team members
export const predefinedRoles = [
  'Project Manager',
  'Business Analyst',
  'QA Engineer',
  'DevOps Engineer',
  'Development Team Lead',
  'Software Engineer',
  'UX/UI Designer',
  'Scrum Master',
  'Product Owner',
];

// Predefined Task Statuses
export const taskStatuses: Array<Task['status']> = ['To Do', 'In Progress', 'Done', 'Blocked'];
