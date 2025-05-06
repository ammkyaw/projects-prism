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

// Task Types for Backlog items
export type TaskType = 'New Feature' | 'Improvement' | 'Bug' | 'Refactoring' | 'Documentation' | 'Security' | 'Infra' | 'CI/CD' | 'Compliance';
export const taskTypes: TaskType[] = [
    'New Feature', 'Improvement', 'Bug', 'Refactoring', 'Documentation', 'Security', 'Infra', 'CI/CD', 'Compliance'
];

// Represents the status of a backlog item in history
export type HistoryStatus = 'Move' | 'Split' | 'Merge';

// Represents a single task within a sprint plan or backlog
export interface Task {
  id: string; // Unique ID for the task item
  backlogId?: string | ''; // Allow empty string for manual input
  ticketNumber?: string | null; // Primary identifier for tasks *within* a sprint (e.g., JIRA key), can be same as backlogId initially
  title?: string; // Optional: A more descriptive title for the task
  description?: string; // Optional: Detailed description of the task
  acceptanceCriteria?: string; // Optional: Acceptance criteria for the task
  storyPoints?: number | string; // Can be number or empty string from input
  devEstimatedTime?: string | null; // Optional: e.g., "2d", "4h", "1w 2d"
  qaEstimatedTime?: string | null; // Optional: Defaults to "2d"
  bufferTime?: string | null; // Optional: Defaults to "1d"
  assignee?: string; // Optional: Stores the Member's name
  reviewer?: string; // Optional: Stores the Member's name for review
  status?: 'To Do' | 'In Progress' | 'In Review' | 'QA' | 'Done' | 'Blocked'; // Status applicable *within* a sprint or backlog
  startDate?: string | undefined; // Optional: YYYY-MM-DD for Gantt chart (only relevant when planned in sprint)
  priority?: 'Highest' | 'High' | 'Medium' | 'Low' | 'Lowest'; // Optional: Priority level
  dependsOn?: string[]; // Optional: Array of Backlog IDs this task depends on
  // --- Backlog Specific Fields ---
  taskType?: TaskType; // Type of task/work item
  createdDate?: string; // YYYY-MM-DD, when the item was added to the backlog
  initiator?: string; // Name or ID of the person who added the item
  needsGrooming?: boolean; // Flag to indicate if item needs refinement
  readyForSprint?: boolean; // Flag to indicate if item is ready to be pulled into a sprint
  // --- History Tracking ---
  movedToSprint?: number | null; // Optional: The sprint number this backlog item was moved to.
  historyStatus?: HistoryStatus | null; // Optional: Status indicating how the item moved to history (Move, Split, Merge).
  splitFromId?: string; // Optional: ID of the original task this was split from.
  mergeEventId?: string; // Optional: An ID linking items involved in the same merge event.
  // Legacy fields - keep if needed for migration or detail view, but planning uses new fields
  devTime?: string; // Legacy, replaced by devEstimatedTime
}

// Represents the planning data for a single sprint
export interface SprintPlanning {
  goal: string;
  newTasks: Task[]; // Tasks newly planned for this sprint (can come from backlog)
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
    backlog?: Task[]; // Array of tasks not yet assigned to a sprint (the backlog)
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

// Predefined Task Statuses - applicable IN a sprint
export const taskStatuses: Array<Task['status']> = ['To Do', 'In Progress', 'In Review', 'QA', 'Done', 'Blocked']; // Removed Backlog

// Predefined Task Priorities
export const taskPriorities: Array<Task['priority']> = ['Highest', 'High', 'Medium', 'Low', 'Lowest'];


// Initial empty state for a new Team
export const initialTeam: Omit<Team, 'id'> = {
    name: '',
    members: [],
    leadMemberId: null,
};

// Initial empty state for a new Task in the backlog
// Note: 'status' is implicitly 'Backlog' when an item is in the backlog array.
export const initialBacklogTask: Omit<Task, 'id'> = {
    backlogId: '', // Allow manual entry
    ticketNumber: '',
    title: '',
    description: '',
    acceptanceCriteria: '', // Initialize acceptance criteria
    storyPoints: undefined,
    priority: 'Medium',
    taskType: 'New Feature', // Default task type
    createdDate: '', // Will be set on creation
    initiator: '', // Will be set (maybe manually for now)
    dependsOn: [],
    needsGrooming: false, // Default new items to NOT need grooming
    readyForSprint: false,
    movedToSprint: undefined, // Initialize as not moved
    historyStatus: undefined, // Initialize history status
    splitFromId: undefined, // Initialize split tracking
    mergeEventId: undefined, // Initialize merge tracking
    // Fields typically set during sprint planning:
    devEstimatedTime: undefined,
    qaEstimatedTime: undefined, // Don't default these in backlog
    bufferTime: undefined,
    assignee: undefined,
    reviewer: undefined,
    startDate: undefined,
};