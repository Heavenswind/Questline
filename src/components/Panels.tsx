import { duration, useAnalysis } from '../analysis';
import { useEditor, useProject } from '../store';

export function SummaryPanel() {
  const project = useProject();
  const select = useEditor((s) => s.select);
  const { main, all, path, tier } = useAnalysis();
  const stuck = project.quests.length - tier.size;
  const title = (id: string) => project.quests.find((q) => q.id === id)?.title ?? '?';

  return (
    <section className="panel">
      <h2>Summary</h2>
      <div className="tiles">
        <div className="tile">
          <span className="muted">Main story</span>
          <strong>{duration(main.minutes)}</strong>
          <span className="muted">
            {main.quests} quests · {main.xp.toLocaleString('en')} XP · {main.gold.toLocaleString('en')} gold
          </span>
        </div>
        <div className="tile">
          <span className="muted">Everything reachable</span>
          <strong>{duration(all.minutes)}</strong>
          <span className="muted">
            {all.quests} quests · {all.xp.toLocaleString('en')} XP · {all.gold.toLocaleString('en')} gold
          </span>
        </div>
      </div>
      {stuck > 0 && (
        <p className="note">
          {stuck} {stuck === 1 ? 'quest' : 'quests'} can never be started; see Problems.
        </p>
      )}
      {path.quests.length > 0 && (
        <>
          <h3>Main path</h3>
          <ol className="path">
            {path.quests.map((id) => (
              <li key={id}>
                <button className="link" onClick={() => select(id)}>
                  {title(id)}
                </button>
              </li>
            ))}
          </ol>
          <p className="muted note">Main quests plus everything they need, taking the quickest option at each choice.</p>
        </>
      )}
    </section>
  );
}

export function ProblemsPanel() {
  const { problems } = useAnalysis();
  const select = useEditor((s) => s.select);
  return (
    <section className="panel">
      <h2>Problems</h2>
      {problems.length === 0 ? (
        <p className="status-row">
          <span className="status-icon good" aria-hidden>
            ✓
          </span>
          No problems found.
        </p>
      ) : (
        <ul className="problems">
          {problems.map((p, n) => (
            <li key={n} className="status-row">
              <span className={`status-icon ${p.level}`} aria-hidden>
                {p.level === 'error' ? '✕' : '!'}
              </span>
              <span className="sr-only">{p.level === 'error' ? 'Error:' : 'Warning:'}</span>
              {p.questId ? (
                <button className="link" onClick={() => select(p.questId!)}>
                  {p.message}
                </button>
              ) : (
                <span>{p.message}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
