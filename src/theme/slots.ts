export interface RoomColor {
  top: string
  side: string
}

/**
 * The 8 department colour slots. A department picks one by colorSlot, not by id, so real
 * departments get a colour as soon as they are entered. Slots 0-2 are the original sample colours.
 * Checked in docs/ai-handoffs/trace-tool-report.md: neighbouring slots differ in lightness, every
 * top stays clear of the facility, circulation and you-are-here colours.
 */
export const slotColors: RoomColor[] = [
  { top: '#7CC8F8', side: '#5AAEE0' }, // 0 sky
  { top: '#B9A3FF', side: '#9B84E6' }, // 1 violet
  { top: '#5FDCC8', side: '#3FC0AC' }, // 2 teal
  { top: '#C9E58B', side: '#87995D' }, // 3 lime
  { top: '#FF9E86', side: '#CC7E6B' }, // 4 coral
  { top: '#9ADB8F', side: '#6F9E67' }, // 5 green
  { top: '#E69BEE', side: '#BA7EC1' }, // 6 orchid
  { top: '#F6CF68', side: '#AA8F48' }, // 7 amber
]

/** The colour of a department slot, or undefined for a missing or unknown slot. */
export function slotColor(slot: number | undefined): RoomColor | undefined {
  return slot === undefined ? undefined : slotColors[slot]
}
