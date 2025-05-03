

// Represents the status of a sprint
export type SprintStatus = 'Planned' | 'Active' | 'Completed';

// Represents a single public holiday date
export interface PublicHoliday {
  id: string; // Unique ID for the holiday entry
  name: string;
  date: string; // YYYY-MM-DD format
}

// Represents a collection of public holidays, typically for a country or custom group
export interface HolidayCalendar {
  id: string; // Unique ID for the calendar
  name: string; // e.g., "US Holidays", "UK Holidays", "Team Alpha Custom"
  countryCode?: string; // Optional: ISO 3166-1 alpha-2 country code (e.g., "US", "GB") or empty string
  holidays: PublicHoliday[];
}

// Represents a single team member
export interface Member {
  id: string; // Unique ID for the member
  name: string;
  role: string; // e.g., 'Project Manager', 'Software Engineer'
  holidayCalendarId?: string | null; // Optional: ID of the assigned HolidayCalendar
}

// Represents a member linked within a team, potentially with a specific role in that team
export interface TeamMember {
  memberId: string; // Corresponds to the Member's id
  // teamRole?: string; // Optional: Role specific to this team (e.g., Lead) - Future enhancement
}

// Represents a team within a project
export interface Team {
  id: string; // Unique ID for the team
  name: string; // e.g., "Frontend Team", "QA Team Alpha"
  members: TeamMember[]; // Array of members belonging to this team
  leadMemberId?: string | null; // Optional: ID of the member designated as team lead
}


// Represents a single task within a sprint plan or backlog
export interface Task {
  id: string; // Unique ID for the task item
  ticketNumber: string; // Primary identifier, e.g., JIRA key
  title?: string; // Optional: A more descriptive title for the task
  description?: string; // Optional: Detailed description of the task (can be added in backlog/planning)
  storyPoints?: number | string; // Can be number or empty string from input
  devEstimatedTime?: string; // Optional: e.g., "2d", "4h", "1w 2d"
  qaEstimatedTime?: string; // Optional: Defaults to "2d"
  bufferTime?: string; // Optional: Defaults to "1d"
  assignee?: string; // Optional: Stores the Member's name
  reviewer?: string; // Optional: Stores the Member's name for review
  status?: 'To Do' | 'In Progress' | 'In Review' | 'QA' | 'Done' | 'Blocked' | 'Backlog'; // Added 'Backlog' status
  startDate?: string | undefined; // Optional: YYYY-MM-DD for Gantt chart (only relevant when planned)
  priority?: 'Highest' | 'High' | 'Medium' | 'Low' | 'Lowest'; // Optional: Priority level
  dependsOn?: string[]; // Optional: Array of task IDs this task depends on (for future dependency tracking)
  // Legacy fields - keep if needed for migration or detail view, but planning uses new fields
  devTime?: string; // Legacy, replaced by devEstimatedTime
}

// Represents the planning data for a single sprint
export interface SprintPlanning {
  goal: string;
  newTasks: Task[]; // Tasks newly planned for this sprint
  spilloverTasks: Task[]; // Tasks carried over from the previous sprint
  definitionOfDone: string;
  testingStrategy: string;
}


export interface SprintDetailItem {
  id: string; // Unique ID for the detail item (legacy)
  ticketNumber: string;
  developer: string; // Stores the Member's name
  storyPoints: number;
  devTime: string; // e.g., "2d", "4h", "1w" // Kept for legacy details
}

export interface Sprint {
  sprintNumber: number;
  committedPoints: number; // Sum of story points from newTasks + spilloverTasks at sprint start? Or manually set?
  completedPoints: number; // Sum of story points of tasks marked 'Done' at sprint end
  totalDays: number; // Derived from duration (working days)
  startDate: string; // YYYY-MM-DD format
  endDate: string; // YYYY-MM-DD format, derived from startDate and duration
  duration: string; // e.g., "1 Week", "2 Weeks"
  status: SprintStatus; // Added sprint status
  details?: SprintDetailItem[]; // Optional array for detailed ticket info (LEGACY - prefer planning.tasks)
  planning?: SprintPlanning; // Optional object for planning details (tasks, goal, DoD etc.)
}

// Represents the data specific to a single sprint cycle within a project
export interface SprintData {
  sprints: Sprint[]; // Array of sprint objects for this project
  totalStoryPoints: number; // Sum of completedPoints across all completed sprints in this project
  daysInSprint: number; // Max totalDays across all sprints in this project (might be less relevant now)
}

// Represents a single project containing its own sprint data, members, and backlog
export interface Project {
    id: string; // Unique identifier for the project (e.g., UUID or timestamp-based)
    name: string;
    sprintData: SprintData;
    members: Member[]; // Array of team members associated with the project
    holidayCalendars?: HolidayCalendar[]; // Optional: Array of holiday calendars specific to this project
    teams?: Team[]; // Optional: Array of teams within the project
    backlog?: Task[]; // Optional: Array of tasks not yet assigned to a sprint
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

// Predefined Task Statuses - Added 'Backlog'
export const taskStatuses: Array<Task['status']> = ['Backlog', 'To Do', 'In Progress', 'In Review', 'QA', 'Done', 'Blocked'];

// Predefined Task Priorities
export const taskPriorities: Array<Task['priority']> = ['Highest', 'High', 'Medium', 'Low', 'Lowest'];


// Initial empty state for a new Team
export const initialTeam: Omit<Team, 'id'> = {
    name: '',
    members: [],
    leadMemberId: null,
};

// Initial empty state for a new Task in the backlog
export const initialBacklogTask: Omit<Task, 'id'> = {
    ticketNumber: '',
    title: '',
    description: '',
    storyPoints: undefined,
    status: 'Backlog',
    priority: 'Medium',
};

