import { describe, expect, it } from 'vitest';
import {
  addQuest,
  addToList,
  blankObjective,
  connect,
  disconnect,
  flagUsage,
  importItems,
  itemUsages,
  removeFromList,
  removeQuest,
  renameFlag,
  setInList,
} from './edits';
import { itemsFromHoard } from './hoard';
import { commit, historyOf, undo } from './history';
import { sampleProject } from './project';
import { problems } from './validate';

const quest = (p: ReturnType<typeof sampleProject>, id: string) => p.quests.find((q) => q.id === id)!;

describe('quest edits', () => {
  it('removes a quest along with every reference to it', () => {
    const p = removeQuest(sampleProject(), 'smugglers');
    expect(p.quests.some((q) => q.id === 'smugglers')).toBe(false);
    expect(quest(p, 'guild').locks).toEqual([]);
    expect(problems(p).filter((x) => x.level === 'error')).toEqual([]);

    const q = removeQuest(sampleProject(), 'ring');
    expect(quest(q, 'favour').requires).toEqual([]);
  });

  it('numbers new quests and keeps the project valid', () => {
    const { project, id } = addQuest(addQuest(sampleProject()).project, { x: 10, y: 20 });
    expect(project.quests.slice(-2).map((q) => q.title)).toEqual(['New quest', 'New quest 2']);
    expect(quest(project, id).position).toEqual({ x: 10, y: 20 });
  });

  it('edits requirement, objective and reward lists by index', () => {
    let p = sampleProject();
    p = addToList(p, 'pass', 'objectives', blankObjective('kill', p));
    expect(quest(p, 'pass').objectives.at(-1)).toEqual({ kind: 'kill', target: '', count: 1 });
    p = setInList(p, 'pass', 'objectives', 1, { kind: 'kill', target: 'Mountain troll', count: 1 });
    expect(quest(p, 'pass').objectives[1]).toEqual({ kind: 'kill', target: 'Mountain troll', count: 1 });
    p = removeFromList(p, 'pass', 'requires', 0);
    expect(quest(p, 'pass').requires).toEqual([{ kind: 'flag', flag: 'pass_open' }]);
  });
});

describe('graph edits', () => {
  it('connects quests once and never to themselves', () => {
    const p = sampleProject();
    const q = connect(p, 'pelts', 'pass');
    expect(quest(q, 'pass').requires).toContainEqual({ kind: 'quest', questId: 'pelts' });
    expect(connect(q, 'pelts', 'pass')).toBe(q);
    expect(connect(p, 'pass', 'pass')).toBe(p);
  });

  it('deletes prerequisite and lock links but leaves derived ones', () => {
    const p = sampleProject();
    expect(quest(disconnect(p, 'quest:ring>favour'), 'favour').requires).toEqual([]);
    expect(quest(disconnect(p, 'lock:guild>smugglers'), 'guild').locks).toEqual([]);
    expect(disconnect(p, 'flag:ring>pelts:met_mara')).toBe(p);
  });
});

describe('items and flags', () => {
  it('knows where items are used', () => {
    const p = sampleProject();
    expect(itemUsages(p, 'map')).toEqual(['Wolf Pelts', 'The Hermit’s Riddle']);
    expect(itemUsages(p, 'blade')).toEqual(['Forge the Blade']);
  });

  it('lists flags with who sets and who needs them', () => {
    expect(flagUsage(sampleProject())).toEqual([
      { flag: 'met_mara', setBy: ['ring'], neededBy: ['pelts'] },
      { flag: 'pass_open', setBy: ['guild', 'smugglers'], neededBy: ['pass'] },
      { flag: 'smith_trusts_you', setBy: ['favour'], neededBy: ['blade'] },
    ]);
  });

  it('renames a flag everywhere, ignoring empty or unchanged names', () => {
    const p = renameFlag(sampleProject(), 'pass_open', 'gate_open');
    expect(flagUsage(p).map((f) => f.flag)).toEqual(['gate_open', 'met_mara', 'smith_trusts_you']);
    expect(quest(p, 'pass').requires).toContainEqual({ kind: 'flag', flag: 'gate_open' });
    expect(quest(p, 'guild').rewards).toContainEqual({ kind: 'flag', flag: 'gate_open' });
    expect(problems(p).filter((x) => x.level === 'error')).toEqual([]);
    expect(renameFlag(p, 'gate_open', '   ')).toBe(p);
    expect(renameFlag(p, 'gate_open', 'gate_open')).toBe(p);
  });

  it('renames flags inside outcome rewards and lists them as setters', () => {
    const p = sampleProject();
    quest(p, 'hermit').outcomes = [{ id: 'o1', name: 'Spared', rewards: [{ kind: 'flag', flag: 'pass_open' }] }];
    expect(flagUsage(p).find((f) => f.flag === 'pass_open')!.setBy).toEqual(['hermit', 'guild', 'smugglers']);
    const renamed = renameFlag(p, 'pass_open', 'gate_open');
    expect(quest(renamed, 'hermit').outcomes![0].rewards).toEqual([{ kind: 'flag', flag: 'gate_open' }]);
  });

  it('imports Hoard items, skipping gold and anything already there', () => {
    const hoard = {
      format: 'hoard',
      items: [
        { id: 'gold', name: 'Gold', value: 1 },
        { id: 'pelt', name: 'Wolf pelt', value: 6 },
        { id: 'fang', name: 'Wolf fang', value: 3 },
        { id: 'x1', name: 'IRON ORE', value: 8 },
      ],
    };
    const incoming = itemsFromHoard(hoard);
    expect(incoming.map((i) => i.id)).toEqual(['pelt', 'fang', 'x1']);
    const { project, added } = importItems(sampleProject(), incoming);
    expect(added).toBe(1);
    expect(project.items.at(-1)).toEqual({ id: 'fang', name: 'Wolf fang', inWorld: true });
    expect(() => itemsFromHoard({ format: 'questline' })).toThrow('Not a Hoard project file.');
  });
});

describe('history', () => {
  it('undoes back to the previous project', () => {
    const a = sampleProject();
    const h = commit(historyOf(a), removeQuest(a, 'ring'));
    expect(undo(h).present).toBe(a);
  });
});
