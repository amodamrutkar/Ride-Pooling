import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

export default function LeafletMap({
  center = [19.9977, 73.7803],
  zoom = 13,
  pickup = null,
  drop = null,
  routeCoords = [],
  vehicleCoord = null,
  corridors = [],
  selectedCorridorId = null,
  fleetVehicles = [],
  selectedVehicleId = null,
  onVehicleSelect = null,
  diffPolyline = null,
  diffMode = 'after', // 'before' | 'after'
  showRadar = false,
  radarCoords = null,
  searchRadiusMeters = 450,
  onMapClick = null,
  height = "320px",
  className = ""
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const dynamicLayersRef = useRef([]);

  // Initialize Leaflet Map once
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: center,
        zoom: zoom,
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: true,
        touchZoom: true
      });

      // ESRI Dark Gray Canvas: 100% Free, NO API KEY, Zero Watermarks
      // Base layer for dark background, water bodies, and road lines
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 16,
        subdomains: ['server', 'services'],
        attribution: 'Esri, HERE, Garmin, &copy; OpenStreetMap contributors'
      }).addTo(map);

      // Reference layer: Renders crisp street names, highway labels (MH-15, NH-848), and city landmarks in clean dark contrast
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 16,
        subdomains: ['server', 'services']
      }).addTo(map);

      if (onMapClick) {
        map.on('click', (e) => {
          onMapClick(e.latlng);
        });
      }

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;
    
    // Invalidate size on container resize
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);

    const timer2 = setTimeout(() => {
      map.invalidateSize();
    }, 500);

    return () => {
      clearTimeout(timer);
      clearTimeout(timer2);
      resizeObserver.disconnect();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const lastRouteKeyRef = useRef('');
  const lastFitCorridorRef = useRef(null);
  const lastFitVehicleRef = useRef(null);

  // Update map layers on prop changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Clear previous dynamic layers
    dynamicLayersRef.current.forEach((layer) => layer.remove());
    dynamicLayersRef.current = [];

    const addLayer = (layer) => {
      layer.addTo(map);
      dynamicLayersRef.current.push(layer);
      return layer;
    };

    // ─────────────────────────────────────────────────────────────
    // 1. CORRIDORS (Routes Mode) with permanent stop name badges
    // ─────────────────────────────────────────────────────────────
    if (corridors && corridors.length > 0) {
      const bounds = [];
      let selectedCorrBounds = [];

      corridors.forEach((corr) => {
        if (corr.path && corr.path.length > 1) {
          const isSelected = selectedCorridorId && (corr.id === selectedCorridorId || corr.name.includes(selectedCorridorId));
          if (isSelected) {
            selectedCorrBounds = corr.path;
          }

          // Corridor route vector
          addLayer(
            L.polyline(corr.path, {
              color: isSelected ? '#0ED4A8' : (corr.color || '#38bdf8'),
              weight: isSelected ? 6.5 : (selectedCorridorId ? 3 : 4.5),
              opacity: isSelected ? 1.0 : (selectedCorridorId ? 0.35 : 0.9),
              lineCap: 'round',
              lineJoin: 'round'
            })
          );

          // Corridor stop nodes with permanent location name labels
          corr.path.forEach((pt, idx) => {
            bounds.push(pt);
            const stopName = corr.stops && corr.stops[idx] ? corr.stops[idx] : `Stop ${idx + 1}`;
            const badgeColor = isSelected ? '#0ED4A8' : (corr.color || '#38bdf8');
            
            const stopBadgeIcon = L.divIcon({
              className: 'custom-stop-badge',
              html: `
                <div style="display: flex; align-items: center; gap: 6px; pointer-events: none; opacity: ${selectedCorridorId && !isSelected ? '0.4' : '1.0'};">
                  <div style="width: ${isSelected ? '14px' : '11px'}; height: ${isSelected ? '14px' : '11px'}; border-radius: 50%; background: ${badgeColor}; border: 2.5px solid #131318; box-shadow: 0 0 12px ${badgeColor}; shrink: 0;"></div>
                  <div style="background: rgba(19, 19, 24, 0.94); border: 1px solid ${badgeColor}90; color: #e4e1e9; padding: 2px 7px; border-radius: 4px; font-family: Inter, sans-serif; font-size: ${isSelected ? '11px' : '9.5px'}; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; white-space: nowrap; box-shadow: 0 2px 8px rgba(0,0,0,0.6); backdrop-filter: blur(4px);">
                    ${stopName}
                  </div>
                </div>
              `,
              iconSize: [120, 24],
              iconAnchor: [6, 12]
            });
            addLayer(L.marker(pt, { icon: stopBadgeIcon }));
          });
        }
      });

      if (selectedCorrBounds.length > 0) {
        if (lastFitCorridorRef.current !== selectedCorridorId) {
          lastFitCorridorRef.current = selectedCorridorId;
          try {
            map.flyToBounds(selectedCorrBounds, { padding: [50, 50], duration: 1.2 });
          } catch (e) {}
        }
      } else if (bounds.length > 0) {
        try {
          map.fitBounds(bounds, { padding: [35, 35] });
        } catch (e) {}
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 2. FLEET VEHICLES with permanent ID and location tags
    // ─────────────────────────────────────────────────────────────
    if (fleetVehicles && fleetVehicles.length > 0) {
      const bounds = [];
      let targetVehCoord = null;

      fleetVehicles.forEach((v) => {
        if (!v.lat || !v.lon) return;
        bounds.push([v.lat, v.lon]);

        const isSelected = selectedVehicleId && v.id === selectedVehicleId;
        if (isSelected) {
          targetVehCoord = [v.lat, v.lon];
        }

        const isTransit = v.status === 'transit';
        const isTerminal = v.status === 'terminal';
        const markerColor = isSelected ? '#0ED4A8' : (isTransit ? '#0ED4A8' : isTerminal ? '#ffa858' : '#ffb4ab');

        // Concentric pulse for selected vehicle
        if (isSelected) {
          addLayer(
            L.circle([v.lat, v.lon], {
              radius: 400,
              color: '#0ED4A8',
              weight: 2,
              dashArray: '4, 4',
              fillColor: '#0ED4A8',
              fillOpacity: 0.15
            })
          );
        }

        const fleetMarkerIcon = L.divIcon({
          className: 'custom-fleet-marker',
          html: `
            <div style="display: flex; align-items: center; gap: 6px; cursor: pointer; transform: ${isSelected ? 'scale(1.15)' : 'scale(1.0)'}; transition: transform 0.2s;">
              <div style="position: relative; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;">
                <div style="position: absolute; width: 28px; height: 28px; border-radius: 50%; background: ${markerColor}30; border: 1.5px solid ${markerColor}; ${isTransit || isSelected ? 'animation: pulse 1.8s infinite;' : ''}"></div>
                <div style="width: 17px; height: 17px; border-radius: 50%; background: ${markerColor}; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 12px ${markerColor}; font-size: 10px; font-weight: bold; color: #131318;">
                  ${v.id}
                </div>
              </div>
              <div style="background: rgba(19, 19, 24, 0.94); border: 1.5px solid ${isSelected ? '#0ED4A8' : '#35343a'}; color: #e4e1e9; padding: 2px 7px; border-radius: 4px; font-family: Inter, sans-serif; font-size: 10px; font-weight: 700; white-space: nowrap; box-shadow: 0 2px 8px rgba(0,0,0,0.6);">
                <span style="color: ${markerColor}; font-weight: 800;">${v.id}</span> · ${v.speed}
              </div>
            </div>
          `,
          iconSize: [110, 30],
          iconAnchor: [15, 15]
        });

        const m = addLayer(L.marker([v.lat, v.lon], { icon: fleetMarkerIcon }));
        if (onVehicleSelect) {
          m.on('click', () => onVehicleSelect(v));
        }

        m.bindPopup(`
          <div style="background: #1f1f25; color: #e4e1e9; padding: 10px; border-radius: 8px; border: 1px solid #35343a; font-family: Inter, sans-serif; min-width: 190px;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #35343a; padding-bottom: 4px; margin-bottom: 6px;">
              <strong style="color: ${markerColor}; font-size: 13px;">Vehicle ${v.id}</strong>
              <span style="font-size: 10px; text-transform: uppercase; background: #2a292f; padding: 2px 5px; border-radius: 4px;">${v.status}</span>
            </div>
            <div style="font-size: 11px; color: #bacac2; line-height: 1.4;">
              <div><strong>Model:</strong> ${v.model || 'EV'}</div>
              <div><strong>Speed:</strong> ${v.speed || '0 km/h'}</div>
              <div><strong>Seats:</strong> ${v.seatsOccupied || 0}/${v.seatsTotal || 4} occupied</div>
              <div><strong>Battery:</strong> ${v.soc || '80%'}</div>
              <div style="margin-top: 4px; color: #e4e1e9;">${v.routeVector || ''}</div>
            </div>
          </div>
        `);
      });

      if (targetVehCoord) {
        if (lastFitVehicleRef.current !== selectedVehicleId) {
          lastFitVehicleRef.current = selectedVehicleId;
          try {
            map.flyTo(targetVehCoord, 14, { duration: 1.2 });
          } catch (e) {}
        }
      } else if (bounds.length > 0 && !selectedCorridorId) {
        try {
          map.fitBounds(bounds, { padding: [40, 40] });
        } catch (e) {}
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 3. DIFF POLYLINE (BEFORE / AFTER ROUTE DIFF PREVIEW)
    // ─────────────────────────────────────────────────────────────
    if (diffPolyline && diffPolyline.length > 1) {
      const isBefore = diffMode === 'before';
      const poly = addLayer(
        L.polyline(diffPolyline, {
          color: isBefore ? '#9d86e9' : '#0ED4A8',
          weight: 5.5,
          opacity: 0.95,
          dashArray: isBefore ? '6, 8' : undefined,
          lineCap: 'round',
          lineJoin: 'round'
        })
      );
      try {
        map.fitBounds(poly.getBounds(), { padding: [50, 50], maxZoom: 15 });
      } catch (e) {}
    }

    // ─────────────────────────────────────────────────────────────
    // 4. ACTIVE ROUTE / POLYLINE
    // ─────────────────────────────────────────────────────────────
    if (!diffPolyline && routeCoords && routeCoords.length > 1) {
      const poly = addLayer(
        L.polyline(routeCoords, {
          color: '#0ED4A8',
          weight: 5,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round'
        })
      );
      const routeKey = `${pickup?.lat},${pickup?.lon}->${drop?.lat},${drop?.lon}-${routeCoords.length}`;
      if (lastRouteKeyRef.current !== routeKey) {
        lastRouteKeyRef.current = routeKey;
        try {
          map.fitBounds(poly.getBounds(), { padding: [50, 50], maxZoom: 15 });
        } catch (e) {}
      }
    } else if (!diffPolyline && pickup && drop && (!routeCoords || routeCoords.length <= 1)) {
      const line = addLayer(
        L.polyline([[pickup.lat, pickup.lon], [drop.lat, drop.lon]], {
          color: '#0ED4A8',
          weight: 4,
          opacity: 0.85,
          dashArray: '6, 8'
        })
      );
      try {
        map.fitBounds(line.getBounds(), { padding: [50, 50], maxZoom: 15 });
      } catch (e) {}
    } else if (center && !fleetVehicles.length && !corridors.length && !diffPolyline && (!routeCoords || routeCoords.length <= 1)) {
      map.setView(center, zoom);
    }


    // ─────────────────────────────────────────────────────────────
    // 4. PICKUP MARKER with permanent prominent location name
    // ─────────────────────────────────────────────────────────────
    if (pickup) {
      const pickupName = pickup.shortName || pickup.name || 'Pickup';
      const pickupIcon = L.divIcon({
        className: 'custom-pickup-node',
        html: `
          <div style="display: flex; align-items: center; gap: 6px;">
            <div style="position: relative; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center;">
              <div style="position: absolute; width: 24px; height: 24px; border-radius: 50%; border: 2px solid rgba(14, 212, 168, 0.6); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
              <div style="position: relative; width: 12px; height: 12px; border-radius: 50%; background: #0ED4A8; box-shadow: 0 0 12px #49f1c3; border: 2px solid #131318;"></div>
            </div>
            <div style="background: rgba(19, 19, 24, 0.94); border: 1.5px solid #0ED4A8; color: #49f1c3; padding: 3px 8px; border-radius: 6px; font-family: Inter, sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,0.6); backdrop-filter: blur(6px);">
              PICKUP: ${pickupName}
            </div>
          </div>
        `,
        iconSize: [160, 26],
        iconAnchor: [13, 13]
      });
      addLayer(L.marker([pickup.lat, pickup.lon], { icon: pickupIcon }));
    }

    // ─────────────────────────────────────────────────────────────
    // 5. DROP MARKER with permanent prominent location name
    // ─────────────────────────────────────────────────────────────
    if (drop) {
      const dropName = drop.shortName || drop.name || 'Drop';
      const dropIcon = L.divIcon({
        className: 'custom-drop-node',
        html: `
          <div style="display: flex; align-items: center; gap: 6px;">
            <div style="position: relative; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center;">
              <div style="width: 12px; height: 12px; border-radius: 2px; background: #e4e1e9; border: 2px solid #131318; box-shadow: 0 0 10px rgba(228, 225, 233, 0.9);"></div>
            </div>
            <div style="background: rgba(19, 19, 24, 0.94); border: 1.5px solid #e4e1e9; color: #e4e1e9; padding: 3px 8px; border-radius: 6px; font-family: Inter, sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,0.6); backdrop-filter: blur(6px);">
              DROP: ${dropName}
            </div>
          </div>
        `,
        iconSize: [160, 22],
        iconAnchor: [11, 11]
      });
      addLayer(L.marker([drop.lat, drop.lon], { icon: dropIcon }));
    }

    // ─────────────────────────────────────────────────────────────
    // 6. RADAR CONCENTRIC PULSE & RADIUS (Matching Queue)
    // ─────────────────────────────────────────────────────────────
    if (showRadar) {
      const rCoord = radarCoords || (pickup ? [pickup.lat, pickup.lon] : center);

      // Search Radius Circle
      addLayer(
        L.circle(rCoord, {
          radius: searchRadiusMeters,
          color: '#0ED4A8',
          weight: 2,
          dashArray: '5, 6',
          fillColor: '#0ED4A8',
          fillOpacity: 0.12
        })
      );

      // Radar Concentric Pulse Marker
      const radarIcon = L.divIcon({
        className: 'radar-concentric-marker',
        html: `
          <div style="position: relative; width: 140px; height: 140px; display: flex; align-items: center; justify-content: center; pointer-events: none;">
            <div style="position: absolute; width: 130px; height: 130px; border-radius: 50%; background: rgba(73, 241, 195, 0.15); border: 1.5px solid rgba(73, 241, 195, 0.4); animation: ping 2.4s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="position: absolute; width: 75px; height: 75px; border-radius: 50%; background: rgba(73, 241, 195, 0.25); border: 1px solid rgba(73, 241, 195, 0.5);"></div>
            <div style="position: relative; width: 18px; height: 18px; border-radius: 50%; background: #49f1c3; box-shadow: 0 0 18px #49f1c3; display: flex; align-items: center; justify-content: center;">
              <div style="width: 6px; height: 6px; border-radius: 50%; background: #00382a;"></div>
            </div>
          </div>
        `,
        iconSize: [140, 140],
        iconAnchor: [70, 70]
      });
      addLayer(L.marker(rCoord, { icon: radarIcon }));
    }

    // ─────────────────────────────────────────────────────────────
    // 7. REAL-TIME VEHICLE MARKER with live badge
    // ─────────────────────────────────────────────────────────────
    if (vehicleCoord) {
      const vehicleIcon = L.divIcon({
        className: 'custom-vehicle-moving-node',
        html: `
          <div style="display: flex; align-items: center; gap: 6px;">
            <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;">
              <div style="position: absolute; width: 32px; height: 32px; border-radius: 50%; background: rgba(14, 212, 168, 0.3); animation: pulse 1.5s infinite;"></div>
              <div style="width: 22px; height: 22px; border-radius: 50%; background: #49f1c3; border: 2px solid #131318; box-shadow: 0 0 16px #49f1c3; display: flex; align-items: center; justify-content: center;">
                <span class="material-symbols-outlined" style="font-size: 15px; color: #00382a; font-weight: bold;">directions_car</span>
              </div>
            </div>
            <div style="background: rgba(19, 19, 24, 0.94); border: 1.5px solid #0ED4A8; color: #49f1c3; padding: 3px 8px; border-radius: 6px; font-family: Inter, sans-serif; font-size: 11px; font-weight: 700; white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,0.6); backdrop-filter: blur(6px);">
              Vehicle V1 · En Route
            </div>
          </div>
        `,
        iconSize: [160, 34],
        iconAnchor: [17, 17]
      });
      addLayer(L.marker([vehicleCoord.lat, vehicleCoord.lon], { icon: vehicleIcon }));
    }

  }, [center, zoom, pickup, drop, routeCoords, vehicleCoord, corridors, selectedCorridorId, fleetVehicles, selectedVehicleId, diffPolyline, diffMode, showRadar, radarCoords, searchRadiusMeters]);

  return (
    <div className={`relative w-full overflow-hidden ${className}`} style={{ height: height || '100%' }}>
      <div ref={mapContainerRef} className="w-full h-full" />
      {/* Subtle Cartesian Grid Lines */}
      <div className="absolute inset-0 pointer-events-none opacity-15">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="cartesian-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#bacac2" strokeWidth="0.5" strokeDasharray="1 3" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#cartesian-grid)" />
        </svg>
      </div>
      {/* Vignette */}
      <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-surface/30 pointer-events-none" />
    </div>
  );
}
