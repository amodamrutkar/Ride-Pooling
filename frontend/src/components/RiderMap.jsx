import { useEffect } from 'react'
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  useMap,
  useMapEvents,
  Popup,
} from 'react-leaflet'
import L from 'leaflet'

function createRiderPin(label, isPickup) {
  const bg = isPickup ? '#0ED4A8' : '#D44D4D'
  const textColor = isPickup ? '#00382a' : '#fff'
  return L.divIcon({
    className: 'rider-map-pin',
    html: `
      <div style="
        background: ${bg};
        color: ${textColor};
        font-family: 'Inter', sans-serif;
        font-size: 11px;
        font-weight: 700;
        padding: 4px 8px;
        border-radius: 12px;
        border: 2px solid #fff;
        box-shadow: 0 4px 14px rgba(0,0,0,0.6);
        display: flex;
        align-items: center;
        gap: 4px;
        white-space: nowrap;
        transform: translate(-50%, -100%);
      ">
        <span>${isPickup ? '● Pickup' : '■ Destination'}</span>
      </div>
    `,
    iconSize: [80, 26],
    iconAnchor: [40, 26],
  })
}

function createCarIcon(id, occupancy, capacity) {
  return L.divIcon({
    className: 'rider-veh-pin',
    html: `
      <div style="
        background: #131318;
        border: 2px solid #0ED4A8;
        color: #e4e1e9;
        font-family: 'JetBrains Mono', monospace;
        font-size: 10px;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 10px;
        box-shadow: 0 4px 10px rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        gap: 3px;
        transform: translate(-50%, -50%);
      ">
        <span>🚗</span>
        <span>${id}</span>
        <span style="color:#0ED4A8; font-size:9px;">(${occupancy}/${capacity})</span>
      </div>
    `,
    iconSize: [64, 22],
    iconAnchor: [32, 11],
  })
}

// Auto-adjust zoom/bounds when pickup and drop change
function BoundsAdjuster({ pickup, drop }) {
  const map = useMap()
  useEffect(() => {
    if (pickup && drop) {
      const bounds = L.latLngBounds([pickup, drop])
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 })
    } else if (pickup) {
      map.setView(pickup, 13)
    }
  }, [pickup, drop, map])
  return null
}

// Allow user to tap map to adjust location
function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick?.([e.latlng.lat, e.latlng.lng])
    },
  })
  return null
}

export default function RiderMap({
  pickup,
  drop,
  vehicles = [],
  assignedVehicle = null,
  routePolyline = null,
  onMapClick,
  height = '100%',
}) {
  const defaultCenter = pickup || [19.9975, 73.7898] // Nashik center

  // Build connecting polyline between pickup & drop if available
  const directLine =
    pickup && drop
      ? [
          pickup,
          [
            (pickup[0] + drop[0]) / 2 + 0.002,
            (pickup[1] + drop[1]) / 2 - 0.002,
          ],
          drop,
        ]
      : null

  const activePolyline = routePolyline || directLine

  return (
    <div className="rider-map-wrapper" style={{ height }}>
      <MapContainer
        center={defaultCenter}
        zoom={13}
        scrollWheelZoom={true}
        style={{ width: '100%', height: '100%', background: '#0A0A0F' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        <BoundsAdjuster pickup={pickup} drop={drop} />
        <MapClickHandler onMapClick={onMapClick} />

        {/* Pickup Pin */}
        {pickup && (
          <Marker position={pickup} icon={createRiderPin('Pickup', true)}>
            <Popup className="dark-popup">
              <div>
                <strong>Pickup Location</strong>
                <div>Coordinates: {pickup[0].toFixed(4)}, {pickup[1].toFixed(4)}</div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Destination Pin */}
        {drop && (
          <Marker position={drop} icon={createRiderPin('Drop', false)}>
            <Popup className="dark-popup">
              <div>
                <strong>Destination</strong>
                <div>Coordinates: {drop[0].toFixed(4)}, {drop[1].toFixed(4)}</div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Route Polyline */}
        {activePolyline && (
          <Polyline
            positions={activePolyline}
            pathOptions={{
              color: '#0ED4A8',
              weight: 4,
              opacity: 0.9,
              dashArray: routePolyline ? undefined : '6, 6',
            }}
          />
        )}

        {/* Vehicles nearby */}
        {vehicles.map((v) => {
          if (!v.position) return null
          const isAssigned = assignedVehicle && assignedVehicle.id === v.id
          return (
            <Marker
              key={v.id}
              position={[v.position.lat, v.position.lon]}
              icon={createCarIcon(
                v.id,
                v.onboard?.length || 0,
                v.capacity || 4
              )}
            >
              <Popup className="dark-popup">
                <div>
                  <strong>Shared Vehicle {v.id} {isAssigned ? '(Assigned)' : ''}</strong>
                  <div>Seats: {v.onboard?.length || 0}/{v.capacity} occupied</div>
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>

      <div className="rider-map-overlay-badge">
        <span className="dot-live" />
        <span>Live Nashik Network · Tap map to adjust pin</span>
      </div>
    </div>
  )
}
