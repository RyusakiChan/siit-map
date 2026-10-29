import raw from './building.json'
import type { BuildingData } from './types'

// JSON infers tuples as number[], so the cast goes through unknown. The data
// check in building.test.ts guards the shape at test time.
export const buildingData = raw as unknown as BuildingData
