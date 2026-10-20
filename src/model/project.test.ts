import { describe, expect, it } from 'vitest';
import { assertProject, emptyProject, newQuest, sampleProject } from './project';

const roundTrip = (x: unknown): unknown => JSON.parse(JSON.stringify(x));

describe('project files', () => {
  it('accepts the sample and an empty project after a JSON round trip', () => {
    expect(() => assertProject(roundTrip(sampleProject()))).not.toThrow();
    expect(() => assertProject(roundTrip(emptyProject()))).not.toThrow();
  });

  it('gives every new quest its own id and sensible defaults', () => {
    const a = newQuest();
    const b = newQuest('Other', { x: 5, y: 6 });
    expect(a.id).not.toBe(b.id);
    expect(b).toMatchObject({ title: 'Other', kind: 'side', minutes: 10, position: { x: 5, y: 6 }, requires: [], locks: [] });
  });

  it('rejects files from other tools', () => {
    expect(() => assertProject({ format: 'hoard', version: 1 })).toThrow('format');
    expect(() => assertProject(null)).toThrow('format');
  });

  it('names the field that is wrong', () => {
    const bad = roundTrip(sampleProject()) as ReturnType<typeof sampleProject>;
    (bad.quests[1].requires[0] as { kind: string }).kind = 'level';
    expect(() => assertProject(bad)).toThrow('quests[1].requires[0].kind is unknown');

    const noCount = roundTrip(sampleProject()) as ReturnType<typeof sampleProject>;
    delete (noCount.quests[1].objectives[0] as { count?: number }).count;
    expect(() => assertProject(noCount)).toThrow('quests[1].objectives[0] needs itemId and count');

    const badPos = roundTrip(sampleProject()) as ReturnType<typeof sampleProject>;
    (badPos.quests[0] as { position: unknown }).position = 'top left';
    expect(() => assertProject(badPos)).toThrow('quests[0].position');
  });
});
