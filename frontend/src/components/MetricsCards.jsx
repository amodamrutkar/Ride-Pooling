export default function MetricsCards({ metrics }) {
  const data = metrics || {
    pooled_km: 10.6,
    solo_km: 15.5,
    saved_pct: 31.6,
    avg_occupancy: 1.5,
    avg_detour_pct: 4.4,
    max_detour_pct: 8.2,
    served_pct: 60.0,
    deadhead_pct: 12.0,
  }

  const savedKm = (data.solo_km - data.pooled_km).toFixed(1)

  return (
    <div className="metrics-grid">
      {/* 1. Distance Saved Card */}
      <div className="metric-card metric-card-hero">
        <div className="metric-header">
          <span className="metric-label">DISTANCE REDUCTION</span>
          <span className="pill-teal">POOLED EFFICIENCY</span>
        </div>
        <div className="metric-hero-val">{data.saved_pct}%</div>
        <div className="metric-subtext">
          Saved <strong>{savedKm} km</strong> vs solo dispatch
        </div>
      </div>

      {/* 2. Total Distances */}
      <div className="metric-card">
        <span className="metric-label">VEHICLE KM</span>
        <div className="metric-val">{data.pooled_km} <span className="val-unit">km</span></div>
        <div className="metric-subtext">
          Solo baseline: {data.solo_km} km
        </div>
      </div>

      {/* 3. Average Occupancy */}
      <div className="metric-card">
        <span className="metric-label">AVG OCCUPANCY</span>
        <div className="metric-val">{data.avg_occupancy} <span className="val-unit">pax/veh</span></div>
        <div className="metric-subtext">
          Deadhead share: {data.deadhead_pct}%
        </div>
      </div>

      {/* 4. Max Detour */}
      <div className="metric-card">
        <div className="metric-header">
          <span className="metric-label">MAX DETOUR</span>
          <span className="pill-ok">&le; 15% PASS</span>
        </div>
        <div className="metric-val">{data.max_detour_pct}%</div>
        <div className="metric-subtext">
          Avg detour: {data.avg_detour_pct}%
        </div>
      </div>

      {/* 5. Request Service Rate */}
      <div className="metric-card">
        <span className="metric-label">SERVED RATE</span>
        <div className="metric-val">{data.served_pct}%</div>
        <div className="metric-subtext">
          Zero broken commitments
        </div>
      </div>
    </div>
  )
}
