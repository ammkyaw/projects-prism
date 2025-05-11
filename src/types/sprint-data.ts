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
}

// Represents a team within a project
export interface Team {
  id: string; // Unique ID for the team
  name: string; // e.g., "Frontend Team", "QA Team Alpha"
  members: TeamMember[]; // Array of members belonging to this team
  leadMemberId?: string | null; // Optional: ID of the member designated as team lead
}

// Task Types for Backlog items
export type TaskType =
  | 'New Feature'
  | 'Improvement'
  | 'Bug'
  | 'Hotfix'
  | 'Refactoring'
  | 'Documentation'
  | 'Security'
  | 'Infra'
  | 'CI/CD'
  | 'Compliance';
export const taskTypes: TaskType[] = [
  'New Feature',
  'Improvement',
  'Bug',
  'Hotfix',
  'Refactoring',
  'Documentation',
  'Security',
  'Infra',
  'CI/CD',
  'Compliance',
];
export const predefinedTaskTypes: readonly TaskType[] = [...taskTypes];

// Severity Types for Bug tasks
export type SeverityType = 'Low' | 'Medium' | 'High' | 'Critical';
export const severities: SeverityType[] = ['Low', 'Medium', 'High', 'Critical'];

// Represents the status of a backlog item in history
export type HistoryStatus = 'Move' | 'Split' | 'Merge';

// Represents a single task within a sprint plan or backlog
export interface Task {
  id: string;
  backlogId?: string | '';
  ticketNumber?: string | null;
  title?: string;
  description?: string;
  acceptanceCriteria?: string;
  storyPoints?: number | string | null; // Allow string for input, convert to number on save
  devEstimatedTime?: string | null;
  qaEstimatedTime?: string | null;
  bufferTime?: string | null;
  assignee?: string | null; // Allow null for unassigned
  reviewer?: string | null; // Allow null for unassigned
  status?:
    | 'To Do'
    | 'In Progress'
    | 'In Review'
    | 'QA'
    | 'Done'
    | 'Blocked'
    | null;
  startDate?: string | null;
  completedDate?: string | null;
  priority?: 'Highest' | 'High' | 'Medium' | 'Low' | 'Lowest';
  dependsOn?: string[];
  taskType?: TaskType;
  createdDate?: string;
  initiator?: string | null; // Allow null
  needsGrooming?: boolean;
  readyForSprint?: boolean;
  movedToSprint?: number | null;
  historyStatus?: HistoryStatus | null;
  splitFromId?: string | null; // ID of the original task if this task was created by splitting
  mergeEventId?: string | null; // ID to group items that were merged together or resulted from a merge
  devTime?: string; // This seems like a legacy/duplicate of devEstimatedTime, consider removing or aligning
  severity?: SeverityType | null; // Added severity field
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
  id: string;
  ticketNumber: string;
  developer: string;
  storyPoints: number;
  devTime: string;
}

export interface Sprint {
  sprintNumber: number;
  committedPoints: number;
  completedPoints: number;
  totalDays: number;
  startDate: string;
  endDate: string;
  duration: string;
  status: SprintStatus;
  details?: SprintDetailItem[];
  planning?: SprintPlanning;
}

export interface SprintData {
  sprints: Sprint[];
  totalStoryPoints: number;
  daysInSprint: number;
}

// New type for Story Point Scales
export type StoryPointScale = 'Fibonacci' | 'Modified Fibonacci' | 'Linear';
export const storyPointScaleOptions: StoryPointScale[] = [
  'Fibonacci',
  'Modified Fibonacci',
  'Linear',
];

// Risk Management Types
export type RiskCategory =
  | 'Technical'
  | 'Schedule'
  | 'Budget'
  | 'Resource'
  | 'External'
  | 'Scope Creep';
export const riskCategories: RiskCategory[] = [
  'Technical',
  'Schedule',
  'Budget',
  'Resource',
  'External',
  'Scope Creep',
];

export type RiskStatus =
  | 'Open'
  | 'In Progress'
  | 'Mitigated'
  | 'Closed'
  | 'Accepted';
export const riskStatuses: RiskStatus[] = [
  'Open',
  'In Progress',
  'Mitigated',
  'Closed',
  'Accepted',
];

export type RiskLikelihood =
  | 'Rare'
  | 'Unlikely'
  | 'Possible'
  | 'Likely'
  | 'Almost Certain';
// Order for Heatmap Rows (bottom to top)
export const riskLikelihoods: RiskLikelihood[] = [
  'Rare',
  'Unlikely',
  'Possible',
  'Likely',
  'Almost Certain',
];
export const riskLikelihoodValues: Record<RiskLikelihood, number> = {
  Rare: 1,
  Unlikely: 2,
  Possible: 3,
  Likely: 4,
  'Almost Certain': 5,
};

export type RiskImpact =
  | 'Insignificant'
  | 'Minor'
  | 'Moderate'
  | 'Major'
  | 'Catastrophic';
// Order for Heatmap Columns (left to right)
export const riskImpacts: RiskImpact[] = [
  'Insignificant',
  'Minor',
  'Moderate',
  'Major',
  'Catastrophic',
];
export const riskImpactValues: Record<RiskImpact, number> = {
  Insignificant: 1,
  Minor: 2,
  Moderate: 3,
  Major: 4,
  Catastrophic: 5,
};

export interface RiskItem {
  id: string; // Unique ID for the risk
  title: string;
  description: string;
  identifiedDate: string; // YYYY-MM-DD
  owner: string; // Member name or free text
  category: RiskCategory;
  status: RiskStatus;
  likelihood: RiskLikelihood;
  impact: RiskImpact;
  riskScore: number; // Calculated: Likelihood_value * Impact_value
  mitigationStrategies: string;
  contingencyPlan: string;
}

export interface Project {
  id: string;
  name: string;
  sprintData: SprintData;
  members: Member[];
  holidayCalendars?: HolidayCalendar[];
  teams?: Team[];
  backlog?: Task[];
  risks?: RiskItem[]; // Add risks array
  // New configuration fields
  storyPointScale?: StoryPointScale;
  customTaskTypes?: string[];
  customTicketStatuses?: string[];
}

export type AppData = Project[];

export const initialSprintData: SprintData = {
  sprints: [],
  totalStoryPoints: 0,
  daysInSprint: 0,
};

export const initialSprintPlanning: SprintPlanning = {
  goal: '',
  newTasks: [],
  spilloverTasks: [],
  definitionOfDone: '',
  testingStrategy: '',
};

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

export const taskStatuses: Array<Task['status']> = [
  'To Do',
  'In Progress',
  'In Review',
  'QA',
  'Done',
  'Blocked',
];
export const predefinedTicketStatuses: readonly (Task['status'] | null)[] = [
  ...taskStatuses,
];

export const taskPriorities: Array<Task['priority']> = [
  'Highest',
  'High',
  'Medium',
  'Low',
  'Lowest',
];

export const initialTeam: Omit<Team, 'id'> = {
  name: '',
  members: [],
  leadMemberId: null,
};

// Define initial state for a backlog task, ensuring all fields match Task interface
export const initialBacklogTask: Omit<Task, 'id'> = {
  backlogId: '',
  ticketNumber: '',
  title: '',
  description: '',
  acceptanceCriteria: '',
  storyPoints: null,
  priority: 'Medium',
  taskType: 'New Feature',
  createdDate: '',
  initiator: null,
  dependsOn: [],
  needsGrooming: false,
  readyForSprint: false,
  movedToSprint: null,
  historyStatus: null,
  splitFromId: null,
  mergeEventId: null,
  devEstimatedTime: null,
  qaEstimatedTime: null,
  bufferTime: null,
  assignee: null,
  reviewer: null,
  status: null,
  startDate: null,
  completedDate: null,
  devTime: undefined, // Remove or align devTime
  severity: null, // Initialize severity
};

export type ToastFun = (props: {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
  duration?: number;
}) => void;

export interface DailyProgressDataPoint {
  date: string; // Formatted date e.g., "MM/dd"
  points: number;
  tasksCompleted?: number; // Add optional field for tasks completed
}

// Initial state for a new risk item - ID is generated on save
export const initialRiskItem: Omit<RiskItem, 'id' | 'riskScore'> = {
  title: '',
  description: '',
  identifiedDate: '',
  owner: '',
  category: 'Technical',
  status: 'Open',
  likelihood: 'Possible', // Updated default to 'Possible'
  impact: 'Moderate',
  mitigationStrategies: '',
  contingencyPlan: '',
};