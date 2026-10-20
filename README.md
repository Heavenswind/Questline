# Questline

A quest and progression planner for games. Lay out quests as a dependency graph (what each one needs, what the player does, what it pays out) and Questline plays the whole thing through to tell you:

- **when** each quest becomes possible (its tier), and **why** the ones that never do are stuck: a flag nothing sets, an item nobody gives, a prerequisite that's itself unreachable;
- whether a **choice soft-locks** the story: "after *Side with the Smugglers*, the player can no longer finish *The Mountain Pass*";
- the **main path**: the main quests plus everything they depend on, with how long it takes and how much XP and gold it pays.

I'm building it to plan the quest lines of my own games. It's one of a set of pre-production tools around [Forge](https://github.com/Heavenswind/Forge), my game design document tool: [Parley](https://github.com/Heavenswind/Parley) writes the conversations, [Blockout](https://github.com/Heavenswind/Blockout) sketches the levels, [Hoard](https://github.com/Heavenswind/Hoard) balances the loot, and Questline ties them together into quests.

## Features

- **Quests** with a title, main/side kind, giver, location, journal text and a rough time in minutes.
  - **Needs:** other quests done, flags set, or items held (with a count).
  - **Objectives:** talk to an NPC (with an optional Parley conversation id for the game), collect items, defeat enemies, reach a location, or anything else.
  - **Rewards:** XP, gold, items, and flags that later quests can need.
  - **Locks:** quests that close once this one is done, for choices like picking a side.
- **Graph:** drag from one quest to another to make it a prerequisite. Flags and items handed from quest to quest show up as labelled links, and locks as their own kind of link. **Auto-layout** arranges quests in columns by tier.
- **Items** can be "found in the world" (always available) or only come from quest rewards. **Import items from Hoard** adds the items of a Hoard loot project, keeping their ids so both tools refer to the same items.
- **Flags panel:** every flag with the quests that set it and the quests that need it; a flag set but never needed is flagged as a likely typo.
- **Problems panel:** unreachable quests with reasons, prerequisite loops, soft-locks, broken references, bad counts. Click one to jump to the quest.
- **Summary:** main story time, everything reachable, and their XP and gold.
- **Editing:** undo/redo for everything, including deletes, New / Sample / Open and moving quests (one drag is one step). Deleting a quest also removes the requirements and locks that pointed at it.
- **Files:** autosaves in the browser; **Save** / **Open** use `.questline.json` files.

## Built with

React 18 and TypeScript, with React Flow for the graph, Zustand for state, and Vite and Vitest for building and testing. The model (playthrough, blockers, soft-lock and main-path analysis, validation, edits) is plain TypeScript with no UI dependencies.

## Running it

Requires Node.js 20 or newer.

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests for the model and analysis
npm run build      # production build in dist/
```

Click **Sample** to load Millbrook: a short village chain that ends with a choice between the guild and the smugglers. Try removing the smugglers' `pass_open` reward to see a soft-lock reported.

## How the analysis works

- **Tiers:** starting from nothing, every quest whose needs are met (and whose collect objectives can be satisfied) completes together as one wave; their rewards may unlock the next wave. A quest's tier is the wave it first becomes possible in. Quests in the same wave don't unlock each other.
- **Items:** "found in the world" items are always available; others count only what quest rewards have handed out so far.
- **Locks** are ignored for tiers, since each side of a choice is reachable on its own. The **soft-lock** check then takes each quest that locks others, supposes the player picks it first, and reports main quests that become impossible because of that choice alone.
- **Main path:** for each main quest, the quests it needs, following flags and items to the quest that gives them; when several quests could, the quickest route wins. Item counts are not considered there.

## Keyboard

| Key | Action |
|---|---|
| Ctrl+Z, Ctrl+Y (or Ctrl+Shift+Z) | Undo, redo (outside text fields) |
| Delete / Backspace on the graph | Remove the selected quest or link |

## File format

A project is JSON with `items` and `quests`; see [`src/model/types.ts`](src/model/types.ts). Quest and item ids are stable, so a game can load the file and track progress against them. Plans for a Unity runtime and imports from Forge and Parley are in [ROADMAP.md](ROADMAP.md).

## License

[MIT](LICENSE)
