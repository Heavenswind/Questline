import { blockers, playthrough, prerequisiteLoops, softLocks, type Playthrough } from './analysis';
import type { Project } from './types';

export interface Problem {
  level: 'error' | 'warning';
  message: string;
  /** The quest to select when the problem is clicked. */
  questId?: string;
}

const quote = (s: string) => `“${s}”`;
const countOk = (n: number) => Number.isInteger(n) && n >= 1;

/** Everything that would break the quest line or make its numbers wrong. Errors come first. */
export function problems(p: Project, play: Playthrough = playthrough(p)): Problem[] {
  const out: Problem[] = [];
  const quests = new Map(p.quests.map((q) => [q.id, q]));
  const items = new Set(p.items.map((i) => i.id));
  const error = (message: string, questId?: string) => out.push({ level: 'error', message, questId });
  const warning = (message: string, questId?: string) => out.push({ level: 'warning', message, questId });

  for (const q of p.quests) {
    const name = quote(q.title || 'Untitled quest');
    if (q.requires.some((r) => r.kind === 'quest' && !quests.has(r.questId))) error(`${name} needs a quest that no longer exists.`, q.id);
    if (q.requires.some((r) => r.kind === 'quest' && r.questId === q.id)) error(`${name} needs itself.`, q.id);
    const itemIds = [
      ...q.requires.flatMap((r) => (r.kind === 'item' ? [r.itemId] : [])),
      ...q.objectives.flatMap((o) => (o.kind === 'collect' ? [o.itemId] : [])),
      ...q.rewards.flatMap((r) => (r.kind === 'item' ? [r.itemId] : [])),
    ];
    if (itemIds.some((id) => !items.has(id))) error(`${name} uses an item that no longer exists.`, q.id);
    if (q.locks.some((id) => !quests.has(id))) error(`${name} locks a quest that no longer exists.`, q.id);
    if (q.locks.includes(q.id)) error(`${name} locks itself.`, q.id);

    const counts = [
      ...q.requires.flatMap((r) => (r.kind === 'item' ? [r.count] : [])),
      ...q.objectives.flatMap((o) => (o.kind === 'collect' || o.kind === 'kill' ? [o.count] : [])),
      ...q.rewards.flatMap((r) => (r.kind === 'item' ? [r.count] : [])),
    ];
    if (!counts.every(countOk)) error(`${name}: counts must be whole numbers of at least 1.`, q.id);
    if (!(q.minutes >= 0)) error(`${name}: minutes cannot be negative.`, q.id);
    if (q.rewards.some((r) => (r.kind === 'xp' || r.kind === 'gold') && !(r.amount >= 0)))
      error(`${name}: XP and gold rewards cannot be negative.`, q.id);
  }

  for (const loop of prerequisiteLoops(p)) {
    const names = [...loop, loop[0]].map((id) => quote(quests.get(id)!.title));
    error(`Quests need each other in a loop: ${names.join(' → ')}.`, loop[0]);
  }

  const stuck = blockers(p, play);
  for (const q of p.quests) {
    const reasons = stuck.get(q.id);
    if (!reasons) continue;
    const why = reasons.length ? `: it ${reasons.join('; it ')}` : '';
    const message = `${q.kind === 'main' ? 'Main quest' : 'Side quest'} ${quote(q.title)} can never be started${why}.`;
    if (q.kind === 'main') error(message, q.id);
    else warning(message, q.id);
  }

  for (const lock of softLocks(p, play)) {
    const chosen = quests.get(lock.questId)!;
    const lost = lock.lost.map((id) => quote(quests.get(id)!.title)).join(', ');
    warning(`Soft-lock: after ${quote(chosen.title)}, the player can no longer finish ${lost}.`, chosen.id);
  }

  const required = new Set(p.quests.flatMap((q) => q.requires.flatMap((r) => (r.kind === 'flag' ? [r.flag] : []))));
  for (const q of p.quests) {
    for (const r of q.rewards) {
      if (r.kind === 'flag' && !required.has(r.flag))
        warning(`${quote(q.title)} sets flag ${quote(r.flag)}, but no quest needs it. A typo?`, q.id);
    }
    if (q.objectives.length === 0) warning(`${quote(q.title)} has no objectives.`, q.id);
  }

  return [...out.filter((x) => x.level === 'error'), ...out.filter((x) => x.level === 'warning')];
}
