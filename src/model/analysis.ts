// What a player can actually do: which quests become possible and when, why the rest can't,
// which choices strand the main story, and how long the main story takes.

import type { Item, Project, Quest, Requirement } from './types';

interface State {
  done: Set<string>;
  flags: Set<string>;
  /** Items handed out by quests so far (world items are always available). */
  items: Map<string, number>;
}

const emptyState = (): State => ({ done: new Set(), flags: new Set(), items: new Map() });

/** Item ids the player needs a quest to get, and how many: requirements plus collect objectives. */
function itemNeeds(q: Quest): { itemId: string; count: number }[] {
  const out: { itemId: string; count: number }[] = [];
  for (const r of q.requires) if (r.kind === 'item') out.push(r);
  for (const o of q.objectives) if (o.kind === 'collect') out.push(o);
  return out;
}

function hasItem(state: State, items: Map<string, Item>, itemId: string, count: number): boolean {
  const item = items.get(itemId);
  if (!item) return false;
  return item.inWorld || (state.items.get(itemId) ?? 0) >= count;
}

function meets(r: Requirement, state: State, items: Map<string, Item>): boolean {
  if (r.kind === 'quest') return state.done.has(r.questId);
  if (r.kind === 'flag') return state.flags.has(r.flag);
  return hasItem(state, items, r.itemId, r.count);
}

function ready(q: Quest, state: State, items: Map<string, Item>): boolean {
  return (
    q.requires.every((r) => meets(r, state, items)) &&
    q.objectives.every((o) => o.kind !== 'collect' || hasItem(state, items, o.itemId, o.count))
  );
}

function complete(q: Quest, state: State) {
  state.done.add(q.id);
  for (const r of q.rewards) {
    if (r.kind === 'flag') state.flags.add(r.flag);
    else if (r.kind === 'item') state.items.set(r.itemId, (state.items.get(r.itemId) ?? 0) + r.count);
  }
}

export interface Playthrough {
  /** tier.get(id) = the wave in which a quest first becomes possible (0 = from the start). Missing = never. */
  tier: Map<string, number>;
  /** Flags and items available once everything reachable is done. */
  final: State;
}

/**
 * Plays everything possible, wave by wave: all quests that are ready complete together, then repeat.
 * Locks are ignored here (each choice is reachable on its own); `softLocks` looks at them.
 */
export function playthrough(p: Project, exclude: ReadonlySet<string> = new Set()): Playthrough {
  const items = new Map(p.items.map((i) => [i.id, i]));
  const state = emptyState();
  const tier = new Map<string, number>();
  for (let wave = 0; ; wave++) {
    const now = p.quests.filter((q) => !state.done.has(q.id) && !exclude.has(q.id) && ready(q, state, items));
    if (now.length === 0) break;
    // Mark the whole wave before applying rewards, so quests in one wave don't unlock each other.
    for (const q of now) tier.set(q.id, wave);
    for (const q of now) complete(q, state);
  }
  return { tier, final: state };
}

const quote = (s: string) => `“${s}”`;

/** Plain-language reasons each unreachable quest is stuck. */
export function blockers(p: Project, play: Playthrough = playthrough(p)): Map<string, string[]> {
  const items = new Map(p.items.map((i) => [i.id, i]));
  const quests = new Map(p.quests.map((q) => [q.id, q]));
  const { tier, final } = play;
  const setters = (flag: string) => p.quests.filter((q) => q.rewards.some((r) => r.kind === 'flag' && r.flag === flag));
  const givers = (itemId: string) => p.quests.filter((q) => q.rewards.some((r) => r.kind === 'item' && r.itemId === itemId));

  const itemReason = (itemId: string, count: number, prefix: string): string | null => {
    const item = items.get(itemId);
    if (!item) return `${prefix} an item that no longer exists`;
    if (hasItem(final, items, itemId, count)) return null;
    const got = final.items.get(itemId) ?? 0;
    if (givers(itemId).length === 0) return `${prefix} ${count} × ${quote(item.name)}, which no quest gives and isn't found in the world`;
    return `${prefix} ${count} × ${quote(item.name)}, but only ${got} can be obtained`;
  };

  const out = new Map<string, string[]>();
  for (const q of p.quests) {
    if (tier.has(q.id)) continue;
    const reasons: string[] = [];
    for (const r of q.requires) {
      if (r.kind === 'quest') {
        const target = quests.get(r.questId);
        if (!target) reasons.push('needs a quest that no longer exists');
        else if (!tier.has(target.id)) reasons.push(`needs ${quote(target.title)}, which can't be reached`);
      } else if (r.kind === 'flag') {
        if (final.flags.has(r.flag)) continue;
        reasons.push(
          setters(r.flag).length === 0
            ? `needs flag ${quote(r.flag)}, which no quest sets`
            : `needs flag ${quote(r.flag)}, which only unreachable quests set`,
        );
      } else {
        const reason = itemReason(r.itemId, r.count, 'needs');
        if (reason) reasons.push(reason);
      }
    }
    for (const o of q.objectives) {
      if (o.kind !== 'collect') continue;
      const reason = itemReason(o.itemId, o.count, 'asks the player to collect');
      if (reason) reasons.push(reason);
    }
    out.set(q.id, reasons);
  }
  return out;
}

/** Loops in direct quest prerequisites (A needs B, B needs A). */
export function prerequisiteLoops(p: Project): string[][] {
  const needs = new Map(p.quests.map((q) => [q.id, q.requires.flatMap((r) => (r.kind === 'quest' ? [r.questId] : []))]));
  const state = new Map<string, 'open' | 'done'>();
  const stack: string[] = [];
  const loops: string[][] = [];
  const visit = (id: string) => {
    state.set(id, 'open');
    stack.push(id);
    for (const next of needs.get(id) ?? []) {
      if (!needs.has(next)) continue;
      if (state.get(next) === 'open') loops.push(stack.slice(stack.indexOf(next)));
      else if (!state.has(next)) visit(next);
    }
    stack.pop();
    state.set(id, 'done');
  };
  for (const id of needs.keys()) if (!state.has(id)) visit(id);
  return loops;
}

export interface SoftLock {
  /** The quest whose choice causes it. */
  questId: string;
  /** Main quests that become impossible after it. */
  lost: string[];
}

/**
 * For every quest that locks others: suppose the player picks it before doing anything it locks.
 * Which main quests that were reachable can no longer be finished? Other choices stay open, so each
 * report is caused by that one quest alone.
 */
export function softLocks(p: Project, base: Playthrough = playthrough(p)): SoftLock[] {
  const out: SoftLock[] = [];
  for (const q of p.quests) {
    if (q.locks.length === 0 || !base.tier.has(q.id)) continue;
    const run = playthrough(p, new Set(q.locks.filter((id) => id !== q.id)));
    if (!run.tier.has(q.id)) continue; // it needs something it locks, so it can't be chosen first
    const lost = p.quests.filter((m) => m.kind === 'main' && base.tier.has(m.id) && !run.tier.has(m.id)).map((m) => m.id);
    if (lost.length > 0) out.push({ questId: q.id, lost });
  }
  return out;
}

export interface MainPath {
  /** Main quests plus every quest they depend on, in tier order. */
  quests: string[];
  minutes: number;
}

/**
 * The quests a player has to do to finish every reachable main quest. When several quests give the
 * same flag or item, the quickest route is taken. Item counts are ignored here.
 */
export function mainPath(p: Project, play: Playthrough = playthrough(p)): MainPath {
  const quests = new Map(p.quests.map((q) => [q.id, q]));
  const items = new Map(p.items.map((i) => [i.id, i]));
  const reachable = (q: Quest) => play.tier.has(q.id);
  const memo = new Map<string, Set<string>>();
  const visiting = new Set<string>();
  const minutes = (set: Set<string>) => [...set].reduce((sum, id) => sum + Math.max(0, quests.get(id)!.minutes), 0);

  const quickest = (providers: Quest[]): Set<string> => {
    let best: Set<string> | null = null;
    for (const q of providers.filter(reachable)) {
      const set = needed(q.id);
      if (!best || minutes(set) < minutes(best)) best = set;
    }
    return best ?? new Set();
  };

  const needed = (id: string): Set<string> => {
    const cached = memo.get(id);
    if (cached) return cached;
    if (visiting.has(id)) return new Set([id]);
    visiting.add(id);
    const q = quests.get(id)!;
    const set = new Set([id]);
    const add = (other: Set<string>) => other.forEach((x) => set.add(x));
    for (const r of q.requires) {
      if (r.kind === 'quest' && quests.has(r.questId)) add(needed(r.questId));
      else if (r.kind === 'flag')
        add(quickest(p.quests.filter((x) => x.rewards.some((w) => w.kind === 'flag' && w.flag === r.flag))));
    }
    for (const need of itemNeeds(q)) {
      if (items.get(need.itemId)?.inWorld) continue;
      add(quickest(p.quests.filter((x) => x.rewards.some((w) => w.kind === 'item' && w.itemId === need.itemId))));
    }
    visiting.delete(id);
    memo.set(id, set);
    return set;
  };

  const all = new Set<string>();
  for (const q of p.quests) if (q.kind === 'main' && reachable(q)) needed(q.id).forEach((x) => all.add(x));
  const ordered = p.quests.filter((q) => all.has(q.id)).sort((a, b) => play.tier.get(a.id)! - play.tier.get(b.id)!);
  return { quests: ordered.map((q) => q.id), minutes: minutes(all) };
}

export interface Totals {
  quests: number;
  minutes: number;
  xp: number;
  gold: number;
}

/** Minutes, XP and gold per tier (index = tier), to spot dry stretches and spikes in the pacing. */
export function tierPacing(p: Project, play: Playthrough = playthrough(p)): Totals[] {
  const byTier: string[][] = [];
  for (const [id, t] of play.tier) (byTier[t] ??= []).push(id);
  return byTier.map((ids) => totals(p, ids));
}

/** Adds up the given quests: how much content there is and how much XP and gold it pays out. */
export function totals(p: Project, ids: Iterable<string>): Totals {
  const set = new Set(ids);
  const out: Totals = { quests: 0, minutes: 0, xp: 0, gold: 0 };
  for (const q of p.quests) {
    if (!set.has(q.id)) continue;
    out.quests++;
    out.minutes += Math.max(0, q.minutes);
    for (const r of q.rewards) {
      if (r.kind === 'xp') out.xp += r.amount;
      else if (r.kind === 'gold') out.gold += r.amount;
    }
  }
  return out;
}

/** Ids of the quests whose text mentions the query: title, people, places, journal text, flags and item names. */
export function searchQuests(p: Project, query: string): Set<string> {
  const needle = query.trim().toLowerCase();
  const out = new Set<string>();
  if (!needle) return out;
  const itemName = new Map(p.items.map((i) => [i.id, i.name.toLowerCase()]));
  const has = (s: string) => s.toLowerCase().includes(needle);
  const itemHit = (id: string) => (itemName.get(id) ?? '').includes(needle);
  for (const q of p.quests) {
    const hit =
      has(q.title) ||
      has(q.giver) ||
      has(q.location) ||
      has(q.description) ||
      q.requires.some((r) => (r.kind === 'flag' && has(r.flag)) || (r.kind === 'item' && itemHit(r.itemId))) ||
      q.rewards.some((r) => (r.kind === 'flag' && has(r.flag)) || (r.kind === 'item' && itemHit(r.itemId))) ||
      q.objectives.some(
        (o) =>
          (o.kind === 'talk' && has(o.npc)) ||
          (o.kind === 'kill' && has(o.target)) ||
          (o.kind === 'reach' && has(o.location)) ||
          (o.kind === 'collect' && itemHit(o.itemId)) ||
          (o.kind === 'other' && has(o.text)),
      );
    if (hit) out.add(q.id);
  }
  return out;
}
