/**
 * PoolIQ API Client — Connects frontend with FastAPI Backend
 * Supports both local Vite proxy and production Vercel/Render deployments.
 */

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const ADMIN_TOKEN = 'pooliq-admin-secret-key';

const getAuthHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${ADMIN_TOKEN}`
});

export async function fetchHealth() {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Backend health check failed:', err);
    return null;
  }
}

export async function fetchState() {
  try {
    const res = await fetch(`${API_BASE}/api/state`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Backend state fetch failed:', err);
    return null;
  }
}

export async function submitRideRequest({ pickup, drop, seats = 1, maxWait = 480, detourCap = 0.15 }) {
  try {
    const payload = {
      pickup: { lat: Number(pickup.lat), lon: Number(pickup.lon) },
      drop: { lat: Number(drop.lat), lon: Number(drop.lon) },
      seats: Number(seats),
      max_wait_s: Number(maxWait),
      detour_cap: Number(detourCap)
    };
    const res = await fetch(`${API_BASE}/api/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Backend request submission failed, using local simulation:', err);
    return {
      id: `R_${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      status: 'simulated'
    };
  }
}

export async function runDispatch(strategy = 'hybrid') {
  try {
    const res = await fetch(`${API_BASE}/api/dispatch/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ strategy })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Dispatch run failed:', err);
    return null;
  }
}

export async function controlSim(action, speed = null) {
  try {
    const res = await fetch(`${API_BASE}/api/sim/control`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ action, speed })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Simulation control failed:', err);
    return null;
  }
}

export async function loadScenario(scenarioId) {
  try {
    const res = await fetch(`${API_BASE}/api/scenarios/${scenarioId}/load`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Scenario load failed:', err);
    return null;
  }
}

export async function fetchFare(groupId) {
  try {
    const res = await fetch(`${API_BASE}/api/fares/${groupId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    return null;
  }
}

export async function fetchDistanceConfig() {
  try {
    const res = await fetch(`${API_BASE}/api/config/distance`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    return null;
  }
}

export async function updateDistanceConfig(config) {
  try {
    const res = await fetch(`${API_BASE}/api/config/distance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    return null;
  }
}

export async function fetchTrafficStatus() {
  try {
    const res = await fetch(`${API_BASE}/api/traffic/status`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    return null;
  }
}

export async function setTrafficScenario(mode, corridorFocus = null) {
  try {
    const res = await fetch(`${API_BASE}/api/traffic/scenario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, corridor_focus: corridorFocus })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    return null;
  }
}

export async function fetchFraudAlerts(limit = 20) {
  try {
    const res = await fetch(`${API_BASE}/api/fraud/alerts?limit=${limit}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    return [];
  }
}

export async function fetchArenaBenchmark(scenarioId = 'demo_5r_3v') {
  try {
    const res = await fetch(`${API_BASE}/api/arena/${scenarioId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    return null;
  }
}

export async function fetchRouteDiff(requestId = 'R2') {
  try {
    const res = await fetch(`${API_BASE}/api/diff/${requestId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`Fetch route diff for ${requestId} failed:`, err);
    return null;
  }
}
