import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import PoolScreen from './pages/PoolScreen';
import JourneyScreen from './pages/JourneyScreen';
import FairnessScreen from './pages/FairnessScreen';
import RoutesScreen from './pages/RoutesScreen';
import StatsScreen from './pages/StatsScreen';
import FleetScreen from './pages/FleetScreen';
import DispatchScreen from './pages/DispatchScreen';
import ZeroTrustGate from './components/ZeroTrustGate';
import RouteDiffView from './components/RouteDiffView';
import {
  fetchHealth,
  fetchState,
  submitRideRequest,
  runDispatch,
  loadScenario,
  controlSim,
  fetchDistanceConfig,
  updateDistanceConfig,
  fetchTrafficStatus,
  setTrafficScenario,
  fetchFraudAlerts,
  fetchArenaBenchmark
} from './utils/api';
import { NASHIK_HUBS } from './data/nashikLocations';

export default function App() {
  const [userRole, setUserRole] = useState('passenger'); // 'passenger' | 'admin'
  const [activeTab, setActiveTab] = useState('pool'); // 'pool' | 'journey' | 'fairness' | 'routes' | 'stats' | 'fleet'
  const [poolStage, setPoolStage] = useState('request'); // 'request' | 'matching' | 'active'
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState('controls'); // 'controls' | 'traffic' | 'distance' | 'alerts' | 'arena'

  const handleRoleChange = (newRole) => {
    setUserRole(newRole);
    if (newRole === 'passenger') {
      if (activeTab === 'stats' || activeTab === 'fleet' || activeTab === 'dispatch') {
        setActiveTab('pool');
      }
    } else if (newRole === 'admin') {
      if (activeTab === 'journey' || activeTab === 'fairness' || activeTab === 'pool') {
        setActiveTab('dispatch');
      }
    }
  };

  const [backendStatus, setBackendStatus] = useState('Checking...');
  const [selectedScenario, setSelectedScenario] = useState('demo_5r_3v');
  const [selectedStrategy, setSelectedStrategy] = useState('hybrid');
  const [trafficMode, setTrafficMode] = useState('NORMAL');
  const [distanceConfig, setDistanceConfig] = useState(null);
  const [fraudAlerts, setFraudAlerts] = useState([]);
  const [arenaResults, setArenaResults] = useState(null);

  // Backend state cache
  const [backendState, setBackendState] = useState(null);
  const [activeRideRequest, setActiveRideRequest] = useState(null);
  const [assignedVehicle, setAssignedVehicle] = useState(null);

  // Poll backend health and state
  useEffect(() => {
    let mounted = true;

    async function poll() {
      const health = await fetchHealth();
      if (!mounted) return;
      if (health && health.status === 'ok') {
        setBackendStatus(`Online (${health.road_data})`);
        const state = await fetchState();
        if (state && mounted) {
          setBackendState(state);

          // If we have an active ride request, check if a vehicle was assigned
          if (activeRideRequest && state.vehicles) {
            const v = state.vehicles.find((veh) =>
              (veh.onboard || []).includes(activeRideRequest.id) ||
              (veh.route && veh.route.some((r) => r.request_id === activeRideRequest.id))
            );
            if (v) {
              setAssignedVehicle(v);
            }
          }
        }
      } else {
        setBackendStatus('Simulation Mode (Standalone)');
      }
    }

    poll();
    const interval = setInterval(poll, 2500);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [activeRideRequest]);

  // Load modal data when modal opens
  useEffect(() => {
    if (!showSettingsModal) return;
    fetchTrafficStatus().then((t) => t && setTrafficMode(t.mode));
    fetchDistanceConfig().then((d) => d && setDistanceConfig(d));
    fetchFraudAlerts().then((a) => a && setFraudAlerts(a));
  }, [showSettingsModal]);

  // Header Title calculation
  const getHeaderTitle = () => {
    if (activeTab === 'pool') {
      if (poolStage === 'request' || poolStage === 'matching') return 'Active Ride Tracking';
      return 'Live Pool';
    }
    if (activeTab === 'journey') return 'My Shared Journey';
    if (activeTab === 'fairness') return 'Fairness Vault';
    if (activeTab === 'routes') return 'Corridor Network';
    if (activeTab === 'stats') return 'Efficiency Hub';
    if (activeTab === 'fleet') return 'Fleet Telemetry';
    if (activeTab === 'dispatch') return 'Dispatch Operations';
    return 'pool-IQ';
  };

  const handleHeaderBack = () => {
    if (activeTab === 'pool') {
      if (poolStage === 'matching' || poolStage === 'active') {
        setPoolStage('request');
        return;
      }
    }
    setActiveTab('pool');
    setPoolStage('request');
  };

  const [preselectedHubs, setPreselectedHubs] = useState(null);

  const handleSelectCorridor = (corridor) => {
    setActiveTab('pool');
    setPoolStage('request');
    if (corridor && corridor.stops && corridor.stops.length > 0) {
      const firstStop = corridor.stops[0].toLowerCase();
      const lastStop = corridor.stops[corridor.stops.length - 1].toLowerCase();
      const originIdx = NASHIK_HUBS.findIndex(
        (h) => h.name.toLowerCase().includes(firstStop) || h.shortName.toLowerCase().includes(firstStop)
      );
      const destIdx = NASHIK_HUBS.findIndex(
        (h) => h.name.toLowerCase().includes(lastStop) || h.shortName.toLowerCase().includes(lastStop)
      );
      setPreselectedHubs({
        originIdx: originIdx >= 0 ? originIdx : 0,
        destIdx: destIdx >= 0 ? destIdx : 2
      });
    }
  };

  const handleRequestRide = async ({ origin, dest, sharedOrigin, soloFare, pooledFare }) => {
    const res = await submitRideRequest({
      pickup: origin,
      drop: dest,
      seats: 1
    });
    if (res && res.id) {
      setActiveRideRequest({
        id: res.id,
        origin,
        dest,
        sharedOrigin,
        soloFare,
        pooledFare
      });
    }
  };

  const handleCancelRide = () => {
    setActiveRideRequest(null);
    setAssignedVehicle(null);
    setPoolStage('request');
  };

  const handleDispatchRun = async () => {
    const res = await runDispatch(selectedStrategy);
    if (res) {
      alert(`Batch dispatched via ${res.strategy || 'Hybrid'}! Status: ${res.assigned ? `${res.assigned.length} assigned` : 'Success'}`);
      const state = await fetchState();
      if (state) setBackendState(state);
    } else {
      alert('Batch flush simulation triggered.');
    }
  };

  const handleScenarioChange = async (scenarioId) => {
    setSelectedScenario(scenarioId);
    const res = await loadScenario(scenarioId);
    if (res) {
      const state = await fetchState();
      if (state) setBackendState(state);
    }
  };

  const handleSimClock = async (action, speed = null) => {
    await controlSim(action, speed);
    const state = await fetchState();
    if (state) setBackendState(state);
  };

  const handleTrafficChange = async (mode) => {
    setTrafficMode(mode);
    await setTrafficScenario(mode);
  };

  const handleRunArena = async () => {
    const arena = await fetchArenaBenchmark(selectedScenario);
    if (arena) {
      setArenaResults(arena);
    }
  };

  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col antialiased selection:bg-primary-container selection:text-on-primary-container">
      {/* Fixed Top Header */}
      <Header
        title={getHeaderTitle()}
        showBack={activeTab === 'pool' && poolStage !== 'request'}
        onBack={handleHeaderBack}
        onTuneClick={() => setShowSettingsModal(true)}
        userRole={userRole}
        setUserRole={handleRoleChange}
        backendStatus={backendStatus}
      />

      {/* Main Screen Content */}
      <main className="flex-1 flex flex-col relative w-full pt-14 pb-20 max-w-xl mx-auto">
        {activeTab === 'pool' && (
          <PoolScreen
            poolStage={poolStage}
            setPoolStage={setPoolStage}
            onRequestRide={handleRequestRide}
            onCancelRide={handleCancelRide}
            backendWindow={backendState ? backendState.window : null}
            assignedVehicle={assignedVehicle}
            preselectedHubs={preselectedHubs}
          />
        )}

        {activeTab === 'journey' && (
          <JourneyScreen
            activeRide={activeRideRequest}
            assignedVehicle={assignedVehicle}
          />
        )}

        {activeTab === 'fairness' && (
          <FairnessScreen />
        )}

        {activeTab === 'routes' && (
          <RoutesScreen onSelectCorridor={handleSelectCorridor} userRole={userRole} />
        )}

        {activeTab === 'stats' && (
          <StatsScreen backendMetrics={backendState ? backendState.metrics : null} />
        )}

        {activeTab === 'fleet' && (
          <FleetScreen backendVehicles={backendState ? backendState.vehicles : null} />
        )}

        {activeTab === 'dispatch' && (
          <DispatchScreen
            backendState={backendState}
            onRunDispatch={handleDispatchRun}
          />
        )}
      </main>

      {/* Fixed Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        userRole={userRole}
      />

      {/* Settings / Engine Telemetry & Controls Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-lg bg-surface-container rounded-2xl p-4 md:p-5 border border-surface-container-high shadow-2xl flex flex-col gap-3.5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-surface-container-high pb-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">tune</span>
                <h3 className="font-headline-md text-headline-md font-semibold text-on-surface">
                  Engine Telemetry &amp; Controls
                </h3>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-outline hover:text-on-surface hover:bg-surface-container-high cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar border-b border-surface-container-high pb-1">
              {[
                { id: 'controls', label: 'Controls' },
                { id: 'gate', label: 'Zero-Trust Gate' },
                { id: 'traffic', label: 'Traffic' },
                { id: 'distance', label: 'Distance' },
                { id: 'alerts', label: 'GPS Alerts' },
                { id: 'arena', label: 'Arena' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveModalTab(tab.id)}
                  className={`px-3 py-1 rounded-lg font-label-mono text-[11px] uppercase tracking-wider transition-colors cursor-pointer ${
                    activeModalTab === tab.id
                      ? 'bg-primary-container text-on-primary-container font-bold'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* TAB 1: CONTROLS */}
            {activeModalTab === 'controls' && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-low border border-surface-container-high/60">
                  <span className="font-label-mono text-label-mono text-outline uppercase">Backend State</span>
                  <span className="font-label-mono text-label-mono text-primary font-semibold">
                    {backendStatus}
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-label-mono text-[11px] text-outline uppercase">
                    Simulation Clock Actions
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSimClock('start')}
                      className="flex-1 h-9 rounded bg-surface-container-high hover:bg-primary hover:text-on-primary text-xs font-semibold uppercase font-label-mono transition-colors cursor-pointer"
                    >
                      Resume
                    </button>
                    <button
                      onClick={() => handleSimClock('pause')}
                      className="flex-1 h-9 rounded bg-surface-container-high hover:bg-surface-variant text-xs font-semibold uppercase font-label-mono transition-colors cursor-pointer"
                    >
                      Pause
                    </button>
                    <button
                      onClick={() => handleSimClock('reset')}
                      className="flex-1 h-9 rounded bg-surface-container-high hover:bg-surface-variant text-xs font-semibold uppercase font-label-mono transition-colors cursor-pointer"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-label-mono text-[11px] text-outline uppercase">
                    Load Scenario
                  </label>
                  <select
                    value={selectedScenario}
                    onChange={(e) => handleScenarioChange(e.target.value)}
                    className="w-full h-9 px-3 rounded bg-surface-container-high text-on-surface border border-surface-container-highest font-body-md text-xs focus:outline-none cursor-pointer"
                  >
                    <option value="demo_5r_3v">demo_5r_3v (5 riders, 3 vehicles)</option>
                    <option value="edge_capacity">edge_capacity (Max load edge case)</option>
                    <option value="edge_tight_window">edge_tight_window (Tight time window)</option>
                    <option value="stress_25r_100v">stress_25r_100v (High volume batch)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-label-mono text-[11px] text-outline uppercase">
                    Dispatch Strategy
                  </label>
                  <select
                    value={selectedStrategy}
                    onChange={(e) => setSelectedStrategy(e.target.value)}
                    className="w-full h-9 px-3 rounded bg-surface-container-high text-on-surface border border-surface-container-highest font-body-md text-xs focus:outline-none cursor-pointer"
                  >
                    <option value="hybrid">Hybrid (LOUD + OR-Tools / Batch)</option>
                    <option value="greedy_fcfs">Greedy FCFS</option>
                    <option value="loud_insertion">LOUD-inspired insertion</option>
                    <option value="batch_matching">Batch matching</option>
                  </select>
                </div>

                {backendState && (
                  <div className="grid grid-cols-2 gap-2 text-xs font-label-mono bg-surface-container-low p-2.5 rounded-lg border border-surface-container-high/60">
                    <div>Vehicles: <strong className="text-primary">{backendState.vehicles ? backendState.vehicles.length : 0}</strong></div>
                    <div>Requests: <strong className="text-primary">{backendState.requests ? backendState.requests.length : 0}</strong></div>
                    <div>Sim Clock: <strong className="text-on-surface">{Math.floor(backendState.sim_time || 0)}s</strong></div>
                    <div>Batch Window: <strong className="text-on-surface">{backendState.window ? `${backendState.window.elapsed_s}s` : '0s'}</strong></div>
                  </div>
                )}

                <button
                  onClick={handleDispatchRun}
                  className="w-full h-10 rounded-lg bg-primary text-on-primary font-body-md font-semibold hover:bg-primary-container transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-primary/20"
                >
                  <span className="material-symbols-outlined text-[18px]">bolt</span>
                  <span>Force Dispatch Run</span>
                </button>
              </div>
            )}

            {/* TAB: ZERO-TRUST GATE & DIFF VIEW */}
            {activeModalTab === 'gate' && (
              <div className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto pr-1">
                <ZeroTrustGate />
                <RouteDiffView />
              </div>
            )}

            {/* TAB 2: TRAFFIC */}
            {activeModalTab === 'traffic' && (
              <div className="flex flex-col gap-3">
                <span className="font-body-sm text-xs text-on-surface-variant">
                  Switch active traffic scenario to test congestion ETA updates and delay resilience:
                </span>
                {[
                  { mode: 'NORMAL', label: 'Normal Traffic (1.0x)', desc: 'Standard speed profile' },
                  { mode: 'FAST', label: 'Fast Traffic (0.8x)', desc: 'Early driver arrivals' },
                  { mode: 'MODERATE_CONGESTION', label: 'Moderate Congestion (1.25x)', desc: 'Slight transit delay' },
                  { mode: 'SEVERE_CONGESTION', label: 'Severe Congestion (1.50x)', desc: 'Triggers 50% delay warning' },
                  { mode: 'SUDDEN_SLOWDOWN', label: 'Sudden Slowdown (2.0x)', desc: 'Heavy bottleneck' }
                ].map((item) => (
                  <button
                    key={item.mode}
                    onClick={() => handleTrafficChange(item.mode)}
                    className={`p-2.5 rounded-lg text-left border flex items-center justify-between transition-all cursor-pointer ${
                      trafficMode === item.mode
                        ? 'bg-primary-container/20 border-primary text-primary'
                        : 'bg-surface-container-low border-surface-container-high hover:border-surface-variant'
                    }`}
                  >
                    <div>
                      <div className="font-label-mono text-xs font-semibold">{item.label}</div>
                      <div className="text-[11px] text-on-surface-variant">{item.desc}</div>
                    </div>
                    {trafficMode === item.mode && (
                      <span className="material-symbols-outlined text-primary text-[18px]">check_circle</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* TAB 3: DISTANCE CONFIG */}
            {activeModalTab === 'distance' && distanceConfig && (
              <div className="flex flex-col gap-2.5">
                <span className="font-body-sm text-xs text-on-surface-variant">
                  Backend-owned distance and pooling limits:
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs font-label-mono">
                  <div className="p-2 rounded bg-surface-container-low border border-surface-container-high/60">
                    <span className="text-outline block text-[10px]">INITIAL RADIUS</span>
                    <strong className="text-on-surface">{distanceConfig.initial_search_radius_m} m</strong>
                  </div>
                  <div className="p-2 rounded bg-surface-container-low border border-surface-container-high/60">
                    <span className="text-outline block text-[10px]">MAX RADIUS</span>
                    <strong className="text-on-surface">{distanceConfig.max_search_radius_m} m</strong>
                  </div>
                  <div className="p-2 rounded bg-surface-container-low border border-surface-container-high/60">
                    <span className="text-outline block text-[10px]">MAX DETOUR</span>
                    <strong className="text-on-surface">{Math.round(distanceConfig.max_detour_cap * 100)}%</strong>
                  </div>
                  <div className="p-2 rounded bg-surface-container-low border border-surface-container-high/60">
                    <span className="text-outline block text-[10px]">MAX WAIT</span>
                    <strong className="text-on-surface">{distanceConfig.max_pickup_wait_s} s</strong>
                  </div>
                  <div className="p-2 rounded bg-surface-container-low border border-surface-container-high/60">
                    <span className="text-outline block text-[10px]">VEHICLE CAPACITY</span>
                    <strong className="text-on-surface">{distanceConfig.vehicle_capacity} seats</strong>
                  </div>
                  <div className="p-2 rounded bg-surface-container-low border border-surface-container-high/60">
                    <span className="text-outline block text-[10px]">BASE FARE</span>
                    <strong className="text-on-surface">₹{distanceConfig.base_fare_per_km}/km</strong>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: GPS ALERTS */}
            {activeModalTab === 'alerts' && (
              <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
                <span className="font-body-sm text-xs text-on-surface-variant">
                  Authoritative location integrity observations:
                </span>
                {fraudAlerts.length === 0 ? (
                  <div className="p-4 text-center text-xs text-on-surface-variant font-label-mono bg-surface-container-low rounded-lg border border-surface-container-high/60">
                    No active GPS fraud or quarantined observations. Fleet telemetry verified clean.
                  </div>
                ) : (
                  fraudAlerts.map((alert, idx) => (
                    <div key={idx} className="p-2 rounded bg-surface-container-low border border-error/40 text-xs">
                      <div className="flex justify-between font-label-mono text-error font-semibold">
                        <span>{alert.entity_id}</span>
                        <span>Risk {alert.risk_score}</span>
                      </div>
                      <div className="text-[11px] text-on-surface-variant mt-1">{alert.reason}</div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB 5: ARENA */}
            {activeModalTab === 'arena' && (
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleRunArena}
                  className="w-full h-9 rounded bg-surface-container-high hover:bg-primary hover:text-on-primary text-xs font-semibold font-label-mono transition-colors cursor-pointer"
                >
                  Run Strategy Benchmark on {selectedScenario}
                </button>
                {arenaResults && arenaResults.strategies && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-label-mono border-collapse">
                      <thead>
                        <tr className="border-b border-surface-container-high text-outline text-[10px]">
                          <th className="py-1">Strategy</th>
                          <th className="py-1">Dist (km)</th>
                          <th className="py-1">Served</th>
                          <th className="py-1">Solve</th>
                        </tr>
                      </thead>
                      <tbody>
                        {arenaResults.strategies.map((st, i) => (
                          <tr key={i} className="border-b border-surface-container-high/40">
                            <td className="py-1.5 text-on-surface font-semibold">{st.name}</td>
                            <td className="py-1.5 text-primary">{st.pooled_km}</td>
                            <td className="py-1.5">{st.served_pct}%</td>
                            <td className="py-1.5 text-outline">{st.solve_ms}ms</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            <div className="border-t border-surface-container-high pt-2 flex justify-end">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-4 h-9 rounded-lg bg-surface-container-high text-on-surface font-label-mono text-xs uppercase hover:bg-surface-variant transition-colors cursor-pointer border border-surface-container-highest"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
