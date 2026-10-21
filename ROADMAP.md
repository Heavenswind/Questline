# Roadmap

Work I plan to do, roughly in order. Effort estimates are rough.

## Quest design (≈8 h)

- [ ] Outcomes: a quest can end in different ways (spared / killed), each with its own rewards and flags
- [ ] "Flag not set" requirements, for branches that close when something happens
- [ ] Player level requirements, with an XP curve so levels follow from the XP rewards
- [ ] Repeatable quests and quests that fail after a deadline or event
- [ ] Acts or chapters: group quests, colour them on the graph and total them in the summary

## Analysis (≈6 h)

- [ ] Search every combination of choices, not one choice at a time, to catch soft-locks that need two decisions
- [ ] Missable content report: side quests that a choice makes impossible
- [x] Pacing charts: minutes, XP and gold per tier, to spot dry stretches and spikes
- [ ] Item counts on the main path (does the player get enough ore by the time it's needed?)

## Editor (≈6 h)

- [ ] Multi-select to move, copy and paste groups of quests
- [ ] Search and filter by NPC, location, item or flag
- [ ] Journal preview: the quest log as the player would read it, in tier order
- [ ] Keyboard shortcuts for adding quests and requirements
- [x] Rename a flag everywhere it's used

## Integration (≈8 h)

- [ ] Parley: read a Parley file to list conversation ids and check that talk objectives point at real conversations
- [ ] Forge: import NPCs, locations and items from a Forge GDD
- [ ] Hoard: export quest rewards into a Hoard scenario, so loot and quest gold are balanced together
- [ ] Unity package: C# runtime quest tracker that loads the JSON and follows the same rules as `src/model/analysis.ts`
- [ ] JSON Schema for the file format

## Quality (≈4 h)

- [ ] Component tests for the inspector and the graph
- [ ] File format migrations when the version number changes
- [ ] GitHub Actions: typecheck, test and build on every push
- [ ] Deploy the app to GitHub Pages
- [ ] Light theme and a narrow-screen layout
