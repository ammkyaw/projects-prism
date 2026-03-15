import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  query,
  limit,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import type { Project, AppData } from '@/types/sprint-data';

const PROJECTS_QUERY_KEY = 'projects';
/** Maximum number of projects fetched per query to prevent unbounded reads. */
const PROJECTS_FETCH_LIMIT = 100;

// --- Fetch Projects ---
// Returns projects owned by the currently signed-in user.
// Legacy projects that pre-date the userId field (i.e. userId is absent or empty)
// are included via client-side filtering so existing data is not silently lost.
// New projects always get userId stamped at creation time.
const fetchProjects = async (): Promise<AppData> => {
  const currentUser = auth.currentUser;
  if (!currentUser) return [];

  const projectsCollection = collection(db, 'projects');
  // Fetch a broad set and filter client-side to support both new (userId-stamped)
  // and legacy (no userId) documents without requiring a Firestore index migration.
  const projectsQuery = query(
    projectsCollection,
    limit(PROJECTS_FETCH_LIMIT)
  );
  const querySnapshot = await getDocs(projectsQuery);
  const projects = querySnapshot.docs
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as Project)
    // Keep: projects explicitly owned by this user, OR legacy projects with no owner set.
    .filter((p) => !p.userId || p.userId === currentUser.uid);

  const validatedProjects = projects.map((project) => ({
    ...project,
    backlog: (project.backlog ?? [])
      .map((task) => ({
        ...task,
        needsGrooming: task.needsGrooming ?? false,
        readyForSprint: task.readyForSprint ?? false,
        backlogId:
          task.backlogId ||
          `BL-${project.id}-${task.id?.substring(0, 4) || Math.random().toString(36).substring(2, 6)}`,
      }))
      .sort((a, b) => (a.backlogId ?? '').localeCompare(b.backlogId ?? '')),
    sprintData: {
      ...project.sprintData,
      sprints: (project.sprintData?.sprints ?? []).sort(
        (a, b) => a.sprintNumber - b.sprintNumber
      ),
    },
    members: project.members ?? [],
    teams: project.teams ?? [],
    holidayCalendars: project.holidayCalendars ?? [],
    risks: project.risks ?? [],
    storyPointScale: project.storyPointScale ?? 'Fibonacci',
    customTaskTypes: project.customTaskTypes ?? [],
    customTicketStatuses: project.customTicketStatuses ?? [],
  }));
  return validatedProjects;
};

export function useProjects() {
  return useQuery<AppData>({
    queryKey: [PROJECTS_QUERY_KEY],
    queryFn: fetchProjects,
  });
}

// --- Update/Add Project ---
const updateProject = async (project: Project): Promise<void> => {
  if (!project.id) throw new Error('Project ID is required for updating.');
  const projectRef = doc(db, 'projects', project.id);
  const { id, ...projectData } = project;
  await setDoc(projectRef, projectData, { merge: true });
};

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, Project>({
    mutationFn: updateProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROJECTS_QUERY_KEY] });
    },
    onError: (error) => {
      console.error('Error updating project:', error);
    },
  });
}

// --- Delete Project ---
const deleteProject = async (projectId: string): Promise<void> => {
  if (!projectId) throw new Error('Project ID is required for deletion.');
  const projectRef = doc(db, 'projects', projectId);
  await deleteDoc(projectRef);
};

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: deleteProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROJECTS_QUERY_KEY] });
    },
    onError: (error) => {
      console.error('Error deleting project:', error);
    },
  });
}
