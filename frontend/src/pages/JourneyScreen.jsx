import React, { useState, useEffect, useMemo } from 'react';
import LeafletMap from '../components/LeafletMap';
import { NASHIK_HUBS, getSharedRideOrigin } from '../data/nashikLocations';
import { fetchRoadRoute, getAccurateDistance } from '../utils/routing';

/**
 * My Shared Journey — Dedicated Passenger Live Trip Experience
 *
 * Highlights the pooled nature of the ride:
 * - Shows where the vehicle is coming from (upstream co-rider stop)
 * - Inbound approach route on the Leaflet map (sky blue dashed line)
 * - Dual-phase simulation: "Inbound from Co-Rider Stop" vs "Onboard Shared Transit"
 * - Multi-stop timeline with complete PII protection
 * - Transparency on Shapley cost sharing enabled by the shared corridor
 */
export default function JourneyScreen({ activeRide = null, assignedVehicle = null }) {
  // Baseline stops
  const origin = activeRide?.origin || NASHIK_HUBS[0]; // CBS Chowk
  const dest = activeRide?.dest || NASHIK_HUBS[2];     // Gangapur Road
  const sharedOrigin = activeRide?.sharedOrigin || getSharedRideOrigin(origin, dest);

  const accurate = getAccurateDistance(origin, dest);
  const directDistanceKm = accurate.km;
  const directTimeMin = accurate.min;

  const approachAccurate = getAccurateDistance(sharedOrigin, origin);
  const approachDistanceKm = approachAccurate.km;

  // Realistic pooled metrics
  const detourMinutes = 2.1;
  const detourPct = 8.4;
  const pooledRideTimeMin = Math.round(directTimeMin + detourMinutes);
  const waitTimeMin = 1.5;

  // Trip Phase: 'approaching' (vehicle coming from upstream co-rider stop) | 'onboard' (passenger in transit)
  const [tripPhase, setTripPhase] = useState('approaching');

  const [routeCoords, setRouteCoords] = useState([]);
  const [approachRouteCoords, setApproachRouteCoords] = useState([]);
  const [vehicleIdx, setVehicleIdx] = useState(0);
  const [etaRemainingMin, setEtaRemainingMin] = useState(directTimeMin + 2);

  // ETA change telemetry alert
  const [etaChangeAlert] = useState({
    active: true,
    reason: `Traffic cleared near ${sharedOrigin.shortName} corridor (+1.5 min buffer)`,
    type: "traffic",
    impactMin: "+1.5 min"
  });

  // Load realistic turn-by-turn road polyline for user's trip (origin -> dest)
  useEffect(() => {
    let mounted = true;
    fetchRoadRoute(origin, dest).then((res) => {
      if (mounted && res && res.polyline) {
        setRouteCoords(res.polyline);
      }
    });
    return () => { mounted = false; };
  }, [origin, dest]);

  // Load realistic turn-by-turn road polyline for approach leg (sharedOrigin -> origin)
  useEffect(() => {
    let mounted = true;
    if (sharedOrigin && origin) {
      fetchRoadRoute(sharedOrigin, origin).then((res) => {
        if (mounted && res && res.polyline) {
          setApproachRouteCoords(res.polyline);
        }
      });
    }
    return () => { mounted = false; };
  }, [sharedOrigin, origin]);

  // Fallback coords for approach leg if offline
  const effectiveApproachCoords = useMemo(() => {
    if (approachRouteCoords.length > 1) return approachRouteCoords;
    if (!sharedOrigin || !origin) return [];
    const coords = [];
    const steps = 14;
    for (let i = 0; i <= steps; i++) {
      const frac = i / steps;
      const curveOffset = Math.sin(frac * Math.PI) * 0.005 * (i % 2 === 0 ? 1 : -0.6);
      coords.push([
        sharedOrigin.lat + (origin.lat - sharedOrigin.lat) * frac + curveOffset,
        sharedOrigin.lon + (origin.lon - sharedOrigin.lon) * frac - curveOffset
      ]);
    }
    return coords;
  }, [approachRouteCoords, sharedOrigin, origin]);

  // Active polyline based on viewed phase
  const activePolyline = tripPhase === 'approaching' ? effectiveApproachCoords : routeCoords;

  // Vehicle movement along active road leg
  useEffect(() => {
    if (!activePolyline || activePolyline.length === 0) return;
    const timer = setInterval(() => {
      setVehicleIdx((prev) => {
        const step = Math.max(1, Math.floor(activePolyline.length / 16));
        const next = prev + step;
        if (next >= activePolyline.length) {
          return 0;
        }
        return next;
      });
      if (tripPhase === 'onboard') {
        setEtaRemainingMin((prev) => (prev > 2 ? prev - 0.2 : directTimeMin));
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [activePolyline, tripPhase, directTimeMin]);

  const currentVehicleCoord = activePolyline && activePolyline.length > 0
    ? {
        lat: activePolyline[Math.min(vehicleIdx, activePolyline.length - 1)][0],
        lon: activePolyline[Math.min(vehicleIdx, activePolyline.length - 1)][1]
      }
    : (tripPhase === 'approaching'
        ? { lat: sharedOrigin.lat, lon: sharedOrigin.lon }
        : { lat: origin.lat, lon: origin.lon });

  // Fare breakdown calculation
  const soloFare = Math.round(30 + directDistanceKm * 11);
  const pooledFare = Math.round(soloFare * 0.65);
  const netSaved = soloFare - pooledFare;

  return (
    <div className="flex flex-col w-full px-4 gap-4 text-[#292B29] select-none pb-8 animate-fade-in">
      {/* Header Banner */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#52584A] animate-pulse"></span>
            <span className="font-mono text-[10.5px] uppercase tracking-wider text-[#686B66] font-semibold">
              Live Passenger Telemetry · Shared Pool
            </span>
          </div>
          <h1 className="font-sans text-xl md:text-2xl font-bold tracking-tight text-[#292B29]">
            My Shared Journey
          </h1>
        </div>
        <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-[#E5E8DF] border border-[#DCDAD4] text-[#343B30] font-mono text-[11px] font-semibold">
          <span className="material-symbols-outlined text-[15px] text-[#52584A]">directions_car</span>
          <span>Ride #{activeRide?.id || 'PJ-4821'}</span>
        </div>
      </div>

      {/* Shared Ride Inbound Origin Alert Banner */}
      <div className="rounded-xl px-3.5 py-2.5 bg-[#F0F7FA] border border-[#BAE6FD] flex items-center justify-between gap-2 shadow-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className="material-symbols-outlined text-[#0284C7] text-[20px] shrink-0">
            alt_route
          </span>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-[#0369A1]">
                Shared Ride Inbound
              </span>
              <span className="px-1.5 py-0.2 rounded bg-[#E0F2FE] text-[#0284C7] font-mono text-[9px] font-bold">
                1 Co-Rider Onboard
              </span>
            </div>
            <p className="text-xs text-[#0C4A6E] font-medium truncate">
              Vehicle is en route from <strong className="font-semibold">{sharedOrigin.shortName}</strong> ({approachDistanceKm} km) to pick you up at <strong className="font-semibold">{origin.shortName}</strong>.
            </p>
          </div>
        </div>
        <span className="material-symbols-outlined text-[#38BDF8] text-[18px] shrink-0">
          info
        </span>
      </div>

      {/* 1. Live Trip Map Card */}
      <div className="relative overflow-hidden rounded-2xl bg-[#30312F] border border-[#424440] shadow-md flex flex-col">
        {/* Card Header */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-[#424440]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#38bdf8] animate-ping"></span>
            <span className="font-mono text-xs uppercase tracking-wider text-[#F6F5F1] font-semibold">
              Vehicle {assignedVehicle?.id || 'V1'} · {tripPhase === 'approaching' ? `Inbound from ${sharedOrigin.shortName}` : 'En Route with Co-Riders'}
            </span>
          </div>
          <span className="font-mono text-xs text-[#A3A69D]">
            {tripPhase === 'approaching' ? 'Pickup ETA: ' : 'Trip ETA: '}
            <strong className="text-[#F6F5F1]">
              {tripPhase === 'approaching' ? '1.5 mins' : `${Math.max(2, Math.round(etaRemainingMin))} mins`}
            </strong>
          </span>
        </div>

        {/* Phase View Switcher Pills */}
        <div className="px-3 py-2 bg-[#262725] border-b border-[#424440] flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] uppercase text-[#A3A69D] font-medium hidden sm:inline">
            Interactive View:
          </span>
          <div className="flex items-center gap-1.5 flex-1 sm:flex-initial justify-end">
            <button
              onClick={() => { setTripPhase('approaching'); setVehicleIdx(0); }}
              className={`px-2.5 py-1 rounded-lg font-mono text-[10.5px] font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                tripPhase === 'approaching'
                  ? 'bg-[#38bdf8]/20 text-[#38bdf8] border border-[#38bdf8]/50 shadow-xs'
                  : 'bg-[#30312F] text-[#858C7B] hover:text-[#F6F5F1] border border-transparent'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#38bdf8]"></span>
              <span>1. Inbound from {sharedOrigin.shortName}</span>
            </button>
            <button
              onClick={() => { setTripPhase('onboard'); setVehicleIdx(0); }}
              className={`px-2.5 py-1 rounded-lg font-mono text-[10.5px] font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                tripPhase === 'onboard'
                  ? 'bg-[#0ED4A8]/20 text-[#0ED4A8] border border-[#0ED4A8]/50 shadow-xs'
                  : 'bg-[#30312F] text-[#858C7B] hover:text-[#F6F5F1] border border-transparent'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#0ED4A8]"></span>
              <span>2. Shared Transit to {dest.shortName}</span>
            </button>
          </div>
        </div>

        {/* Leaflet Street Map View */}
        <div className="relative w-full h-64 bg-[#131318] overflow-hidden">
          <LeafletMap
            center={[origin.lat, origin.lon]}
            pickup={origin}
            drop={dest}
            sharedOrigin={sharedOrigin}
            approachRouteCoords={effectiveApproachCoords}
            routeCoords={routeCoords}
            vehicleCoord={currentVehicleCoord}
            vehicleStatus={
              tripPhase === 'approaching'
                ? `Approaching from ${sharedOrigin.shortName} (Co-rider 1 onboard)`
                : `En Route to ${dest.shortName}`
            }
            height="256px"
          />

          {/* Map Badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-1 z-[400]">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#30312F]/92 backdrop-blur-md border border-[#424440]">
              <span className="material-symbols-outlined text-[13px] text-[#38bdf8]">hub</span>
              <span className="font-mono text-[10px] text-[#F6F5F1] font-semibold uppercase">
                {sharedOrigin.shortName} ➔ {origin.shortName} (You) ➔ {dest.shortName}
              </span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#38bdf8]/15 border border-[#38bdf8]/40 backdrop-blur-md">
              <span className="w-1.5 h-1.5 rounded-full bg-[#38bdf8] animate-pulse"></span>
              <span className="font-mono text-[9px] text-[#38bdf8] font-bold uppercase tracking-wider">
                Shared Pool Vector · Inbound Leg Active
              </span>
            </div>
          </div>

          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-[#30312F]/90 border border-[#424440] z-[400]">
            <span className="font-mono text-[9px] text-[#A3A69D]">
              Inbound {approachDistanceKm} km · Your Leg {directDistanceKm} km
            </span>
          </div>
        </div>

        {/* Vehicle & Driver Details Footer */}
        <div className="p-3 bg-[#30312F] flex items-center justify-between border-t border-[#424440]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#3D3F3B] border border-[#424440] flex items-center justify-center text-[#858C7B]">
              <span className="material-symbols-outlined text-[18px]">electric_car</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-[#F6F5F1]">
                {assignedVehicle?.model || 'Tata Tiago EV'}
              </span>
              <span className="font-mono text-[10px] text-[#A3A69D]">
                MH-15-4109 · Pilot Pooja Deshmukh (Women-Verified)
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#3D3F3B] border border-[#424440]">
            <span className="material-symbols-outlined text-[14px] text-[#38bdf8]">airline_seat_recline_normal</span>
            <span className="font-mono text-[10.5px] text-[#F6F5F1] font-semibold">2 Co-Riders Onboard</span>
          </div>
        </div>
      </div>

      {/* 2. ETA Change Explanation Card */}
      {etaChangeAlert.active && (
        <div className="rounded-2xl p-3.5 bg-[#FAF9F6] border border-[#DCDAD4] shadow-xs flex items-start gap-3">
          <span className="w-8 h-8 rounded-xl bg-[#EFE6DD] text-[#9E7B5B] flex items-center justify-center shrink-0 mt-0.5 border border-[#DCDAD4]">
            <span className="material-symbols-outlined text-[18px]">traffic</span>
          </span>
          <div className="flex flex-col flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-[#9E7B5B]">
                Active Route Telemetry Update
              </span>
              <span className="font-mono text-[11px] font-bold text-[#292B29]">
                {etaChangeAlert.impactMin}
              </span>
            </div>
            <p className="text-xs text-[#292B29] font-medium mt-0.5">
              {etaChangeAlert.reason}
            </p>
            <span className="text-[11px] text-[#686B66] mt-0.5">
              Corridor optimized with prior co-rider from {sharedOrigin.shortName}. Detour guarantee remains well within the 15% SLA cap.
            </span>
          </div>
        </div>
      )}

      {/* 3. Personal Detour Meter vs Direct Baseline */}
      <div className="rounded-2xl p-4 bg-[#FAF9F6] border border-[#DCDAD4] shadow-xs flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#898B84] font-semibold">
              Fairness SLA Guarantee
            </span>
            <span className="text-sm font-bold text-[#292B29]">
              Personal Detour Meter
            </span>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-[#E5E8DF] text-[#343B30] font-mono text-[10.5px] font-bold border border-[#DCDAD4]">
            SLA PASSED (Cap ≤ 15%)
          </span>
        </div>

        {/* Detour Triad Columns */}
        <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-[#F2EFEB] border border-[#DCDAD4]">
          <div className="flex flex-col items-center text-center">
            <span className="font-mono text-[10px] text-[#898B84] uppercase">Direct Baseline</span>
            <span className="text-base font-bold text-[#292B29] font-mono mt-0.5">{directTimeMin} min</span>
            <span className="text-[10px] text-[#686B66]">Solo Trip</span>
          </div>
          <div className="flex flex-col items-center text-center border-x border-[#DCDAD4]">
            <span className="font-mono text-[10px] text-[#52584A] font-semibold uppercase">Extra Detour</span>
            <span className="text-base font-bold text-[#52584A] font-mono mt-0.5">+{detourMinutes} min</span>
            <span className="text-[10px] text-[#52584A] font-medium">{detourPct}% added</span>
          </div>
          <div className="flex flex-col items-center text-center">
            <span className="font-mono text-[10px] text-[#898B84] uppercase">Wait Window</span>
            <span className="text-base font-bold text-[#292B29] font-mono mt-0.5">{waitTimeMin} min</span>
            <span className="text-[10px] text-[#686B66]">Pre-Boarding</span>
          </div>
        </div>

        {/* Separated waiting vs onboard ride progress */}
        <div className="flex flex-col gap-1.5 pt-1">
          <div className="flex justify-between text-[11px] font-mono text-[#686B66]">
            <span>Inbound arrival: <strong>1.5 min</strong></span>
            <span>Onboard transit: <strong>{pooledRideTimeMin} min</strong></span>
          </div>
          <div className="w-full h-2 rounded-full bg-[#E8E5DF] overflow-hidden flex">
            <div className="h-full bg-[#38bdf8]" style={{ width: '15%' }} title="Inbound approach"></div>
            <div className="h-full bg-[#52584A] ml-0.5 rounded-r-full flex-1" title="Onboard Ride"></div>
          </div>
        </div>
      </div>

      {/* 4. Personal Journey Timeline with Upstream Shared Origin */}
      <div className="rounded-2xl p-4 bg-[#FAF9F6] border border-[#DCDAD4] shadow-xs flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-[#292B29]">Personal Journey Milestones</span>
          <span className="font-mono text-[10.5px] text-[#686B66]">Strict PII Privacy Guard</span>
        </div>

        <div className="flex flex-col gap-3 pl-1">
          {/* Milestone 0: Upstream Co-Rider Origin */}
          <div className="flex items-start gap-3 relative">
            <div className="flex flex-col items-center">
              <span className="w-6 h-6 rounded-full bg-[#38bdf8] text-white flex items-center justify-center text-xs font-bold shadow-xs">
                ✓
              </span>
              <div className="w-0.5 h-10 bg-[#38bdf8]"></div>
            </div>
            <div className="flex flex-col pt-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#292B29]">Vehicle Departed {sharedOrigin.shortName}</span>
                <span className="font-mono text-[10px] text-[#0284c7] font-semibold">02:08 PM · Origin</span>
              </div>
              <span className="text-[11px] text-[#686B66]">
                Trip initiated at {sharedOrigin.name}. Co-rider 1 boarded upstream, sharing corridor capacity.
              </span>
            </div>
          </div>

          {/* Milestone 1: Pickup at user's location */}
          <div className="flex items-start gap-3 relative">
            <div className="flex flex-col items-center">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                tripPhase === 'approaching'
                  ? 'bg-[#E5E8DF] border-2 border-[#52584A] text-[#52584A]'
                  : 'bg-[#52584A] text-white'
              }`}>
                {tripPhase === 'approaching' ? '●' : '✓'}
              </span>
              <div className="w-0.5 h-10 bg-[#52584A]"></div>
            </div>
            <div className="flex flex-col pt-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#292B29]">Boarding at {origin.shortName} (Your Pickup)</span>
                <span className="font-mono text-[10px] text-[#686B66]">02:14 PM</span>
                {tripPhase === 'approaching' && (
                  <span className="px-1.5 py-0.2 rounded bg-[#38bdf8]/20 text-[#0284c7] font-mono text-[9px] font-bold uppercase">
                    Approaching
                  </span>
                )}
              </div>
              <span className="text-[11px] text-[#898B84]">
                Vehicle arrives at designated transit bay within guaranteed 1m 30s window.
              </span>
            </div>
          </div>

          {/* Milestone 2: En Route (Current Active Step) */}
          <div className="flex items-start gap-3 relative">
            <div className="flex flex-col items-center">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                tripPhase === 'onboard'
                  ? 'bg-[#E5E8DF] border-2 border-[#52584A] text-[#52584A]'
                  : 'bg-[#F2EFEB] border border-[#DCDAD4] text-[#898B84]'
              }`}>
                ●
              </span>
              <div className="w-0.5 h-10 bg-[#DCDAD4]"></div>
            </div>
            <div className="flex flex-col pt-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#52584A]">In Transit · Active Shared Corridor</span>
                {tripPhase === 'onboard' && (
                  <span className="px-1.5 py-0.5 rounded bg-[#E5E8DF] font-mono text-[9px] font-bold text-[#343B30] uppercase">
                    Current
                  </span>
                )}
              </div>
              <span className="text-[11px] text-[#686B66]">
                Travelling via shared vector with co-riders (no detour stops for your trip).
              </span>
            </div>
          </div>

          {/* Milestone 3: Destination Arrival */}
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <span className="w-6 h-6 rounded-full bg-[#F2EFEB] border border-[#DCDAD4] flex items-center justify-center text-xs text-[#898B84]">
                🏁
              </span>
            </div>
            <div className="flex flex-col pt-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#686B66]">Destination Drop at {dest.shortName}</span>
                <span className="font-mono text-[10px] text-[#898B84]">Est. 02:34 PM</span>
              </div>
              <span className="text-[11px] text-[#898B84]">
                Trip complete upon passenger debarkation at requested junction.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Fare Transparency & Fair Allocation Breakdown */}
      <div className="rounded-2xl p-4 bg-[#FAF9F6] border border-[#DCDAD4] shadow-xs flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#898B84] font-semibold">
              Transparent Pricing Model
            </span>
            <span className="text-sm font-bold text-[#292B29]">
              Fare Breakdown &amp; Savings
            </span>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-[#E5E8DF] text-[#343B30] font-mono text-xs font-bold">
            Saved ₹{netSaved} (35%)
          </span>
        </div>

        {/* Pricing comparison table */}
        <div className="flex flex-col gap-2 pt-1">
          <div className="flex items-center justify-between text-xs py-1.5 border-b border-[#DCDAD4]">
            <span className="text-[#686B66]">Solo Direct Ride Baseline</span>
            <span className="font-mono text-[#686B66] line-through">₹{soloFare}</span>
          </div>
          <div className="flex items-center justify-between text-xs py-1.5 border-b border-[#DCDAD4]">
            <span className="text-[#686B66]">Shared Distance Discount (Co-Rider from {sharedOrigin.shortName})</span>
            <span className="font-mono text-[#52584A] font-semibold">-₹{netSaved}</span>
          </div>
          <div className="flex items-center justify-between text-sm py-1 font-bold">
            <span className="text-[#292B29]">Your Final Shared Fare</span>
            <span className="font-mono text-base text-[#292B29]">₹{pooledFare}</span>
          </div>
        </div>

        {/* Allocation Methodology explanation */}
        <div className="p-2.5 rounded-xl bg-[#F2EFEB] border border-[#DCDAD4] flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-[#52584A]">account_balance_wallet</span>
          <span className="text-[11px] text-[#686B66]">
            Calculated via <strong>Marginal Distance Allocation</strong>: Each rider only pays for their own direct vector minus shared corridor cost offsets from upstream co-riders.
          </span>
        </div>
      </div>
    </div>
  );
}
