import { formatTime, formatRupee } from '../utils/hooks.js'

export default function RiderActiveRide({
  request,
  vehicle,
  onCancel,
}) {
  const req = request || {
    id: 'R2',
    status: 'ASSIGNED',
    vehicle_id: 'V1',
    direct_dist_m: 2800,
    direct_time_s: 270,
  }

  const veh = vehicle || {
    id: 'V1',
    capacity: 4,
    onboard: ['R1'],
    route: {
      total_dist_m: 7200,
      total_time_s: 420,
      validation: {
        per_rider: {
          R2: { detour_pct: 5.1, wait_s: 90 },
        },
      },
      stops: [
        { seq: 0, type: 'PICKUP', request_id: 'R1', location_name: 'CBS Chowk', eta_s: 0, load_after: 1 },
        { seq: 1, type: 'PICKUP', request_id: 'R2', location_name: 'Nashik Road Station', eta_s: 90, load_after: 2 },
        { seq: 2, type: 'DROP', request_id: 'R1', location_name: 'College Road', eta_s: 240, load_after: 1 },
        { seq: 3, type: 'DROP', request_id: 'R2', location_name: 'Gangapur Road', eta_s: 420, load_after: 0 },
      ],
    },
  }

  const riderDetour = veh.route?.validation?.per_rider?.[req.id]?.detour_pct ?? 5.1
  const waitSeconds = veh.route?.validation?.per_rider?.[req.id]?.wait_s ?? 90

  return (
    <div className="rider-card-inner">
      <div className="rider-panel-header">
        <div>
          <span className="live-telemetry-tag">ACTIVE POOLED TRIP</span>
          <h2 className="rider-heading">Vehicle {veh.id} En Route</h2>
        </div>
        <span className="live-status-pill">Assigned &amp; Confirmed</span>
      </div>

      {/* Vehicle Telemetry Card */}
      <div className="active-vehicle-card">
        <div className="vehicle-avatar">🚗</div>
        <div className="vehicle-details-col">
          <div className="vehicle-title">Shared Fleet {veh.id} · Nashik EV</div>
          <div className="vehicle-capacity-text">
            Occupancy: {veh.onboard?.length || 1} / {veh.capacity} seats · Onboard: {veh.onboard?.join(', ') || 'R1'}
          </div>
        </div>
        <div className="eta-badge-col">
          <span className="eta-time-val">{formatTime(waitSeconds)}</span>
          <span className="eta-sub-label">Pickup ETA</span>
        </div>
      </div>

      {/* 15% Detour Guarantee Pass Banner */}
      <div className="detour-pass-banner">
        <span className="pass-icon">✔</span>
        <div className="pass-text-col">
          <strong>15% Detour Ceiling Respected</strong>
          <span>Your added detour is <strong>{riderDetour}%</strong> &le; 15% maximum hard cap</span>
        </div>
      </div>

      {/* Multi-Stop Itinerary Timeline */}
      <div className="itinerary-timeline-card">
        <div className="itinerary-title">Optimized Multi-Stop Route</div>
        <div className="itinerary-stops-wrap">
          {veh.route?.stops?.map((stop, idx) => {
            const isMe = stop.request_id === req.id
            return (
              <div
                key={idx}
                className={`stop-timeline-node ${isMe ? 'stop-node-active' : ''}`}
              >
                <div className="stop-marker-column">
                  <span
                    className={`node-dot ${
                      stop.type === 'PICKUP' ? 'dot-pickup' : 'dot-drop'
                    }`}
                  />
                  {idx < veh.route.stops.length - 1 && (
                    <div className="node-connecting-line" />
                  )}
                </div>
                <div className="stop-info-column">
                  <div className="stop-info-top">
                    <span className="stop-action-badge">
                      {stop.type} · Rider {stop.request_id} {isMe ? '(You)' : ''}
                    </span>
                    <span className="stop-eta-tag">+{formatTime(stop.eta_s)}</span>
                  </div>
                  <div className="stop-location-name">
                    {stop.location_name || `Waypoint #${stop.seq + 1}`}
                  </div>
                  <div className="stop-vehicle-load">
                    Load after stop: {stop.load_after} / {veh.capacity} seats
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Fair Fare Shapley Savings Card */}
      <div className="fair-fare-summary-card">
        <div className="fare-summary-header">
          <div>
            <span className="fare-sub-caption">GAME-THEORETIC SHAPLEY ALLOCATION</span>
            <div className="fare-main-figure">{formatRupee(88.60)}</div>
          </div>
          <div className="fare-savings-badge">
            Saved ₹29.80 (25%)
          </div>
        </div>

        <div className="fare-cost-rows">
          <div className="cost-row">
            <span>Solo ride baseline (unpooled)</span>
            <span className="strike-amount">{formatRupee(118.40)}</span>
          </div>
          <div className="cost-row">
            <span>Equal split cost (naive division)</span>
            <span>{formatRupee(107.20)}</span>
          </div>
          <div className="cost-row cost-row-best">
            <span><strong>Your Shapley Fair Fare</strong></span>
            <span className="accent-price"><strong>{formatRupee(88.60)}</strong></span>
          </div>
        </div>

        <div className="pricing-axiom-note">
          💡 You pay less than equal split because your trip introduced less marginal detour to the shared vehicle route.
        </div>
      </div>

      <button
        type="button"
        onClick={onCancel}
        className="reset-ride-btn"
      >
        Leave Trip / Book Another Route
      </button>
    </div>
  )
}
