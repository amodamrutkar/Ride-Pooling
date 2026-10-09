import React, { useState, useEffect, useMemo } from 'react';
import LeafletMap from '../components/LeafletMap';
import { CORRIDORS } from '../data/nashikLocations';

/**
 * pool-IQ Optimized Corridors Screen
 * Features:
 * - Clean 3-way segregation: Express Radial Lines, Urban Arterials, Suburban Feeders
 * - Dual-role experience:
 *   - Passenger Mode: Clean route viewer with instant corridor booking
 *   - Admin Mode: Transit Operations Console with fleet vehicle allocation, headway control,
 *     capacity load monitoring, and congestion dampening.
 * - Map without text clutter (stop text badges only on active corridor).
 */
export default function RoutesScreen({ onSelectCorridor, userRole = 'passenger' }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'express' | 'arterial' | 'feeder'
  const [corridors, setCorridors] = useState(CORRIDORS);
  const [selectedCorridorId, setSelectedCorridorId] = useState('c-station');
  const [adminNotice, setAdminNotice] = useState('');

  // Live telemetry jitter
  useEffect(() => {
    const timer = setInterval(() => {
      setCorridors((prev) =>
        prev.map((c) => ({
          ...c,
          liveVehicles: Math.max(3, c.liveVehicles + (Math.random() > 0.6 ? 1 : -1) * (Math.random() > 0.8 ? 1 : 0)),
          matchRate: Math.min(99, Math.max(75, c.matchRate + (Math.random() > 0.5 ? 1 : -1)))
        }))
      );
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const handleFilterClick = (filterKey) => {
    setActiveFilter(filterKey);
    const matching = corridors.filter((c) => {
      if (filterKey === 'all') return true;
      return c.category === filterKey;
    });
    if (matching.length > 0) {
      const isAlreadyInMatching = matching.some((m) => m.id === selectedCorridorId);
      if (!isAlreadyInMatching) {
        setSelectedCorridorId(matching[0].id);
      }
    }
  };

  const filteredCorridors = useMemo(() => {
    return corridors.filter((c) => {
      const matchesFilter = activeFilter === 'all' || c.category === activeFilter;
      const matchesSearch =
        !searchTerm.trim() ||
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.subtitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.stops.some((s) => s.toLowerCase().includes(searchTerm.toLowerCase()));

      return matchesFilter && matchesSearch;
    });
  }, [corridors, activeFilter, searchTerm]);

  // Admin Fleet Allocation controls
  const handleAdjustFleet = (corridorId, delta) => {
    setCorridors((prev) =>
      prev.map((c) => {
        if (c.id === corridorId) {
          const updated = Math.max(2, Math.min(12, c.liveVehicles + delta));
          return {
            ...c,
            liveVehicles: updated,
            capacityTotal: updated * 4,
            headwayMin: Math.max(1.2, Number((14 / updated).toFixed(1)))
          };
        }
        return c;
      })
    );
    setAdminNotice(`Fleet allocated on ${corridorId.toUpperCase()}: ${delta > 0 ? '+1 Shuttle added' : '-1 Shuttle withdrawn'}`);
    setTimeout(() => setAdminNotice(''), 3500);
  };

  const handleRebalanceCorridor = (corridor) => {
    setAdminNotice(`⚡ Rebalanced standby fleet to ${corridor.code}! Headway tightened to 1.8 mins.`);
    setTimeout(() => setAdminNotice(''), 4000);
  };

  const totalActiveVehicles = useMemo(() => {
    return corridors.reduce((acc, c) => acc + c.liveVehicles, 0);
  }, [corridors]);

  const selectedCorridor = corridors.find((c) => c.id === selectedCorridorId) || corridors[0];

  return (
    <div className="flex flex-col w-full px-3.5 sm:px-4 gap-4 text-on-surface select-none pb-12 animate-fade-in max-w-4xl mx-auto">
      {/* ─── Header / Status Bar ──────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-b border-[#DCDAD4]/60 pb-3">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#898B84] font-bold">
              {userRole === 'admin' ? 'ADMIN DISPATCH CONSOLE' : 'LIVE TRANSIT NETWORK'}
            </span>
            {userRole === 'admin' && (
              <span className="bg-[#30312F] text-white px-2 py-0.5 rounded text-[9.5px] font-mono font-bold uppercase">
                Operations Mode
              </span>
            )}
          </div>
          <h1 className="font-sans text-xl md:text-2xl font-bold tracking-tight text-[#292B29]">
            {userRole === 'admin' ? 'Corridor Fleet & Capacity Management' : 'Optimized Metro Corridors'}
          </h1>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E5E8DF] border border-[#DCDAD4]">
            <span className="w-2 h-2 rounded-full bg-[#52584A] animate-pulse"></span>
            <span className="font-mono text-xs text-[#343B30] font-bold">
              {userRole === 'admin' ? `${totalActiveVehicles} Shuttles Deployed` : '98.5% Network Sync'}
            </span>
          </div>
        </div>
      </div>

      {/* Admin Notice Toast */}
      {adminNotice && (
        <div className="bg-[#E5E8DF] border border-[#52584A] text-[#292B29] px-3.5 py-2 rounded-xl text-xs font-mono flex items-center gap-2 animate-fade-in shadow-xs">
          <span className="material-symbols-outlined text-[#52584A] text-[18px]">verified</span>
          <span>{adminNotice}</span>
        </div>
      )}

      {/* ─── Admin Key Operational KPIs Bar ───────────────────── */}
      {userRole === 'admin' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="bg-[#FAF9F6] border border-[#DCDAD4] rounded-xl p-3 flex flex-col shadow-xs">
            <span className="font-mono text-[10px] text-[#898B84] uppercase font-bold tracking-wider">
              Network Lines
            </span>
            <span className="font-mono text-lg font-bold text-[#292B29] mt-0.5">9 Corridors</span>
            <span className="font-mono text-[9px] text-[#52584A]">3 Express · 3 Arterial · 3 Feeder</span>
          </div>
          <div className="bg-[#FAF9F6] border border-[#DCDAD4] rounded-xl p-3 flex flex-col shadow-xs">
            <span className="font-mono text-[10px] text-[#898B84] uppercase font-bold tracking-wider">
              Total Fleet Shuttles
            </span>
            <span className="font-mono text-lg font-bold text-[#292B29] mt-0.5">{totalActiveVehicles} Active</span>
            <span className="font-mono text-[9px] text-[#52584A]">100% Electric EV Transit</span>
          </div>
          <div className="bg-[#FAF9F6] border border-[#DCDAD4] rounded-xl p-3 flex flex-col shadow-xs">
            <span className="font-mono text-[10px] text-[#898B84] uppercase font-bold tracking-wider">
              Avg Dispatch Headway
            </span>
            <span className="font-mono text-lg font-bold text-[#292B29] mt-0.5">2.2 min</span>
            <span className="font-mono text-[9px] text-[#52584A]">Sub-3 min commuter sync</span>
          </div>
          <div className="bg-[#FAF9F6] border border-[#DCDAD4] rounded-xl p-3 flex flex-col shadow-xs">
            <span className="font-mono text-[10px] text-[#898B84] uppercase font-bold tracking-wider">
              Capacity Load Factor
            </span>
            <span className="font-mono text-lg font-bold text-[#292B29] mt-0.5">78.4%</span>
            <span className="font-mono text-[9px] text-[#52584A]">Zero seat starvation</span>
          </div>
        </div>
      )}

      {/* ─── Search & Segregated Filter Tabs ──────────────────── */}
      <section className="flex flex-col gap-2.5">
        <div className="relative w-full">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search area, stop, or corridor (e.g. Gangapur, Satpur, Dwarka)..."
            className="w-full h-11 px-3.5 pr-16 rounded-xl bg-[#FAF9F6] text-[#292B29] placeholder:text-[#898B84] font-sans text-xs focus:outline-none focus:ring-1 focus:ring-[#858C7B] border border-[#DCDAD4] shadow-xs transition-colors"
          />
          <span className="absolute right-3.5 top-3.5 font-mono text-[10px] text-[#898B84] uppercase tracking-wider font-bold">
            SEARCH
          </span>
        </div>

        {/* Clean 4-Way Segregated Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          <button
            onClick={() => handleFilterClick('all')}
            className={`px-3 py-1.5 rounded-xl font-mono text-[10.5px] uppercase tracking-wider whitespace-nowrap cursor-pointer transition-all ${
              activeFilter === 'all'
                ? 'bg-[#30312F] text-white font-bold shadow-xs'
                : 'bg-[#FAF9F6] text-[#686B66] hover:text-[#292B29] border border-[#DCDAD4]'
            }`}
          >
            All Corridors ({corridors.length})
          </button>
          <button
            onClick={() => handleFilterClick('express')}
            className={`px-3 py-1.5 rounded-xl font-mono text-[10.5px] uppercase tracking-wider whitespace-nowrap cursor-pointer transition-all ${
              activeFilter === 'express'
                ? 'bg-[#30312F] text-white font-bold shadow-xs'
                : 'bg-[#FAF9F6] text-[#686B66] hover:text-[#292B29] border border-[#DCDAD4]'
            }`}
          >
            ⚡ Express Direct ({corridors.filter((c) => c.category === 'express').length})
          </button>
          <button
            onClick={() => handleFilterClick('arterial')}
            className={`px-3 py-1.5 rounded-xl font-mono text-[10.5px] uppercase tracking-wider whitespace-nowrap cursor-pointer transition-all ${
              activeFilter === 'arterial'
                ? 'bg-[#30312F] text-white font-bold shadow-xs'
                : 'bg-[#FAF9F6] text-[#686B66] hover:text-[#292B29] border border-[#DCDAD4]'
            }`}
          >
            🔥 Urban Arterials ({corridors.filter((c) => c.category === 'arterial').length})
          </button>
          <button
            onClick={() => handleFilterClick('feeder')}
            className={`px-3 py-1.5 rounded-xl font-mono text-[10.5px] uppercase tracking-wider whitespace-nowrap cursor-pointer transition-all ${
              activeFilter === 'feeder'
                ? 'bg-[#30312F] text-white font-bold shadow-xs'
                : 'bg-[#FAF9F6] text-[#686B66] hover:text-[#292B29] border border-[#DCDAD4]'
            }`}
          >
            🌿 Suburban Feeders ({corridors.filter((c) => c.category === 'feeder').length})
          </button>
        </div>

        {/* Clear Segregation Banner */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#FAF9F6] border border-[#DCDAD4] text-[#292B29] text-xs font-mono">
          <span className="material-symbols-outlined text-[16px] text-[#52584A]">
            {activeFilter === 'express'
              ? 'bolt'
              : activeFilter === 'arterial'
              ? 'alt_route'
              : activeFilter === 'feeder'
              ? 'hub'
              : 'apps'}
          </span>
          <span className="text-[11px]">
            {activeFilter === 'express' && (
              <>
                <strong>Express Direct Lines:</strong> High-speed non-stop radial lines connecting major terminals with zero intermediate delay.
              </>
            )}
            {activeFilter === 'arterial' && (
              <>
                <strong>Urban Arterial Spines:</strong> Multi-stop high-capacity lines serving commercial, tech, and manufacturing clusters.
              </>
            )}
            {activeFilter === 'feeder' && (
              <>
                <strong>Suburban &amp; Feeder Connectors:</strong> First/last-mile suburban shuttles linking academic, heritage, and residential nodes.
              </>
            )}
            {activeFilter === 'all' && (
              <>
                <strong>Full Metro Network:</strong> 9 synchronized corridors across Nashik. Click any route card to track its live stops.
              </>
            )}
          </span>
        </div>
      </section>

      {/* ─── Leaflet Multi-Corridor Spatial Map Deck ───────────── */}
      <section className="relative w-full rounded-2xl bg-[#30312F] overflow-hidden p-3.5 border border-[#424440] shadow-md flex flex-col gap-2">
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#858C7B] animate-pulse"></span>
            <span className="font-mono text-xs text-[#F6F5F1] uppercase tracking-wider font-bold">
              {userRole === 'admin' ? 'Fleet Corridor Network & Route Load Map' : 'Live Metro Transit Network'}
            </span>
          </div>
          <span className="font-mono text-[10.5px] text-[#A3A69D] font-semibold">
            Tracking: <span className="text-[#0ED4A8]">{selectedCorridor.code}</span>
          </span>
        </div>

        {/* Live Leaflet Map */}
        <div className="relative w-full h-64 rounded-xl overflow-hidden border border-[#424440] bg-[#131318]">
          <LeafletMap
            center={[19.9977, 73.7803]}
            zoom={12}
            corridors={filteredCorridors}
            selectedCorridorId={selectedCorridorId}
            height="256px"
          />
        </div>

        {/* Clean Vector Legend (Showing active corridors without clutter) */}
        <div className="flex items-center justify-between pt-1 overflow-x-auto no-scrollbar gap-3 text-xs font-mono">
          {filteredCorridors.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCorridorId(c.id)}
              className={`flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                selectedCorridorId === c.id ? 'bg-[#424440] text-white' : 'text-[#A3A69D] hover:text-white'
              }`}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }}></span>
              <span className="text-[10.5px] font-semibold truncate max-w-[140px]">{c.code}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ─── Corridors Roster (Admin Mode vs Passenger Mode) ────── */}
      <section className="flex flex-col gap-3" id="corridor-list">
        {filteredCorridors.map((corridor) => {
          const isSelected = selectedCorridorId === corridor.id;

          /* ── ADMIN VIEW ────────────────────────────────────────── */
          if (userRole === 'admin') {
            const loadPct = Math.round((corridor.capacityOccupied / corridor.capacityTotal) * 100);
            return (
              <div
                key={corridor.id}
                onClick={() => setSelectedCorridorId(corridor.id)}
                className={`flex flex-col p-4 rounded-xl gap-3 transition-all cursor-pointer border shadow-sm ${
                  isSelected
                    ? 'bg-[#E5E8DF] border-[#52584A] ring-1 ring-[#52584A]/30'
                    : 'bg-[#FAF9F6] border-[#DCDAD4] hover:border-[#858C7B]'
                }`}
              >
                {/* Header Row */}
                <div className="flex items-start justify-between pb-2 border-b border-[#DCDAD4]">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-[#292B29]">{corridor.name}</span>
                      <span className="bg-[#30312F] text-white px-2 py-0.5 rounded text-[9.5px] font-mono font-bold uppercase">
                        {corridor.categoryLabel}
                      </span>
                      {isSelected && (
                        <span className="bg-[#52584A] text-white px-1.5 py-0.2 rounded text-[9px] font-mono font-bold">
                          ACTIVE ON MAP
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-xs text-[#898B84]">{corridor.code} · {corridor.subtitle}</span>
                  </div>

                  <div className="text-right font-mono">
                    <span className="text-sm font-bold text-[#292B29]">{corridor.matchRate}%</span>
                    <span className="block text-[10px] text-[#898B84] uppercase">Match Rate</span>
                  </div>
                </div>

                {/* Operations Telemetry Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
                  {/* Fleet Allocation Control */}
                  <div className="flex flex-col p-2.5 rounded-lg bg-[#F2EFEB] border border-[#DCDAD4]">
                    <span className="text-[10px] text-[#898B84] uppercase font-bold">Fleet Allocated</span>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-sm font-bold text-[#292B29]">{corridor.liveVehicles} EVs</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAdjustFleet(corridor.id, -1);
                          }}
                          className="w-6 h-6 rounded bg-[#DCDAD4] hover:bg-[#858C7B] hover:text-white flex items-center justify-center font-bold text-xs cursor-pointer"
                          title="Withdraw 1 vehicle"
                        >
                          -
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAdjustFleet(corridor.id, 1);
                          }}
                          className="w-6 h-6 rounded bg-[#52584A] hover:bg-[#3D4236] text-white flex items-center justify-center font-bold text-xs cursor-pointer"
                          title="Deploy +1 extra vehicle"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Capacity Load Bar */}
                  <div className="flex flex-col p-2.5 rounded-lg bg-[#F2EFEB] border border-[#DCDAD4]">
                    <span className="text-[10px] text-[#898B84] uppercase font-bold">Load Factor</span>
                    <div className="flex items-baseline justify-between mt-1">
                      <span className="text-xs font-bold text-[#292B29]">{loadPct}% Occupied</span>
                      <span className="text-[10px] text-[#898B84]">
                        {corridor.capacityOccupied}/{corridor.capacityTotal} seats
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-[#DCDAD4] rounded-full overflow-hidden mt-1">
                      <div
                        className={`h-full ${loadPct > 85 ? 'bg-[#A66030]' : 'bg-[#52584A]'}`}
                        style={{ width: `${loadPct}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Headway Frequency */}
                  <div className="flex flex-col p-2.5 rounded-lg bg-[#F2EFEB] border border-[#DCDAD4]">
                    <span className="text-[10px] text-[#898B84] uppercase font-bold">Dispatch Headway</span>
                    <span className="text-xs font-bold text-[#292B29] mt-1">{corridor.headwayMin} mins</span>
                    <span className="text-[9.5px] text-[#52584A]">Avg wait: {corridor.avgWait}</span>
                  </div>

                  {/* Flow Status */}
                  <div className="flex flex-col p-2.5 rounded-lg bg-[#F2EFEB] border border-[#DCDAD4]">
                    <span className="text-[10px] text-[#898B84] uppercase font-bold">Flow Telemetry</span>
                    <span className="text-xs font-bold text-[#292B29] mt-1">{corridor.hourlyDemandPax} pax/hr</span>
                    <span className="text-[9.5px] text-[#898B84] truncate">{corridor.congestionStatus}</span>
                  </div>
                </div>

                {/* Admin Actions */}
                <div className="flex items-center gap-2 pt-1 border-t border-[#DCDAD4]">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRebalanceCorridor(corridor);
                    }}
                    className="flex-1 py-1.5 rounded-lg bg-[#52584A] hover:bg-[#3D4236] text-[#FAF9F6] font-mono text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-xs"
                  >
                    <span className="material-symbols-outlined text-[15px]">sync_alt</span>
                    <span>Rebalance Fleet on Line</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setAdminNotice(`Corridor ${corridor.code}: Transit priority green signal active.`);
                      setTimeout(() => setAdminNotice(''), 3000);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#F2EFEB] hover:bg-[#DCDAD4] text-[#292B29] font-mono text-xs font-semibold border border-[#DCDAD4] cursor-pointer"
                  >
                    Priority Signal
                  </button>
                </div>
              </div>
            );
          }

          /* ── PASSENGER VIEW ────────────────────────────────────── */
          const isExpress = corridor.category === 'express';
          return (
            <article
              key={corridor.id}
              onClick={() => setSelectedCorridorId(corridor.id)}
              className={`corridor-card flex flex-col p-4 rounded-xl gap-3 transition-all cursor-pointer shadow-sm ${
                isSelected
                  ? 'bg-surface-container-high border-2 border-primary ring-2 ring-primary/20 shadow-primary/10'
                  : 'bg-surface-container border border-surface-container-high hover:border-primary/40'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-headline-md text-headline-md font-semibold text-on-surface">
                      {corridor.name}
                    </span>
                    {isExpress ? (
                      <span className="px-2 py-0.5 rounded-full bg-[#E5E8DF] text-[#343B30] font-mono text-[9.5px] uppercase font-bold flex items-center gap-1 border border-[#858C7B]/40">
                        <span className="material-symbols-outlined text-[13px] text-[#52584A]">bolt</span>
                        EXPRESS DIRECT
                      </span>
                    ) : corridor.category === 'arterial' ? (
                      <span className="px-2 py-0.5 rounded-full bg-[#F4EBE2] text-[#8C522B] font-mono text-[9.5px] uppercase font-bold flex items-center gap-1 border border-[#DCDAD4]">
                        <span className="material-symbols-outlined text-[13px] text-[#A66030]">local_fire_department</span>
                        URBAN ARTERIAL
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-[#E5E8DF] text-[#343B30] font-mono text-[9.5px] uppercase font-bold flex items-center gap-1 border border-[#858C7B]/30">
                        <span className="material-symbols-outlined text-[13px] text-[#52584A]">hub</span>
                        SUBURBAN FEEDER
                      </span>
                    )}
                    {isSelected && (
                      <span className="px-1.5 py-0.5 rounded bg-primary text-on-primary font-label-mono text-[9px] uppercase font-extrabold tracking-wider animate-pulse">
                        ● TRACKING ON MAP
                      </span>
                    )}
                  </div>
                  <span className="font-label-mono text-label-mono uppercase tracking-wider text-outline">
                    {corridor.subtitle}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-headline-md text-headline-md font-semibold text-primary">
                    {corridor.matchRate}%
                  </span>
                  <span className="block font-label-mono text-[10px] uppercase tracking-wider text-on-surface-variant">
                    Match Rate
                  </span>
                </div>
              </div>

              {/* Waypoint Breadcrumb */}
              <div className="flex items-center gap-2 py-1.5 px-3 rounded bg-surface-container-low text-on-surface border border-surface-container-high/40 overflow-x-auto no-scrollbar">
                <span className="w-1.5 h-1.5 rounded-full bg-on-surface shrink-0"></span>
                <span className="font-body-sm text-body-sm font-medium whitespace-nowrap">
                  {corridor.stops[0]}
                </span>
                <span className="font-label-mono text-outline text-[11px] font-bold">→</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant whitespace-nowrap">
                  {corridor.stops[1]}
                </span>
                {corridor.stops[2] && (
                  <>
                    <span className="font-label-mono text-outline text-[11px] font-bold">→</span>
                    <span className="w-1.5 h-1.5 rounded-sm bg-primary shrink-0"></span>
                    <span className="font-body-sm text-body-sm font-medium text-primary whitespace-nowrap">
                      {corridor.stops[2]}
                    </span>
                  </>
                )}
              </div>

              {/* Telemetry Metrics Grid */}
              <div className="grid grid-cols-3 gap-2 py-0.5">
                <div className="flex flex-col p-2 rounded bg-surface-container-low border border-surface-container-high/40">
                  <span className="font-label-mono text-[10px] uppercase tracking-wider text-outline">
                    Vehicles
                  </span>
                  <span className="font-body-md text-body-md font-semibold text-on-surface">
                    {corridor.liveVehicles} Live
                  </span>
                </div>
                <div className="flex flex-col p-2 rounded bg-surface-container-low border border-surface-container-high/40">
                  <span className="font-label-mono text-[10px] uppercase tracking-wider text-outline">
                    Avg Wait
                  </span>
                  <span className="font-body-md text-body-md font-semibold text-on-surface">
                    {corridor.avgWait}
                  </span>
                </div>
                <div className="flex flex-col p-2 rounded bg-surface-container-low border border-surface-container-high/40">
                  <span className="font-label-mono text-[10px] uppercase tracking-wider text-outline">
                    Punctuality
                  </span>
                  <span className="font-body-md text-body-md font-semibold text-primary">
                    99.1%
                  </span>
                </div>
              </div>

              {/* Action button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectCorridor(corridor);
                }}
                className={`w-full h-10 rounded font-label-mono text-label-mono uppercase tracking-wider font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm ${
                  isExpress
                    ? 'bg-[#52584A] hover:bg-[#3D4236] text-[#FAF9F6]'
                    : 'bg-surface-container-high hover:bg-primary hover:text-on-primary text-primary border border-surface-container-highest/60'
                }`}
              >
                <span>{isExpress ? '⚡ Book Express Direct on this Line' : 'Book Pool on this Corridor'}</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </article>
          );
        })}
      </section>
    </div>
  );
}
