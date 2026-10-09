import { useState, useEffect } from 'react'

export default function RiderMatching({ state, onCancel }) {
  const windowState = state?.window || { window_s: 30, elapsed_s: 14, pending: ['R4', 'R5'] }
  const [secondsLeft, setSecondsLeft] = useState(
    Math.max(1, (windowState.window_s || 30) - (windowState.elapsed_s || 14))
  )

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((s) => (s > 1 ? s - 1 : 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const progressPct = Math.min(
    100,
    Math.round(((windowState.window_s - secondsLeft) / windowState.window_s) * 100)
  )

  return (
    <div className="rider-card-inner">
      <div className="rider-panel-header">
        <h2 className="rider-heading">Optimizing Pooled Route</h2>
        <span className="corridor-badge">Adaptive Sliding Window</span>
      </div>

      <div className="matching-radar-section">
        {/* Animated Radar Visual */}
        <div className="radar-circle-cluster">
          <div className="radar-wave wave-3" />
          <div className="radar-wave wave-2" />
          <div className="radar-wave wave-1" />
          <div className="radar-center-hub">
            <span className="hub-symbol">⚡</span>
          </div>
        </div>

        {/* Sliding Batch Window Progress */}
        <div className="batch-window-meter-card">
          <div className="window-meter-header">
            <span className="meter-headline">Batch Window Filling</span>
            <span className="meter-countdown-text">{secondsLeft}s to flush</span>
          </div>

          <div className="window-track-bar">
            <div
              className="window-fill-bar"
              style={{ width: `${Math.max(15, progressPct)}%` }}
            />
          </div>

          <div className="window-meta-tags">
            <span>Pending in batch: {windowState.pending?.length || 2} requests</span>
            <span>Trigger policy: {windowState.next_flush_reason || 'TIMER'}</span>
          </div>
        </div>

        {/* Live Pre-Commitment Solvers & Invariants */}
        <div className="invariants-checklist-box">
          <div className="checklist-heading">Pre-Commitment Invariant Verification</div>
          <div className="checklist-row">
            <span className="bullet-active">✔</span>
            <span>Spatial Candidate Filter: K = 8 nearest candidate vehicles evaluated</span>
          </div>
          <div className="checklist-row">
            <span className="bullet-active">✔</span>
            <span>Hard Detour Invariant: Max &le; 15% added travel time per onboard rider</span>
          </div>
          <div className="checklist-row">
            <span className="bullet-active">✔</span>
            <span>Independent Constraint Validator: Checking capacity &amp; precedence</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="cancel-booking-btn"
        >
          Cancel Request
        </button>
      </div>
    </div>
  )
}
