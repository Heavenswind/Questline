import { useRef, useState } from 'react';
import { useAnalysis } from '../analysis';
import { readJson } from '../files';
import { searchQuests } from '../model/analysis';
import { addItem, addQuest, flagUsage, importItems, itemUsages, removeItem, renameFlag, updateItem } from '../model/edits';
import { itemsFromHoard } from '../model/hoard';
import { useEditor, useProject } from '../store';
import { TextInput } from './fields';

export function QuestList() {
  const project = useProject();
  const edit = useEditor((s) => s.edit);
  const selectedId = useEditor((s) => s.selectedId);
  const select = useEditor((s) => s.select);
  const { tier } = useAnalysis();
  const [query, setQuery] = useState('');
  const found = query.trim() ? searchQuests(project, query) : null;

  const add = () => {
    const p = useEditor.getState().history.present;
    // Below the selected quest, or under the lowest one.
    const anchor = p.quests.find((q) => q.id === selectedId) ?? null;
    const lowest = Math.max(0, ...p.quests.map((q) => q.position.y));
    const position = anchor ? { x: anchor.position.x, y: anchor.position.y + 150 } : { x: 0, y: lowest + 150 };
    const { project: next, id } = addQuest(p, position);
    edit(() => next);
    select(id);
  };

  const sorted = [...project.quests].sort(
    (a, b) => (tier.get(a.id) ?? Infinity) - (tier.get(b.id) ?? Infinity) || (a.kind === b.kind ? 0 : a.kind === 'main' ? -1 : 1),
  );

  return (
    <section className="panel">
      <h2>
        Quests
        <button onClick={add}>+ Quest</button>
      </h2>
      <input
        type="search"
        className="quest-search"
        placeholder="Search titles, places, flags, items…"
        aria-label="Search quests"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul className="quest-list">
        {(found ? sorted.filter((q) => found.has(q.id)) : sorted).map((q) => {
          const t = tier.get(q.id);
          return (
            <li key={q.id}>
              <button className={q.id === selectedId ? 'active' : ''} onClick={() => select(q.id)}>
                <span className={`dot dot-${q.kind}`} aria-hidden />
                <span className="name">{q.title || 'Untitled'}</span>
                <span className={t === undefined ? 'stuck' : 'muted'}>{t === undefined ? '✕' : `tier ${t}`}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {found && found.size === 0 && <p className="muted note">No quest mentions “{query.trim()}”.</p>}
    </section>
  );
}

export function ItemsPanel() {
  const project = useProject();
  const edit = useEditor((s) => s.edit);
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const importFrom = async (file: File | undefined) => {
    if (!file) return;
    try {
      const incoming = itemsFromHoard(await readJson(file));
      const { project: next, added } = importItems(useEditor.getState().history.present, incoming);
      if (added > 0) edit(() => next);
      setMessage({ text: added ? `Added ${added} item${added === 1 ? '' : 's'} from ${file.name}.` : 'No new items: they were all here already.', error: false });
    } catch (err) {
      setMessage({ text: (err as Error).message, error: true });
    }
  };

  return (
    <section className="panel">
      <h2>
        Items
        <button onClick={() => edit(addItem)}>+ Item</button>
      </h2>
      <div className="item-row head muted">
        <span>Name</span>
        <span title="Can be picked up in the world, without a quest">In world</span>
      </div>
      {project.items.map((item) => {
        const used = itemUsages(project, item.id);
        return (
          <div className="item-row" key={item.id}>
            <TextInput
              aria-label="Item name"
              value={item.name}
              onChange={(name) => edit((p) => updateItem(p, item.id, { name }), `item-name-${item.id}`)}
            />
            <input
              type="checkbox"
              aria-label={`${item.name} can be found in the world`}
              checked={item.inWorld}
              onChange={(e) => edit((p) => updateItem(p, item.id, { inWorld: e.target.checked }))}
            />
            <button
              className="icon danger"
              aria-label={`Delete ${item.name}`}
              disabled={used.length > 0}
              title={used.length ? `Used by ${used.join(', ')}` : 'Delete item'}
              onClick={() => edit((p) => removeItem(p, item.id))}
            >
              ×
            </button>
          </div>
        );
      })}
      <button onClick={() => fileRef.current?.click()} title="Add the items from a Hoard loot project (.hoard.json)">
        Import items from Hoard…
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          void importFrom(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {message && <p className={`note ${message.error ? 'error' : 'muted'}`}>{message.text}</p>}
    </section>
  );
}

export function FlagsPanel() {
  const project = useProject();
  const edit = useEditor((s) => s.edit);
  const select = useEditor((s) => s.select);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const title = (id: string) => project.quests.find((q) => q.id === id)?.title ?? '?';
  const flags = flagUsage(project);

  const applyRename = () => {
    if (renaming) edit((p) => renameFlag(p, renaming, draft));
    setRenaming(null);
  };

  return (
    <section className="panel">
      <h2>Flags</h2>
      {flags.length === 0 && <p className="muted note">Flags appear here when a quest sets or needs one.</p>}
      {flags.map((f) => (
        <div className="flag" key={f.flag}>
          {renaming === f.flag ? (
            <input
              autoFocus
              aria-label={`New name for flag ${f.flag}`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={applyRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyRename();
                else if (e.key === 'Escape') setRenaming(null);
              }}
            />
          ) : (
            <div className="row">
              <code>{f.flag}</code>
              <button
                className="icon"
                aria-label={`Rename flag ${f.flag}`}
                title="Rename this flag everywhere it's set or needed"
                onClick={() => {
                  setRenaming(f.flag);
                  setDraft(f.flag);
                }}
              >
                ✎
              </button>
            </div>
          )}
          <div className="flag-uses">
            <span className="muted">set by </span>
            {f.setBy.length ? (
              f.setBy.map((id) => (
                <button key={id} className="link" onClick={() => select(id)}>
                  {title(id)}
                </button>
              ))
            ) : (
              <span className="stuck">nothing</span>
            )}
          </div>
          <div className="flag-uses">
            <span className="muted">needed by </span>
            {f.neededBy.length ? (
              f.neededBy.map((id) => (
                <button key={id} className="link" onClick={() => select(id)}>
                  {title(id)}
                </button>
              ))
            ) : (
              <span className="muted">nothing</span>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}
