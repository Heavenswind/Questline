// A project is the quests of a game (or one region of it) and the items they ask for or hand out.
// Flags are plain strings: one quest sets a flag as a reward, others require it.
// Everything is plain JSON so a game can load the same file.

export type QuestKind = 'main' | 'side';

export interface Item {
  id: string;
  name: string;
  /** Can be picked up in the world, so having or collecting it never depends on a quest. */
  inWorld: boolean;
}

export type Requirement =
  | { kind: 'quest'; questId: string }
  | { kind: 'flag'; flag: string }
  | { kind: 'item'; itemId: string; count: number };

export type Objective =
  /** `conversation` is an optional Parley conversation id, so the game can start the right dialogue. */
  | { kind: 'talk'; npc: string; conversation: string }
  | { kind: 'collect'; itemId: string; count: number }
  | { kind: 'kill'; target: string; count: number }
  | { kind: 'reach'; location: string }
  | { kind: 'other'; text: string };

export type Reward =
  | { kind: 'item'; itemId: string; count: number }
  | { kind: 'flag'; flag: string }
  | { kind: 'xp'; amount: number }
  | { kind: 'gold'; amount: number };

/** One way a quest can end (spared / killed). The player picks exactly one; its rewards come on top of the quest's. */
export interface QuestOutcome {
  id: string;
  /** Short label the designer would recognise: "Spared the dragon". */
  name: string;
  rewards: Reward[];
}

export interface Quest {
  id: string;
  title: string;
  kind: QuestKind;
  giver: string;
  location: string;
  /** Journal text the player reads. */
  description: string;
  /** Rough minutes a player needs, for time estimates. */
  minutes: number;
  /** All of these must hold before the quest can be started. */
  requires: Requirement[];
  objectives: Objective[];
  rewards: Reward[];
  /** Different endings, each with extra rewards and flags. Missing or empty means one fixed ending. */
  outcomes?: QuestOutcome[];
  /** Quests that can no longer be started once this one is done (mutually exclusive choices). */
  locks: string[];
  /** Where the quest sits in the graph. */
  position: { x: number; y: number };
}

export interface Project {
  format: 'questline';
  version: 1;
  name: string;
  items: Item[];
  quests: Quest[];
}
