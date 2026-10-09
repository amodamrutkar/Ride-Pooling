import { getLocationLabel } from '../data/mockState.js'
import { formatTime, formatKm } from '../utils/hooks.js'

export default function RequestQueue({ requests = [], selectedRequestId, onSelectRequest }) {
  const getStatusColor = (status) => {
    switch (status) {
      case 'PICKED_UP':
        return 'status-picked-up'
      case 'ASSIGNED':
        return 'status-assigned'
      case 'PENDING':
        return 'status-pending'
      case 'DEFERRED':
        return 'status-deferred'
      case 'REJECTED':
        return 'status-rejected'
      default:
        return 'status-pending'
    }
  }

  return (
    <div className="panel-card request-queue-panel">
      <div className="panel-header">
        <div>
          <span className="panel-title">Request Stream</span>
          <span className="panel-subtitle">Live demand queue</span>
        </div>
        <span className="badge-count">{requests.length} total</span>
      </div>

      <div className="requests-scroll-list">
        {requests.map((req) => {
          const isSelected = selectedRequestId === req.id
          const pickupLabel = getLocationLabel(req.pickup.lat, req.pickup.lon)
          const dropLabel = getLocationLabel(req.drop.lat, req.drop.lon)

          return (
            <div
              key={req.id}
              className={`request-item-card ${isSelected ? 'request-selected' : ''}`}
              onClick={() => onSelectRequest?.(req.id)}
            >
              <div className="req-header-row">
                <div className="req-id-wrap">
                  <span className="req-id-badge">{req.id}</span>
                  {req.vehicle_id && (
                    <span className="veh-assigned-tag">🚗 {req.vehicle_id}</span>
                  )}
                </div>
                <span className={`status-pill ${getStatusColor(req.status)}`}>
                  {req.status}
                </span>
              </div>

              <div className="req-locations-row">
                <div className="location-node">
                  <span className="dot dot-pickup" />
                  <span className="loc-text">{pickupLabel}</span>
                </div>
                <div className="location-arrow">↓</div>
                <div className="location-node">
                  <span className="dot dot-drop" />
                  <span className="loc-text">{dropLabel}</span>
                </div>
              </div>

              <div className="req-meta-footer">
                <span>Dist: {formatKm(req.direct_dist_m)} km</span>
                <span>Direct: {formatTime(req.direct_time_s)}</span>
                <span>Cap: &le;15%</span>
              </div>

              {req.status === 'REJECTED' && req.reason && (
                <div className="rejection-note">
                  ⚠️ {req.reason}: {req.explain || 'Constraint violated'}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
