// Mock state matching PRD §6 data contract
// Used when backend is unavailable

export const mockState = {
  vehicles: [
    {
      id: 'V1',
      position: { lat: 19.9977, lon: 73.7803 },
      capacity: 4,
      onboard: ['R1'],
      route: {
        vehicle_id: 'V1',
        version: 3,
        stops: [
          { seq: 0, type: 'PICKUP', request_id: 'R1', point: { lat: 19.9977, lon: 73.7803 }, eta_s: 0, load_after: 1 },
          { seq: 1, type: 'PICKUP', request_id: 'R2', point: { lat: 19.9878, lon: 73.7825 }, eta_s: 90, load_after: 2 },
          { seq: 2, type: 'DROP', request_id: 'R1', point: { lat: 20.0069, lon: 73.7930 }, eta_s: 240, load_after: 1 },
          { seq: 3, type: 'DROP', request_id: 'R2', point: { lat: 20.0046, lon: 73.7628 }, eta_s: 420, load_after: 0 },
        ],
        total_dist_m: 7200,
        total_time_s: 420,
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
        validation: {
          ok: true,
          violations: [],
          per_rider: {
            R1: { detour_pct: 8.2, wait_s: 0 },
            R2: { detour_pct: 5.1, wait_s: 90 },
          },
        },
      },
    },
    {
      id: 'V2',
      position: { lat: 20.0020, lon: 73.7870 },
      capacity: 4,
      onboard: [],
      route: null,
    },
    {
      id: 'V3',
      position: { lat: 19.9742, lon: 73.7819 },
      capacity: 4,
      onboard: ['R3'],
      route: {
        vehicle_id: 'V3',
        version: 1,
        stops: [
          { seq: 0, type: 'PICKUP', request_id: 'R3', point: { lat: 20.0020, lon: 73.7870 }, eta_s: 30, load_after: 1 },
          { seq: 1, type: 'DROP', request_id: 'R3', point: { lat: 19.9742, lon: 73.7819 }, eta_s: 300, load_after: 0 },
        ],
        total_dist_m: 3400,
        total_time_s: 300,
        polyline: [
          [20.0020, 73.7870],
          [19.9950, 73.7860],
          [19.9880, 73.7845],
          [19.9810, 73.7830],
          [19.9742, 73.7819],
        ],
        validation: {
          ok: true,
          violations: [],
          per_rider: {
            R3: { detour_pct: 0.0, wait_s: 30 },
          },
        },
      },
    },
  ],
  requests: [
    { id: 'R1', pickup: { lat: 19.9977, lon: 73.7803 }, drop: { lat: 20.0069, lon: 73.7930 }, request_time: 0, seats: 1, max_wait_s: 480, detour_cap: 0.15, status: 'PICKED_UP', vehicle_id: 'V1', direct_time_s: 180, direct_dist_m: 1650 },
    { id: 'R2', pickup: { lat: 19.9878, lon: 73.7825 }, drop: { lat: 20.0046, lon: 73.7628 }, request_time: 15, seats: 1, max_wait_s: 480, detour_cap: 0.15, status: 'ASSIGNED', vehicle_id: 'V1', direct_time_s: 270, direct_dist_m: 2800 },
    { id: 'R3', pickup: { lat: 20.0020, lon: 73.7870 }, drop: { lat: 19.9742, lon: 73.7819 }, request_time: 30, seats: 1, max_wait_s: 480, detour_cap: 0.15, status: 'ASSIGNED', vehicle_id: 'V3', direct_time_s: 300, direct_dist_m: 3100 },
    { id: 'R4', pickup: { lat: 19.9974, lon: 73.7213 }, drop: { lat: 19.9727, lon: 73.7579 }, request_time: 45, seats: 1, max_wait_s: 480, detour_cap: 0.15, status: 'PENDING', vehicle_id: null },
    { id: 'R5', pickup: { lat: 19.9931, lon: 73.8037 }, drop: { lat: 20.0300, lon: 73.7122 }, request_time: 60, seats: 1, max_wait_s: 480, detour_cap: 0.15, status: 'PENDING', vehicle_id: null },
  ],
  metrics: {
    pooled_km: 10.6,
    solo_km: 15.5,
    saved_pct: 31.6,
    avg_occupancy: 1.5,
    avg_detour_pct: 4.4,
    max_detour_pct: 8.2,
    served_pct: 60.0,
    deadhead_pct: 12.0,
  },
  window: {
    window_s: 30,
    elapsed_s: 12,
    pending: ['R4', 'R5'],
    next_flush_reason: 'TIMER',
  },
}

export const mockFareBreakdown = {
  group_id: 'G1',
  riders: ['R1', 'R2'],
  total_cost: 214.40,
  solo: { R1: 96.0, R2: 118.40 },
  equal: { R1: 107.20, R2: 107.20 },
  proportional: { R1: 92.30, R2: 122.10 },
  shapley: { R1: 88.60, R2: 125.80 },
  shapley_ci: null,
  audit: {
    efficiency: true,
    symmetry: true,
    null_player: true,
    individual_rationality: { ok: true, violations: [] },
  },
}

export const mockArena = {
  scenario: 'nashik_metro_core',
  seed: 42,
  results: [
    { strategy: 'Solo', total_km: 63.8, avg_detour: null, served_pct: 100, avg_occupancy: 1.0, solve_ms: 2 },
    { strategy: 'Greedy', total_km: 52.1, avg_detour: 6.2, served_pct: 80, avg_occupancy: 1.4, solve_ms: 5 },
    { strategy: 'LOUD Insert', total_km: 45.3, avg_detour: 7.6, served_pct: 83, avg_occupancy: 1.8, solve_ms: 12 },
    { strategy: 'Batch Match', total_km: 43.8, avg_detour: 8.1, served_pct: 83, avg_occupancy: 2.0, solve_ms: 89 },
    { strategy: 'Hybrid', total_km: 41.2, avg_detour: 7.6, served_pct: 83, avg_occupancy: 2.1, solve_ms: 412 },
  ],
}

// Nashik location labels
export const locationLabels = {
  '19.9977,73.7803': 'CBS Chowk',
  '19.9878,73.7825': 'Nashik Road',
  '20.0069,73.7930': 'College Road',
  '20.0046,73.7628': 'Gangapur Road',
  '20.0020,73.7870': 'Panchavati',
  '19.9742,73.7819': 'Satpur MIDC',
  '19.9974,73.7213': 'Dwarka',
  '19.9727,73.7579': 'Indira Nagar',
  '19.9931,73.8037': 'Deolali Camp',
  '20.0300,73.7122': 'Gangapur Dam',
}

export function getLocationLabel(lat, lon) {
  const key = `${Number(lat).toFixed(4)},${Number(lon).toFixed(4)}`
  return locationLabels[key] || `${lat.toFixed(4)}, ${lon.toFixed(4)}`
}
