/** A point on the floor plan, [x, z] in metres. */
export type Point = [x: number, z: number]

export interface Building {
  name: string
  campus: string
  sampleData: boolean
  floorHeight: number
  outline: Point[]
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
  summary?: string
  url?: string
}

export type RoomType =
  | 'classroom'
  | 'lab'
  | 'office'
  | 'meeting'
  | 'lobby'
  | 'cafe'
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

export interface BuildingData {
  building: Building
  floors: Floor[]
  departments: Department[]
  rooms: Room[]
  qrPoints: QrPoint[]
}
