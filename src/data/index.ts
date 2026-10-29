import raw from './building.json'
import type { BuildingData } from './types'

/** The SAMPLE badge shows while any floor is still untraced. */
export const hasSampleData = (d: BuildingData) => d.floors.some((f) => !f.traced)

// JSON infers tuples as number[], so the cast goes through unknown. The data
// check in building.test.ts guards the shape at test time.
const parsed = raw as unknown as BuildingData
export const buildingData: BuildingData = { ...parsed, building: { ...parsed.building, sampleData: hasSampleData(parsed) } }
