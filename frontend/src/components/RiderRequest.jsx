import { useState, useMemo } from 'react'
import {
  NASHIK_LOCATIONS,
  calculateDirectDistanceKm,
  estimateDirectMinutes,
  estimateFares,
} from '../data/nashikLocations.js'
import { submitRequest } from '../utils/api.js'

export default function RiderRequest({
  pickup,
  drop,
  onPickupChange,
  onDropChange,
  onSubmit,
}) {
  const [loading, setLoading] = useState(false)

  // Fallbacks if not provided
  const currentPickup = pickup || [NASHIK_LOCATIONS[0].lat, NASHIK_LOCATIONS[0].lon]
  const currentDrop = drop || [NASHIK_LOCATIONS[2].lat, NASHIK_LOCATIONS[2].lon]

  // Find corresponding location object or custom coordinates
  const pickupLocation = useMemo(() => {
    return (
      NASHIK_LOCATIONS.find(
        (l) =>
          Math.abs(l.lat - currentPickup[0]) < 0.005 &&
          Math.abs(l.lon - currentPickup[1]) < 0.005
      ) || { name: 'Selected Pin on Map', lat: currentPickup[0], lon: currentPickup[1] }
    )
  }, [currentPickup[0], currentPickup[1]])

  const dropLocation = useMemo(() => {
    return (
      NASHIK_LOCATIONS.find(
        (l) =>
          Math.abs(l.lat - currentDrop[0]) < 0.005 &&
          Math.abs(l.lon - currentDrop[1]) < 0.005
      ) || { name: 'Selected Pin on Map', lat: currentDrop[0], lon: currentDrop[1] }
    )
  }, [currentDrop[0], currentDrop[1]])

  // Distance & Fare computation
  const distKm = useMemo(() => {
    return calculateDirectDistanceKm(
      currentPickup[0],
      currentPickup[1],
      currentDrop[0],
      currentDrop[1]
    )
  }, [currentPickup[0], currentPickup[1], currentDrop[0], currentDrop[1]])

  const minutes = useMemo(() => estimateDirectMinutes(distKm), [distKm])
  const fares = useMemo(() => estimateFares(distKm), [distKm])

  // Swap pickup & drop
  const handleSwap = () => {
    onPickupChange?.(currentDrop)
    onDropChange?.(currentPickup)
  }

  // Quick route chips
  const handleSelectQuickRoute = (pName, dName) => {
    const pLoc = NASHIK_LOCATIONS.find((l) => l.name.includes(pName))
    const dLoc = NASHIK_LOCATIONS.find((l) => l.name.includes(dName))
    if (pLoc) onPickupChange?.([pLoc.lat, pLoc.lon])
    if (dLoc) onDropChange?.([dLoc.lat, dLoc.lon])
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await submitRequest(currentPickup, currentDrop)
      onSubmit?.(currentPickup, currentDrop, res?.id || 'R2')
    } catch {
      onSubmit?.(currentPickup, currentDrop, 'R2')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rider-card-inner">
      <div className="rider-panel-header">
        <h2 className="rider-heading">Book Pooled Transit</h2>
        <span className="corridor-badge">Nashik Urban Corridor</span>
      </div>

      <form onSubmit={handleSubmit} className="rider-booking-form">
        {/* Origin & Destination Selector Box */}
        <div className="route-select-card">
          {/* Pickup Field */}
          <div className="location-select-row">
            <span className="location-indicator dot-origin" />
            <div className="select-meta-wrap">
              <label className="field-caption">PICKUP POINT</label>
              <select
                className="location-dropdown"
                value={pickupLocation.name}
                onChange={(e) => {
                  const loc = NASHIK_LOCATIONS.find((l) => l.name === e.target.value)
                  if (loc) onPickupChange?.([loc.lat, loc.lon])
                }}
              >
                {pickupLocation.name === 'Selected Pin on Map' && (
                  <option value="Selected Pin on Map">📍 Selected Pin on Map</option>
                )}
                {NASHIK_LOCATIONS.map((loc) => (
                  <option key={loc.id} value={loc.name}>
                    {loc.name} ({loc.category})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Swap Divider Button */}
          <div className="swap-divider-track">
            <button
              type="button"
              className="swap-icon-btn"
              onClick={handleSwap}
              title="Reverse pickup and destination"
            >
              ⇅
            </button>
          </div>

          {/* Destination Field */}
          <div className="location-select-row">
            <span className="location-indicator dot-destination" />
            <div className="select-meta-wrap">
              <label className="field-caption">DESTINATION</label>
              <select
                className="location-dropdown"
                value={dropLocation.name}
                onChange={(e) => {
                  const loc = NASHIK_LOCATIONS.find((l) => l.name === e.target.value)
                  if (loc) onDropChange?.([loc.lat, loc.lon])
                }}
              >
                {dropLocation.name === 'Selected Pin on Map' && (
                  <option value="Selected Pin on Map">🏁 Selected Pin on Map</option>
                )}
                {NASHIK_LOCATIONS.map((loc) => (
                  <option key={loc.id} value={loc.name}>
                    {loc.name} ({loc.category})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Quick Corridor Chips */}
        <div className="corridor-chips-box">
          <span className="chips-title">High-frequency corridors:</span>
          <div className="corridor-pills-wrap">
            <button
              type="button"
              className="corridor-pill-btn"
              onClick={() => handleSelectQuickRoute('CBS', 'College Road')}
            >
              CBS → College Rd
            </button>
            <button
              type="button"
              className="corridor-pill-btn"
              onClick={() => handleSelectQuickRoute('Nashik Road', 'Gangapur Road')}
            >
              Station → Gangapur Rd
            </button>
            <button
              type="button"
              className="corridor-pill-btn"
              onClick={() => handleSelectQuickRoute('City Center', 'Satpur')}
            >
              Mall → Satpur MIDC
            </button>
            <button
              type="button"
              className="corridor-pill-btn"
              onClick={() => handleSelectQuickRoute('Panchavati', 'Dwarka')}
            >
              Panchavati → Dwarka
            </button>
          </div>
        </div>

        {/* Route Metrics & Fare Pricing Card */}
        <div className="fare-quote-card">
          <div className="quote-top-row">
            <div>
              <span className="quote-label">Shapley Value Fare</span>
              <div className="quote-price-wrap">
                <span className="quote-price">₹{fares.pooledMin} – ₹{fares.pooledMax}</span>
              </div>
            </div>

            <div className="solo-comparison-col">
              <span className="solo-label">Solo trip</span>
              <span className="solo-strike">₹{fares.solo}.00</span>
              <span className="savings-badge">Save {fares.savedPct}%</span>
            </div>
          </div>

          <div className="trip-specs-row">
            <span className="spec-item">📏 {distKm} km direct</span>
            <span className="spec-item">⏱ ~{minutes} mins</span>
            <span className="spec-item spec-detour">🛡 Detour cap: &le;15%</span>
          </div>

          <div className="pooling-invariants-box">
            <div className="invariant-line">
              <span className="check-mark">✔</span>
              <span><strong>Detour Guarantee:</strong> Maximum 15% added travel time cap</span>
            </div>
            <div className="invariant-line">
              <span className="check-mark">✔</span>
              <span><strong>Axiomatic Fairness:</strong> You only pay for your marginal detour</span>
            </div>
            <div className="invariant-line">
              <span className="check-mark">✔</span>
              <span><strong>Batching Horizon:</strong> 30s window matches nearby shared vehicles</span>
            </div>
          </div>
        </div>

        {/* Submit Action */}
        <button
          type="submit"
          className="request-ride-action-btn"
          disabled={loading}
        >
          {loading ? 'Submitting to Batcher…' : 'Request Pooled Ride'}
        </button>
      </form>
    </div>
  )
}
