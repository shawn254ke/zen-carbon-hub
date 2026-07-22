import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  fetchProjectsApi,
  getProjectsCache,
  type Batch,
  type EmissionActivity,
  type EvidenceItem,
  type LabResult,
  type LaboratoryAnalysis,
  type Project,
} from "@/lib/projects-api";

type ProjectKpis = {
  totalProjects: number;
  activeProjects: number;
  totalRemovalsTco2e: number;
  totalGrossTco2e: number;
  totalNetTco2e: number;
  pendingEvidenceCount: number;
  reportedLabResultsCount: number;
  inProgressLabResultsCount: number;
  totalBatches: number;
};

type ProjectsContextValue = {
  projects: Project[];
  evidence: EvidenceItem[];
  labResults: LabResult[];
  analyses: LaboratoryAnalysis[];
  emissions: EmissionActivity[];
  batches: Batch[];
  kpis: ProjectKpis;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getProjectById: (projectId: string) => Project | undefined;
};

const ProjectsContext = createContext<ProjectsContextValue | null>(null);

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(() => getProjectsCache());
  const [isLoading, setIsLoading] = useState<boolean>(getProjectsCache().length === 0);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const next = await fetchProjectsApi();
      setProjects(next);
      setError(null);
    } catch (loadError) {
      setProjects(getProjectsCache());
      setError(loadError instanceof Error ? loadError.message : "Unable to load projects.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const evidence = useMemo(
    () => projects.flatMap((project) => project.evidences ?? []),
    [projects],
  );

  const labResults = useMemo(
    () => projects.flatMap((project) => project.labResults ?? []),
    [projects],
  );

  const analyses = useMemo(
    () => projects.flatMap((project) => project.labAnalysis ?? []),
    [projects],
  );

  const emissions = useMemo(
    () => projects.flatMap((project) => project.emissions ?? []),
    [projects],
  );

  const batches = useMemo(
    () => projects.flatMap((project) => project.batch ?? []),
    [projects],
  );

  const kpis = useMemo<ProjectKpis>(() => {
    const totalRemovalsTco2e = emissions
      .filter((entry) => entry.scope === "removals")
      .reduce((sum, entry) => sum + entry.tco2e, 0);
    const totalGrossTco2e = emissions
      .filter((entry) => entry.scope !== "removals")
      .reduce((sum, entry) => sum + entry.tco2e, 0);

    return {
      totalProjects: projects.length,
      activeProjects: projects.filter((project) => project.status === "active").length,
      totalRemovalsTco2e,
      totalGrossTco2e,
      totalNetTco2e: totalRemovalsTco2e - totalGrossTco2e,
      pendingEvidenceCount: evidence.filter((item) => item.status === "pending").length,
      reportedLabResultsCount: labResults.filter((item) => item.status === "reported").length,
      inProgressLabResultsCount: labResults.filter((item) => item.status === "in_progress").length,
      totalBatches: batches.length,
    };
  }, [batches, emissions, evidence, labResults, projects]);

  const getProjectById = useCallback(
    (projectId: string) => projects.find((project) => project.id === projectId),
    [projects],
  );

  const value = useMemo(
    () => ({ projects, evidence, labResults, analyses, emissions, batches, kpis, isLoading, error, refresh, getProjectById }),
    [projects, evidence, labResults, analyses, emissions, batches, kpis, isLoading, error, refresh, getProjectById],
  );

  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}

export function useProjects() {
  const value = useContext(ProjectsContext);
  if (!value) throw new Error("useProjects must be used within ProjectsProvider");
  return value;
}
