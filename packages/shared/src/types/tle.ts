export interface TLE {
  id: string
  satelliteId: string
  line1: string
  line2: string
  epoch: Date
  createdAt: Date
}

export interface ImportTleDto {
  satelliteId: string
  line1: string
  line2: string
}

export interface ParsedTLE {
  noradId: number
  satelliteName: string
  epochYear: number
  epochDayOfYear: number
  line1: string
  line2: string
}
