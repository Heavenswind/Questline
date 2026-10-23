// How quests connect, for drawing: direct prerequisites, flags and items passed from one quest
// to another, and locks between mutually exclusive choices.

import { allRewards, playthrough } from './analysis';
import type { Project } from './types';

export type LinkKind = 'quest' | 'flag' | 'item' | 'lock';

export interface Link {
  id: string;
  source: string;
  target: string;
  kind: LinkKind;
  label?: string;
}

export function links(p: Project): Link[] {
  const quests = new Set(p.quests.map((q) => q.id));
  const items = new Map(p.items.map((i) => [i.id, i]));
  const setters = (flag: string) => p.quests.filter((q) => allRewards(q).some((r) => r.kind === 'flag' && r.flag === flag));
  const givers = (itemId: string) => p.quests.filter((q) => allRewards(q).some((r) => r.kind === 'item' && r.itemId === itemId));
  const out: Link[] = [];

  for (const q of p.quests) {
    for (const r of q.requires) {
      if (r.kind === 'quest') {
        if (quests.has(r.questId) && r.questId !== q.id) out.push({ id: `quest:${r.questId}>${q.id}`, source: r.questId, target: q.id, kind: 'quest' });
      } else if (r.kind === 'flag') {
        for (const s of setters(r.flag)) out.push({ id: `flag:${s.id}>${q.id}:${r.flag}`, source: s.id, target: q.id, kind: 'flag', label: r.flag });
      }
    }
    const neededItems = new Set([
      ...q.requires.flatMap((r) => (r.kind === 'item' ? [r.itemId] : [])),
      ...q.objectives.flatMap((o) => (o.kind === 'collect' ? [o.itemId] : [])),
    ]);
    for (const itemId of neededItems) {
      const item = items.get(itemId);
      if (!item || item.inWorld) continue;
      for (const g of givers(itemId))
        if (g.id !== q.id) out.push({ id: `item:${g.id}>${q.id}:${itemId}`, source: g.id, target: q.id, kind: 'item', label: item.name });
    }
    for (const locked of q.locks)
      if (quests.has(locked) && locked !== q.id) out.push({ id: `lock:${q.id}>${locked}`, source: q.id, target: locked, kind: 'lock', label: 'locks' });
  }
  return out;
}

/** Columns by tier (unreachable quests in a final column), rows in list order. */
export function autoLayout(p: Project, columnWidth = 300, rowHeight = 150): Project {
  const { tier } = playthrough(p);
  const last = Math.max(-1, ...tier.values()) + 1;
  const rows = new Map<number, number>();
  return {
    ...p,
    quests: p.quests.map((q) => {
      const column = tier.get(q.id) ?? last;
      const row = rows.get(column) ?? 0;
      rows.set(column, row + 1);
      return { ...q, position: { x: column * columnWidth, y: row * rowHeight } };
    }),
  };
}
