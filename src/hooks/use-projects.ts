
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, doc, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Project, AppData } from '@/types/sprint-data';

const PROJECTS_QUERY_KEY = 'projects';

// --- Fetch Projects ---
const fetchProjects = async (): Promise<AppData> => {
  console.log("Fetching projects from Firestore...");
  const projectsCollection = collection(db, 'projects');
  // Optional: Order by name or another field if needed
  // const q = query(projectsCollection, orderBy("name"));
  // const querySnapshot = await getDocs(q);
  const querySnapshot = await getDocs(projectsCollection);
  const projects = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
  console.log(`Fetched ${projects.length} projects.`);
  // Basic validation/migration can happen here if needed
   const validatedProjects = projects.map(project => ({
       ...project,
       backlog: (project.backlog ?? []).map(task => ({
           ...task,
           // Ensure required fields have defaults if missing from Firestore
           needsGrooming: task.needsGrooming ?? false,
           readyForSprint: task.readyForSprint ?? false,
           backlogId: task.backlogId || `BL-${project.id}-${task.id?.substring(0, 4) || Math.random().toString(36).substring(2, 6)}`, // Fallback ID
       })).sort((a, b) => (a.backlogId ?? '').localeCompare(b.backlogId ?? '')), // Default sort
       sprintData: {
           ...project.sprintData,
           sprints: (project.sprintData?.sprints ?? []).sort((a, b) => a.sprintNumber - b.sprintNumber) // Sort sprints
       },
       members: project.members ?? [],
       teams: project.teams ?? [],
       holidayCalendars: project.holidayCalendars ?? [],
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
  if (!project.id) throw new Error("Project ID is required for updating.");
  const projectRef = doc(db, 'projects', project.id);
  // Remove the id from the data being saved, as it's the document ID
  const { id, ...projectData } = project;
  await setDoc(projectRef, projectData, { merge: true }); // Use merge: true to avoid overwriting unrelated fields if needed, or false/omit for full replace
  console.log(`Project ${project.id} updated successfully.`);
};

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, Project>({
    mutationFn: updateProject,
    onSuccess: (_, updatedProject) => {
       console.log('Project update mutation successful, invalidating queries...');
      // Invalidate and refetch the projects query to update the UI
       queryClient.invalidateQueries({ queryKey: [PROJECTS_QUERY_KEY] });

      // Optional: Optimistically update the cache
      // queryClient.setQueryData<AppData>([PROJECTS_QUERY_KEY], (oldData) =>
      //   oldData ? oldData.map(p => p.id === updatedProject.id ? updatedProject : p) : []
      // );
    },
     onError: (error) => {
       console.error("Error updating project:", error);
       // Here you might want to show an error toast to the user
     }
  });
}

// --- Delete Project ---
const deleteProject = async (projectId: string): Promise<void> => {
  console.log(`Deleting project ${projectId} from Firestore...`);
  if (!projectId) throw new Error("Project ID is required for deletion.");
  const projectRef = doc(db, 'projects', projectId);
  await deleteDoc(projectRef);
  console.log(`Project ${projectId} deleted successfully.`);
};

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: deleteProject,
    onSuccess: (_, projectId) => {
       console.log('Project delete mutation successful, invalidating queries...');
      // Invalidate and refetch the projects query
       queryClient.invalidateQueries({ queryKey: [PROJECTS_QUERY_KEY] });

      // Optional: Optimistically remove from the cache
      // queryClient.setQueryData<AppData>([PROJECTS_QUERY_KEY], (oldData) =>
      //   oldData ? oldData.filter(p => p.id !== projectId) : []
      // );
    },
     onError: (error) => {
       console.error("Error deleting project:", error);
       // Show error toast
     }
  });
}
