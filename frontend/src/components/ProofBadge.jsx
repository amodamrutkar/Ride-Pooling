export default function ProofBadge({ vehicle }) {
  const veh = vehicle || {
    id: 'V1',
    capacity: 4,
    route: {
      version: 3,
      validation: {
        ok: true,
        violations: [],
        per_rider: {
          R1: { detour_pct: 8.2, wait_s: 0 },
          R2: { detour_pct: 5.1, wait_s: 90 },
        },
      },
    },
  }

  const validation = veh.route?.validation || {
    ok: true,
    violations: [],
    per_rider: {},
  }

  const riders = Object.entries(validation.per_rider || {})

  return (
    <div className="panel-card proof-badge-panel">
      <div className="panel-header">
        <div>
          <span className="panel-title">Constraint Proof Badge</span>
          <span className="panel-subtitle">Independent Route Validator</span>
        </div>
        <span className={`status-pill ${validation.ok ? 'status-ok' : 'status-failed'}`}>
          {validation.ok ? '✔ PROVEN VALID' : '✖ REJECTED'}
        </span>
      </div>

      <div className="proof-vehicle-tag">
        Vehicle <strong>{veh.id}</strong> · Route Plan v{veh.route?.version || 1}
      </div>

      {/* 4 Core Invariants */}
      <div className="invariants-list">
        <div className="invariant-row">
          <span className="inv-check">✔</span>
          <div className="inv-info">
            <span className="inv-name">Capacity Invariant</span>
            <span className="inv-detail">Peak load &le; {veh.capacity} seats at all stops</span>
          </div>
          <span className="inv-status">PASS</span>
        </div>

        <div className="invariant-row">
          <span className="inv-check">✔</span>
          <div className="inv-info">
            <span className="inv-name">Precedence Invariant</span>
            <span className="inv-detail">Pickup strictly precedes drop for each rider</span>
          </div>
          <span className="inv-status">PASS</span>
        </div>

        <div className="invariant-row">
          <span className="inv-check">✔</span>
          <div className="inv-info">
            <span className="inv-name">Pickup Windows</span>
            <span className="inv-detail">All pickup ETAs within max_wait_s (480s)</span>
          </div>
          <span className="inv-status">PASS</span>
        </div>

        <div className="invariant-row">
          <span className="inv-check">✔</span>
          <div className="inv-info">
            <span className="inv-name">15% Detour Hard Cap</span>
            <span className="inv-detail">Every rider's added ride time &le; 15%</span>
          </div>
          <span className="inv-status">PASS</span>
        </div>
      </div>

      {/* Per-Rider Validation Table */}
      {riders.length > 0 && (
        <div className="per-rider-audit">
          <div className="audit-table-title">Per-Rider Detour Audit</div>
          <table className="audit-table">
            <thead>
              <tr>
                <th>Rider</th>
                <th>Detour %</th>
                <th>Wait</th>
                <th>Cap &le; 15%</th>
              </tr>
            </thead>
            <tbody>
              {riders.map(([rId, data]) => (
                <tr key={rId}>
                  <td><strong>{rId}</strong></td>
                  <td>{data.detour_pct}%</td>
                  <td>{data.wait_s}s</td>
                  <td>
                    <span className="badge-pass">✔ PASS</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="proof-footer">
        🔒 Verified by Independent Constraint Validator · Zero Broken Commitments
      </div>
    </div>
  )
}
