import { useState, useEffect } from 'react'
import { usePollingState, useHealth } from '../utils/hooks.js'
import { submitRequest, getDiff, controlSim } from '../utils/api.js'
import NavBar from '../components/NavBar.jsx'
import MapView from '../components/MapView.jsx'
import RequestQueue from '../components/RequestQueue.jsx'
import WindowTimeline from '../components/WindowTimeline.jsx'
import MetricsCards from '../components/MetricsCards.jsx'
import ProofBadge from '../components/ProofBadge.jsx'
import FarePanel from '../components/FarePanel.jsx'
import ArenaTable from '../components/ArenaTable.jsx'
import RejectionToast from '../components/RejectionToast.jsx'

export default function DashboardPage() {
  const { state } = usePollingState(1000)
  const health = useHealth()

  const [selectedVehicleId, setSelectedVehicleId] = useState('V1')
  const [selectedRequestId, setSelectedRequestId] = useState('R2')

  // Simulation speed: 1x, 10x, 60x
  const [simSpeed, setSimSpeed] = useState(1)

  // Before / After route diff state
  const [showDiff, setShowDiff] = useState(false)
  const [diffData, setDiffData] = useState(null)

  // Interactive Add-Request Flow (Deliverable 7)
  const [isAddingRequest, setIsAddingRequest] = useState(false)
  const [draftPickup, setDraftPickup] = useState(null)
  const [draftDrop, setDraftDrop] = useState(null)
  const [addStep, setAddStep] = useState('idle') // 'idle' | 'pickup' | 'drop' | 'ready'

  // Rejection Toast State (Deliverable 11)
  const [rejection, setRejection] = useState(null)

  // Collapsible Arena table
  const [arenaOpen, setArenaOpen] = useState(true)

  const roadDataLabel = health?.road_data || 'Nashik Urban OSRM'

  // Load diff data when toggle is enabled
  useEffect(() => {
    if (showDiff && !diffData) {
      getDiff(selectedRequestId || 'R2').then(setDiffData)
    }
  }, [showDiff, diffData, selectedRequestId])

  // Speed change handler
  const handleSpeedChange = (speed) => {
    setSimSpeed(speed)
    controlSim('speed', speed)
  }

  // Toggle Add-Request mode
  const handleStartAddRequest = () => {
    if (isAddingRequest) {
      setIsAddingRequest(false)
      setDraftPickup(null)
      setDraftDrop(null)
      setAddStep('idle')
    } else {
      setIsAddingRequest(true)
      setDraftPickup(null)
      setDraftDrop(null)
      setAddStep('pickup')
    }
  }

  // Map Click Handler for draft points
  const handleMapClick = (coords) => {
    if (!isAddingRequest) return

    if (addStep === 'pickup') {
      setDraftPickup(coords)
      setAddStep('drop')
    } else if (addStep === 'drop') {
      setDraftDrop(coords)
      setAddStep('ready')
    }
  }

  // Submit draft request to backend
  const handleConfirmAddRequest = async () => {
    if (!draftPickup || !draftDrop) return
    try {
      const res = await submitRequest(draftPickup, draftDrop)
      setIsAddingRequest(false)
      setDraftPickup(null)
      setDraftDrop(null)
      setAddStep('idle')
      if (res?.id) {
        setSelectedRequestId(res.id)
      }
    } catch {
      setIsAddingRequest(false)
      setDraftPickup(null)
      setDraftDrop(null)
      setAddStep('idle')
    }
  }

  // Trigger stress rejection test (Deliverable 11)
  const handleTriggerRejection = () => {
    setRejection({
      id: 'R6',
      reason: 'DETOUR_EXCEEDED',
      explain:
        'Adding R6 would push onboard rider R2 to 19.2% detour (hard cap 15%). Request deferred to protect existing commitments.',
    })
  }

  const selectedVehicle =
    state?.vehicles?.find((v) => v.id === selectedVehicleId) || state?.vehicles?.[0]

  return (
    <div className="dashboard-container">
      <NavBar roadData={roadDataLabel} />

      {/* Control bar */}
      <div className="dashboard-controls-bar">
        <div className="controls-left">
          <span className="control-label">SIMULATION SPEED:</span>
          <div className="speed-buttons-group">
            {[1, 10, 60].map((spd) => (
              <button
                key={spd}
                type="button"
                className={`speed-btn ${simSpeed === spd ? 'speed-btn-active' : ''}`}
                onClick={() => handleSpeedChange(spd)}
              >
                {spd}×
              </button>
            ))}
          </div>

          <div className="divider-vert" />

          {/* Before / After toggle */}
          <button
            type="button"
            className={`diff-toggle-btn ${showDiff ? 'diff-btn-active' : ''}`}
            onClick={() => setShowDiff((prev) => !prev)}
            title="Toggle route before/after pooling"
          >
            {showDiff ? '◉ Diff Active' : '○ Before / After Route Diff'}
          </button>
        </div>

        <div className="controls-right">
          {/* Add Request Button */}
          <button
            type="button"
            className={`action-btn ${isAddingRequest ? 'action-btn-active' : ''}`}
            onClick={handleStartAddRequest}
          >
            {isAddingRequest ? '✕ Cancel Pinning' : '+ Pin New Request'}
          </button>

          {/* Test 15% Detour Rejection Button */}
          <button
            type="button"
            className="stress-btn"
            onClick={handleTriggerRejection}
            title="Verify explainable commitment protection"
          >
            Test 15% Detour Rejection
          </button>

          <button
            type="button"
            className="arena-toggle-btn"
            onClick={() => setArenaOpen((prev) => !prev)}
          >
            {arenaOpen ? 'Hide Arena' : 'Show Arena'}
          </button>
        </div>
      </div>

      {/* Adding request guidance banner */}
      {isAddingRequest && (
        <div className="map-guidance-banner">
          {addStep === 'pickup' && (
            <span>📍 Step 1: Click anywhere on the map to set <strong>PICKUP</strong> location</span>
          )}
          {addStep === 'drop' && (
            <span>🏁 Step 2: Click on the map to set <strong>DESTINATION</strong> location</span>
          )}
          {addStep === 'ready' && (
            <div className="banner-confirm-row">
              <span>✔ Points set. Confirm request submission to batching window:</span>
              <button
                type="button"
                onClick={handleConfirmAddRequest}
                className="banner-submit-btn"
              >
                Dispatch Request
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Grid Layout */}
      <div className="dashboard-grid">
        {/* Left Column: Window Timeline & Request Queue */}
        <div className="dashboard-col col-left">
          <WindowTimeline windowData={state?.window} />
          <RequestQueue
            requests={state?.requests}
            selectedRequestId={selectedRequestId}
            onSelectRequest={setSelectedRequestId}
          />
        </div>

        {/* Center: Leaflet Map */}
        <div className="dashboard-col col-center">
          <MapView
            vehicles={state?.vehicles}
            selectedVehicleId={selectedVehicleId}
            onSelectVehicle={setSelectedVehicleId}
            diffData={diffData}
            showDiff={showDiff}
            isAddingRequest={isAddingRequest}
            draftPickup={draftPickup}
            draftDrop={draftDrop}
            onMapClick={handleMapClick}
            simSpeed={simSpeed}
          />
        </div>

        {/* Right Column: Metrics, Proof, and Fares */}
        <div className="dashboard-col col-right">
          <MetricsCards metrics={state?.metrics} />
          <ProofBadge vehicle={selectedVehicle} />
          <FarePanel groupId="G1" />
        </div>
      </div>

      {/* Bottom Collapsible: Algorithm Arena */}
      {arenaOpen && (
        <div className="dashboard-bottom-arena">
          <ArenaTable />
        </div>
      )}

      {/* Rejection Notification Toast */}
      <RejectionToast
        rejection={rejection}
        onDismiss={() => setRejection(null)}
      />
    </div>
  )
}
