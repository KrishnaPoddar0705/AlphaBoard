/**
 * The desk's sector list.
 *
 * There is no sectors table: the list is simply every sector a covered stock is tagged
 * with. Saving a stock under a new sector is what adds that sector to the list, and a
 * sector nobody uses any more drops out on its own.
 */
export function sectorOptions(board: Array<{ sector: string | null }>): string[] {
  const byKey = new Map<string, string>()
  for (const { sector } of board) {
    const name = sector?.trim().replace(/\s+/g, ' ')
    if (name && !byKey.has(name.toLowerCase())) byKey.set(name.toLowerCase(), name)
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b))
}

/**
 * A typed sector, tidied -- and snapped to an existing one when it only differs by case
 * or spacing, so "banks" does not become a second sector next to "Banks".
 */
export function canonicalSector(input: string, existing: string[]): string {
  const name = input.trim().replace(/\s+/g, ' ')
  return existing.find((s) => s.toLowerCase() === name.toLowerCase()) ?? name
}
