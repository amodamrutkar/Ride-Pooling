import React, { useState, useEffect, useMemo } from 'react';
import LeafletMap from '../components/LeafletMap';
import { NASHIK_HUBS, getSharedRideOrigin } from '../data/nashikLocations';
import { fetchRoadRoute, getAccurateDistance } from '../utils/routing';

/**
 * My Shared Journey — Dedicated Passenger Live Trip Experience
 *
 * Shows the complete shared ride from:
 * Shared Start Point ➔ Pickup ➔ Drop Off
 *
 * The vehicle approaches from the shared start point and stops at the pickup
 * (does not run in a loop).
 * The upstream shared start origin is dynamic and random each time.
 */
export default function JourneyScreen({ activeRide = null, assignedVehicle = null }) {
  // Baseline stops
  const origin = activeRide?.origin || NASHIK_HUBS[0]; // CBS Chowk or User's Pickup
  const dest = activeRide?.dest || NASHIK_HUBS[2];     // Gangapur Road or User's Drop

  // Dynamic random shared origin if not already attached to activeRide
  const [randomSeed, setRandomSeed] = useState(() => Math.floor(Math.random() * 10000));
  const sharedOrigin = useMemo(() => {
    if (activeRide?.sharedOrigin) return activeRide.sharedOrigin;
    return getSharedRideOrigin(origin, dest, randomSeed);
  }, [activeRide?.sharedOrigin, origin, dest, randomSeed]);

  const accurate = getAccurateDistance(origin, dest);
  const directDistanceKm = accurate.km;
  const directTimeMin = accurate.min;

  const approachAccurate = getAccurateDistance(sharedOrigin, origin);
  const approachDistanceKm = approachAccurate.km;

  // Realistic pooled metrics
  const detourMinutes = 2.1;
  const detourPct = 8.4;
  const pooledRideTimeMin = Math.round(directTimeMin + detourMinutes);

  const [routeCoords, setRouteCoords] = useState([]);
  const [approachRouteCoords, setApproachRouteCoords] = useState([]);
  const [vehicleIdx, setVehicleIdx] = useState(0);
  const [hasArrived, setHasArrived] = useState(false);
  const [etaRemainingSeconds, setEtaRemainingSeconds] = useState(90);

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

  // Load realistic turn-by-turn road polyline for user's leg (origin -> dest)
  useEffect(() => {
    let mounted = true;
    fetchRoadRoute(origin, dest).then((res) => {
      if (mounted && res && res.polyline) {
        setRouteCoords(res.polyline);
      }
    });
    return () => { mounted = false; };
  }, [origin, dest]);

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

  // Vehicle movement: Drives from sharedOrigin to origin (Pickup), and STOPS at Pickup (no loop!)
  useEffect(() => {
    if (!effectiveApproachCoords || effectiveApproachCoords.length === 0) return;
    if (hasArrived) return; // Vehicle already stopped at pickup

    const timer = setInterval(() => {
      const totalSteps = effectiveApproachCoords.length;
      const step = Math.max(1, Math.floor(totalSteps / 10));

      setVehicleIdx((prev) => {
        const next = prev + step;
        if (next >= totalSteps - 1) {
          // Reached pickup! Stop vehicle and do NOT loop.
          setHasArrived(true);
          setEtaRemainingSeconds(0);
          clearInterval(timer);
          return totalSteps - 1;
        }
        return next;
      });

      setEtaRemainingSeconds((prev) => (prev > 10 ? prev - 10 : 0));
    }, 1500);

    return () => clearInterval(timer);
  }, [effectiveApproachCoords, hasArrived]);

  const currentVehicleCoord = useMemo(() => {
    if (effectiveApproachCoords && effectiveApproachCoords.length > 0) {
      const safeIdx = Math.min(vehicleIdx, effectiveApproachCoords.length - 1);
      return {
        lat: effectiveApproachCoords[safeIdx][0],
        lon: effectiveApproachCoords[safeIdx][1],
        isApproaching: !hasArrived,
        label: hasArrived
          ? `Vehicle V1 · Arrived at ${origin.shortName} (Board Now)`
          : `Vehicle V1 · Approaching from ${sharedOrigin.shortName}`
      };
    }
    return {
      lat: hasArrived ? origin.lat : sharedOrigin.lat,
      lon: hasArrived ? origin.lon : sharedOrigin.lon,
      isApproaching: !hasArrived,
      label: hasArrived ? `Vehicle V1 · Arrived at ${origin.shortName}` : 'Vehicle V1 · Approaching'
    };
  }, [effectiveApproachCoords, vehicleIdx, hasArrived, origin, sharedOrigin]);

  // Reset/replay function for user convenience (does not loop on its own)
  const handleReplayApproach = () => {
    setVehicleIdx(0);
    setHasArrived(false);
    setEtaRemainingSeconds(90);
  };

  const handleShuffleOrigin = () => {
    setRandomSeed(Math.floor(Math.random() * 10000));
    setVehicleIdx(0);
    setHasArrived(false);
    setEtaRemainingSeconds(90);
  };

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
              Live Passenger Telemetry · Shared Ride
            </span>
          </div>
          <h1 className="font-sans text-xl md:text-2xl font-bold tracking-tight text-[#292B29]">
            My Shared Journey
          </h1>
        </div>
        <div className="flex items-center gap-1.5">
          {!activeRide && (
            <button
              onClick={handleShuffleOrigin}
              className="px-2 py-1 rounded-lg bg-[#E5E8DF] hover:bg-[#DCDAD4] text-[#343B30] font-mono text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all border border-[#DCDAD4]"
              title="Pick another random upstream feeder"
            >
              <span className="material-symbols-outlined text-[12px]">casino</span>
              <span>Random Origin</span>
            </button>
          )}
          <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-[#E5E8DF] border border-[#DCDAD4] text-[#343B30] font-mono text-[11px] font-semibold">
            <span className="material-symbols-outlined text-[15px] text-[#52584A]">directions_car</span>
            <span>Ride #{activeRide?.id || 'PJ-4821'}</span>
          </div>
        </div>
      </div>

      {/* Shared Ride Corridor Info Banner */}
      <div className="rounded-xl px-3.5 py-2.5 bg-[#F0F7FA] border border-[#BAE6FD] flex items-center justify-between gap-2 shadow-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="material-symbols-outlined text-[#0284C7] text-[20px] shrink-0">
            alt_route
          </span>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10.5px] uppercase font-bold tracking-wider text-[#0369A1]">
                Shared 3-Stop Journey
              </span>
              <span className="px-1.5 py-0.2 rounded bg-[#E0F2FE] text-[#0284C7] font-mono text-[9px] font-bold">
                Co-Rider 1 Onboard
              </span>
            </div>
            <p className="text-xs text-[#0C4A6E] font-medium truncate">
              {hasArrived
                ? `Vehicle has arrived at ${origin.shortName} from ${sharedOrigin.shortName}! Ready for boarding.`
                : `Vehicle started at ${sharedOrigin.shortName} (${approachDistanceKm} km away) and is approaching your pickup at ${origin.shortName}.`}
            </p>
          </div>
        </div>
        {hasArrived && (
          <span className="px-2 py-0.5 rounded-full bg-[#10b981]/20 text-[#059669] font-mono text-[10px] font-bold uppercase shrink-0">
            Arrived
          </span>
        )}
      </div>

      {/* 1. Unified Live Trip Map Card: Shared Start ➔ Pickup ➔ Drop Off */}
      <div className="relative overflow-hidden rounded-2xl bg-[#30312F] border border-[#424440] shadow-md flex flex-col">
        {/* Card Header */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-[#424440]">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${hasArrived ? 'bg-[#0ED4A8]' : 'bg-[#38bdf8] animate-ping'}`}></span>
            <span className="font-mono text-xs uppercase tracking-wider text-[#F6F5F1] font-semibold">
              Vehicle {assignedVehicle?.id || 'V1'} · {hasArrived ? 'Arrived at Pickup' : `Inbound from ${sharedOrigin.shortName}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-[#A3A69D]">
              {hasArrived ? 'Status: ' : 'Pickup ETA: '}
              <strong className={hasArrived ? 'text-[#0ED4A8]' : 'text-[#F6F5F1]'}>
                {hasArrived ? 'Arrived · Board Now' : `${Math.max(1, Math.ceil(etaRemainingSeconds / 60))} min`}
              </strong>
            </span>
            {hasArrived && (
              <button
                onClick={handleReplayApproach}
                className="text-[10px] font-mono text-[#38bdf8] hover:underline cursor-pointer flex items-center gap-0.5 ml-1"
                title="Replay vehicle approach animation"
              >
                <span className="material-symbols-outlined text-[13px]">replay</span>
                <span>Replay</span>
              </button>
            )}
          </div>
        </div>

        {/* Route Corridor Banner */}
        <div className="px-3.5 py-2 bg-[#262725] border-b border-[#424440] flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="material-symbols-outlined text-[15px] text-[#38bdf8] shrink-0">route</span>
            <span className="font-mono text-[11px] text-[#F6F5F1] font-bold uppercase truncate">
              {sharedOrigin.shortName} <span className="text-[#38bdf8]">➔</span> {origin.shortName} (You) <span className="text-[#0ED4A8]">➔</span> {dest.shortName}
            </span>
          </div>
          <span className="font-mono text-[10px] text-[#A3A69D] shrink-0">
            Total {Math.round((approachDistanceKm + directDistanceKm) * 10) / 10} km
          </span>
        </div>

        {/* Leaflet Street Map View: Complete continuous shared route */}
        <div className="relative w-full h-72 bg-[#131318] overflow-hidden">
          <LeafletMap
            center={[origin.lat, origin.lon]}
            pickup={origin}
            drop={dest}
            sharedOrigin={sharedOrigin}
            approachRouteCoords={effectiveApproachCoords}
            routeCoords={routeCoords}
            vehicleCoord={currentVehicleCoord}
            height="288px"
          />

          {/* Map Badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-1 z-[400]">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#30312F]/92 backdrop-blur-md border border-[#424440]">
              <span className="material-symbols-outlined text-[13px] text-[#38bdf8]">hub</span>
              <span className="font-mono text-[10px] text-[#F6F5F1] font-semibold uppercase">
                {sharedOrigin.shortName} ➔ {origin.shortName} ➔ {dest.shortName}
              </span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#38bdf8]/15 border border-[#38bdf8]/40 backdrop-blur-md">
              <span className={`w-1.5 h-1.5 rounded-full ${hasArrived ? 'bg-[#0ED4A8]' : 'bg-[#38bdf8] animate-pulse'}`}></span>
              <span className="font-mono text-[9px] text-[#38bdf8] font-bold uppercase tracking-wider">
                {hasArrived ? 'Vehicle Stopped at Pickup' : `Inbound Approach Active (${approachDistanceKm} km)`}
              </span>
            </div>
          </div>

          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-[#30312F]/90 border border-[#424440] z-[400]">
            <span className="font-mono text-[9px] text-[#A3A69D]">
              OSRM Live · Street Geometry
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

      {/* 2. Personal Journey Timeline (Start ➔ Pickup ➔ Drop Off) */}
      <div className="rounded-2xl p-4 bg-[#FAF9F6] border border-[#DCDAD4] shadow-xs flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-[#292B29]">Personal Journey Milestones</span>
          <span className="font-mono text-[10.5px] text-[#686B66]">Strict PII Privacy Guard</span>
        </div>

        <div className="flex flex-col gap-3 pl-1">
          {/* Milestone 1: Shared Origin (Co-Rider Boarded) */}
          <div className="flex items-start gap-3 relative">
            <div className="flex flex-col items-center">
              <span className="w-6 h-6 rounded-full bg-[#38bdf8] text-white flex items-center justify-center text-xs font-bold shadow-xs">
                ✓
              </span>
              <div className="w-0.5 h-10 bg-[#38bdf8]"></div>
            </div>
            <div className="flex flex-col pt-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#292B29]">Shared Start: {sharedOrigin.shortName}</span>
                <span className="font-mono text-[10px] text-[#0284c7] font-semibold">02:08 PM · Origin</span>
              </div>
              <span className="text-[11px] text-[#686B66]">
                Trip originated at {sharedOrigin.name}. Co-rider 1 boarded upstream, sharing corridor capacity.
              </span>
            </div>
          </div>

          {/* Milestone 2: Pickup at user's location */}
          <div className="flex items-start gap-3 relative">
            <div className="flex flex-col items-center">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                hasArrived
                  ? 'bg-[#10b981] text-white'
                  : 'bg-[#E5E8DF] border-2 border-[#52584A] text-[#52584A]'
              }`}>
                {hasArrived ? '✓' : '●'}
              </span>
              <div className="w-0.5 h-10 bg-[#52584A]"></div>
            </div>
            <div className="flex flex-col pt-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#292B29]">Pickup: {origin.shortName} (Your Boarding)</span>
                <span className={`font-mono text-[10px] font-bold ${hasArrived ? 'text-[#059669]' : 'text-[#686B66]'}`}>
                  {hasArrived ? '02:14 PM · Arrived' : 'ETA 1.5 min'}
                </span>
                {hasArrived && (
                  <span className="px-1.5 py-0.2 rounded bg-[#10b981]/20 text-[#059669] font-mono text-[9px] font-bold uppercase">
                    Board Now
                  </span>
                )}
              </div>
              <span className="text-[11px] text-[#898B84]">
                {hasArrived
                  ? 'Vehicle arrived and stopped at your pickup bay. Please board vehicle V1.'
                  : 'Vehicle en route from upstream origin. Please be ready at pickup bay.'}
              </span>
            </div>
          </div>

          {/* Milestone 3: Shared Transit Corridor */}
          <div className="flex items-start gap-3 relative">
            <div className="flex flex-col items-center">
              <span className="w-6 h-6 rounded-full bg-[#F2EFEB] border border-[#DCDAD4] flex items-center justify-center text-xs text-[#898B84]">
                ●
              </span>
              <div className="w-0.5 h-10 bg-[#DCDAD4]"></div>
            </div>
            <div className="flex flex-col pt-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#686B66]">In Transit · Active Shared Corridor</span>
              </div>
              <span className="text-[11px] text-[#898B84]">
                Direct transit vector with co-riders along corridor (no detour stops for your trip).
              </span>
            </div>
          </div>

          {/* Milestone 4: Destination Arrival */}
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <span className="w-6 h-6 rounded-full bg-[#F2EFEB] border border-[#DCDAD4] flex items-center justify-center text-xs text-[#898B84]">
                🏁
              </span>
            </div>
            <div className="flex flex-col pt-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#686B66]">Dropoff: {dest.shortName}</span>
                <span className="font-mono text-[10px] text-[#898B84]">Est. 02:34 PM</span>
              </div>
              <span className="text-[11px] text-[#898B84]">
                Trip complete upon passenger debarkation at requested destination.
              </span>
            </div>
          </div>
        </div>
      </div>

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
            <span className="text-base font-bold text-[#292B29] font-mono mt-0.5">1.5 min</span>
            <span className="text-[10px] text-[#686B66]">Pre-Boarding</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex flex-col gap-1.5 pt-1">
          <div className="flex justify-between text-[11px] font-mono text-[#686B66]">
            <span>Inbound approach: <strong>{hasArrived ? 'Completed' : 'In Progress'}</strong></span>
            <span>Onboard transit: <strong>{pooledRideTimeMin} min</strong></span>
          </div>
          <div className="w-full h-2 rounded-full bg-[#E8E5DF] overflow-hidden flex">
            <div className="h-full bg-[#38bdf8]" style={{ width: hasArrived ? '25%' : '15%' }} title="Inbound approach"></div>
            <div className="h-full bg-[#52584A] ml-0.5 rounded-r-full flex-1" title="Onboard Ride"></div>
          </div>
        </div>
      </div>

      {/* 4. Fare Transparency & Fair Allocation Breakdown */}
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
            <span className="text-[#686B66]">Shared Distance Discount (Feeder from {sharedOrigin.shortName})</span>
            <span className="font-mono text-[#52584A] font-semibold">-₹{netSaved}</span>
          </div>
          <div className="flex items-center justify-between text-sm py-1 font-bold">
            <span className="text-[#292B29]">Your Final Shared Fare</span>
            <span className="font-mono text-base text-[#292B29]">₹{pooledFare}</span>
          </div>
        </div>

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
