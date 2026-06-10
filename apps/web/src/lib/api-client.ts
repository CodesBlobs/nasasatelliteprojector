// Requests go to Next.js' own origin, which proxies /api/* → the NestJS backend.
// This avoids cross-origin issues entirely and survives race conditions on startup.
const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api'

export async function apiCall<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`API error: ${response.status} - ${error}`)
  }

  return response.json()
}

export const api = {
  health: () => apiCall('/health'),
  satellites: {
    list: (skip = 0, take = 100) =>
      apiCall(`/satellites?skip=${skip}&take=${take}`),
    get: (id: string) => apiCall(`/satellites/${id}`),
    getByNoradId: (noradId: number) => apiCall(`/satellites/norad/${noradId}`),
    create: (data: unknown) =>
      apiCall('/satellites', { method: 'POST', body: JSON.stringify(data) }),
    stats: () => apiCall('/satellites/stats'),
  },
  tle: {
    getLatest: (noradId: number) => apiCall(`/tle/${noradId}`),
    getHistory: (noradId: number, limit = 10) =>
      apiCall(`/tle/${noradId}/history?limit=${limit}`),
    import: (data: unknown) =>
      apiCall('/tle/import', { method: 'POST', body: JSON.stringify(data) }),
  },
  propagation: {
    getPosition: (noradId: number, time?: Date) => {
      const params = time ? `?time=${encodeURIComponent(time.toISOString())}` : ''
      return apiCall(`/satellites/${noradId}/position${params}`)
    },
    getPositions: (noradIds: number[], time?: Date) => {
      return apiCall(`/satellites/positions`, {
        method: 'POST',
        body: JSON.stringify({ noradIds, time: time?.toISOString() }),
      })
    },
    getOrbit: (noradId: number) => apiCall(`/satellites/${noradId}/orbit`),
  },
  conjunctions: {
    list: () => apiCall('/conjunctions'),
    active: () => apiCall('/conjunctions/active'),
    get: (id: string) => apiCall(`/conjunctions/${id}`),
    scan: (options?: { windowHours?: number; sampleMinutes?: number; thresholdKm?: number }) =>
      apiCall('/conjunctions/scan', { method: 'POST', body: JSON.stringify(options ?? {}) }),
  },
  ingest: {
    celestrak: (group: string) =>
      apiCall(`/ingest/celestrak?group=${encodeURIComponent(group)}`, {
        method: 'POST',
      }),
  },
}
