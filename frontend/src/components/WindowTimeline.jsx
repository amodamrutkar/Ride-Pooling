import { useState, useEffect } from 'react'
import { runDispatch } from '../utils/api.js'

export default function WindowTimeline({ windowData, onFlushComplete }) {
  const data = windowData || {
    window_s: 30,
    elapsed_s: 12,
    pending: ['R4', 'R5'],
    next_flush_reason: 'TIMER',
  }

  const [elapsed, setElapsed] = useState(data.elapsed_s || 12)
  const [strategy, setStrategy] = useState('hybrid')
  const [isFlushing, setIsFlushing] = useState(false)

  // Auto-increment sim timer for visual feedback
  useEffect(() => {
    setElapsed(data.elapsed_s || 0)
    const interval = setInterval(() => {
      setElapsed((prev) => {
        if (prev >= data.window_s) return 0
        return prev + 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [data.elapsed_s, data.window_s])

  const progressPct = Math.min(
    100,
    Math.round((elapsed / (data.window_s || 30)) * 100)
  )

  const handleManualFlush = async () => {
    setIsFlushing(true)
    try {
      await runDispatch(strategy)
      setElapsed(0)
      onFlushComplete?.()
    } finally {
      setIsFlushing(false)
    }
  }

  const getReasonBadgeClass = (reason) => {
    if (reason === 'URGENCY') return 'reason-urgency'
    if (reason === 'SIZE') return 'reason-size'
    return 'reason-timer'
  }

  return (
    <div className="panel-card window-timeline-panel">
      <div className="panel-header">
        <div>
          <span className="panel-title">Dynamic Sliding Window</span>
          <span className="panel-subtitle">Adaptive batching engine</span>
        </div>
        <span className={`reason-pill ${getReasonBadgeClass(data.next_flush_reason)}`}>
          Trigger: {data.next_flush_reason || 'TIMER'}
        </span>
      </div>

      <div className="timeline-meter-section">
        <div className="meter-labels">
          <span className="meter-time">
            {elapsed}s / {data.window_s}s
          </span>
          <span className="meter-batch-size">
            Pending: <strong>{data.pending?.length || 0}</strong> requests
          </span>
        </div>

        <div className="meter-track">
          <div
            className="meter-bar"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="pending-chips-row">
          {data.pending?.length > 0 ? (
            data.pending.map((reqId) => (
              <span key={reqId} className="pending-chip">
                {reqId}
              </span>
            ))
          ) : (
            <span className="no-pending-text">Queue clear · Awaiting requests</span>
          )}
        </div>
      </div>

      <div className="timeline-actions-row">
        <div className="strategy-picker">
          <label className="picker-label">DISPATCH STRATEGY</label>
          <select
            className="strategy-select"
            value={strategy}
            onChange={(e) => setStrategy(e.target.value)}
          >
            <option value="hybrid">Strategy E: Hybrid (OR-Tools Polish)</option>
            <option value="batch_matching">Strategy D: Batch Matching (Hungarian)</option>
            <option value="loud_insertion">Strategy C: LOUD-inspired Insertion</option>
            <option value="greedy_fcfs">Strategy B: Greedy FCFS</option>
            <option value="solo">Strategy A: Solo (No Pooling)</option>
          </select>
        </div>

        <button
          type="button"
          onClick={handleManualFlush}
          className="flush-btn"
          disabled={isFlushing}
        >
          {isFlushing ? 'Solving…' : 'Flush Window'}
        </button>
      </div>
    </div>
  )
}
