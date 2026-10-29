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

export interface BuildingData {
  building: Building
  floors: Floor[]
  departments: Department[]
  rooms: Room[]
  qrPoints: QrPoint[]
  amenities: Amenity[]
}
