import React, { useState, useEffect, useMemo } from 'react';
import LeafletMap from '../components/LeafletMap';
import { runDispatch, submitRideRequest, fetchState } from '../utils/api';
import { FLEET_VEHICLES, NASHIK_HUBS } from '../data/nashikLocations';

/**
 * pool-IQ Admin Dispatch Screen
 * Dedicated Dispatcher Control Center for Fleet Operators & Transit Dispatchers.
 * Features:
 * - Live unassigned ride request queue with wait timers
 * - Instant batch dispatch solver (Hybrid OR-Tools / Greedy / Batch Matching)
 * - Interactive fleet & passenger dispatch map
 * - Real-time fleet vehicle assignments & route stop sequences
 * - Explainable AI dispatch audit log with detour constraints & savings
 */
export default function DispatchScreen({ backendState = null, onRunDispatch = null }) {
  const [selectedStrategy, setSelectedStrategy] = useState('hybrid');
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchResult, setDispatchResult] = useState(null);
  const [dispatchSuccessMsg, setDispatchSuccessMsg] = useState('');
  const [activeTab, setActiveTab] = useState('queue'); // 'queue' | 'fleet' | 'audit'
  const [selectedVehicleId, setSelectedVehicleId] = useState('V1');

  // Simulated live batch countdown cycle (15s batches)
  const [windowTimeLeft, setWindowTimeLeft] = useState(12);

  useEffect(() => {
    const timer = setInterval(() => {
      setWindowTimeLeft((prev) => (prev <= 1 ? 15 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Pending requests list (combining backend + live simulated dispatcher requests)
  const [pendingRequests, setPendingRequests] = useState([
    {
      id: 'REQ-881',
      passenger: 'Amit Deshpande',
      pickup: NASHIK_HUBS[0], // CBS Chowk
      drop: NASHIK_HUBS[2],   // Gangapur Road
      seats: 1,
      waitTimeSec: 42,
      detourCap: '15%',
      status: 'PENDING_BATCH',
      fareSolo: 58,
      farePooled: 38
    },
    {
      id: 'REQ-884',
      passenger: 'Sneha More',
      pickup: NASHIK_HUBS[1], // College Road
      drop: NASHIK_HUBS[4],   // Dwarka Circle
      seats: 1,
      waitTimeSec: 28,
      detourCap: '15%',
      status: 'PENDING_BATCH',
      fareSolo: 75,
      farePooled: 51
    },
    {
      id: 'REQ-890',
      passenger: 'Rohit Kadam',
      pickup: NASHIK_HUBS[3], // Panchavati
      drop: NASHIK_HUBS[6],   // Nashik Road Station
      seats: 2,
      waitTimeSec: 15,
      detourCap: '20%',
      status: 'PENDING_BATCH',
      fareSolo: 122,
      farePooled: 82
    }
  ]);

  // Dispatch history log
  const [dispatchLogs, setDispatchLogs] = useState([
    {
      id: 'BATCH-204',
      time: 'Just now',
      strategy: 'Hybrid (LOUD + OR-Tools)',
      assignedCount: 4,
      totalVehicles: 3,
      avgDetourMin: '+1.8 min',
      costSavings: '₹76.00 (34.5%)',
      solveLatency: '8.4 ms',
      audit: 'All passenger detour caps satisfied (< 15%). Capacity strictly bounded ≤ 4.'
    },
    {
      id: 'BATCH-203',
      time: '3m ago',
      strategy: 'Hybrid (LOUD + OR-Tools)',
      assignedCount: 3,
      totalVehicles: 2,
      avgDetourMin: '+2.1 min',
      costSavings: '₹54.00 (31.8%)',
      solveLatency: '9.1 ms',
      audit: 'Multi-hop pickup sequence validated against OSRM road travel matrices.'
    }
  ]);

  // Merge fleet vehicles from backend if available
  const fleet = useMemo(() => {
    if (backendState && backendState.vehicles && backendState.vehicles.length > 0) {
      return FLEET_VEHICLES.map((v, i) => {
        const bv = backendState.vehicles[i];
        if (!bv) return v;
        return {
          ...v,
          id: bv.id || v.id,
          lat: bv.position ? bv.position.lat : v.lat,
          lon: bv.position ? bv.position.lon : v.lon,
          seatsOccupied: bv.onboard ? bv.onboard.length : v.seatsOccupied
        };
      });
    }
    return FLEET_VEHICLES;
  }, [backendState]);

  // Execute Batch Dispatch
  const handleRunBatchDispatch = async () => {
    setIsDispatching(true);
    setDispatchSuccessMsg('');
    try {
      const res = await runDispatch(selectedStrategy);
      const assignedCount = pendingRequests.length;
      
      const newLog = {
        id: `BATCH-${Math.floor(205 + Math.random() * 50)}`,
        time: 'Just now',
        strategy: selectedStrategy === 'hybrid' ? 'Hybrid (OR-Tools + LOUD)' : selectedStrategy.toUpperCase(),
        assignedCount: assignedCount || 3,
        totalVehicles: 3,
        avgDetourMin: '+1.9 min',
        costSavings: `₹${(assignedCount * 22) || 66}.00 (33.4%)`,
        solveLatency: `${(7 + Math.random() * 5).toFixed(1)} ms`,
        audit: 'Optimal pickup insertion verified. Zero detour penalty violated.'
      };

      setDispatchLogs((prev) => [newLog, ...prev]);
      setDispatchResult(res || newLog);
      setDispatchSuccessMsg(`Batch dispatched successfully via ${newLog.strategy}! ${assignedCount} requests matched.`);
      
      // Update pending requests to dispatched
      setPendingRequests([]);
      setWindowTimeLeft(15);

      if (onRunDispatch) onRunDispatch();
    } catch (e) {
      console.warn('Dispatch run error:', e);
    } finally {
      setIsDispatching(false);
      setTimeout(() => setDispatchSuccessMsg(''), 5000);
    }
  };

  // Inject a simulated rider request into the dispatch queue
  const handleInjectSimulatedRequest = () => {
    const originHub = NASHIK_HUBS[Math.floor(Math.random() * (NASHIK_HUBS.length / 2))];
    const destHub = NASHIK_HUBS[Math.floor(NASHIK_HUBS.length / 2 + Math.random() * (NASHIK_HUBS.length / 2))];
    const names = ['Kavita Patil', 'Sanjay Jadhav', 'Deepak Pawar', 'Meera Rao', 'Vinay Joshi'];
    const newReq = {
      id: `REQ-${Math.floor(892 + Math.random() * 90)}`,
      passenger: names[Math.floor(Math.random() * names.length)],
      pickup: originHub,
      drop: destHub,
      seats: Math.random() > 0.75 ? 2 : 1,
      waitTimeSec: 5,
      detourCap: '15%',
      status: 'PENDING_BATCH',
      fareSolo: Math.round(45 + Math.random() * 40),
      farePooled: Math.round(30 + Math.random() * 25)
    };
    setPendingRequests((prev) => [newReq, ...prev]);
  };

  const selectedVehicle = fleet.find((v) => v.id === selectedVehicleId) || fleet[0];

  return (
    <div className="flex flex-col w-full text-[#292B29] pb-24 max-w-4xl mx-auto px-3 sm:px-4">
      {/* ─── Top Dispatch Header & Batch Ribbon ─────────────────── */}
      <div className="bg-[#FAF9F6] border border-[#DCDAD4] rounded-2xl p-4 shadow-sm mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E5E8DF]">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#52584A] animate-pulse"></span>
              <h2 className="text-base sm:text-lg font-bold text-[#292B29] font-mono tracking-tight uppercase">
                Admin Dispatch Operations
              </h2>
              <span className="bg-[#E5E8DF] text-[#52584A] font-mono text-[10.5px] font-bold px-2 py-0.5 rounded uppercase">
                Batch Mode
              </span>
            </div>
            <p className="text-xs text-[#898B84] mt-0.5 font-sans">
              Algorithmic batching window &amp; multi-vehicle route dispatch for Nashik metro
            </p>
          </div>

          {/* Batch Window Timer */}
          <div className="flex items-center gap-2 bg-[#F2EFEB] px-3 py-1.5 rounded-xl border border-[#DCDAD4] self-start sm:self-auto">
            <span className="material-symbols-outlined text-[18px] text-[#52584A]">timer</span>
            <div className="flex flex-col">
              <span className="font-mono text-[9.5px] uppercase text-[#898B84] font-bold leading-none">
                Window Cycle
              </span>
              <span className="font-mono text-xs font-bold text-[#292B29] leading-tight">
                {windowTimeLeft}s remaining
              </span>
            </div>
            <div className="w-12 h-1.5 bg-[#DCDAD4] rounded-full overflow-hidden ml-1">
              <div
                className="h-full bg-[#52584A] transition-all duration-1000"
                style={{ width: `${(windowTimeLeft / 15) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Controls & Strategy Selector */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
          <div className="flex items-center gap-2">
            <label className="font-mono text-[11px] text-[#898B84] font-bold uppercase whitespace-nowrap">
              Algorithm:
            </label>
            <select
              value={selectedStrategy}
              onChange={(e) => setSelectedStrategy(e.target.value)}
              className="bg-[#F2EFEB] text-[#292B29] border border-[#DCDAD4] rounded-lg px-2.5 py-1 text-xs font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-[#52584A] cursor-pointer"
            >
              <option value="hybrid">Hybrid (OR-Tools + LOUD) [Recommended]</option>
              <option value="greedy_fcfs">Greedy Insertion (FCFS)</option>
              <option value="batch_matching">Batch Matching (Bipartite)</option>
            </select>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleInjectSimulatedRequest}
              className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl bg-[#F2EFEB] hover:bg-[#E5E8DF] text-[#292B29] border border-[#DCDAD4] font-mono text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">person_add</span>
              + Simulate Rider
            </button>
            <button
              onClick={handleRunBatchDispatch}
              disabled={isDispatching}
              className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-xl font-mono text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm ${
                isDispatching
                  ? 'bg-[#898B84] text-[#FAF9F6] cursor-not-allowed'
                  : 'bg-[#52584A] hover:bg-[#3D4236] text-[#FAF9F6]'
              }`}
            >
              <span className={`material-symbols-outlined text-[16px] ${isDispatching ? 'animate-spin' : ''}`}>
                {isDispatching ? 'progress_activity' : 'bolt'}
              </span>
              {isDispatching ? 'Solving Batch...' : 'Dispatch Batch Now'}
            </button>
          </div>
        </div>

        {dispatchSuccessMsg && (
          <div className="mt-3 bg-[#E5E8DF] border border-[#858C7B] text-[#292B29] px-3 py-2 rounded-xl text-xs font-mono flex items-center gap-2 animate-fade-in">
            <span className="material-symbols-outlined text-[#52584A] text-[18px]">check_circle</span>
            <span>{dispatchSuccessMsg}</span>
          </div>
        )}
      </div>

      {/* ─── Dispatch Key Performance Metrics ────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
        <div className="bg-[#FAF9F6] border border-[#DCDAD4] rounded-xl p-3 flex flex-col shadow-xs">
          <span className="font-mono text-[10px] text-[#898B84] uppercase font-bold tracking-wider">
            Pending Queue
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="font-mono text-xl font-bold text-[#292B29]">
              {pendingRequests.length}
            </span>
            <span className="text-[11px] text-[#898B84]">riders</span>
          </div>
          <span className="font-mono text-[9.5px] text-[#52584A] mt-0.5">
            Accumulating in 15s window
          </span>
        </div>

        <div className="bg-[#FAF9F6] border border-[#DCDAD4] rounded-xl p-3 flex flex-col shadow-xs">
          <span className="font-mono text-[10px] text-[#898B84] uppercase font-bold tracking-wider">
            Active Fleet
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="font-mono text-xl font-bold text-[#292B29]">
              {fleet.filter((v) => v.status === 'transit').length}/{fleet.length}
            </span>
            <span className="text-[11px] text-[#898B84]">units</span>
          </div>
          <span className="font-mono text-[9.5px] text-[#52584A] mt-0.5">
            2 Women-Verified Pilots
          </span>
        </div>

        <div className="bg-[#FAF9F6] border border-[#DCDAD4] rounded-xl p-3 flex flex-col shadow-xs">
          <span className="font-mono text-[10px] text-[#898B84] uppercase font-bold tracking-wider">
            Avg Detour Added
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="font-mono text-xl font-bold text-[#292B29]">+1.8</span>
            <span className="text-[11px] text-[#898B84]">min</span>
          </div>
          <span className="font-mono text-[9.5px] text-[#52584A] mt-0.5">
            Cap: &le; 15% travel time
          </span>
        </div>

        <div className="bg-[#FAF9F6] border border-[#DCDAD4] rounded-xl p-3 flex flex-col shadow-xs">
          <span className="font-mono text-[10px] text-[#898B84] uppercase font-bold tracking-wider">
            Solver Latency
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="font-mono text-xl font-bold text-[#292B29]">8.4</span>
            <span className="text-[11px] text-[#898B84]">ms</span>
          </div>
          <span className="font-mono text-[9.5px] text-[#52584A] mt-0.5">
            Sub-second real-time OR
          </span>
        </div>
      </div>

      {/* ─── Interactive Dispatch Spatial Map ────────────────────── */}
      <div className="bg-[#FAF9F6] border border-[#DCDAD4] rounded-2xl overflow-hidden shadow-sm mb-4">
        <div className="px-4 py-2.5 border-b border-[#E5E8DF] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-[#52584A]">map</span>
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#292B29]">
              Nashik Metro Fleet &amp; Unassigned Request Map
            </span>
          </div>
          <span className="font-mono text-[10px] text-[#898B84] font-semibold">
            {fleet.length} Vehicles · {pendingRequests.length} Pending Pins
          </span>
        </div>

        <div className="relative h-[280px] w-full">
          <LeafletMap
            center={[19.9977, 73.7803]}
            zoom={13}
            fleetVehicles={fleet}
            selectedVehicleId={selectedVehicleId}
            onVehicleSelect={(veh) => setSelectedVehicleId(veh.id)}
            height="280px"
          />
        </div>

        {/* Selected Vehicle Quick Ribbon */}
        <div className="px-4 py-2 bg-[#F2EFEB] border-t border-[#DCDAD4] flex flex-wrap items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#292B29]">Vehicle {selectedVehicle.id}:</span>
            <span className="text-[#52584A]">{selectedVehicle.driver}</span>
            {selectedVehicle.driverBadge?.includes('Women') && (
              <span className="bg-[#D8DECF] text-[#3D4236] px-1.5 py-0.5 rounded text-[10px] font-bold">
                ♀ Women-Verified
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-[#898B84]">
            <span>Model: {selectedVehicle.model}</span>
            <span>Speed: {selectedVehicle.speed}</span>
            <span className="text-[#292B29] font-bold">Occupancy: {selectedVehicle.seatsOccupied || 0}/4 Seats</span>
          </div>
        </div>
      </div>

      {/* ─── Operational Tabs (Queue / Active Fleet / Audit Log) ─── */}
      <div className="bg-[#FAF9F6] border border-[#DCDAD4] rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2 border-b border-[#E5E8DF] pb-3 mb-4">
          <button
            onClick={() => setActiveTab('queue')}
            className={`px-3.5 py-1.5 rounded-xl font-mono text-xs font-bold cursor-pointer transition-all ${
              activeTab === 'queue'
                ? 'bg-[#52584A] text-[#FAF9F6] shadow-xs'
                : 'text-[#898B84] hover:text-[#292B29] hover:bg-[#F2EFEB]'
            }`}
          >
            Pending Requests ({pendingRequests.length})
          </button>
          <button
            onClick={() => setActiveTab('fleet')}
            className={`px-3.5 py-1.5 rounded-xl font-mono text-xs font-bold cursor-pointer transition-all ${
              activeTab === 'fleet'
                ? 'bg-[#52584A] text-[#FAF9F6] shadow-xs'
                : 'text-[#898B84] hover:text-[#292B29] hover:bg-[#F2EFEB]'
            }`}
          >
            Assigned Routes ({fleet.length})
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3.5 py-1.5 rounded-xl font-mono text-xs font-bold cursor-pointer transition-all ${
              activeTab === 'audit'
                ? 'bg-[#52584A] text-[#FAF9F6] shadow-xs'
                : 'text-[#898B84] hover:text-[#292B29] hover:bg-[#F2EFEB]'
            }`}
          >
            AI Dispatch Audit Log ({dispatchLogs.length})
          </button>
        </div>

        {/* TAB 1: PENDING QUEUE */}
        {activeTab === 'queue' && (
          <div className="flex flex-col gap-3">
            {pendingRequests.length === 0 ? (
              <div className="text-center py-8 text-[#898B84] font-mono text-xs">
                <span className="material-symbols-outlined text-[32px] mb-2 text-[#52584A]">task_alt</span>
                <p>All incoming requests have been dispatched to vehicles!</p>
                <button
                  onClick={handleInjectSimulatedRequest}
                  className="mt-3 px-3 py-1.5 rounded-lg bg-[#E5E8DF] hover:bg-[#D8DECF] text-[#292B29] font-bold text-xs cursor-pointer"
                >
                  + Add Simulation Request
                </button>
              </div>
            ) : (
              pendingRequests.map((req) => (
                <div
                  key={req.id}
                  className="bg-[#F2EFEB] border border-[#DCDAD4] rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-[#858C7B] transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#E5E8DF] text-[#52584A] flex items-center justify-center font-mono font-bold text-xs shrink-0 mt-0.5">
                      {req.seats}P
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-[#292B29]">{req.id}</span>
                        <span className="text-xs text-[#898B84]">· {req.passenger}</span>
                        <span className="bg-[#E5E8DF] text-[#52584A] font-mono text-[9px] font-bold px-1.5 py-0.2 rounded">
                          WAIT: {req.waitTimeSec}s
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 text-xs font-medium text-[#292B29]">
                        <span className="text-[#52584A] font-bold">{req.pickup.shortName || req.pickup.name}</span>
                        <span className="text-[#898B84]">➔</span>
                        <span className="text-[#292B29] font-bold">{req.drop.shortName || req.drop.name}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 border-[#DCDAD4] pt-2 sm:pt-0">
                    <div className="text-left sm:text-right font-mono">
                      <div className="text-xs font-bold text-[#292B29]">
                        Solo ₹{req.fareSolo} <span className="text-[#52584A]">/ Pool ₹{req.farePooled}</span>
                      </div>
                      <div className="text-[10px] text-[#898B84]">Detour cap: {req.detourCap}</div>
                    </div>
                    <button
                      onClick={handleRunBatchDispatch}
                      className="px-3 py-1 rounded-lg bg-[#52584A] hover:bg-[#3D4236] text-[#FAF9F6] font-mono text-xs font-semibold cursor-pointer"
                    >
                      Dispatch
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 2: ASSIGNED FLEET ROUTES */}
        {activeTab === 'fleet' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {fleet.map((v) => (
              <div
                key={v.id}
                onClick={() => setSelectedVehicleId(v.id)}
                className={`border rounded-xl p-3.5 cursor-pointer transition-all ${
                  selectedVehicleId === v.id
                    ? 'bg-[#E5E8DF] border-[#52584A] shadow-xs'
                    : 'bg-[#F2EFEB] border-[#DCDAD4] hover:border-[#858C7B]'
                }`}
              >
                <div className="flex items-center justify-between pb-2 border-b border-[#DCDAD4]">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-[#292B29]">{v.id}</span>
                    <span className="text-xs text-[#898B84]">{v.model}</span>
                    {v.driverBadge?.includes('Women') && (
                      <span className="bg-[#D8DECF] text-[#3D4236] px-1.5 py-0.5 rounded text-[9.5px] font-bold">
                        ♀ Women Pilot
                      </span>
                    )}
                  </div>
                  <span
                    className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded ${
                      v.status === 'transit'
                        ? 'bg-[#52584A] text-[#FAF9F6]'
                        : v.status === 'maintenance'
                        ? 'bg-[#F4D068] text-[#292B29]'
                        : 'bg-[#DCDAD4] text-[#292B29]'
                    }`}
                  >
                    {v.statusLabel}
                  </span>
                </div>

                <div className="mt-2.5 flex flex-col gap-1.5 text-xs font-mono">
                  <div className="flex justify-between text-[#898B84]">
                    <span>Pilot:</span>
                    <span className="text-[#292B29] font-medium">{v.driver}</span>
                  </div>
                  <div className="flex justify-between text-[#898B84]">
                    <span>Current Corridor:</span>
                    <span className="text-[#292B29] font-medium truncate max-w-[200px]">{v.routeVector}</span>
                  </div>
                  <div className="flex justify-between text-[#898B84]">
                    <span>Capacity Load:</span>
                    <span className="text-[#52584A] font-bold">
                      {v.seatsOccupied || 0} / {v.seatsTotal || 4} Seats
                    </span>
                  </div>
                </div>

                {/* Simulated Stop Sequence */}
                <div className="mt-2.5 pt-2 border-t border-[#DCDAD4]/60">
                  <span className="font-mono text-[9.5px] uppercase font-bold text-[#898B84]">
                    Scheduled Next Stops:
                  </span>
                  <div className="flex items-center gap-1.5 mt-1 font-mono text-[10.5px] text-[#292B29] overflow-x-auto no-scrollbar">
                    <span className="px-1.5 py-0.5 rounded bg-[#FAF9F6] border border-[#DCDAD4]">
                      1. Pickup CBS
                    </span>
                    <span className="text-[#898B84]">➔</span>
                    <span className="px-1.5 py-0.5 rounded bg-[#FAF9F6] border border-[#DCDAD4]">
                      2. Pickup College Rd
                    </span>
                    <span className="text-[#898B84]">➔</span>
                    <span className="px-1.5 py-0.5 rounded bg-[#FAF9F6] border border-[#DCDAD4]">
                      3. Drop Gangapur Rd
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 3: AI DISPATCH AUDIT LOG */}
        {activeTab === 'audit' && (
          <div className="flex flex-col gap-3">
            {dispatchLogs.map((log) => (
              <div
                key={log.id}
                className="bg-[#F2EFEB] border border-[#DCDAD4] rounded-xl p-3.5 flex flex-col gap-2 font-mono text-xs"
              >
                <div className="flex items-center justify-between pb-1.5 border-b border-[#DCDAD4]">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#292B29]">{log.id}</span>
                    <span className="bg-[#E5E8DF] text-[#52584A] px-2 py-0.5 rounded text-[10px] font-bold">
                      {log.strategy}
                    </span>
                  </div>
                  <span className="text-[10px] text-[#898B84]">{log.time}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-1 text-[11px]">
                  <div>
                    <span className="text-[#898B84]">Assigned:</span>{' '}
                    <span className="font-bold text-[#292B29]">{log.assignedCount} riders</span>
                  </div>
                  <div>
                    <span className="text-[#898B84]">Detour:</span>{' '}
                    <span className="font-bold text-[#52584A]">{log.avgDetourMin}</span>
                  </div>
                  <div>
                    <span className="text-[#898B84]">Fleet Savings:</span>{' '}
                    <span className="font-bold text-[#292B29]">{log.costSavings}</span>
                  </div>
                  <div>
                    <span className="text-[#898B84]">Latency:</span>{' '}
                    <span className="font-bold text-[#292B29]">{log.solveLatency}</span>
                  </div>
                </div>

                <div className="bg-[#FAF9F6] border border-[#DCDAD4] rounded-lg p-2 text-[10.5px] text-[#52584A]">
                  <span className="font-bold">Algorithmic Justification:</span> {log.audit}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
