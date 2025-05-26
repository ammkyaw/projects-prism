
# Projects Prism

**Projects Prism** is a comprehensive sprint management and analytics tool designed to empower Agile teams. Built with Next.js, Firebase, and Shadcn UI, it provides a user-friendly platform for planning, tracking, and analyzing sprints effectively. Gain valuable insights into project progress, team velocity, risk management, and potential bottlenecks to drive continuous improvement.

## Project Overview

Projects Prism streamlines Agile project management by offering a suite of tools for:

*   **Project Management:** Create and manage multiple projects, each with its own dedicated workspace.
*   **Sprint Planning & Execution:** Define sprint goals, plan tasks (new and spillover), track progress with visual timelines, and manage sprint statuses (Planned, Active, Completed).
*   **Backlog Management:** Maintain a product backlog, groom items, prioritize tasks, and seamlessly move them into sprint plans.
*   **Task Management:** Add detailed tasks with story points, estimates (Dev, QA, Review, Buffer), assignees, reviewers, status, and dependencies.
*   **Team & Member Configuration:** Manage project members, their roles, and assign them to specific teams with designated team leads.
*   **Holiday Calendars:** Create custom holiday calendars or import public holidays for selected countries (via Nager.Date API) to accurately adjust sprint scheduling and resource availability.
*   **Risk Management:** Register, track, and visualize project risks with a risk register, heat map, and mitigation planning capabilities.
*   **Analytics & Reporting:** Generate insightful reports and charts, including Velocity, Burndown, Developer Contribution, Bug Tracking, and Bug Severity, to monitor sprint performance and identify areas for improvement.
*   **Data Export:** Export project data, including sprint details, backlog items, and selected reports (with embedded chart images), to Excel.
*   **User Authentication:** Secure access to project data using Firebase Authentication.
*   **Data Persistence:** Securely store all project data using Firebase Firestore.

## Features

*   **Multi-Project Support:** Manage several distinct projects from a single interface.
*   **Sprint Management:**
    *   Create, configure, activate, and complete sprints.
    *   Visualize sprint timelines with Gantt-style charts, including task dependencies and non-working days (weekends, public holidays).
    *   Automatic calculation of sprint end dates based on start date and duration.
*   **Task Management:**
    *   Detailed task creation with fields for Backlog ID, Title, Description, Acceptance Criteria, Story Points, Priority, Task Type (Feature, Bug, Hotfix, etc.), Severity (for Bugs), Initiator, Dependencies, Start Date, and estimated times for Dev, QA, Review, and Buffer.
    *   Assign tasks to team members and designate reviewers.
    *   Track task status (To Do, In Progress, In Review, QA, Done, Blocked).
    *   Mark tasks as complete with a completion date.
*   **Backlog Management:**
    *   **Management Tab:** Add new backlog items, edit existing ones, view details, and move items to sprints.
    *   **Grooming Tab:** Refine backlog items, update details, mark as "Needs Grooming" or "Ready for Sprint", split user stories into smaller tasks, and merge related items. Undo functionality for split/merge actions.
    *   **History Tab:** View a log of backlog items that have been moved to sprints, split, or merged.
*   **Team & Member Management (Settings):**
    *   Add and manage project members with assigned roles.
    *   Create and manage teams, assign members to teams, and designate team leads.
    *   Assign custom or country-specific holiday calendars to members.
*   **Holiday Calendars (Settings):**
    *   Create custom holiday calendars.
    *   Import public holidays for selected countries using the Nager.Date API.
*   **Project Configuration (Settings):**
    *   Configure project-specific story point scales (Fibonacci, Modified Fibonacci, Linear).
    *   Define custom task types and ticket statuses.
*   **Risk Management (Risk Tab):**
    *   **Overview:** Summary statistics, risk heat map, and top critical risks.
    *   **Register:** Log new risks with details like title, description, identified date, owner, category, status, likelihood, impact, mitigation strategies, and contingency plans. Auto-calculated risk score.
    *   **Mitigation:** (Placeholder for future mitigation tracking features)
*   **Analytics & Reporting (Analytics Tab):**
    *   **Charts:**
        *   Velocity Chart (up to last 10 sprints)
        *   Burndown Chart (for selected sprint)
        *   Developer Team Contribution (stacked bar chart for selected sprint/developer, showing points per task type or ticket)
        *   Bugs & Hotfixes per Sprint
        *   Bug Severity Distribution (for selected sprint)
    *   **Reports:** Export selected reports (including chart images and underlying data) to Excel.
*   **Dashboard:**
    *   Active sprint overview: goal, start/end dates, countdown.
    *   Story points progress (pie chart for committed vs. completed - new tasks only).
    *   Task progress (progress bar and node visualization for all sprint tasks).
    *   Burndown chart for the active sprint.
    *   Daily progress chart (points and tasks completed per day for the active sprint).
    *   Project velocity chart.
*   **User Interface:**
    *   Dark mode toggle.
    *   Responsive design for various screen sizes.
    *   In-app help modal with a glossary of Agile terms.
*   **Data Persistence:** Firebase Firestore is used as the backend database.
*   **User Authentication:** Firebase Authentication for user login (email/password).

## Technologies Used

*   **Framework:** Next.js (React Framework)
*   **Database:** Firebase Firestore
*   **Authentication:** Firebase Authentication
*   **Styling:** Tailwind CSS
*   **UI Components:** Shadcn UI
*   **Charting Library:** Recharts
*   **Date Handling:** date-fns
*   **Excel Export:** ExcelJS (for data and embedding chart images)
*   **Image Capture for Export:** html2canvas
*   **Public Holiday API:** Nager.Date API (for fetching country-specific holidays)
*   **State Management:** React Hooks (useState, useEffect, useCallback, useMemo), TanStack Query (React Query) for server state management.
*   **Drag & Drop (Backlog Prioritization):** @dnd-kit

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

*   Node.js (v18 or higher recommended)
*   npm or yarn
*   Git

### Firebase Setup

1.  **Create a Firebase Project:** Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project (or use an existing one).
2.  **Enable Firestore:** In your Firebase project, navigate to "Firestore Database" and create a database. Start in **test mode** for easier setup, but remember to [secure your data with security rules](https://firebase.google.com/docs/firestore/security/get-started) before production.
3.  **Enable Firebase Authentication:**
    *   In the Firebase console, go to "Authentication".
    *   Click on the "Sign-in method" tab.
    *   Enable the "Email/Password" provider.
4.  **Register a Web App:**
    *   In your Firebase project settings (gear icon next to "Project Overview"), go to the "General" tab.
    *   Scroll down to "Your apps" and click on "Add app". Select the web platform (</>).
    *   Register your app. You'll be provided with a Firebase configuration object.
5.  **Environment Variables:**
    *   Create a file named `.env.local` in the root of your project.
    *   Add the Firebase configuration variables from the previous step to this file, prefixing each with `NEXT_PUBLIC_`:
        ```env
        NEXT_PUBLIC_FIREBASE_API_KEY="YOUR_API_KEY"
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="YOUR_AUTH_DOMAIN"
        NEXT_PUBLIC_FIREBASE_PROJECT_ID="YOUR_PROJECT_ID"
        NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="YOUR_STORAGE_BUCKET"
        NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="YOUR_MESSAGING_SENDER_ID"
        NEXT_PUBLIC_FIREBASE_APP_ID="YOUR_APP_ID"
        NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="YOUR_MEASUREMENT_ID"
        ```
    *   **Important:** Add `.env.local` to your `.gitignore` file to prevent committing sensitive credentials.

### Installation

1.  **Clone the Repository:**
    ```bash
    git clone <repository_url>
    cd projects-prism
    ```

2.  **Install Dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```

### Running the Application

1.  **Start the Development Server:**
    ```bash
    npm run dev
    # or
    yarn dev
    ```
    The application will typically be available at `http://localhost:9002`.

## Project Structure (Key Directories)

*   `src/app/`: Contains the Next.js App Router pages and layouts.
    *   `src/app/prism/page.tsx`: The main application page after login.
    *   `src/app/page.tsx`: The landing/login page.
*   `src/components/`: Reusable UI components.
    *   `src/components/ui/`: Shadcn UI components.
    *   `src/components/analytics/`: Components for the Analytics tab.
    *   `src/components/backlog/`: Components for the Backlog tab.
    *   `src/components/charts/`: Reusable chart components.
    *   `src/components/dialogs/`: Modal dialog components.
    *   `src/components/risk/`: Components for the Risk tab.
    *   `src/components/settings/`: Components for the Settings tab.
    *   `src/components/sprints/`: Components for the Sprints tab.
*   `src/hooks/`: Custom React hooks for managing actions and state.
*   `src/lib/`: Utility functions and Firebase configuration.
*   `src/types/`: TypeScript type definitions.

## Usage

1.  **Landing Page:** The application starts on a landing page. Click "Go to Prism Dashboard".
2.  **Login:** A login modal will appear. Enter your email and password (you might need to create a user directly in Firebase Authentication console for initial access if sign-up isn't implemented).
3.  **Main Application (PrismPage):**
    *   **Project Selection/Creation:**
        *   Select an existing project from the dropdown at the top.
        *   Click "New Project" to create a new project. You'll be prompted to (optionally) add members.
    *   **Navigation Tabs:**
        *   **Dashboard:** View active sprint overview, story point progress, task progress, burndown, daily progress, and project velocity.
        *   **Sprints:**
            *   **Overview:** See a summary of all sprints (Planned, Active, Completed). Click a sprint number to navigate to its planning/details view.
            *   **Planning:** Plan new sprints or edit existing 'Planned' or 'Active' sprints. Define goals, add tasks from the backlog, set estimates, assignees, reviewers, start dates, etc. View a Gantt-style timeline. Start or complete sprints.
            *   **Retrospective:** (Placeholder for retrospective features)
        *   **Backlog:**
            *   **Management:** Add new items to the backlog, edit existing ones. View details or move items to a sprint.
            *   **Grooming:** Refine backlog items marked "Needs Grooming". Split or merge stories.
            *   **History:** View backlog items that have been moved, split, or merged.
        *   **Risk:**
            *   **Overview:** View risk summary, heat map, and top critical risks.
            *   **Register:** Add new risks to the project.
            *   **Mitigation:** (Placeholder for mitigation features)
        *   **Evaluation:** (Placeholder for project evaluation features)
        *   **Analytics:**
            *   **Charts:** View various agile charts like Velocity, Burndown, Developer Contribution, Bug Counts, and Bug Severity.
            *   **Reports:** Select and export various project reports to Excel, including chart images.
        *   **Settings:**
            *   **Members:** Add, edit, or remove project members and assign them holiday calendars.
            *   **Teams:** Create teams, assign members to teams, and designate team leads.
            *   **Holidays:** Create custom holiday calendars or import public holidays by country.
            *   **Config:** Configure project-level settings like story point scale and custom task/ticket types.
    *   **Export Data:** Use the "Export Project Data" button in the header to download project information to an Excel file.
    *   **Theme Toggle:** Switch between light and dark modes.
    *   **Help:** Click the floating help icon for a glossary of terms.

## Contributing



## License


