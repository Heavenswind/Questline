import { useAnalysis } from '../analysis';
import {
  addToList,
  blankObjective,
  blankOutcome,
  blankRequirement,
  blankReward,
  flagUsage,
  removeFromList,
  removeQuest,
  setInList,
  updateQuest,
} from '../model/edits';
import type { Objective, Project, Quest, Requirement, Reward } from '../model/types';
import { useEditor, useProject } from '../store';
import { NumberInput, TextArea, TextInput } from './fields';

const FLAG_LIST = 'known-flags';

function ItemSelect({ project, value, onChange }: { project: Project; value: string; onChange: (id: string) => void }) {
  return (
    <select aria-label="Item" value={value} onChange={(e) => onChange(e.target.value)}>
      {!project.items.some((i) => i.id === value) && <option value={value}>(no item)</option>}
      {project.items.map((i) => (
        <option key={i.id} value={i.id}>
          {i.name}
        </option>
      ))}
    </select>
  );
}

function Count({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return <NumberInput className="count" aria-label="Count" min={1} step={1} value={value} onChange={onChange} />;
}

function Remove({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button className="icon danger" aria-label={label} onClick={onClick}>
      ×
    </button>
  );
}

function AddMenu<K extends string>({ label, kinds, onAdd }: { label: string; kinds: Record<K, string>; onAdd: (kind: K) => void }) {
  return (
    <select
      className="add-menu"
      aria-label={label}
      value=""
      onChange={(e) => {
        if (e.target.value) onAdd(e.target.value as K);
      }}
    >
      <option value="">{label}</option>
      {Object.entries<string>(kinds).map(([kind, name]) => (
        <option key={kind} value={kind}>
          {name}
        </option>
      ))}
    </select>
  );
}

const REQUIREMENT_KINDS: Record<Requirement['kind'], string> = { quest: 'Quest done', flag: 'Flag set', item: 'Has item' };
const OBJECTIVE_KINDS: Record<Objective['kind'], string> = { talk: 'Talk to', collect: 'Collect', kill: 'Defeat', reach: 'Reach', other: 'Other' };
const REWARD_KINDS: Record<Reward['kind'], string> = { xp: 'XP', gold: 'Gold', item: 'Item', flag: 'Set flag' };

function RequirementRow({ project, quest, r, n }: { project: Project; quest: Quest; r: Requirement; n: number }) {
  const edit = useEditor((s) => s.edit);
  const set = (value: Requirement, key?: string) => edit((p) => setInList(p, quest.id, 'requires', n, value), key);
  return (
    <div className="row">
      <span className="row-kind">{REQUIREMENT_KINDS[r.kind]}</span>
      {r.kind === 'quest' && (
        <select aria-label="Required quest" value={r.questId} onChange={(e) => set({ ...r, questId: e.target.value })}>
          {!project.quests.some((q) => q.id === r.questId) && <option value={r.questId}>(deleted quest)</option>}
          {project.quests
            .filter((q) => q.id !== quest.id)
            .map((q) => (
              <option key={q.id} value={q.id}>
                {q.title}
              </option>
            ))}
        </select>
      )}
      {r.kind === 'flag' && (
        <TextInput aria-label="Flag" list={FLAG_LIST} placeholder="flag_name" value={r.flag} onChange={(flag) => set({ ...r, flag }, `req-${quest.id}-${n}`)} />
      )}
      {r.kind === 'item' && (
        <>
          <Count value={r.count} onChange={(count) => set({ ...r, count }, `req-${quest.id}-${n}`)} />
          <ItemSelect project={project} value={r.itemId} onChange={(itemId) => set({ ...r, itemId })} />
        </>
      )}
      <Remove label="Remove requirement" onClick={() => edit((p) => removeFromList(p, quest.id, 'requires', n))} />
    </div>
  );
}

function ObjectiveRow({ project, quest, o, n }: { project: Project; quest: Quest; o: Objective; n: number }) {
  const edit = useEditor((s) => s.edit);
  const key = `obj-${quest.id}-${n}`;
  const set = (value: Objective, merge?: string) => edit((p) => setInList(p, quest.id, 'objectives', n, value), merge);
  return (
    <div className="row">
      <span className="row-kind">{OBJECTIVE_KINDS[o.kind]}</span>
      {o.kind === 'talk' && (
        <>
          <TextInput aria-label="NPC" placeholder="NPC" value={o.npc} onChange={(npc) => set({ ...o, npc }, key)} />
          <TextInput
            aria-label="Parley conversation id"
            title="Optional: the Parley conversation to start"
            placeholder="conversation id"
            value={o.conversation}
            onChange={(conversation) => set({ ...o, conversation }, key)}
          />
        </>
      )}
      {o.kind === 'collect' && (
        <>
          <Count value={o.count} onChange={(count) => set({ ...o, count }, key)} />
          <ItemSelect project={project} value={o.itemId} onChange={(itemId) => set({ ...o, itemId })} />
        </>
      )}
      {o.kind === 'kill' && (
        <>
          <Count value={o.count} onChange={(count) => set({ ...o, count }, key)} />
          <TextInput aria-label="Enemy" placeholder="Enemy" value={o.target} onChange={(target) => set({ ...o, target }, key)} />
        </>
      )}
      {o.kind === 'reach' && (
        <TextInput aria-label="Location" placeholder="Location" value={o.location} onChange={(location) => set({ ...o, location }, key)} />
      )}
      {o.kind === 'other' && (
        <TextInput aria-label="Objective" placeholder="What the player does" value={o.text} onChange={(text) => set({ ...o, text }, key)} />
      )}
      <Remove label="Remove objective" onClick={() => edit((p) => removeFromList(p, quest.id, 'objectives', n))} />
    </div>
  );
}

function RewardRow({
  project,
  r,
  mergeKey: key,
  set,
  remove,
}: {
  project: Project;
  r: Reward;
  mergeKey: string;
  set: (value: Reward, merge?: string) => void;
  remove: () => void;
}) {
  return (
    <div className="row">
      <span className="row-kind">{REWARD_KINDS[r.kind]}</span>
      {(r.kind === 'xp' || r.kind === 'gold') && (
        <NumberInput className="count" aria-label={`${REWARD_KINDS[r.kind]} amount`} min={0} value={r.amount} onChange={(amount) => set({ ...r, amount }, key)} />
      )}
      {r.kind === 'item' && (
        <>
          <Count value={r.count} onChange={(count) => set({ ...r, count }, key)} />
          <ItemSelect project={project} value={r.itemId} onChange={(itemId) => set({ ...r, itemId })} />
        </>
      )}
      {r.kind === 'flag' && (
        <TextInput aria-label="Flag" list={FLAG_LIST} placeholder="flag_name" value={r.flag} onChange={(flag) => set({ ...r, flag }, key)} />
      )}
      <Remove label="Remove reward" onClick={remove} />
    </div>
  );
}

export function Inspector() {
  const project = useProject();
  const selectedId = useEditor((s) => s.selectedId);
  const edit = useEditor((s) => s.edit);
  const select = useEditor((s) => s.select);
  const { tier, blockers, onPath } = useAnalysis();
  const quest = project.quests.find((q) => q.id === selectedId);

  if (!quest) {
    return (
      <section className="panel">
        <h2>Quest</h2>
        <p className="muted note">Select a quest in the graph or the list. Drag from a quest's right handle to another quest to make it a prerequisite.</p>
      </section>
    );
  }

  const set = (fn: (q: Quest) => Quest, key?: string) => edit((p) => updateQuest(p, quest.id, fn), key);
  const field = (name: string) => `${name}-${quest.id}`;
  const reasons = blockers.get(quest.id);
  const lockable = project.quests.filter((q) => q.id !== quest.id && !quest.locks.includes(q.id));

  return (
    <section className="panel inspector">
      <datalist id={FLAG_LIST}>
        {flagUsage(project).map((f) => (
          <option key={f.flag} value={f.flag} />
        ))}
      </datalist>
      <h2>
        Quest
        <button
          className="danger"
          onClick={() => {
            edit((p) => removeQuest(p, quest.id));
            select(null);
          }}
        >
          Delete
        </button>
      </h2>
      <TextInput className="title-input" aria-label="Quest title" value={quest.title} onChange={(title) => set((q) => ({ ...q, title }), field('title'))} />
      <p className={`status-line ${reasons ? 'stuck' : ''}`}>
        {reasons
          ? `Can never be started: it ${reasons.join('; it ') || 'is blocked'}.`
          : `Possible from tier ${tier.get(quest.id)}${onPath.has(quest.id) ? ' · on the main path' : ''}.`}
      </p>
      <div className="form-grid">
        <label>
          Kind
          <select value={quest.kind} onChange={(e) => set((q) => ({ ...q, kind: e.target.value as Quest['kind'] }))}>
            <option value="main">Main story</option>
            <option value="side">Side quest</option>
          </select>
        </label>
        <label>
          Minutes
          <NumberInput min={0} value={quest.minutes} onChange={(minutes) => set((q) => ({ ...q, minutes }), field('minutes'))} />
        </label>
        <label>
          Giver
          <TextInput value={quest.giver} onChange={(giver) => set((q) => ({ ...q, giver }), field('giver'))} />
        </label>
        <label>
          Location
          <TextInput value={quest.location} onChange={(location) => set((q) => ({ ...q, location }), field('location'))} />
        </label>
      </div>
      <label className="block">
        Journal text
        <TextArea rows={3} value={quest.description} onChange={(description) => set((q) => ({ ...q, description }), field('description'))} />
      </label>

      <h3>Needs</h3>
      {quest.requires.length === 0 && <p className="muted note">Nothing: available from the start.</p>}
      {quest.requires.map((r, n) => (
        <RequirementRow key={n} project={project} quest={quest} r={r} n={n} />
      ))}
      <AddMenu
        label="+ Add requirement"
        kinds={REQUIREMENT_KINDS}
        onAdd={(kind) => edit((p) => addToList(p, quest.id, 'requires', blankRequirement(kind, p)))}
      />

      <h3>Objectives</h3>
      {quest.objectives.map((o, n) => (
        <ObjectiveRow key={n} project={project} quest={quest} o={o} n={n} />
      ))}
      <AddMenu
        label="+ Add objective"
        kinds={OBJECTIVE_KINDS}
        onAdd={(kind) => edit((p) => addToList(p, quest.id, 'objectives', blankObjective(kind, p)))}
      />

      <h3>Rewards</h3>
      {quest.rewards.map((r, n) => (
        <RewardRow
          key={n}
          project={project}
          r={r}
          mergeKey={`rew-${quest.id}-${n}`}
          set={(value, merge) => edit((p) => setInList(p, quest.id, 'rewards', n, value), merge)}
          remove={() => edit((p) => removeFromList(p, quest.id, 'rewards', n))}
        />
      ))}
      <AddMenu label="+ Add reward" kinds={REWARD_KINDS} onAdd={(kind) => edit((p) => addToList(p, quest.id, 'rewards', blankReward(kind, p)))} />

      <h3>Outcomes</h3>
      <p className="muted note">Ways the quest can end (spared / killed). The player gets the rewards above plus one outcome's.</p>
      {(quest.outcomes ?? []).map((o, n) => {
        const setOutcome = (value: typeof o | null, merge?: string) =>
          set((q) => ({ ...q, outcomes: value ? q.outcomes?.map((x, i) => (i === n ? value : x)) : q.outcomes?.filter((_, i) => i !== n) }), merge);
        return (
          <div className="outcome" key={o.id}>
            <div className="row">
              <span className="row-kind">Ends as</span>
              <TextInput
                aria-label="Outcome name"
                placeholder="How it ends"
                value={o.name}
                onChange={(name) => setOutcome({ ...o, name }, `out-${quest.id}-${n}`)}
              />
              <Remove label="Remove outcome" onClick={() => setOutcome(null)} />
            </div>
            {o.rewards.map((r, k) => (
              <RewardRow
                key={k}
                project={project}
                r={r}
                mergeKey={`out-rew-${o.id}-${k}`}
                set={(value, merge) => setOutcome({ ...o, rewards: o.rewards.map((x, i) => (i === k ? value : x)) }, merge)}
                remove={() => setOutcome({ ...o, rewards: o.rewards.filter((_, i) => i !== k) })}
              />
            ))}
            <AddMenu
              label="+ Add outcome reward"
              kinds={REWARD_KINDS}
              onAdd={(kind) => edit((p) => updateQuest(p, quest.id, (q) => ({
                ...q,
                outcomes: q.outcomes?.map((x, i) => (i === n ? { ...x, rewards: [...x.rewards, blankReward(kind, p)] } : x)),
              })))}
            />
          </div>
        );
      })}
      <button onClick={() => set((q) => ({ ...q, outcomes: [...(q.outcomes ?? []), blankOutcome()] }))}>+ Outcome</button>

      <h3>Locks</h3>
      <p className="muted note">Quests that can no longer be started once this one is done, for choices like picking a side.</p>
      {quest.locks.map((id) => (
        <div className="row" key={id}>
          <span className="row-kind">Locks</span>
          <span className="grow">{project.quests.find((q) => q.id === id)?.title ?? '(deleted quest)'}</span>
          <Remove label="Remove lock" onClick={() => set((q) => ({ ...q, locks: q.locks.filter((l) => l !== id) }))} />
        </div>
      ))}
      {lockable.length > 0 && (
        <select
          className="add-menu"
          aria-label="Add lock"
          value=""
          onChange={(e) => {
            const id = e.target.value;
            if (id) set((q) => ({ ...q, locks: [...q.locks, id] }));
          }}
        >
          <option value="">+ Lock another quest</option>
          {lockable.map((q) => (
            <option key={q.id} value={q.id}>
              {q.title}
            </option>
          ))}
        </select>
      )}
    </section>
  );
}
