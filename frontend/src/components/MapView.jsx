import { useEffect, useState } from 'react'
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  useMapEvents,
} from 'react-leaflet'
import L from 'leaflet'

const VEHICLE_COLORS = {
  V1: '#0ED4A8', // Teal accent
  V2: '#BFA24D', // Gold/yellow
  V3: '#4D8EBF', // Blue
  V4: '#ffa858', // Orange
}

function createVehicleIcon(id, occupancy, capacity, color) {
  return L.divIcon({
    className: 'custom-vehicle-marker',
    html: `
      <div style="
        background: #131318;
        border: 2px solid ${color};
        color: #e4e1e9;
        font-family: 'JetBrains Mono', monospace;
        font-size: 11px;
        font-weight: 700;
        padding: 3px 6px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        gap: 4px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.6);
        white-space: nowrap;
      ">
        <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:${color};"></span>
        <span>${id}</span>
        <span style="color:#85948d; font-size:9px;">${occupancy}/${capacity}</span>
      </div>
    `,
    iconSize: [60, 24],
    iconAnchor: [30, 12],
  })
}

function createStopIcon(type, reqId) {
  const isPickup = type === 'PICKUP'
  const bg = isPickup ? '#0ED4A8' : '#D44D4D'
  const text = isPickup ? `P·${reqId}` : `D·${reqId}`
  return L.divIcon({
    className: 'custom-stop-marker',
    html: `
      <div style="
        background: ${bg};
        color: #000;
        font-family: 'JetBrains Mono', monospace;
        font-size: 10px;
        font-weight: 700;
        padding: 2px 5px;
        border-radius: 6px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.5);
      ">
        ${text}
      </div>
    `,
    iconSize: [36, 18],
    iconAnchor: [18, 9],
  })
}

function createDraftIcon(label, isPickup) {
  const bg = isPickup ? '#0ED4A8' : '#ffa858'
  return L.divIcon({
    className: 'draft-pin-marker',
    html: `
      <div style="
        background: ${bg};
        color: #000;
        font-family: 'Inter', sans-serif;
        font-size: 11px;
        font-weight: 700;
        padding: 4px 8px;
        border-radius: 14px;
        border: 2px solid #fff;
        box-shadow: 0 4px 12px rgba(0,0,0,0.7);
      ">
        ${label}
      </div>
    `,
    iconSize: [40, 24],
    iconAnchor: [20, 24],
  })
}

// Map click handler for interactive add-request flow
function MapClickHandler({ isAddingRequest, onMapClick }) {
  useMapEvents({
    click(e) {
      if (!isAddingRequest) return
      onMapClick([e.latlng.lat, e.latlng.lng])
    },
  })
  return null
}

export default function MapView({
  vehicles = [],
  selectedVehicleId = null,
  onSelectVehicle,
  diffData = null,
  showDiff = false,
  isAddingRequest = false,
  draftPickup = null,
  draftDrop = null,
  onMapClick,
}) {
  const center = [19.9975, 73.7898] // Nashik center

  // Vehicle position animation interpolation state
  const [animatedPositions, setAnimatedPositions] = useState({})

  useEffect(() => {
    // Initialize or animate vehicles along their route polylines
    const initial = {}
    vehicles.forEach((v) => {
      if (v.position) {
        initial[v.id] = [v.position.lat, v.position.lon]
      }
    })
    setAnimatedPositions(initial)
  }, [vehicles])

  return (
    <div className="map-view-container">
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom={true}
        style={{ width: '100%', height: '100%', background: '#0A0A0F' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        <MapClickHandler
          isAddingRequest={isAddingRequest}
          draftPickup={draftPickup}
          draftDrop={draftDrop}
          onMapClick={onMapClick}
        />

        {/* Draft Markers for add-request mode */}
        {draftPickup && (
          <Marker
            position={draftPickup}
            icon={createDraftIcon('PICKUP', true)}
          />
        )}
        {draftDrop && (
          <Marker
            position={draftDrop}
            icon={createDraftIcon('DROP', false)}
          />
        )}

        {/* Before / After Diff Overlay */}
        {showDiff && diffData && (
          <>
            {diffData.old_route?.polyline && (
              <Polyline
                positions={diffData.old_route.polyline}
                pathOptions={{
                  color: '#6B6B76',
                  weight: 4,
                  dashArray: '8, 8',
                  opacity: 0.8,
                }}
              />
            )}
            {diffData.new_route?.polyline && (
              <Polyline
                positions={diffData.new_route.polyline}
                pathOptions={{
                  color: '#0ED4A8',
                  weight: 5,
                  opacity: 0.95,
                }}
              />
            )}
          </>
        )}

        {/* Normal Vehicle Routes */}
        {!showDiff &&
          vehicles.map((v) => {
            if (!v.route?.polyline || v.route.polyline.length === 0) return null
            const isSelected = selectedVehicleId === v.id
            const color = VEHICLE_COLORS[v.id] || '#0ED4A8'
            return (
              <Polyline
                key={`route-${v.id}-${v.route.version || 1}`}
                positions={v.route.polyline}
                pathOptions={{
                  color,
                  weight: isSelected ? 6 : 4,
                  opacity: isSelected ? 1 : 0.75,
                }}
                eventHandlers={{
                  click: () => onSelectVehicle?.(v.id),
                }}
              />
            )
          })}

        {/* Stops Markers */}
        {!showDiff &&
          vehicles.map((v) => {
            if (!v.route?.stops) return null
            return v.route.stops.map((stop, sIdx) => {
              const pos = [stop.point.lat, stop.point.lon]
              return (
                <Marker
                  key={`stop-${v.id}-${sIdx}`}
                  position={pos}
                  icon={createStopIcon(stop.type, stop.request_id, stop.seq)}
                >
                  <Popup className="dark-popup">
                    <div style={{ padding: '4px' }}>
                      <strong>{stop.type} Rider {stop.request_id}</strong>
                      <div>Vehicle: {v.id} (Stop #{stop.seq})</div>
                      <div>ETA: {stop.eta_s}s · Load: {stop.load_after}/{v.capacity}</div>
                    </div>
                  </Popup>
                </Marker>
              )
            })
          })}

        {/* Vehicle Markers */}
        {vehicles.map((v) => {
          const pos = animatedPositions[v.id] || (v.position && [v.position.lat, v.position.lon])
          if (!pos) return null
          const color = VEHICLE_COLORS[v.id] || '#0ED4A8'
          return (
            <Marker
              key={`veh-${v.id}`}
              position={pos}
              icon={createVehicleIcon(
                v.id,
                v.onboard?.length || 0,
                v.capacity || 4,
                color
              )}
              eventHandlers={{
                click: () => onSelectVehicle?.(v.id),
              }}
            >
              <Popup className="dark-popup">
                <div style={{ padding: '6px' }}>
                  <div style={{ fontWeight: 700, color }}>Vehicle {v.id}</div>
                  <div>Capacity: {v.capacity} seats</div>
                  <div>Onboard: {v.onboard?.join(', ') || 'Empty'}</div>
                  {v.route && (
                    <div style={{ marginTop: '4px', fontSize: '11px', color: '#85948d' }}>
                      Dist: {(v.route.total_dist_m / 1000).toFixed(1)} km · Time: {Math.round(v.route.total_time_s / 60)} min
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
    </div>
  )
}
