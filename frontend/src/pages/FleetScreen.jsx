import React, { useState, useEffect } from 'react';
import LeafletMap from '../components/LeafletMap';
import { FLEET_VEHICLES } from '../data/nashikLocations';

export default function FleetScreen({ backendVehicles = null }) {
  const [filter, setFilter] = useState('all');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshCountdown, setRefreshCountdown] = useState(5);
  const [vehicles, setVehicles] = useState(FLEET_VEHICLES);
  const [selectedVehicleId, setSelectedVehicleId] = useState('V1');
  const [avgSpeed, setAvgSpeed] = useState(31);
  const [utilization, setUtilization] = useState(88);
  const [activeBatches, setActiveBatches] = useState(9);

  // Sync with real backend vehicles if available
  useEffect(() => {
    if (backendVehicles && backendVehicles.length > 0) {
      const merged = FLEET_VEHICLES.map((fallback, idx) => {
        const bv = backendVehicles[idx];
        if (!bv) return fallback;
        const hasRoute = bv.route && bv.route.length > 0;
        const isOnboard = bv.onboard && bv.onboard.length > 0;
        const isTransit = hasRoute || isOnboard || fallback.status === 'transit';
        return {
          ...fallback,
          id: bv.id || fallback.id,
          status: fallback.status === 'maintenance' ? 'maintenance' : (isTransit ? 'transit' : 'terminal'),
          statusLabel: fallback.status === 'maintenance' ? 'MAINTENANCE' : (isTransit ? 'IN TRANSIT' : 'AT TERMINAL'),
          routeVector: hasRoute ? 'Active Optimized Dispatch' : fallback.routeVector,
          speed: fallback.status === 'maintenance' ? '0 km/h' : (isTransit ? (fallback.speed === '0 km/h' ? '36 km/h' : fallback.speed) : '0 km/h'),
          soc: fallback.soc,
          driver: fallback.driver,
          seatsTotal: bv.capacity || fallback.seatsTotal,
          seatsOccupied: bv.onboard ? bv.onboard.length : fallback.seatsOccupied,
          lat: bv.position ? bv.position.lat : fallback.lat,
          lon: bv.position ? bv.position.lon : fallback.lon
        };
      });
      setVehicles(merged);
    }
  }, [backendVehicles]);

  // Real-time telemetry progression and coordinate motion every 2 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      setRefreshCountdown((prev) => (prev <= 1 ? 2 : prev - 1));

      // Coordinate micro-motion & speed fluctuation for transit vehicles
      setVehicles((curr) =>
        curr.map((v) => {
          if (v.status === 'transit') {
            const latJitter = (Math.random() - 0.5) * 0.0008;
            const lonJitter = (Math.random() - 0.5) * 0.0008;
            const spd = Math.floor(32 + Math.random() * 16);
            return {
              ...v,
              lat: v.lat + latJitter,
              lon: v.lon + lonJitter,
              speed: `${spd} km/h`
            };
          }
          if (v.status === 'maintenance') {
            const currentSocNum = parseInt(v.soc) || 32;
            const newSoc = currentSocNum < 98 ? currentSocNum + 1 : 32;
            return {
              ...v,
              soc: `${newSoc}%`
            };
          }
          return v;
        })
      );
      setAvgSpeed(Math.floor(30 + Math.random() * 6));
      setUtilization(Math.floor(84 + Math.random() * 6));
      setActiveBatches(Math.floor(8 + Math.random() * 3));
    }, 2000);
    return () => clearInterval(timer);
  }, [autoRefresh]);

  const filteredVehicles = vehicles.filter((v) => {
    if (filter === 'all') return true;
    return v.status === filter;
  });

  return (
    <div className="flex flex-col w-full px-4 gap-4 text-on-surface select-none pb-8">
      {/* Status & Header Meta */}
      <div className="flex flex-col gap-1 pt-1">
        <div className="flex items-center justify-between">
          <span className="font-label-mono text-label-mono text-on-surface uppercase tracking-wider font-semibold">
            FLEET TELEMETRY
          </span>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-high border border-surface-container-highest/60">
            <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse"></span>
            <span className="font-label-mono text-label-mono text-primary font-medium tracking-wide">
              {vehicles.filter((v) => v.status !== 'maintenance').length} / {vehicles.length} ONLINE
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-body-sm text-body-sm text-on-surface-variant">
            Live cluster telemetry &amp; dynamic routing
          </span>
          <span className="font-label-mono text-[10px] text-tertiary-fixed-dim uppercase tracking-wider">
            Active Batching
          </span>
        </div>
      </div>

      {/* Filter Pills Bar */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5" id="fleet-filters">
        <button
          onClick={() => setFilter('all')}
          className={`filter-pill shrink-0 px-3 py-1.5 rounded-full font-label-mono text-label-mono font-semibold transition-all cursor-pointer ${
            filter === 'all'
              ? 'bg-primary-container text-on-primary-container shadow-sm'
              : 'bg-surface-container text-on-surface-variant hover:text-on-surface border border-surface-container-high'
          }`}
        >
          All Vehicles ({vehicles.length})
        </button>
        <button
          onClick={() => setFilter('transit')}
          className={`filter-pill shrink-0 px-3 py-1.5 rounded-full font-label-mono text-label-mono font-medium transition-all cursor-pointer ${
            filter === 'transit'
              ? 'bg-primary-container text-on-primary-container shadow-sm'
              : 'bg-surface-container text-on-surface-variant hover:text-on-surface border border-surface-container-high'
          }`}
        >
          In Transit ({vehicles.filter((v) => v.status === 'transit').length})
        </button>
        <button
          onClick={() => setFilter('terminal')}
          className={`filter-pill shrink-0 px-3 py-1.5 rounded-full font-label-mono text-label-mono font-medium transition-all cursor-pointer ${
            filter === 'terminal'
              ? 'bg-primary-container text-on-primary-container shadow-sm'
              : 'bg-surface-container text-on-surface-variant hover:text-on-surface border border-surface-container-high'
          }`}
        >
          At Terminals ({vehicles.filter((v) => v.status === 'terminal').length})
        </button>
        <button
          onClick={() => setFilter('maintenance')}
          className={`filter-pill shrink-0 px-3 py-1.5 rounded-full font-label-mono text-label-mono font-medium transition-all cursor-pointer ${
            filter === 'maintenance'
              ? 'bg-primary-container text-on-primary-container shadow-sm'
              : 'bg-surface-container text-on-surface-variant hover:text-on-surface border border-surface-container-high'
          }`}
        >
          Maintenance ({vehicles.filter((v) => v.status === 'maintenance').length})
        </button>
      </div>

      {/* Live Cluster Overview Card with Interactive Leaflet Fleet Map */}
      <div className="relative overflow-hidden rounded-2xl p-4 bg-surface-container-low shadow-xl flex flex-col gap-3.5 border border-surface-container-high">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="font-label-mono text-[10px] uppercase text-outline tracking-wider">
              Metropolitan Zone
            </span>
            <span className="font-headline-md text-headline-md text-on-surface font-semibold tracking-tight">
              Nashik Urban Fleet V2.4
            </span>
          </div>
          <span className="p-2 rounded-lg bg-surface-container text-primary border border-surface-container-high">
            <span className="material-symbols-outlined text-[20px]">hub</span>
          </span>
        </div>

        {/* Live Leaflet Fleet Cluster Map View */}
        <div className="relative w-full h-56 rounded-xl bg-surface-container-lowest overflow-hidden border border-surface-container-high/60 shadow-inner">
          <LeafletMap
            center={[19.9977, 73.7803]}
            zoom={12}
            fleetVehicles={filteredVehicles}
            selectedVehicleId={selectedVehicleId}
            onVehicleSelect={(veh) => setSelectedVehicleId(veh.id)}
            height="224px"
          />
          <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface-container-high/90 border border-surface-container-highest/40 z-[400] backdrop-blur-sm">
            <span className="material-symbols-outlined text-[12px] text-primary">satellite_alt</span>
            <span className="font-label-mono text-[9px] text-on-surface-variant uppercase tracking-wider font-semibold">
              Spatial Fleet Grid Synced · Tracking {selectedVehicleId || 'V1'}
            </span>
          </div>
          <div className="absolute bottom-2 right-2 bg-surface-container-high/90 px-2 py-0.5 rounded border border-surface-container-highest/40 z-[400] backdrop-blur-sm">
            <span className="font-label-mono text-[9px] text-outline">
              LAT 19.9975° N · LON 73.7898° E
            </span>
          </div>
        </div>

        {/* Metrics Triad */}
        <div className="grid grid-cols-3 gap-2 pt-0.5">
          <div className="flex flex-col p-2.5 rounded-lg bg-surface-container border border-surface-container-high/60">
            <span className="font-label-mono text-[10px] text-on-surface-variant uppercase">
              Avg Speed
            </span>
            <span className="font-headline-md text-headline-md text-on-surface font-semibold mt-0.5">
              {avgSpeed} <span className="text-body-sm font-normal text-outline">km/h</span>
            </span>
            <span className="font-label-mono text-[9px] text-primary mt-1 font-semibold">▲ +3.2 km/h</span>
          </div>
          <div className="flex flex-col p-2.5 rounded-lg bg-surface-container border border-surface-container-high/60">
            <span className="font-label-mono text-[10px] text-on-surface-variant uppercase">
              Utilization
            </span>
            <span className="font-headline-md text-headline-md text-on-surface font-semibold mt-0.5">
              {utilization}<span className="text-body-sm font-normal text-outline">%</span>
            </span>
            <div className="w-full bg-surface-variant h-1 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-primary-container h-full transition-all duration-500"
                style={{ width: `${utilization}%` }}
              ></div>
            </div>
          </div>
          <div className="flex flex-col p-2.5 rounded-lg bg-surface-container border border-surface-container-high/60">
            <span className="font-label-mono text-[10px] text-on-surface-variant uppercase">
              Active Batches
            </span>
            <span className="font-headline-md text-headline-md text-on-surface font-semibold mt-0.5">
              {activeBatches < 10 ? `0${activeBatches}` : activeBatches}
            </span>
            <span className="font-label-mono text-[9px] text-tertiary-fixed-dim mt-1 font-semibold">
              Optimal Load
            </span>
          </div>
        </div>
      </div>

      {/* Vehicle Roster Header */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <span className="font-label-mono text-label-mono uppercase tracking-wider text-on-surface font-semibold">
            Active Roster
          </span>
          <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-outline font-label-mono text-[10px]">
            {filteredVehicles.length} Visible
          </span>
        </div>
        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
          className="flex items-center gap-1 font-label-mono text-[11px] text-primary hover:underline cursor-pointer"
        >
          <span>{autoRefresh ? `Auto-refresh ${refreshCountdown}s` : 'Paused'}</span>
          <span className={`material-symbols-outlined text-[14px] ${autoRefresh ? 'animate-spin' : ''}`}>
            sync
          </span>
        </button>
      </div>

      {/* Vehicle Cards List */}
      <div className="flex flex-col gap-3" id="roster-container">
        {filteredVehicles.map((v) => {
          const isSelected = selectedVehicleId === v.id;
          return (
            <div
              key={v.id}
              onClick={() => setSelectedVehicleId(v.id)}
              className={`vehicle-card flex flex-col p-3.5 rounded-xl cursor-pointer transition-all ${
                isSelected
                  ? 'bg-surface-container border-2 border-primary ring-2 ring-primary/20 shadow-xl shadow-primary/10'
                  : 'bg-surface-container-low shadow-md border border-surface-container-high hover:border-primary/40'
              }`}
            >
              {/* Responsive Header Row - Never truncate labels */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-primary border border-surface-container-highest/40 shrink-0">
                    <span className="material-symbols-outlined text-[20px]">electric_car</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-label-lg text-sm font-bold text-on-surface">
                        Vehicle {v.id}
                      </span>
                      {isSelected && (
                        <span className="px-1.5 py-0.5 rounded bg-primary text-on-primary font-label-mono text-[8.5px] uppercase font-extrabold tracking-wider animate-pulse">
                          ● TRACKING
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 font-body-sm text-[11px] text-on-surface-variant truncate">
                      <span>{v.model}</span>
                      <span className="text-outline">·</span>
                      <span className="font-mono text-outline">#{v.license}</span>
                    </div>
                  </div>
                </div>
                <div className="shrink-0 flex items-center">
                  <span className={`px-2.5 py-1 rounded-md font-label-mono text-[9.5px] font-bold uppercase tracking-wider text-center ${
                    v.status === 'transit'
                      ? 'bg-primary/15 text-primary border border-primary/30'
                      : v.status === 'terminal'
                      ? 'bg-amber-400/15 text-amber-300 border border-amber-400/30'
                      : 'bg-rose-400/15 text-rose-300 border border-rose-400/30'
                  }`}>
                    {v.status === 'transit' ? 'IN TRANSIT' : v.status === 'terminal' ? 'AT TERMINAL' : 'MAINTENANCE'}
                  </span>
                </div>
              </div>

              {/* Route Trajectory */}
              <div className="mt-3 p-2.5 rounded-lg bg-surface-container flex items-center gap-2 border border-surface-container-high/60">
                <span className="material-symbols-outlined text-primary text-[18px] shrink-0">
                  {v.status === 'maintenance' ? 'build' : v.status === 'terminal' ? 'local_parking' : 'turn_sharp_right'}
                </span>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="font-label-mono text-[10px] text-outline uppercase">
                    {v.status === 'maintenance' ? 'Service Depot Location' : v.status === 'terminal' ? 'Terminal Staging Area' : 'Active Route Vector'}
                  </span>
                  <span className="font-body-md text-body-md font-medium text-on-surface truncate">
                    {v.routeVector}
                  </span>
                </div>
              </div>

              {/* Telemetry Segment Bar */}
              <div className="grid grid-cols-3 gap-2 mt-2.5">
                <div className="flex flex-col p-2 rounded bg-surface-container-lowest border border-surface-container-high/40 min-w-0">
                  <span className="font-label-mono text-[10px] text-outline uppercase">Speed</span>
                  <span className="font-label-lg text-label-lg text-on-surface font-semibold mt-0.5 truncate">
                    {v.speed}
                  </span>
                </div>

                {/* Segmented Seat Allocation Bar */}
                <div className="flex flex-col p-2 rounded bg-surface-container-lowest border border-surface-container-high/40 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-label-mono text-[10px] text-outline uppercase">Seats</span>
                    <span className="font-label-mono text-[10px] text-on-surface-variant font-semibold">
                      {v.seatsOccupied}/{v.seatsTotal}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-1.5">
                    {Array.from({ length: v.seatsTotal }).map((_, idx) => (
                      <div
                        key={idx}
                        className="w-2.5 h-3 rounded-[1px] transition-all"
                        style={{
                          backgroundColor: idx < v.seatsOccupied ? '#0ED4A8' : '#232328',
                          boxShadow: idx < v.seatsOccupied ? '0 0 4px #0ED4A8' : 'none'
                        }}
                        title={idx < v.seatsOccupied ? 'Reserved Seat' : 'Available Seat'}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex flex-col p-2 rounded bg-surface-container-lowest border border-surface-container-high/40 min-w-0">
                  <span className="font-label-mono text-[10px] text-outline uppercase">Battery</span>
                  <span className="font-label-lg text-label-lg text-primary font-semibold mt-0.5 truncate">
                    {v.soc}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
