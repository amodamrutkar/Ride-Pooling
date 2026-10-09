import { useState, useCallback } from 'react'
import { usePollingState, useHealth } from '../utils/hooks.js'
import { NASHIK_LOCATIONS } from '../data/nashikLocations.js'
import NavBar from '../components/NavBar.jsx'
import RiderMap from '../components/RiderMap.jsx'
import RiderRequest from '../components/RiderRequest.jsx'
import RiderMatching from '../components/RiderMatching.jsx'
import RiderActiveRide from '../components/RiderActiveRide.jsx'

export default function RiderPage() {
  const { state, loading } = usePollingState(1000)
  const health = useHealth()

  // View steps: 'request' | 'matching' | 'active'
  const [view, setView] = useState('request')

  // Selected pickup & drop coordinates (defaults to CBS & College Road)
  const [pickup, setPickup] = useState([NASHIK_LOCATIONS[0].lat, NASHIK_LOCATIONS[0].lon])
  const [drop, setDrop] = useState([NASHIK_LOCATIONS[2].lat, NASHIK_LOCATIONS[2].lon])
  const [activeRequestId, setActiveRequestId] = useState(null)
  const [clickTarget, setClickTarget] = useState('pickup') // 'pickup' | 'drop'

  const roadDataLabel = health?.road_data || 'Nashik Urban OSRM'

  // Find active or assigned request in state
  const activeRequest = state?.requests?.find(
    (r) => r.id === (activeRequestId || 'R2')
  ) || state?.requests?.[1]

  const assignedVehicle = activeRequest?.vehicle_id
    ? state?.vehicles?.find((v) => v.id === activeRequest.vehicle_id)
    : state?.vehicles?.[0]

  // Handle map click: updates either pickup or drop based on clickTarget
  const handleMapClick = useCallback((coords) => {
    if (view !== 'request') return
    if (clickTarget === 'pickup') {
      setPickup(coords)
      setClickTarget('drop')
    } else {
      setDrop(coords)
      setClickTarget('pickup')
    }
  }, [view, clickTarget])

  const handleRequestSubmit = useCallback((p, d, reqId) => {
    setPickup(p)
    setDrop(d)
    setActiveRequestId(reqId || 'R2')
    setView('matching')
    // Simulate realistic batch matching window progression
    const timer = setTimeout(() => {
      setView('active')
    }, 4500)
    return () => clearTimeout(timer)
  }, [])

  const handleCancel = useCallback(() => {
    setView('request')
    setActiveRequestId(null)
  }, [])

  if (loading && !state) {
    return (
      <div className="rider-loading-screen">
        <span className="brand-pulse-dot" />
        <span className="loading-text">Connecting to Nashik Dispatch Engine…</span>
      </div>
    )
  }

  return (
    <div className="rider-viewport-container">
      <NavBar roadData={roadDataLabel} />

      {/* Main Responsive Layout: Split-screen on desktop, Stacked on mobile */}
      <div className="rider-content-layout">
        {/* Interactive Leaflet Map Pane */}
        <div className="rider-map-pane">
          <RiderMap
            pickup={pickup}
            drop={drop}
            vehicles={state?.vehicles || []}
            assignedVehicle={view === 'active' ? assignedVehicle : null}
            routePolyline={view === 'active' ? assignedVehicle?.route?.polyline : null}
            onMapClick={handleMapClick}
            height="100%"
          />
        </div>

        {/* Interactive Trip Controls & Flow Sheet */}
        <div className="rider-sheet-pane">
          <div className="rider-sheet-scroll">
            {view === 'request' && (
              <RiderRequest
                pickup={pickup}
                drop={drop}
                onPickupChange={setPickup}
                onDropChange={setDrop}
                onSubmit={handleRequestSubmit}
              />
            )}

            {view === 'matching' && (
              <RiderMatching
                state={state}
                onCancel={handleCancel}
              />
            )}

            {view === 'active' && (
              <RiderActiveRide
                request={activeRequest}
                vehicle={assignedVehicle}
                onCancel={handleCancel}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
