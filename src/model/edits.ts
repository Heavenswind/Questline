// Immutable edits the UI applies through the store. Each returns a new project.

import { newQuest, uid } from './project';
import type { Item, Objective, Project, Quest, Requirement, Reward } from './types';

/** "New quest", then "New quest 2", "New quest 3"… */
export function uniqueName(base: string, taken: string[]): string {
  const names = new Set(taken);
  if (!names.has(base)) return base;
  let n = 2;
  while (names.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

export function updateQuest(p: Project, id: string, fn: (q: Quest) => Quest): Project {
  return { ...p, quests: p.quests.map((q) => (q.id === id ? fn(q) : q)) };
}

export function addQuest(p: Project, position = { x: 0, y: 0 }): { project: Project; id: string } {
  const quest = newQuest(uniqueName('New quest', p.quests.map((q) => q.title)), position);
  return { project: { ...p, quests: [...p.quests, quest] }, id: quest.id };
}

/** Removes the quest and every requirement or lock that points at it. */
export function removeQuest(p: Project, id: string): Project {
  return {
    ...p,
    quests: p.quests
      .filter((q) => q.id !== id)
      .map((q) => ({
        ...q,
        requires: q.requires.filter((r) => !(r.kind === 'quest' && r.questId === id)),
        locks: q.locks.filter((l) => l !== id),
      })),
  };
}

type ListKey = 'requires' | 'objectives' | 'rewards';
type ListItem<K extends ListKey> = Quest[K][number];

export function addToList<K extends ListKey>(p: Project, questId: string, key: K, value: ListItem<K>): Project {
  return updateQuest(p, questId, (q) => ({ ...q, [key]: [...q[key], value] }));
}

export function setInList<K extends ListKey>(p: Project, questId: string, key: K, index: number, value: ListItem<K>): Project {
  return updateQuest(p, questId, (q) => ({ ...q, [key]: q[key].map((x, i) => (i === index ? value : x)) }));
}

export function removeFromList(p: Project, questId: string, key: ListKey, index: number): Project {
  return updateQuest(p, questId, (q) => ({ ...q, [key]: q[key].filter((_, i) => i !== index) }));
}

/** Defaults for a newly added requirement, objective or reward of each kind. */
export function blankRequirement(kind: Requirement['kind'], p: Project): Requirement {
  if (kind === 'quest') return { kind, questId: p.quests[0]?.id ?? '' };
  if (kind === 'flag') return { kind, flag: '' };
  return { kind, itemId: p.items[0]?.id ?? '', count: 1 };
}

export function blankObjective(kind: Objective['kind'], p: Project): Objective {
  switch (kind) {
    case 'talk':
      return { kind, npc: '', conversation: '' };
    case 'collect':
      return { kind, itemId: p.items[0]?.id ?? '', count: 1 };
    case 'kill':
      return { kind, target: '', count: 1 };
    case 'reach':
      return { kind, location: '' };
    case 'other':
      return { kind, text: '' };
  }
}

export function blankReward(kind: Reward['kind'], p: Project): Reward {
  if (kind === 'item') return { kind, itemId: p.items[0]?.id ?? '', count: 1 };
  if (kind === 'flag') return { kind, flag: '' };
  return { kind, amount: kind === 'xp' ? 50 : 10 };
}

/** Dragging from one quest to another in the graph: `target` now needs `source` to be done. */
export function connect(p: Project, source: string, target: string): Project {
  if (source === target) return p;
  const exists = p.quests.find((q) => q.id === target)?.requires.some((r) => r.kind === 'quest' && r.questId === source);
  return exists ? p : addToList(p, target, 'requires', { kind: 'quest', questId: source });
}

/**
 * Deleting a link in the graph. Prerequisite and lock links are removed; flag and item links are
 * derived from rewards, so they're left alone (edit the quest instead).
 */
export function disconnect(p: Project, linkId: string): Project {
  const match = /^(quest|lock):([^>]+)>(.+)$/.exec(linkId);
  if (!match) return p;
  const [, kind, source, target] = match;
  if (kind === 'quest')
    return updateQuest(p, target, (q) => ({ ...q, requires: q.requires.filter((r) => !(r.kind === 'quest' && r.questId === source)) }));
  return updateQuest(p, source, (q) => ({ ...q, locks: q.locks.filter((l) => l !== target) }));
}

export function moveQuest(p: Project, id: string, position: { x: number; y: number }): Project {
  return updateQuest(p, id, (q) => ({ ...q, position }));
}

export function addItem(p: Project): Project {
  const item: Item = { id: uid(), name: uniqueName('New item', p.items.map((i) => i.name)), inWorld: true };
  return { ...p, items: [...p.items, item] };
}

export function updateItem(p: Project, id: string, patch: Partial<Omit<Item, 'id'>>): Project {
  return { ...p, items: p.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) };
}

export function removeItem(p: Project, id: string): Project {
  return { ...p, items: p.items.filter((i) => i.id !== id) };
}

/** Titles of quests that use an item, for explaining why it can't be deleted. */
export function itemUsages(p: Project, itemId: string): string[] {
  return p.quests
    .filter(
      (q) =>
        q.requires.some((r) => r.kind === 'item' && r.itemId === itemId) ||
        q.objectives.some((o) => o.kind === 'collect' && o.itemId === itemId) ||
        q.rewards.some((r) => r.kind === 'item' && r.itemId === itemId),
    )
    .map((q) => q.title);
}

export interface FlagUse {
  flag: string;
  setBy: string[];
  neededBy: string[];
}

/** Every flag in the project, with the quests that set it and the quests that need it. */
export function flagUsage(p: Project): FlagUse[] {
  const flags = new Map<string, FlagUse>();
  const entry = (flag: string) => flags.get(flag) ?? flags.set(flag, { flag, setBy: [], neededBy: [] }).get(flag)!;
  for (const q of p.quests) {
    for (const r of q.rewards) if (r.kind === 'flag' && r.flag) entry(r.flag).setBy.push(q.id);
    for (const r of q.requires) if (r.kind === 'flag' && r.flag) entry(r.flag).neededBy.push(q.id);
  }
  return [...flags.values()].sort((a, b) => a.flag.localeCompare(b.flag));
}

/**
 * Adds items that aren't in the project yet, matched by id or by name (ignoring case).
 * New items keep their ids, so both tools refer to the same item, and default to "found in the world".
 */
export function importItems(p: Project, incoming: { id: string; name: string }[]): { project: Project; added: number } {
  const ids = new Set(p.items.map((i) => i.id));
  const names = new Set(p.items.map((i) => i.name.trim().toLowerCase()));
  const fresh: Item[] = [];
  for (const i of incoming) {
    const name = i.name.trim().toLowerCase();
    if (ids.has(i.id) || names.has(name)) continue;
    ids.add(i.id);
    names.add(name);
    fresh.push({ id: i.id, name: i.name, inWorld: true });
  }
  return { project: { ...p, items: [...p.items, ...fresh] }, added: fresh.length };
}
