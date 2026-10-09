import { useEffect } from 'react'

export default function RejectionToast({ rejection, onDismiss }) {
  useEffect(() => {
    if (!rejection) return
    const timer = setTimeout(() => {
      onDismiss?.()
    }, 8000)
    return () => clearTimeout(timer)
  }, [rejection, onDismiss])

  if (!rejection) return null

  return (
    <div className="rejection-toast-container">
      <div className="rejection-toast-card">
        <div className="toast-icon-wrap">⚠️</div>
        <div className="toast-content">
          <div className="toast-title-row">
            <span className="toast-reason-code">{rejection.reason || 'DETOUR_EXCEEDED'}</span>
            <span className="toast-tag">EXPLAINABLE DISPATCH</span>
          </div>
          <p className="toast-message">
            {rejection.explain ||
              `Request ${rejection.id || 'R6'} rejected: Would push onboard rider to 19.2% detour exceeding the 15% guarantee. Existing commitments preserved.`}
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="toast-close-btn"
          title="Dismiss notification"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
