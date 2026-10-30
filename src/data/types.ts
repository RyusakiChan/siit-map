/** A point on the floor plan, [x, z] in metres. */
export type Point = [x: number, z: number]

export interface Building {
  name: string
  campus: string
  sampleData: boolean
  floorHeight: number
  /** Footprint in metres around `origin`: x east, z south (-z is north). */
  outline: Point[]
  /** OSM way the outline comes from (© OpenStreetMap contributors, ODbL). */
  osmWay?: number
  origin?: { lat: number; lon: number }
}

export interface Floor {
  level: number
  label: string
  labelTh?: string
  elevation: number
  /** True once the group has traced this floor from real sources (set by the trace tool). */
  traced?: boolean
}

export interface Department {
  id: string
  name: string
  nameTh?: string
  /** Letter badge shown on the map and in lists (unique per department). */
  letter: string
  aliases?: string[]
  aliasesTh?: string[]
  summary?: string
  url?: string
  /** Index into the 8 department colour slots (src/theme/colors.ts); two departments may share one. */
  colorSlot: number
}

/** IMDF unit categories (OGC 20-094) where they fit; `other` is our own fallback. */
export type RoomType =
  | 'classroom'
  | 'laboratory'
  | 'office'
  | 'conferenceroom'
  | 'lobby'
  | 'foodservice'
  | 'library'
  | 'restroom'
  | 'stairs'
  | 'elevator'
  | 'other'

export interface Room {
  id: string
  number: string | null
  name: string
  nameTh?: string
  aliases?: string[]
  aliasesTh?: string[]
  popular?: boolean
  floor: number
  departmentId: string | null
  type: RoomType
  polygon: Point[]
  description?: string
  hours?: string
  contact?: string
  photo?: string
  /** Id of this room's door node in `walkways` (a point on the room's edge, facing the corridor). */
  door?: string
}

export interface QrPoint {
  id: string
  floor: number
  position: Point
  facingDeg: number
}

/** IMDF amenity categories (OGC 20-094) used so far. */
export type AmenityType =
  | 'drinkingfountain'
  | 'defibrillator'
  | 'powerchargingstation'
  | 'prayerroom'
  | 'information'

export interface Amenity {
  id: string
  floor: number
  position: Point
  type: AmenityType
}

/** A point on a floor's walkway graph. Corridor nodes sit on the corridor centre line; door nodes sit just outside a room's edge. */
export interface WalkNode {
  id: string
  floor: number
  position: Point
}

/** A walkable link between two nodes on the same floor. */
export interface WalkEdge {
  a: string
  b: string
}

/** A stair or lift shaft: one node per floor it serves, in the same `kind` of room. */
export interface Connector {
  id: string
  kind: 'stairs' | 'elevator'
  /** Walking cost of one floor of travel, in metre-equivalents (see docs: 1 m = 0.77 s). */
  costPerFloor: number
  /** Node id on each floor the shaft serves, keyed by floor level. */
  nodes: Record<string, string>
}

export interface Walkways {
  nodes: WalkNode[]
  edges: WalkEdge[]
  connectors: Connector[]
}

export interface BuildingData {
  building: Building
  floors: Floor[]
  departments: Department[]
  rooms: Room[]
  qrPoints: QrPoint[]
  amenities: Amenity[]
  walkways: Walkways
  /** Room and QR ids that ever existed, including deleted ones, so none is reused (kept by the trace tool). */
  usedIds?: string[]
}
