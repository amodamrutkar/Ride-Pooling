import React, { useState, useEffect, useMemo } from 'react';
import LeafletMap from '../components/LeafletMap';
import ZeroTrustGate from '../components/ZeroTrustGate';
import RouteDiffView from '../components/RouteDiffView';
import { fetchRoadRoute, getAccurateDistance } from '../utils/routing';
import { runDispatch } from '../utils/api';
import { NASHIK_HUBS } from '../data/nashikLocations';

export default function PoolScreen({
  poolStage,
  setPoolStage,
  onRequestRide,
  onCancelRide,
  backendWindow = null,
  assignedVehicle = null,
  preselectedHubs = null
}) {
  // Hubs selection: Default to PVG COE (Nashik) or user's saved preference
  const [originIndex, setOriginIndex] = useState(() => {
    const saved = localStorage.getItem('pooliq_preferred_hub');
    if (saved) {
      const idx = NASHIK_HUBS.findIndex((h) => h.id === saved);
      if (idx !== -1) return idx;
    }
    const pvgIdx = NASHIK_HUBS.findIndex((h) => h.id === 'pvg_coe');
    return pvgIdx !== -1 ? pvgIdx : 0;
  });
  const [destIndex, setDestIndex] = useState(2); // Gangapur Road

  // User Live Geolocation State
  const [useLiveLocation, setUseLiveLocation] = useState(false);
  const [liveLocation, setLiveLocation] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState('');
  const [outsideNashikAlert, setOutsideNashikAlert] = useState(null);

  // Search Modal / Popover State for Hubs
  const [searchModalType, setSearchModalType] = useState(null); // 'pickup' | 'drop' | null
  const [searchQuery, setSearchQuery] = useState('');

  // Filtered hubs for the quick location search modal
  const filteredHubs = useMemo(() => {
    if (!searchQuery.trim()) return NASHIK_HUBS;
    const q = searchQuery.toLowerCase().trim();
    return NASHIK_HUBS.filter(
      (h) =>
        h.name.toLowerCase().includes(q) ||
        h.shortName.toLowerCase().includes(q) ||
        (h.tag && h.tag.toLowerCase().includes(q))
    );
  }, [searchQuery]);

  // 1-Click Set to PVG's College of Engineering (Dindori Road, Mhasrul)
  const selectPvgAsPickup = () => {
    const pvgIdx = NASHIK_HUBS.findIndex((h) => h.id === 'pvg_coe');
    if (pvgIdx !== -1) {
      const pvg = NASHIK_HUBS[pvgIdx];
      setOriginIndex(pvgIdx);
      setLiveLocation({
        id: 'pvg_coe',
        name: pvg.name,
        shortName: pvg.shortName,
        lat: pvg.lat,
        lon: pvg.lon,
        accuracy: 5,
        isLiveGps: true,
        isWithinService: true
      });
      setUseLiveLocation(true);
      setOutsideNashikAlert(null);
      localStorage.setItem('pooliq_preferred_hub', 'pvg_coe');
      setLocationStatus("📍 Pickup set to PVG's College of Engineering (Dindori Rd, Mhasrul)");
      setTimeout(() => setLocationStatus(''), 4500);
    }
  };

  // Handle map click to set custom pinpoint pickup anywhere in Nashik
  const handleMapClick = (latlng) => {
    if (!latlng) return;
    const clickLat = Number(latlng.lat.toFixed(6));
    const clickLon = Number(latlng.lng.toFixed(6));

    // Find nearest landmark for context
    let nearestHub = NASHIK_HUBS[0];
    let minDis = 999999;
    for (const h of NASHIK_HUBS) {
      const d = Math.hypot((h.lat - clickLat) * 111, (h.lon - clickLon) * 104);
      if (d < minDis) {
        minDis = d;
        nearestHub = h;
      }
    }
    const distM = Math.round(minDis * 1000);
    
    // Check if specifically on PVG campus
    const distToPvg = Math.hypot((20.0369 - clickLat) * 111, (73.8007 - clickLon) * 104) * 1000;
    const shortDesc = distToPvg < 400
      ? 'PVG Campus (Dindori Rd)'
      : distM < 250
        ? nearestHub.shortName
        : `${distM}m from ${nearestHub.shortName}`;

    const customPinHub = {
      id: 'user_map_pin',
      name: `Pinned Pickup (${shortDesc})`,
      shortName: `Pin · ${shortDesc}`,
      lat: clickLat,
      lon: clickLon,
      accuracy: 5,
      isLiveGps: true
    };

    setLiveLocation(customPinHub);
    setUseLiveLocation(true);
    setOutsideNashikAlert(null);
    setLocationStatus(`📍 Pickup pinned to map near ${nearestHub.shortName}`);
    setTimeout(() => setLocationStatus(''), 4000);
  };

  const handleFetchLiveLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    setLocationStatus('Acquiring high-accuracy GPS fix...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const rawLat = Number(pos.coords.latitude.toFixed(6));
        const rawLon = Number(pos.coords.longitude.toFixed(6));
        const accuracy = Math.round(pos.coords.accuracy || 15);

        // Distance from Nashik Metropolitan Center (CBS Chowk: 19.9977, 73.7803)
        const dLat = (rawLat - 19.9977) * 111.0;
        const dLon = (rawLon - 73.7803) * 104.0;
        const distFromNashikKm = Math.round(Math.hypot(dLat, dLon));

        // PoolIQ operates exclusively within the Nashik Metropolitan transit network (radius ~35 km)
        const isWithinNashik = distFromNashikKm <= 35;

        if (isWithinNashik) {
          // USER IS PHYSICALLY IN NASHIK: Use exact live coordinates
          let nearestHub = NASHIK_HUBS[0];
          let minDis = 999999;
          for (const h of NASHIK_HUBS) {
            const d = Math.hypot((h.lat - rawLat) * 111, (h.lon - rawLon) * 104);
            if (d < minDis) {
              minDis = d;
              nearestHub = h;
            }
          }
          const distM = Math.round(minDis * 1000);

          // Check if right at PVG Nashik
          const distToPvg = Math.hypot((20.0369 - rawLat) * 111, (73.8007 - rawLon) * 104) * 1000;
          const shortDesc = distToPvg < 500
            ? 'PVG COE (Nashik)'
            : distM < 250
              ? nearestHub.shortName
              : `${distM}m from ${nearestHub.shortName}`;

          const userGpsHub = {
            id: 'user_live_gps',
            name: `Live Location (${shortDesc})`,
            shortName: `Live GPS · ${shortDesc}`,
            lat: rawLat,
            lon: rawLon,
            accuracy,
            isLiveGps: true,
            isWithinService: true
          };

          setLiveLocation(userGpsHub);
          setUseLiveLocation(true);
          setIsLocating(false);
          setOutsideNashikAlert(null);
          setLocationStatus(`📍 Live GPS locked: ${shortDesc} (±${accuracy}m accuracy)`);
          setTimeout(() => setLocationStatus(''), 4500);
        } else {
          // BROWSER/ISP REPORTED IP OUTSIDE NASHIK (e.g. telecom data center routing via Delhi 1017 km away)
          // DO NOT force-override their selection with CBS Chowk!
          // Alert user and offer instant 1-click lock to PVG Nashik or custom pin!
          setIsLocating(false);
          setOutsideNashikAlert({ distanceKm: distFromNashikKm });
          setLocationStatus('');
        }
      },
      (err) => {
        console.warn('Geolocation error:', err);
        setIsLocating(false);
        if (err.code === 1) {
          setLocationStatus('Location permission denied. Please pick a hub or pin on map.');
        } else if (err.code === 2) {
          setLocationStatus('GPS hardware unavailable. Switched to high-precision hubs.');
        } else if (err.code === 3) {
          setLocationStatus('GPS request timed out. Please retry or pin on map.');
        } else {
          setLocationStatus('Could not determine current location.');
        }
        setTimeout(() => setLocationStatus(''), 4000);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  // If corridor was chosen from Routes screen, apply its stops
  useEffect(() => {
    if (preselectedHubs) {
      if (typeof preselectedHubs.originIdx === 'number') {
        setOriginIndex(preselectedHubs.originIdx);
        setUseLiveLocation(false);
      }
      if (typeof preselectedHubs.destIdx === 'number') setDestIndex(preselectedHubs.destIdx);
    }
  }, [preselectedHubs]);

  const originHub = useMemo(() => {
    if (useLiveLocation && liveLocation) {
      return liveLocation;
    }
    return NASHIK_HUBS[originIndex] || NASHIK_HUBS[0];
  }, [useLiveLocation, liveLocation, originIndex]);

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

  // Accurate road metrics calculation based on Nashik Road Matrix & OSRM
  const accurateMetrics = useMemo(() => {
    return getAccurateDistance(originHub, destHub);
  }, [originHub, destHub]);

  const tripDistance = useMemo(() => {
    if (roadRoute && roadRoute.distanceKm && roadRoute.distanceKm > 0.5) {
      return roadRoute.distanceKm;
    }
    return accurateMetrics.km;
  }, [roadRoute, accurateMetrics]);

  const estTimeMin = useMemo(() => {
    if (roadRoute && roadRoute.durationMin && roadRoute.durationMin > 0) {
      return roadRoute.durationMin;
    }
    return accurateMetrics.min;
  }, [roadRoute, accurateMetrics]);

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

  // Matching window simulation and live queue count (fast dynamic 2s allocation)
  const [batchProgress, setBatchProgress] = useState(0.2);
  const [queueCount, setQueueCount] = useState(2);

  useEffect(() => {
    if (poolStage !== 'matching') {
      setBatchProgress(0.2);
      return;
    }
    const timer = setInterval(() => {
      setBatchProgress((prev) => {
        const next = Math.round((prev + 0.3) * 10) / 10;
        if (next >= 2.0) {
          clearInterval(timer);
          setPoolStage('active');
          return 2.0;
        }
        return next;
      });
      if (Math.random() > 0.5) {
        setQueueCount((q) => (q === 2 ? 3 : 2));
      }
    }, 250);
    return () => clearInterval(timer);
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
            <span className="px-2 py-0.5 rounded bg-primary-container/20 text-primary font-label-mono text-[10px] font-semibold">
              OSRM LIVE
            </span>
          </div>

          {/* Location Input Sequence */}
          <div className="px-4 pt-1 pb-3 flex flex-col gap-2">
            {/* Out-of-Nashik ISP Alert Banner with 1-click PVG lock */}
            {outsideNashikAlert && (
              <div className="bg-[#F3F2EF] border border-[#DCDAD4] p-3 rounded-xl flex flex-col gap-2.5 shadow-sm animate-fade-in">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[17px] text-[#52584A]">near_me_disabled</span>
                    <span className="font-mono text-xs font-bold text-on-surface">
                      ISP Geolocation ({outsideNashikAlert.distanceKm} km away)
                    </span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setOutsideNashikAlert(null)}
                    className="text-on-surface-variant hover:text-on-surface text-xs font-bold cursor-pointer p-0.5"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-[11px] text-on-surface-variant leading-relaxed">
                  Your network IP resolved outside Nashik. If you are currently at <strong>PVG Nashik Campus</strong>, lock your exact spot below:
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={selectPvgAsPickup}
                    className="px-3 py-1.5 rounded-lg bg-[#52584A] text-[#FAF9F6] text-xs font-bold font-mono flex items-center gap-1.5 hover:bg-[#3D4236] transition-all cursor-pointer shadow-xs"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse"></span>
                    <span>📍 Lock PVG Nashik (Campus)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const idx = NASHIK_HUBS.findIndex(h => h.id === 'college_rd');
                      if (idx !== -1) setOriginIndex(idx);
                      setUseLiveLocation(false);
                      setOutsideNashikAlert(null);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-medium cursor-pointer transition-all border border-surface-container-highest/60"
                  >
                    🎓 College Rd
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const idx = NASHIK_HUBS.findIndex(h => h.id === 'cbs');
                      if (idx !== -1) setOriginIndex(idx);
                      setUseLiveLocation(false);
                      setOutsideNashikAlert(null);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-medium cursor-pointer transition-all border border-surface-container-highest/60"
                  >
                    🏛️ CBS Chowk
                  </button>
                </div>
              </div>
            )}

            <div className="relative flex flex-col gap-2 bg-surface-container-low p-2.5 rounded-xl border border-surface-container-high/60 shadow-md">
              {/* Origin Node */}
              <div className="relative flex items-center h-12 bg-surface-container-high rounded-lg px-3 transition-all">
                <div className="w-3 flex justify-center items-center mr-3 shrink-0 z-10">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary-container shadow-[0_0_10px_#0ed4a8]"></div>
                </div>

                {useLiveLocation && liveLocation ? (
                  <div className="flex items-center justify-between flex-1 min-w-0 pr-1">
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#0ED4A8] animate-pulse"></span>
                        <span className="text-on-surface font-body-md text-sm font-bold truncate">
                          {liveLocation.shortName}
                        </span>
                      </div>
                      <span className="font-label-mono text-[9.5px] text-outline truncate">
                        GPS: {liveLocation.lat.toFixed(4)}, {liveLocation.lon.toFixed(4)} (±{liveLocation.accuracy}m)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSearchModalType('pickup');
                          setSearchQuery('');
                        }}
                        className="font-label-mono text-[10px] text-primary hover:underline font-semibold cursor-pointer whitespace-nowrap"
                      >
                        Search
                      </button>
                      <button
                        type="button"
                        onClick={() => setUseLiveLocation(false)}
                        className="font-label-mono text-[10px] text-outline hover:text-on-surface font-semibold cursor-pointer whitespace-nowrap"
                      >
                        Presets
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col min-w-0 flex-1">
                      <select
                        value={originIndex}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setOriginIndex(val);
                          localStorage.setItem('pooliq_preferred_hub', NASHIK_HUBS[val]?.id || 'cbs');
                        }}
                        className="bg-transparent text-on-surface font-body-md text-sm font-semibold focus:outline-none cursor-pointer"
                      >
                        {NASHIK_HUBS.map((hub, idx) => (
                          <option key={hub.id} value={idx} className="bg-surface-container text-on-surface">
                            {hub.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchModalType('pickup');
                        setSearchQuery('');
                      }}
                      className="p-1 rounded hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface transition-all cursor-pointer mr-1"
                      title="Search all Nashik hubs"
                    >
                      <span className="material-symbols-outlined text-[16px]">search</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleFetchLiveLocation}
                      disabled={isLocating}
                      className="px-2 py-1 rounded bg-[#E5E8DF] hover:bg-[#DCDAD4] text-[#292B29] font-mono text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all shrink-0 ml-1"
                      title="Fetch live location via GPS"
                    >
                      <span className={`material-symbols-outlined text-[13px] text-[#52584A] ${isLocating ? 'animate-spin' : ''}`}>
                        {isLocating ? 'progress_activity' : 'near_me'}
                      </span>
                      <span>{isLocating ? 'Locating...' : 'Use Live GPS'}</span>
                    </button>
                  </>
                )}

                <span className="font-label-mono text-label-mono text-primary uppercase tracking-wider text-[10px] font-bold ml-2">
                  Pickup
                </span>
              </div>

              {locationStatus && (
                <div className="text-[10px] font-mono text-[#52584A] bg-[#E5E8DF]/70 px-2.5 py-1 rounded-md flex items-center gap-1.5 animate-fade-in">
                  <span className="material-symbols-outlined text-[13px]">info</span>
                  <span>{locationStatus}</span>
                </div>
              )}

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
                <button
                  type="button"
                  onClick={() => {
                    setSearchModalType('drop');
                    setSearchQuery('');
                  }}
                  className="p-1 rounded hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface transition-all cursor-pointer mr-1"
                  title="Search destination hubs"
                >
                  <span className="material-symbols-outlined text-[16px]">search</span>
                </button>
                <span className="font-label-mono text-label-mono text-outline uppercase tracking-wider text-[10px]">
                  Drop
                </span>
              </div>
            </div>

            {/* Quick Location Selection Pills */}
            <div className="flex items-center gap-1.5 pt-0.5 overflow-x-auto no-scrollbar">
              <span className="font-label-mono text-[9px] uppercase tracking-wider text-outline shrink-0 font-bold">
                QUICK PICK:
              </span>
              <button
                type="button"
                onClick={selectPvgAsPickup}
                className={`px-2.5 py-1 rounded-full font-mono text-[10.5px] font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1.5 border shadow-2xs ${
                  originHub.id === 'pvg_coe'
                    ? 'bg-[#52584A] text-[#FAF9F6] border-[#52584A]'
                    : 'bg-surface-container-high hover:bg-surface-container-highest text-on-surface border-surface-container-highest/80'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse"></span>
                <span>📍 PVG Nashik</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const idx = NASHIK_HUBS.findIndex(h => h.id === 'college_rd');
                  if (idx !== -1) {
                    setOriginIndex(idx);
                    setUseLiveLocation(false);
                    localStorage.setItem('pooliq_preferred_hub', 'college_rd');
                  }
                }}
                className={`px-2 py-1 rounded-full font-mono text-[10px] font-medium shrink-0 transition-all cursor-pointer border ${
                  originHub.id === 'college_rd'
                    ? 'bg-[#52584A] text-[#FAF9F6] border-[#52584A]'
                    : 'bg-surface-container-high hover:bg-surface-container-highest text-on-surface border-surface-container-highest/60'
                }`}
              >
                🎓 College Rd
              </button>
              <button
                type="button"
                onClick={() => {
                  const idx = NASHIK_HUBS.findIndex(h => h.id === 'gangapur_rd');
                  if (idx !== -1) {
                    setOriginIndex(idx);
                    setUseLiveLocation(false);
                    localStorage.setItem('pooliq_preferred_hub', 'gangapur_rd');
                  }
                }}
                className={`px-2 py-1 rounded-full font-mono text-[10px] font-medium shrink-0 transition-all cursor-pointer border ${
                  originHub.id === 'gangapur_rd'
                    ? 'bg-[#52584A] text-[#FAF9F6] border-[#52584A]'
                    : 'bg-surface-container-high hover:bg-surface-container-highest text-on-surface border-surface-container-highest/60'
                }`}
              >
                🌿 Gangapur Rd
              </button>
              <button
                type="button"
                onClick={() => {
                  const idx = NASHIK_HUBS.findIndex(h => h.id === 'cbs');
                  if (idx !== -1) {
                    setOriginIndex(idx);
                    setUseLiveLocation(false);
                    localStorage.setItem('pooliq_preferred_hub', 'cbs');
                  }
                }}
                className={`px-2 py-1 rounded-full font-mono text-[10px] font-medium shrink-0 transition-all cursor-pointer border ${
                  originHub.id === 'cbs'
                    ? 'bg-[#52584A] text-[#FAF9F6] border-[#52584A]'
                    : 'bg-surface-container-high hover:bg-surface-container-highest text-on-surface border-surface-container-highest/60'
                }`}
              >
                🏛️ CBS Chowk
              </button>
              <button
                type="button"
                onClick={() => {
                  const idx = NASHIK_HUBS.findIndex(h => h.id === 'nashik_road');
                  if (idx !== -1) {
                    setOriginIndex(idx);
                    setUseLiveLocation(false);
                    localStorage.setItem('pooliq_preferred_hub', 'nashik_road');
                  }
                }}
                className={`px-2 py-1 rounded-full font-mono text-[10px] font-medium shrink-0 transition-all cursor-pointer border ${
                  originHub.id === 'nashik_road'
                    ? 'bg-[#52584A] text-[#FAF9F6] border-[#52584A]'
                    : 'bg-surface-container-high hover:bg-surface-container-highest text-on-surface border-surface-container-highest/60'
                }`}
              >
                🚆 Nashik Rd
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchModalType('pickup');
                  setSearchQuery('');
                }}
                className="px-2 py-1 rounded-full font-mono text-[10px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 shrink-0 transition-all cursor-pointer flex items-center gap-1 border border-primary/20"
              >
                <span className="material-symbols-outlined text-[13px]">search</span>
                <span>Search Hubs</span>
              </button>
            </div>
          </div>

          {/* Location Search Modal Popover */}
          {searchModalType && (
            <div 
              className="fixed inset-0 z-[1000] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
              onClick={() => setSearchModalType(null)}
            >
              <div 
                className="bg-[#FAF9F6] w-full max-w-md rounded-2xl border border-[#DCDAD4] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-3 border-b border-[#E5E8DF] flex items-center justify-between bg-surface-container-lowest">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#52584A] text-[18px]">
                      {searchModalType === 'pickup' ? 'trip_origin' : 'location_on'}
                    </span>
                    <span className="font-mono text-xs font-bold uppercase tracking-wider text-on-surface">
                      Select {searchModalType === 'pickup' ? 'Pickup Location' : 'Destination Drop'}
                    </span>
                  </div>
                  <button 
                    onClick={() => setSearchModalType(null)}
                    className="text-on-surface-variant hover:text-on-surface text-sm font-bold p-1 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-3 bg-surface-container-low border-b border-[#E5E8DF]">
                  <div className="relative flex items-center">
                    <span className="material-symbols-outlined absolute left-3 text-outline text-[18px]">search</span>
                    <input
                      type="text"
                      autoFocus
                      placeholder="Search PVG, College Rd, Dindori, Gangapur, CBS..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-surface rounded-lg text-sm text-on-surface border border-surface-container-high focus:outline-none focus:border-primary font-body-md"
                    />
                  </div>
                </div>

                <div className="overflow-y-auto p-2 flex flex-col gap-1 max-h-[350px]">
                  {filteredHubs.length === 0 ? (
                    <div className="p-6 text-center text-xs text-on-surface-variant font-mono">
                      No matching locations found in Nashik Metro.
                    </div>
                  ) : (
                    filteredHubs.map((hub) => {
                      const isSelected = searchModalType === 'pickup'
                        ? originHub.id === hub.id
                        : destHub.id === hub.id;
                      return (
                        <button
                          key={hub.id}
                          onClick={() => {
                            const hubIdx = NASHIK_HUBS.findIndex(h => h.id === hub.id);
                            if (searchModalType === 'pickup') {
                              if (hubIdx !== -1) setOriginIndex(hubIdx);
                              setUseLiveLocation(false);
                              localStorage.setItem('pooliq_preferred_hub', hub.id);
                            } else {
                              if (hubIdx !== -1) setDestIndex(hubIdx);
                            }
                            setSearchModalType(null);
                          }}
                          className={`w-full p-2.5 rounded-lg flex items-center justify-between text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#52584A] text-[#FAF9F6]'
                              : 'hover:bg-surface-container-high text-on-surface'
                          }`}
                        >
                          <div className="flex flex-col min-w-0 pr-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold truncate">{hub.name}</span>
                              {hub.id === 'pvg_coe' && (
                                <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                                  isSelected ? 'bg-white/20 text-white' : 'bg-[#10b981]/20 text-[#10b981]'
                                }`}>
                                  CAMPUS
                                </span>
                              )}
                            </div>
                            <span className={`text-[10px] font-mono truncate ${
                              isSelected ? 'text-white/80' : 'text-on-surface-variant'
                            }`}>
                              {hub.tag || 'Transit Hub'} · {hub.lat.toFixed(4)}°N, {hub.lon.toFixed(4)}°E
                            </span>
                          </div>
                          {isSelected && (
                            <span className="material-symbols-outlined text-[16px] text-white">check</span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

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
              onMapClick={handleMapClick}
            />
            {/* Interactive Tap Guide */}
            <div className="absolute bottom-2 left-3 bg-[#FAF9F6]/95 backdrop-blur-md px-2.5 py-1 rounded-md border border-[#DCDAD4] shadow-xs z-[400] flex items-center gap-1.5 pointer-events-none">
              <span className="w-1.5 h-1.5 rounded-full bg-[#52584A] animate-pulse"></span>
              <span className="font-mono text-[9px] text-[#292B29] font-bold uppercase tracking-wider">
                Tap anywhere on map to pin custom pickup
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
                    Dynamic Batch Allocation
                  </span>
                  <span className="font-label-mono text-label-mono text-primary font-semibold">
                    {batchProgress.toFixed(1)}s / 2.0s
                  </span>
                </div>
                <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-200 ease-out"
                    style={{ width: `${Math.min(100, (batchProgress / 2.0) * 100)}%` }}
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

              {/* Assigned Verified Woman Pilot Card */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-container-low border border-surface-container-high/60">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-xs font-mono">
                    PD
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-on-surface">Pooja Deshmukh</span>
                      <span className="px-1.5 py-0.2 rounded-full bg-primary/20 text-primary font-mono text-[9px] font-semibold">
                        Women-Verified Pilot
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-on-surface-variant">
                      Tata Tiago EV · IN-MH15-4109 · 4.95 ★
                    </span>
                  </div>
                </div>
                <span className="material-symbols-outlined text-[18px] text-primary">verified</span>
              </div>

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
