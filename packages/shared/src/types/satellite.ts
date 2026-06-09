export interface Satellite {
  id: string
  noradId: number
  name: string
  operator: string | null
  country: string | null
  objectType: string
  createdAt: Date
  updatedAt: Date
}

export interface CreateSatelliteDto {
  noradId: number
  name: string
  operator?: string
  country?: string
  objectType: string
}
