import { describe, expect, it } from 'vitest';
import { blockers, mainPath, playthrough, prerequisiteLoops, softLocks, tierPacing, totals } from './analysis';
import { autoLayout, links } from './graph';
import { newQuest, sampleProject } from './project';
import type { Project, Quest } from './types';
import { problems } from './validate';

const quest = (p: Project, id: string): Quest => p.quests.find((q) => q.id === id)!;
const messages = (p: Project) => problems(p).map((x) => `${x.level}: ${x.message}`);

describe('playthrough', () => {
  it('puts the sample quests in waves', () => {
    expect(Object.fromEntries(playthrough(sampleProject()).tier)).toEqual({
      ring: 0,
      favour: 1,
      pelts: 1,
      blade: 2,
      hermit: 2,
      guild: 3,
      smugglers: 3,
      pass: 4,
    });
  });

  it('does not let quests in the same wave unlock each other', () => {
    const p = sampleProject();
    const a = { ...newQuest('A'), id: 'a', rewards: [{ kind: 'flag' as const, flag: 'x' }] };
    const b = { ...newQuest('B'), id: 'b', requires: [{ kind: 'flag' as const, flag: 'x' }] };
    p.quests = [a, b];
    expect(Object.fromEntries(playthrough(p).tier)).toEqual({ a: 0, b: 1 });
  });

  it('ships a sample with no problems', () => {
    expect(messages(sampleProject())).toEqual([]);
  });
});

describe('why quests are stuck', () => {
  it('explains missing flags, missing items and short counts', () => {
    const p = sampleProject();
    quest(p, 'pelts').requires = [{ kind: 'flag', flag: 'met_marra' }];
    quest(p, 'hermit').requires = [{ kind: 'item', itemId: 'map', count: 3 }];
    quest(p, 'favour').objectives.push({ kind: 'collect', itemId: 'blade', count: 1 });
    const stuck = blockers(p);
    expect(stuck.get('pelts')).toEqual(['needs flag “met_marra”, which no quest sets']);
    // The map only comes from Wolf Pelts, which is now stuck.
    expect(stuck.get('hermit')).toEqual(['needs 3 × “Old map”, but only 0 can be obtained']);
    // Forge the Blade needs the smith's trust, which only the stuck Smith's Favour gives.
    expect(stuck.get('favour')).toEqual(['asks the player to collect 1 × “Steel blade”, but only 0 can be obtained']);
    expect(stuck.get('blade')).toEqual(['needs flag “smith_trusts_you”, which only unreachable quests set']);
    expect(stuck.get('guild')).toEqual(['needs “Forge the Blade”, which can\'t be reached']);
    expect(stuck.has('ring')).toBe(false);
  });

  it('reports items nobody gives', () => {
    const p = sampleProject();
    p.items.push({ id: 'egg', name: 'Dragon egg', inWorld: false });
    quest(p, 'hermit').requires.push({ kind: 'item', itemId: 'egg', count: 1 });
    expect(blockers(p).get('hermit')).toEqual(['needs 1 × “Dragon egg”, which no quest gives and isn\'t found in the world']);
  });

  it('turns stuck main quests into errors and side quests into warnings, with a typo hint', () => {
    const p = sampleProject();
    quest(p, 'favour').rewards = [{ kind: 'flag', flag: 'smith_trust_you' }];
    expect(messages(p)).toEqual([
      'error: Main quest “Forge the Blade” can never be started: it needs flag “smith_trusts_you”, which no quest sets.',
      'error: Main quest “The Mountain Pass” can never be started: it needs “Forge the Blade”, which can\'t be reached; it needs flag “pass_open”, which only unreachable quests set.',
      'warning: Side quest “Side with the Guild” can never be started: it needs “Forge the Blade”, which can\'t be reached.',
      'warning: Side quest “Side with the Smugglers” can never be started: it needs “Forge the Blade”, which can\'t be reached.',
      'warning: “The Smith’s Favour” sets flag “smith_trust_you”, but no quest needs it. A typo?',
    ]);
  });

  it('finds prerequisite loops', () => {
    const p = sampleProject();
    quest(p, 'ring').requires.push({ kind: 'quest', questId: 'favour' });
    expect(prerequisiteLoops(p)).toEqual([['ring', 'favour']]);
    expect(messages(p)[0]).toBe('error: Quests need each other in a loop: “The Lost Ring” → “The Smith’s Favour” → “The Lost Ring”.');
  });
});

describe('soft-locks', () => {
  it('finds none in the sample, where either side opens the pass', () => {
    expect(softLocks(sampleProject())).toEqual([]);
  });

  it('blames the choice that strands the main story', () => {
    const p = sampleProject();
    quest(p, 'smugglers').rewards = [{ kind: 'gold', amount: 200 }];
    expect(softLocks(p)).toEqual([{ questId: 'smugglers', lost: ['pass'] }]);
    expect(messages(p)).toContain(
      'warning: Soft-lock: after “Side with the Smugglers”, the player can no longer finish “The Mountain Pass”.',
    );
  });

  it('ignores locks on quests that must be done first anyway', () => {
    const p = sampleProject();
    quest(p, 'pass').locks = ['blade'];
    expect(softLocks(p)).toEqual([]);
  });
});

describe('main path and totals', () => {
  it('takes the quickest route through a choice', () => {
    const p = sampleProject();
    expect(mainPath(p)).toEqual({ quests: ['ring', 'favour', 'blade', 'smugglers', 'pass'], minutes: 110 });
    quest(p, 'smugglers').minutes = 40;
    expect(mainPath(p).quests).toContain('guild');
    expect(mainPath(p).minutes).toBe(115);
  });

  it('counts quests that only give an item on the path', () => {
    const p = sampleProject();
    quest(p, 'hermit').kind = 'main';
    expect(mainPath(p).quests).toEqual(['ring', 'favour', 'pelts', 'blade', 'hermit', 'smugglers', 'pass']);
  });

  it('adds up minutes, XP and gold', () => {
    const p = sampleProject();
    expect(totals(p, p.quests.map((q) => q.id))).toEqual({ quests: 8, minutes: 185, xp: 790, gold: 430 });
    expect(totals(p, ['ring', 'pass'])).toEqual({ quests: 2, minutes: 45, xp: 250, gold: 20 });
  });

  it('breaks the pacing down by tier', () => {
    const p = sampleProject();
    const pacing = tierPacing(p);
    expect(pacing.length).toBe(5);
    expect(pacing[0]).toEqual(totals(p, ['ring']));
    expect(pacing[3]).toEqual(totals(p, ['guild', 'smugglers']));
    expect(pacing.reduce((sum, t) => sum + t.minutes, 0)).toBe(185);
  });
});

describe('graph', () => {
  it('links prerequisites, flags, items and locks', () => {
    const ids = links(sampleProject()).map((l) => l.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'quest:ring>favour',
        'flag:ring>pelts:met_mara',
        'flag:favour>blade:smith_trusts_you',
        'item:pelts>hermit:map',
        'lock:guild>smugglers',
        'lock:smugglers>guild',
        'flag:guild>pass:pass_open',
        'flag:smugglers>pass:pass_open',
      ]),
    );
    // World items (ore, ring, pelts) never draw links.
    expect(ids.some((id) => id.endsWith(':ore'))).toBe(false);
  });

  it('lays quests out in columns by tier, unreachable ones last', () => {
    const p = sampleProject();
    p.quests.push({ ...newQuest('Stuck'), id: 'stuck', requires: [{ kind: 'flag', flag: 'never' }] });
    const at = Object.fromEntries(autoLayout(p).quests.map((q) => [q.id, [q.position.x, q.position.y]]));
    expect(at.ring).toEqual([0, 0]);
    expect(at.favour).toEqual([300, 0]);
    expect(at.pelts).toEqual([300, 150]);
    expect(at.pass).toEqual([1200, 0]);
    expect(at.stuck).toEqual([1500, 0]);
  });
});
