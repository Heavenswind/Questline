import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { blockers, mainPath, playthrough, totals, type MainPath, type Totals } from './model/analysis';
import { problems, type Problem } from './model/validate';
import { useProject } from './store';

export interface Analysis {
  tier: Map<string, number>;
  blockers: Map<string, string[]>;
  problems: Problem[];
  path: MainPath;
  onPath: Set<string>;
  main: Totals;
  all: Totals;
}

const AnalysisContext = createContext<Analysis | null>(null);

/** Analyses the current project once per edit and shares the result with every panel. */
export function AnalysisProvider({ children }: { children: ReactNode }) {
  const project = useProject();
  const analysis = useMemo<Analysis>(() => {
    const play = playthrough(project);
    const path = mainPath(project, play);
    return {
      tier: play.tier,
      blockers: blockers(project, play),
      problems: problems(project, play),
      path,
      onPath: new Set(path.quests),
      main: totals(project, path.quests),
      all: totals(project, play.tier.keys()),
    };
  }, [project]);
  return <AnalysisContext.Provider value={analysis}>{children}</AnalysisContext.Provider>;
}

export function useAnalysis(): Analysis {
  const analysis = useContext(AnalysisContext);
  if (!analysis) throw new Error('useAnalysis needs an AnalysisProvider');
  return analysis;
}

export function duration(minutes: number): string {
  const m = Math.round(minutes);
  if (m < 60) return `${m} min`;
  return m % 60 === 0 ? `${m / 60} h` : `${Math.floor(m / 60)} h ${m % 60} min`;
}
