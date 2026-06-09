export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString()
}

export function formatDistance(km: number): string {
  if (km < 1) {
    return `${(km * 1000).toFixed(0)}m`
  }
  return `${km.toFixed(2)}km`
}

export function formatVelocity(kmS: number): string {
  return `${kmS.toFixed(3)}km/s`
}

export function getRiskColor(level: string): string {
  switch (level) {
    case 'CRITICAL':
      return 'bg-red-900 text-white'
    case 'HIGH':
      return 'bg-red-600 text-white'
    case 'MEDIUM':
      return 'bg-yellow-600 text-white'
    case 'LOW':
      return 'bg-green-600 text-white'
    default:
      return 'bg-gray-600 text-white'
  }
}
