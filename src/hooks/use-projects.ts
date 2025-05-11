import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Project, AppData } from '@/types/sprint-data';

const PROJECTS_QUERY_KEY = 'projects';

// --- Fetch Projects ---
const fetchProjects = async (): Promise<AppData> => {
  console.log('Fetching projects from Firestore...');
  const projectsCollection = collection(db, 'projects');
  const querySnapshot = await getDocs(projectsCollection);
  const projects = querySnapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() }) as Project
  );
  console.log(`Fetched ${projects.length} projects.`);

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
    risks: project.risks ?? [], // Initialize risks if undefined
    // Default new config fields
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
  console.log(`Updating project ${project.id} in Firestore...`);
  if (!project.id) throw new Error('Project ID is required for updating.');
  const projectRef = doc(db, 'projects', project.id);
  const { id, ...projectData } = project;
  await setDoc(projectRef, projectData, { merge: true });
  console.log(`Project ${project.id} updated successfully.`);
};

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, Project>({
    mutationFn: updateProject,
    onSuccess: (_, updatedProject) => {
      console.log(
        'Project update mutation successful, invalidating queries...'
      );
      queryClient.invalidateQueries({ queryKey: [PROJECTS_QUERY_KEY] });
    },
    onError: (error) => {
      console.error('Error updating project:', error);
    },
  });
}

// --- Delete Project ---
const deleteProject = async (projectId: string): Promise<void> => {
  console.log(`Deleting project ${projectId} from Firestore...`);
  if (!projectId) throw new Error('Project ID is required for deletion.');
  const projectRef = doc(db, 'projects', projectId);
  await deleteDoc(projectRef);
  console.log(`Project ${projectId} deleted successfully.`);
};

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: deleteProject,
    onSuccess: (_, projectId) => {
      console.log(
        'Project delete mutation successful, invalidating queries...'
      );
      queryClient.invalidateQueries({ queryKey: [PROJECTS_QUERY_KEY] });
    },
    onError: (error) => {
      console.error('Error deleting project:', error);
    },
  });
}
