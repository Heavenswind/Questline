// Reading items from a Hoard project (https://github.com/Heavenswind/Hoard), my loot and economy simulator,
// so quest rewards and collect objectives use the same item ids as the loot tables.

/** Items from a Hoard file. Gold is skipped: Questline pays gold as its own reward kind. */
export function itemsFromHoard(data: unknown): { id: string; name: string }[] {
  const file = data as { format?: unknown; items?: unknown };
  if (typeof file !== 'object' || file === null || file.format !== 'hoard' || !Array.isArray(file.items))
    throw new Error('Not a Hoard project file.');
  return file.items
    .filter((i): i is { id: string; name: string } => typeof i?.id === 'string' && typeof i?.name === 'string')
    .filter((i) => i.id !== 'gold')
    .map(({ id, name }) => ({ id, name }));
}
