import { mockState, mockFareBreakdown, mockArena } from '../data/mockState.js'

const API_BASE = import.meta.env.VITE_API_URL || ''

let useMock = true

async function fetchJSON(path) {
  try {
    const res = await fetch(`${API_BASE}${path}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    useMock = false
    return await res.json()
  } catch {
    useMock = true
    return null
  }
}

export async function getState() {
  const data = await fetchJSON('/api/state')
  return data || mockState
}

export async function getHealth() {
  const data = await fetchJSON('/api/health')
  return data || { status: 'ok', road_data: 'Nashik Urban OSRM' }
}

export async function getFares(groupId) {
  const data = await fetchJSON(`/api/fares/${groupId}`)
  return data || mockFareBreakdown
}

export async function getArena(scenario = 'nashik_metro_core') {
  const data = await fetchJSON(`/api/arena/${scenario}`)
  if (!data) return mockArena
  if (data.strategies && !data.results) {
    data.results = data.strategies.map((s) => ({
      strategy: s.name || s.strategy,
      total_km: s.total_km ?? s.pooled_km ?? 0,
      avg_detour: s.avg_detour ?? s.avg_detour_pct ?? 0,
      served_pct: s.served_pct ?? 100,
      avg_occupancy: s.avg_occupancy ?? 1.8,
      solve_ms: s.solve_ms ?? 1,
    }))
  }
  return data
}

export async function submitRequest(pickup, drop) {
  try {
    const res = await fetch(`${API_BASE}/api/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pickup: { lat: pickup[0], lon: pickup[1] },
        drop: { lat: drop[0], lon: drop[1] },
        seats: 1,
        max_wait_s: 480,
        detour_cap: 0.15,
      }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return {
      id: data.id || data.request?.id || `R${Date.now() % 1000}`,
      status: data.status || data.request?.status || 'PENDING',
      vehicle_id: data.vehicle_id || data.request?.vehicle_id || null,
      ...data,
    }
  } catch {
    // Mock response: simulate an assignment
    return {
      id: `R${Date.now() % 1000}`,
      status: 'PENDING',
      vehicle_id: null,
    }
  }
}

export async function runDispatch(strategy = 'hybrid') {
  try {
    const res = await fetch(`${API_BASE}/api/dispatch/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ strategy }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch {
    return null
  }
}

export async function controlSim(action, speed) {
  try {
    const res = await fetch(`${API_BASE}/api/sim/control`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer pooliq-admin-secret-key',
      },
      body: JSON.stringify({ action, speed }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch {
    return null
  }
}

export async function getDiff(requestId = 'R2') {
  const data = await fetchJSON(`/api/diff/${requestId}`)
  if (data) {
    if (!data.old_route && data.before) data.old_route = data.before
    if (!data.new_route && data.after) data.new_route = data.after
    return data
  }
  // Mock diff: route before and after R2 was pooled into V1
  return {
    request_id: requestId,
    vehicle_id: 'V1',
    old_route: {
      polyline: [
        [19.9977, 73.7803],
        [20.0020, 73.7870],
        [20.0069, 73.7930],
      ],
      total_dist_m: 4800,
      total_time_s: 240,
    },
    new_route: {
      polyline: [
        [19.9977, 73.7803],
        [19.9900, 73.7810],
        [19.9878, 73.7825],
        [19.9920, 73.7860],
        [19.9980, 73.7890],
        [20.0069, 73.7930],
        [20.0060, 73.7850],
        [20.0050, 73.7750],
        [20.0046, 73.7628],
      ],
      total_dist_m: 7200,
      total_time_s: 420,
    },
    detour_pct: 5.1,
    cost_delta: 28.8,
  }
}

export function isUsingMock() {
  return useMock
}
