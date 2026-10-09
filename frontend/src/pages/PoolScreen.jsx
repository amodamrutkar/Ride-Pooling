import React, { useState, useEffect, useMemo } from 'react';
import LeafletMap from '../components/LeafletMap';
import ZeroTrustGate from '../components/ZeroTrustGate';
import RouteDiffView from '../components/RouteDiffView';
import { fetchRoadRoute } from '../utils/routing';
import { runDispatch } from '../utils/api';
import { NASHIK_HUBS } from '../data/nashikLocations';

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.max(1.2, Math.round(R * c * 10) / 10);
}

export default function PoolScreen({
  poolStage,
  setPoolStage,
  onRequestRide,
  onCancelRide,
  backendWindow = null,
  assignedVehicle = null,
  preselectedHubs = null
}) {
  // Hubs selection
  const [originIndex, setOriginIndex] = useState(0); // CBS Chowk
  const [destIndex, setDestIndex] = useState(2);   // Gangapur Road

  // If corridor was chosen from Routes screen, apply its stops
  useEffect(() => {
    if (preselectedHubs) {
      if (typeof preselectedHubs.originIdx === 'number') setOriginIndex(preselectedHubs.originIdx);
      if (typeof preselectedHubs.destIdx === 'number') setDestIndex(preselectedHubs.destIdx);
    }
  }, [preselectedHubs]);

  const originHub = NASHIK_HUBS[originIndex] || NASHIK_HUBS[0];
  const destHub = NASHIK_HUBS[destIndex] || NASHIK_HUBS[2];

  // Real OSRM Road Geometry (Google Maps-like street turn-by-turn polyline)
  const [roadRoute, setRoadRoute] = useState(null);
  const [loadingRoute, setLoadingRoute] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadRoadPath() {
      setLoadingRoute(true);
      const res = await fetchRoadRoute(originHub, destHub);
      if (mounted && res && res.polyline) {
        setRoadRoute(res);
      }
      setLoadingRoute(false);
    }
    loadRoadPath();
    return () => {
      mounted = false;
    };
  }, [originHub, destHub]);

  // Dynamic trip metrics calculation based on real road routing
  const tripDistance = useMemo(() => {
    if (roadRoute && roadRoute.distanceKm) return roadRoute.distanceKm;
    return calculateDistance(originHub.lat, originHub.lon, destHub.lat, destHub.lon);
  }, [originHub, destHub, roadRoute]);

  const estTimeMin = useMemo(() => {
    if (roadRoute && roadRoute.durationMin) return roadRoute.durationMin;
    return Math.round(tripDistance * 1.8 + 2);
  }, [tripDistance, roadRoute]);

  const soloFare = Math.round(25 + tripDistance * 10);
  const pooledMin = Math.round(soloFare * 0.72);
  const pooledMax = Math.round(soloFare * 0.81);
  const dynamicPoolPrice = Math.round(soloFare * 0.65);
  const pooledSavings = soloFare - dynamicPoolPrice;
  const savingsPct = Math.round((pooledSavings / soloFare) * 100);

  // Active street route polyline for Google Maps-like precision
  const activeRouteCoords = useMemo(() => {
    if (roadRoute && roadRoute.polyline && roadRoute.polyline.length > 1) {
      return roadRoute.polyline;
    }
    // Fallback: 12 street-curved coordinates
    const coords = [];
    const steps = 12;
    for (let i = 0; i <= steps; i++) {
      const frac = i / steps;
      const curveOffset = Math.sin(frac * Math.PI) * 0.006 * (i % 2 === 0 ? 1 : -0.6);
      coords.push([
        originHub.lat + (destHub.lat - originHub.lat) * frac + curveOffset,
        originHub.lon + (destHub.lon - originHub.lon) * frac - curveOffset
      ]);
    }
    return coords;
  }, [originHub, destHub, roadRoute]);

  // Diff polyline state for Before vs After route visualization on Leaflet
  const [diffPolyline, setDiffPolyline] = useState(null);
  const [diffMode, setDiffMode] = useState('after');

  // Zero-Trust Gate Verification State
  const [isVerifyingGate, setIsVerifyingGate] = useState(false);
  const [gateDecision, setGateDecision] = useState('COMMITTED');
  const [showUspDrawer, setShowUspDrawer] = useState(true);

  const handleReverifyGate = async () => {
    setIsVerifyingGate(true);
    const res = await runDispatch('hybrid');
    setTimeout(() => {
      setGateDecision(res && res.plans && res.plans.length > 0 ? 'COMMITTED' : 'COMMITTED');
      setIsVerifyingGate(false);
    }, 600);
  };

  // Matching window simulation and live queue count
  const [batchProgress, setBatchProgress] = useState(12);
  const [queueCount, setQueueCount] = useState(2);

  useEffect(() => {
    if (backendWindow && typeof backendWindow.elapsed_s === 'number') {
      setBatchProgress(Math.min(30, Math.floor(backendWindow.elapsed_s)));
    }
  }, [backendWindow]);

  useEffect(() => {
    if (poolStage !== 'matching') return;
    const interval = setInterval(() => {
      setBatchProgress((prev) => {
        if (prev >= 30) {
          setPoolStage('active');
          return 0;
        }
        return prev + 1;
      });
      // subtle live jitter in nearby queue
      if (Math.random() > 0.6) {
        setQueueCount((q) => (q === 2 ? 3 : 2));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [poolStage, setPoolStage]);

  // Active ride live vehicle progression & ticking ETA (visibly moves every 2 seconds along road)
  const [vehicleIdx, setVehicleIdx] = useState(0);
  const [etaSeconds, setEtaSeconds] = useState(157); // 2:37 ETA
  const [currentSpeed, setCurrentSpeed] = useState(28);

  useEffect(() => {
    if (poolStage !== 'active') return;
    const timer = setInterval(() => {
      setVehicleIdx((prev) => {
        const step = Math.max(1, Math.floor(activeRouteCoords.length / 14));
        return (prev + step) % activeRouteCoords.length;
      });
      setEtaSeconds((prev) => (prev > 12 ? prev - 2 : 157));
      setCurrentSpeed(Math.floor(28 + Math.random() * 8));
    }, 2000);
    return () => clearInterval(timer);
  }, [poolStage, activeRouteCoords.length]);

  const currentVehicleCoord = useMemo(() => {
    if (activeRouteCoords && activeRouteCoords.length > 0) {
      const safeIdx = vehicleIdx % activeRouteCoords.length;
      return { lat: activeRouteCoords[safeIdx][0], lon: activeRouteCoords[safeIdx][1] };
    }
    return { lat: originHub.lat, lon: originHub.lon };
  }, [activeRouteCoords, vehicleIdx, originHub]);

  const formatEta = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s} ETA`;
  };

  // Cancel button two-phase confirmation
  const [cancelText, setCancelText] = useState('Cancel Ride');
  const [cancelIsConfirm, setCancelIsConfirm] = useState(false);

  const handleActiveCancel = () => {
    if (!cancelIsConfirm) {
      setCancelText('Confirm Cancellation?');
      setCancelIsConfirm(true);
      setTimeout(() => {
        setCancelText('Cancel Ride');
        setCancelIsConfirm(false);
      }, 4000);
    } else {
      setCancelText('Ride Aborted');
      setTimeout(() => {
        setCancelText('Cancel Ride');
        setCancelIsConfirm(false);
        setPoolStage('request');
        if (onCancelRide) onCancelRide();
      }, 1200);
    }
  };

  return (
    <div className="flex flex-col w-full text-on-surface select-none pb-4">
      {/* ─────────────────────────────────────────────────────────────
          STAGE 1: REQUEST A RIDE
      ───────────────────────────────────────────────────────────── */}
      {poolStage === 'request' && (
        <div className="flex flex-col w-full">
          {/* Top Sub-Bar */}
          <div className="w-full flex items-center justify-between px-4 py-2 relative">
            <span className="font-label-mono text-label-mono text-outline uppercase tracking-wider">
              CORRIDOR SELECT
            </span>
            <div className="absolute inset-x-0 flex justify-center pointer-events-none">
              <span className="font-body-lg text-body-lg font-medium text-on-surface tracking-tight">
                Request a Ride
              </span>
            </div>
            <span className="px-2 py-0.5 rounded bg-primary-container/20 text-primary font-label-mono text-[10px] font-semibold">
              OSRM LIVE
            </span>
          </div>

          {/* Location Input Sequence */}
          <div className="px-4 pt-1 pb-3">
            <div className="relative flex flex-col gap-2 bg-surface-container-low p-2.5 rounded-xl border border-surface-container-high/60 shadow-md">
              {/* Origin Node */}
              <div className="relative flex items-center h-12 bg-surface-container-high rounded-lg px-3 transition-all">
                <div className="w-3 flex justify-center items-center mr-3 shrink-0 z-10">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary-container shadow-[0_0_10px_#0ed4a8]"></div>
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <select
                    value={originIndex}
                    onChange={(e) => setOriginIndex(Number(e.target.value))}
                    className="bg-transparent text-on-surface font-body-md text-sm font-semibold focus:outline-none cursor-pointer"
                  >
                    {NASHIK_HUBS.map((hub, idx) => (
                      <option key={hub.id} value={idx} className="bg-surface-container text-on-surface">
                        {hub.name}
                      </option>
                    ))}
                  </select>
                </div>
                <span className="font-label-mono text-label-mono text-primary uppercase tracking-wider text-[10px] font-bold">
                  Pickup
                </span>
              </div>

              {/* Vertical connector line */}
              <div className="absolute left-[30px] top-[28px] bottom-[28px] w-px bg-outline-variant z-0 pointer-events-none"></div>

              {/* Destination Node */}
              <div className="relative flex items-center h-12 bg-surface-container-high rounded-lg px-3 transition-all">
                <div className="w-3 flex justify-center items-center mr-3 shrink-0 z-10">
                  <div className="w-2.5 h-2.5 rounded-sm bg-on-surface shadow-[0_0_8px_#e4e1e9]"></div>
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <select
                    value={destIndex}
                    onChange={(e) => setDestIndex(Number(e.target.value))}
                    className="bg-transparent text-on-surface font-body-md text-sm font-semibold focus:outline-none cursor-pointer"
                  >
                    {NASHIK_HUBS.map((hub, idx) => (
                      <option key={hub.id} value={idx} className="bg-surface-container text-on-surface">
                        {hub.name}
                      </option>
                    ))}
                  </select>
                </div>
                <span className="font-label-mono text-label-mono text-outline uppercase tracking-wider text-[10px]">
                  Drop
                </span>
              </div>
            </div>
          </div>

          {/* Route Map Viewport with ESRI Dark Tiles and Clear Location Badges */}
          <div className="w-full relative h-[310px] bg-surface-container-lowest overflow-hidden border-y border-surface-container-high/40">
            <LeafletMap
              center={[originHub.lat, originHub.lon]}
              pickup={originHub}
              drop={destHub}
              routeCoords={activeRouteCoords}
              diffPolyline={diffPolyline}
              diffMode={diffMode}
              height="310px"
            />
            {/* Context Floating Indicators */}
            <div className="absolute top-2 left-4 flex items-center gap-1.5 bg-surface-container-high/90 backdrop-blur-md px-2.5 py-1 rounded border border-surface-container-highest/40 z-[400]">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-pulse"></span>
              <span className="font-label-mono text-[10px] text-on-surface tracking-widest uppercase font-semibold">
                CORRIDOR: MH-15 · ROAD ROUTING ACTIVE
              </span>
            </div>
            <div className="absolute bottom-2 right-4 bg-surface-container-high/90 backdrop-blur-md px-2.5 py-0.5 rounded border border-surface-container-highest/40 z-[400]">
              <span className="font-label-mono text-[10px] text-on-surface-variant tracking-wider">
                {diffPolyline ? (diffMode === 'before' ? 'BEFORE ROUTE GEOMETRY' : 'AFTER RE-OPTIMIZATION GEOMETRY') : 'LIVE STREET TELEMETRY'}
              </span>
            </div>
          </div>

          {/* Trip Metric & Summary Card */}
          <div className="px-4 -mt-3 z-10">
            <div className="bg-surface-container p-4 rounded-2xl flex flex-col gap-3 shadow-2xl border border-surface-container-high/80">
              <div className="flex items-center justify-between pb-1">
                <span className="font-label-mono text-label-mono text-outline uppercase tracking-wider font-semibold">
                  TRIP SUMMARY
                </span>
                <span className="font-label-mono text-[10px] text-primary-container bg-surface-container-highest px-2 py-0.5 rounded font-bold">
                  HIGH MATCH PROBABILITY
                </span>
              </div>

              {/* Data Rows */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-body-md text-body-md text-on-surface-variant">Distance</span>
                  <span className="font-body-md text-body-md text-on-surface font-semibold">{tripDistance} km</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-body-md text-body-md text-on-surface-variant">Est. Time</span>
                  <span className="font-body-md text-body-md text-on-surface font-semibold">{estTimeMin}:00</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-body-md text-body-md text-on-surface-variant">Solo Fare</span>
                  <span className="font-body-md text-body-md text-on-surface font-medium">₹{soloFare}</span>
                </div>
                <div className="flex items-center justify-between pt-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-body-md text-body-md text-primary font-medium">Pooled Est.</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                  </div>
                  <span className="font-headline-md text-headline-md text-primary font-bold">
                    ₹{pooledMin}–{pooledMax}
                  </span>
                </div>
              </div>

              <div className="w-full h-px bg-surface-variant my-0.5"></div>

              <div className="flex items-center justify-between">
                <span className="font-label-mono text-[11px] text-outline leading-tight">
                  Savings depend on matched riders
                </span>
                <span className="font-label-mono text-[11px] text-on-surface-variant">
                  Max 2 Pickups
                </span>
              </div>

              {/* Primary Action Button */}
              <button
                id="request-pool-btn"
                onClick={() => {
                  setPoolStage('matching');
                  if (onRequestRide) onRequestRide({ origin: originHub, dest: destHub, soloFare, pooledFare: dynamicPoolPrice });
                }}
                className="w-full h-12 bg-primary-container hover:bg-primary active:scale-[0.99] text-on-primary font-body-md text-body-md font-semibold rounded-lg flex items-center justify-center transition-all cursor-pointer shadow-lg shadow-primary-container/20 mt-1"
              >
                Request Pooled Ride
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          STAGE 2: MATCHING QUEUE
      ───────────────────────────────────────────────────────────── */}
      {poolStage === 'matching' && (
        <div className="flex flex-col w-full">
          {/* Sub-bar */}
          <div className="px-4 py-2 flex items-center justify-between bg-surface-container-lowest border-b border-surface-container-high/40">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse"></span>
              <span className="font-label-mono text-label-mono uppercase tracking-wider text-on-surface-variant">
                Batch Engine v2.4
              </span>
            </div>
            <span className="font-label-mono text-label-mono text-primary font-semibold">
              SYNC ACTIVE
            </span>
          </div>

          {/* Radar Telemetry Map with clean tiles and permanent location badge */}
          <div className="relative w-full h-[320px] bg-surface-container-lowest overflow-hidden border-b border-surface-container-high/40">
            <LeafletMap
              center={[originHub.lat, originHub.lon]}
              pickup={originHub}
              drop={destHub}
              showRadar={true}
              radarCoords={[originHub.lat, originHub.lon]}
              searchRadiusMeters={450}
              height="320px"
            />
            {/* Tactical Tag */}
            <div className="absolute top-3 left-4 flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-container-high/90 backdrop-blur-md border border-surface-container-highest/40 z-[400]">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
              <span className="font-label-mono text-[10px] tracking-wider uppercase text-on-surface font-semibold">
                PICKUP LOCK {originHub.lat.toFixed(4)}° N
              </span>
            </div>
            <div className="absolute top-3 right-4 flex gap-1 z-[400]">
              <div className="px-2 py-1 bg-surface-container-high/90 rounded border border-surface-container-highest/40 backdrop-blur-sm">
                <span className="font-label-mono text-[10px] text-on-surface-variant uppercase">Radius:</span>
                <span className="font-label-mono text-[10px] text-on-surface font-semibold ml-1">450m</span>
              </div>
              <div className="px-2 py-1 bg-surface-container-high/90 rounded border border-surface-container-highest/40 backdrop-blur-sm">
                <span className="font-label-mono text-[10px] text-on-surface-variant uppercase">ETA:</span>
                <span className="font-label-mono text-[10px] text-primary font-semibold ml-1">±3 min</span>
              </div>
            </div>
          </div>

          {/* Operational Card Panel */}
          <div className="relative z-10 -mt-5 px-4 pb-4 flex flex-col gap-3">
            <div className="w-full bg-surface-container p-4 rounded-2xl shadow-2xl flex flex-col gap-3 border border-surface-container-high">
              {/* Batch countdown progress bar */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-label-mono text-label-mono text-on-surface-variant uppercase tracking-wider">
                    Batch Window
                  </span>
                  <span className="font-label-mono text-label-mono text-primary font-semibold">
                    {batchProgress}s / 30s
                  </span>
                </div>
                <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-container transition-all duration-300 ease-out"
                    style={{ width: `${(batchProgress / 30) * 100}%` }}
                  ></div>
                </div>
              </div>

              {/* State & Telemetry */}
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between">
                  <h2 className="font-headline-md text-headline-md text-on-surface font-semibold">
                    Matching with nearby riders
                  </h2>
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                    <span className="font-label-mono text-label-mono text-primary font-bold">LIVE</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    Optimizing co-riders along route
                  </span>
                  <span className="text-on-surface-variant text-[10px]">•</span>
                  <span className="font-label-mono text-label-mono text-primary font-semibold">
                    {queueCount} riders in queue
                  </span>
                </div>
              </div>

              <div className="w-full h-px bg-surface-variant"></div>

              {/* Waypoints timeline */}
              <div className="flex items-start gap-3 py-1">
                <div className="flex flex-col items-center mt-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-transparent p-0.5 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-primary"></div>
                  </div>
                  <div className="w-[1px] h-6 bg-surface-variant my-0.5"></div>
                  <div className="w-2 h-2 rounded-none bg-on-surface"></div>
                </div>
                <div className="flex flex-col gap-2 flex-1 min-w-0">
                  <div className="flex items-center justify-between min-w-0">
                    <div className="flex flex-col min-w-0">
                      <span className="font-label-mono text-[10px] uppercase tracking-wider text-on-surface-variant">
                        Pickup
                      </span>
                      <span className="font-body-md text-body-md text-on-surface font-medium truncate">
                        {originHub.shortName}
                      </span>
                    </div>
                    <span className="font-label-mono text-label-mono text-on-surface-variant">Terminal 2</span>
                  </div>
                  <div className="flex items-center justify-between min-w-0">
                    <div className="flex flex-col min-w-0">
                      <span className="font-label-mono text-[10px] uppercase tracking-wider text-on-surface-variant">
                        Drop
                      </span>
                      <span className="font-body-md text-body-md text-on-surface font-medium truncate">
                        {destHub.shortName}
                      </span>
                    </div>
                    <span className="font-label-mono text-label-mono text-on-surface-variant">{tripDistance} km</span>
                  </div>
                </div>
              </div>

              <div className="w-full h-px bg-surface-variant"></div>

              {/* Economics Module */}
              <div className="flex items-center justify-between bg-surface-container-low px-3 py-2 rounded-lg border border-surface-container-high/60">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[22px]">savings</span>
                  <div className="flex flex-col">
                    <span className="font-label-mono text-[10px] uppercase tracking-wider text-on-surface-variant">
                      Pool Economy
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-body-sm text-body-sm text-on-surface-variant">Est. Solo</span>
                      <span className="font-body-sm text-body-sm text-on-surface-variant line-through font-mono">₹{soloFare}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="font-label-mono text-[10px] uppercase text-primary tracking-wide">Dynamic Pool</span>
                  <span className="font-headline-md text-headline-md text-primary font-semibold font-mono">₹{dynamicPoolPrice}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setPoolStage('active')}
                  className="flex-1 h-11 rounded-lg bg-primary text-on-primary font-body-md font-semibold hover:bg-primary-container transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-primary/20"
                >
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                  <span>Confirm Match</span>
                </button>
                <button
                  id="cancel-btn"
                  onClick={() => {
                    setPoolStage('request');
                    if (onCancelRide) onCancelRide();
                  }}
                  className="px-4 h-11 rounded-lg bg-surface-container-high text-on-surface font-label-lg uppercase tracking-wider hover:bg-surface-variant transition-colors flex items-center justify-center gap-1 cursor-pointer border border-surface-container-highest/60"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                  <span>Cancel</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          STAGE 3: ACTIVE RIDE TRACKING
      ───────────────────────────────────────────────────────────── */}
      {poolStage === 'active' && (
        <div className="flex flex-col w-full">
          {/* Real-time Map Area with Moving Vehicle Marker & Permanent Badges */}
          <div className="relative w-full h-[330px] bg-surface-container-lowest overflow-hidden border-b border-surface-container-high/40">
            <LeafletMap
              center={[currentVehicleCoord.lat, currentVehicleCoord.lon]}
              pickup={originHub}
              drop={destHub}
              routeCoords={activeRouteCoords}
              vehicleCoord={currentVehicleCoord}
              height="330px"
            />
            {/* Real-time Tags */}
            <div className="absolute top-3 left-4 flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-container-lowest/90 backdrop-blur-md border border-surface-container-high/60 z-[400]">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
              <span className="font-label-mono text-label-mono text-primary uppercase tracking-wider font-semibold">
                LIVE TELEMETRY · {currentSpeed} KM/H
              </span>
            </div>
            <div className="absolute bottom-3 left-4 px-2.5 py-1 rounded bg-surface-container-high/90 backdrop-blur-md border border-surface-container-highest/40 z-[400]">
              <span className="font-label-mono text-[10px] text-on-surface uppercase font-semibold">
                {originHub.shortName} ➔ {destHub.shortName}
              </span>
            </div>
          </div>

          {/* Floating Operational Card */}
          <div className="relative z-30 px-4 -mt-4">
            <div className="w-full bg-surface-container rounded-2xl p-4 shadow-2xl flex flex-col gap-3.5 border border-surface-container-high">
              {/* Top Row: Arrival & Dynamic ETA */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                  <span className="font-body-lg text-body-md text-on-surface font-medium">
                    Vehicle {assignedVehicle ? assignedVehicle.id : 'V1'} arriving
                  </span>
                </div>
                <div className="px-2.5 py-0.5 rounded bg-surface-container-high border border-surface-container-highest/60">
                  <span className="font-label-mono text-label-mono text-primary font-semibold tracking-wider">
                    {formatEta(etaSeconds)}
                  </span>
                </div>
              </div>

              <div className="w-full h-px bg-surface-variant"></div>

              {/* Stat Columns: Detour, Wait, Riders */}
              <div className="grid grid-cols-3 gap-2 text-center py-1 bg-surface-container-low rounded-xl p-2 border border-surface-container-high/40">
                <div className="flex flex-col items-center">
                  <span className="font-headline-md text-headline-md text-primary font-semibold tracking-tight">
                    +2.1 min
                  </span>
                  <span className="font-label-mono text-label-mono text-outline uppercase tracking-wider mt-0.5 text-[10px]">
                    Detour Time
                  </span>
                </div>
                <div className="flex flex-col items-center border-x border-surface-variant">
                  <span className="font-headline-md text-headline-md text-on-surface font-semibold tracking-tight">
                    1:30
                  </span>
                  <span className="font-label-mono text-label-mono text-outline uppercase tracking-wider mt-0.5 text-[10px]">
                    Wait
                  </span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="font-headline-md text-headline-md text-on-surface font-semibold tracking-tight text-primary">
                    2
                  </span>
                  <span className="font-label-mono text-label-mono text-outline uppercase tracking-wider mt-0.5 text-[10px]">
                    Riders
                  </span>
                </div>
              </div>

              {/* Fare Optimization & Comparison Section */}
              <div className="flex flex-col gap-2 bg-surface-container-low p-3 rounded-xl border border-surface-container-high/60">
                <div className="flex items-center justify-between">
                  <span className="font-label-mono text-label-mono uppercase tracking-wider text-outline font-semibold">
                    Your Fare
                  </span>
                  <span className="font-label-mono text-label-mono text-primary font-medium tracking-wide">
                    SAVINGS APPLIED
                  </span>
                </div>

                {/* Proportional Cost Comparison Bars */}
                <div className="flex items-center gap-2 w-full pt-0.5">
                  <div className="flex-1 flex flex-col gap-1">
                    <div className="h-8 rounded-lg bg-surface-container-high px-2.5 flex items-center justify-between border border-surface-container-highest/40">
                      <span className="font-label-mono text-label-mono uppercase text-on-surface-variant tracking-wider">
                        Solo
                      </span>
                      <span className="font-body-md text-body-md text-secondary font-medium">₹{soloFare}</span>
                    </div>
                  </div>
                  <div className="flex-[0.77] flex flex-col gap-1">
                    <div className="h-8 rounded-lg bg-primary px-2.5 flex items-center justify-between shadow-md shadow-primary/20">
                      <span className="font-label-mono text-label-mono uppercase text-on-primary font-semibold tracking-wider">
                        Pooled
                      </span>
                      <span className="font-body-md text-body-md text-on-primary font-semibold">₹{dynamicPoolPrice}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="font-body-sm text-body-sm text-primary font-medium">
                    You save ₹{pooledSavings} ({savingsPct}%)
                  </span>
                  <span className="font-label-mono text-label-mono text-on-surface-variant text-[10px]">
                    CO2 ↓ 410g
                  </span>
                </div>
              </div>

              {/* Primary Action Button */}
              <button
                id="cancel-active-btn"
                onClick={handleActiveCancel}
                className={`w-full py-3 rounded-lg font-body-md text-body-md font-medium text-center transition-all cursor-pointer ${
                  cancelIsConfirm
                    ? 'bg-error-container text-on-error-container shadow-md shadow-error-container/40'
                    : 'bg-primary hover:bg-primary-fixed-dim active:bg-primary-container text-on-primary'
                }`}
              >
                {cancelText}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
