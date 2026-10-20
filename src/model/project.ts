import type { Item, Objective, Project, Quest, Requirement, Reward } from './types';

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function newQuest(title = 'New quest', position = { x: 0, y: 0 }): Quest {
  return {
    id: uid(),
    title,
    kind: 'side',
    giver: '',
    location: '',
    description: '',
    minutes: 10,
    requires: [],
    objectives: [],
    rewards: [],
    locks: [],
    position,
  };
}

export function emptyProject(): Project {
  return { format: 'questline', version: 1, name: 'Untitled', items: [], quests: [newQuest('First quest')] };
}

/**
 * Millbrook, a small village chain: return a lost ring, earn the smith's trust, forge a blade,
 * then pick a side (guild or smugglers) to open the mountain pass. Either side works, so no soft-lock.
 */
export function sampleProject(): Project {
  const item = (id: string, name: string, inWorld: boolean): Item => ({ id, name, inWorld });
  const quest = (
    id: string,
    title: string,
    kind: Quest['kind'],
    at: [number, number],
    fields: Partial<Omit<Quest, 'id' | 'title' | 'kind' | 'position'>>,
  ): Quest => ({
    ...newQuest(title, { x: at[0], y: at[1] }),
    id,
    kind,
    ...fields,
  });
  const needQuest = (questId: string): Requirement => ({ kind: 'quest', questId });
  const needFlag = (flag: string): Requirement => ({ kind: 'flag', flag });
  const talk = (npc: string, conversation = ''): Objective => ({ kind: 'talk', npc, conversation });
  const collect = (itemId: string, count: number): Objective => ({ kind: 'collect', itemId, count });
  const xp = (amount: number): Reward => ({ kind: 'xp', amount });
  const gold = (amount: number): Reward => ({ kind: 'gold', amount });
  const flag = (f: string): Reward => ({ kind: 'flag', flag: f });

  return {
    format: 'questline',
    version: 1,
    name: 'Millbrook',
    items: [
      item('ring', 'Lost ring', true),
      item('ore', 'Iron ore', true),
      item('pelt', 'Wolf pelt', true),
      item('map', 'Old map', false),
      item('blade', 'Steel blade', false),
    ],
    quests: [
      quest('ring', 'The Lost Ring', 'main', [0, 0], {
        giver: 'Mara',
        location: 'Millbrook',
        description: 'Mara dropped her mother’s ring near the old well. Find it and bring it back.',
        minutes: 15,
        objectives: [{ kind: 'reach', location: 'Old well' }, collect('ring', 1), talk('Mara', 'mara_ring_return')],
        rewards: [xp(50), gold(20), flag('met_mara')],
      }),
      quest('favour', 'The Smith’s Favour', 'main', [300, 0], {
        giver: 'Bram',
        location: 'Millbrook forge',
        description: 'Bram will only talk business with people Mara vouches for. Bring him iron ore.',
        minutes: 20,
        requires: [needQuest('ring')],
        objectives: [collect('ore', 3), talk('Bram', 'bram_ore')],
        rewards: [xp(80), flag('smith_trusts_you')],
      }),
      quest('pelts', 'Wolf Pelts', 'side', [300, 160], {
        giver: 'Mara',
        location: 'Eastwood',
        description: 'Winter is coming and Mara’s family needs pelts.',
        minutes: 25,
        requires: [needFlag('met_mara')],
        objectives: [{ kind: 'kill', target: 'Wolf', count: 5 }, collect('pelt', 5)],
        rewards: [gold(60), { kind: 'item', itemId: 'map', count: 1 }],
      }),
      quest('blade', 'Forge the Blade', 'main', [600, 0], {
        giver: 'Bram',
        location: 'Millbrook forge',
        description: 'With enough ore, Bram can forge a blade strong enough for the mountain.',
        minutes: 20,
        requires: [needFlag('smith_trusts_you')],
        objectives: [collect('ore', 5), talk('Bram', 'bram_forge')],
        rewards: [xp(120), { kind: 'item', itemId: 'blade', count: 1 }],
      }),
      quest('hermit', 'The Hermit’s Riddle', 'side', [600, 160], {
        giver: '',
        location: 'Hermit’s hut',
        description: 'The old map marks a hut in the hills. Someone still lives there.',
        minutes: 20,
        requires: [{ kind: 'item', itemId: 'map', count: 1 }],
        objectives: [{ kind: 'reach', location: 'Hermit’s hut' }, talk('Hermit', 'hermit_riddle')],
        rewards: [xp(40), gold(30)],
      }),
      quest('guild', 'Side with the Guild', 'side', [900, -80], {
        giver: 'Guildmaster Iris',
        location: 'Millbrook',
        description: 'The merchants’ guild will pay to have the pass cleared, by the book.',
        minutes: 30,
        requires: [needQuest('blade')],
        objectives: [talk('Iris', 'iris_contract'), { kind: 'kill', target: 'Pass bandit', count: 6 }],
        rewards: [xp(150), gold(120), flag('pass_open')],
        locks: ['smugglers'],
      }),
      quest('smugglers', 'Side with the Smugglers', 'side', [900, 80], {
        giver: 'Wren',
        location: 'Eastwood',
        description: 'Wren knows a hidden way through, if you help move a few crates first.',
        minutes: 25,
        requires: [needQuest('blade')],
        objectives: [talk('Wren', 'wren_deal'), { kind: 'other', text: 'Deliver three crates without being seen' }],
        rewards: [xp(150), gold(200), flag('pass_open')],
        locks: ['guild'],
      }),
      quest('pass', 'The Mountain Pass', 'main', [1200, 0], {
        giver: '',
        location: 'Mountain pass',
        description: 'The way through the mountains is open. Whatever waits on the other side, it starts here.',
        minutes: 30,
        requires: [needQuest('blade'), needFlag('pass_open')],
        objectives: [{ kind: 'reach', location: 'Summit' }],
        rewards: [xp(200)],
      }),
    ],
  };
}

class FileError extends Error {}

function check(ok: boolean, path: string, what: string): asserts ok {
  if (!ok) throw new FileError(`Not a Questline project: ${path} ${what}.`);
}

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null;
const isNum = (x: unknown) => typeof x === 'number';
const isStr = (x: unknown) => typeof x === 'string';

/** Throws a readable error unless `data` has the shape of a project file. Semantic issues are left to `problems`. */
export function assertProject(data: unknown): asserts data is Project {
  check(isObject(data) && data.format === 'questline', 'format', 'is not "questline"');
  const p = data as unknown as Project;
  check(p.version === 1, 'version', `${String(p.version)} is not supported`);
  check(isStr(p.name), 'name', 'is missing');
  check(Array.isArray(p.items), 'items', 'is not a list');
  p.items.forEach((i, n) =>
    check(isObject(i) && isStr(i.id) && isStr(i.name) && typeof i.inWorld === 'boolean', `items[${n}]`, 'needs id, name and inWorld'),
  );
  check(Array.isArray(p.quests), 'quests', 'is not a list');
  p.quests.forEach((q, n) => {
    const at = `quests[${n}]`;
    check(isObject(q) && isStr(q.id) && isStr(q.title), at, 'needs an id and a title');
    check(q.kind === 'main' || q.kind === 'side', `${at}.kind`, 'must be "main" or "side"');
    for (const key of ['giver', 'location', 'description'] as const) check(isStr(q[key]), `${at}.${key}`, 'is not text');
    check(isNum(q.minutes), `${at}.minutes`, 'is not a number');
    check(isObject(q.position) && isNum(q.position.x) && isNum(q.position.y), `${at}.position`, 'needs x and y');
    check(Array.isArray(q.locks) && q.locks.every(isStr), `${at}.locks`, 'is not a list of quest ids');

    check(Array.isArray(q.requires), `${at}.requires`, 'is not a list');
    q.requires.forEach((r, k) => {
      const where = `${at}.requires[${k}]`;
      check(isObject(r), where, 'is malformed');
      if (r.kind === 'quest') check(isStr(r.questId), where, 'needs questId');
      else if (r.kind === 'flag') check(isStr(r.flag), where, 'needs flag');
      else if (r.kind === 'item') check(isStr(r.itemId) && isNum(r.count), where, 'needs itemId and count');
      else check(false, `${where}.kind`, 'is unknown');
    });

    check(Array.isArray(q.objectives), `${at}.objectives`, 'is not a list');
    q.objectives.forEach((o, k) => {
      const where = `${at}.objectives[${k}]`;
      check(isObject(o), where, 'is malformed');
      if (o.kind === 'talk') check(isStr(o.npc) && isStr(o.conversation), where, 'needs npc and conversation');
      else if (o.kind === 'collect') check(isStr(o.itemId) && isNum(o.count), where, 'needs itemId and count');
      else if (o.kind === 'kill') check(isStr(o.target) && isNum(o.count), where, 'needs target and count');
      else if (o.kind === 'reach') check(isStr(o.location), where, 'needs location');
      else if (o.kind === 'other') check(isStr(o.text), where, 'needs text');
      else check(false, `${where}.kind`, 'is unknown');
    });

    check(Array.isArray(q.rewards), `${at}.rewards`, 'is not a list');
    q.rewards.forEach((r, k) => {
      const where = `${at}.rewards[${k}]`;
      check(isObject(r), where, 'is malformed');
      if (r.kind === 'item') check(isStr(r.itemId) && isNum(r.count), where, 'needs itemId and count');
      else if (r.kind === 'flag') check(isStr(r.flag), where, 'needs flag');
      else if (r.kind === 'xp' || r.kind === 'gold') check(isNum(r.amount), where, 'needs amount');
      else check(false, `${where}.kind`, 'is unknown');
    });
  });
}
