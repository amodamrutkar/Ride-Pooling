import { useState, useEffect, useRef, useCallback } from 'react'
import { getState, getHealth } from './api.js'

/**
 * Poll /api/state every intervalMs. Pauses when tab is hidden.
 */
export function usePollingState(intervalMs = 1000) {
  const [state, setState] = useState(null)
  const [loading, setLoading] = useState(true)
  const timerRef = useRef(null)
  const visibleRef = useRef(true)

  const poll = useCallback(async () => {
    if (!visibleRef.current) return
    try {
      const data = await getState()
      setState(data)
      setLoading(false)
    } catch {
      // keep last good state
    }
  }, [])

  useEffect(() => {
    poll() // initial fetch

    timerRef.current = setInterval(poll, intervalMs)

    const handleVisibility = () => {
      visibleRef.current = document.visibilityState === 'visible'
      if (visibleRef.current) {
        poll() // fetch immediately on return
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearInterval(timerRef.current)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [poll, intervalMs])

  return { state, loading }
}

/**
 * Fetch health once and cache.
 */
export function useHealth() {
  const [health, setHealth] = useState(null)

  useEffect(() => {
    getHealth().then(setHealth)
  }, [])

  return health
}

/**
 * Format seconds to mm:ss
 */
export function formatTime(seconds) {
  if (seconds == null) return '--:--'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Format meters to km with 1 decimal
 */
export function formatKm(meters) {
  if (meters == null) return '--'
  return (meters / 1000).toFixed(1)
}

/**
 * Format rupee amount
 */
export function formatRupee(amount) {
  if (amount == null) return '₹--'
  return `₹${Math.round(amount)}`
}

/**
 * Get status pill class
 */
export function statusPillClass(status) {
  switch (status) {
    case 'PENDING': return 'pill pill-pending'
    case 'ASSIGNED': return 'pill pill-assigned'
    case 'PICKED_UP': return 'pill pill-picked-up'
    case 'COMPLETED': return 'pill pill-completed'
    case 'REJECTED': return 'pill pill-rejected'
    case 'DEFERRED': return 'pill pill-pending'
    default: return 'pill'
  }
}
