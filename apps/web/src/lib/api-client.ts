// Requests go to Next.js' own origin, which proxies /api/* → the NestJS backend.
// This avoids cross-origin issues entirely and survives race conditions on startup.
const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api'

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('orbital_token')
}

export async function apiCall<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const token = getToken()
  const response = await fetch(`${API_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
    list: (skip = 0, take = 100) => apiCall(`/conjunctions?skip=${skip}&take=${take}`),
    active: (skip = 0, take = 100) => apiCall(`/conjunctions/active?skip=${skip}&take=${take}`),
    stats: () => apiCall('/conjunctions/stats'),
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
  simulation: {
    create: (data: {
      satelliteId: string
      deltaV: { x: number; y: number; z: number }
      windowHours?: number
      maneuverTime?: string
    }) => apiCall('/simulation/maneuver', { method: 'POST', body: JSON.stringify(data) }),
    get: (id: string) => apiCall(`/simulation/${id}`),
    results: (id: string) => apiCall(`/simulation/${id}/results`),
    bySatellite: (satelliteId: string) => apiCall(`/simulation/satellite/${satelliteId}`),
  },
  ai: {
    chat: (message: string, chatId?: string) =>
      apiCall<{ response: string; chatId?: string }>('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ message, chatId }),
      }),
    briefing: () => apiCall<{ response: string; cached: boolean }>('/ai/briefing'),
    explainConjunction: (id: string) =>
      apiCall<{ response: string }>(`/ai/conjunction/${id}/explain`),
    explainAlert: (id: string) => apiCall<{ response: string }>(`/ai/alert/${id}/explain`),
    analyzeSimulation: (id: string) =>
      apiCall<{ response: string }>(`/ai/simulation/${id}/analyze`),
    conjunctionRecommendations: (id: string) =>
      apiCall<{ response: string }>(`/ai/conjunction/${id}/recommendations`),
  },
  chats: {
    list: () =>
      apiCall<{ id: string; title: string; createdAt: string; updatedAt: string; _count: { messages: number } }[]>('/chats'),
    get: (id: string) =>
      apiCall<{ id: string; title: string; messages: { id: string; role: string; content: string; createdAt: string }[] }>(`/chats/${id}`),
    delete: (id: string) =>
      apiCall(`/chats/${id}`, { method: 'DELETE' }),
  },
}
