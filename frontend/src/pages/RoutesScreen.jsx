import React, { useState, useEffect } from 'react';
import LeafletMap from '../components/LeafletMap';
import { CORRIDORS } from '../data/nashikLocations';

export default function RoutesScreen({ onSelectCorridor }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [corridors, setCorridors] = useState(CORRIDORS);
  const [selectedCorridorId, setSelectedCorridorId] = useState('mh-09');
  const [efficiency, setEfficiency] = useState(98.4);

  // Real-time telemetry simulation for corridors
  useEffect(() => {
    const timer = setInterval(() => {
      // Dynamic vehicle and wait-time jitter
      setCorridors((prev) =>
        prev.map((c) => ({
          ...c,
          liveVehicles: Math.max(3, c.liveVehicles + (Math.random() > 0.5 ? 1 : -1) * (Math.random() > 0.7 ? 1 : 0)),
          matchRate: Math.min(99, Math.max(70, c.matchRate + (Math.random() > 0.5 ? 1 : -1)))
        }))
      );
      setEfficiency((e) => Math.round((98.2 + Math.random() * 0.5) * 10) / 10);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const filteredCorridors = corridors.filter((c) => {
    const matchesFilter =
      activeFilter === 'all' ||
      (activeFilter === 'high' && c.category.includes('high')) ||
      (activeFilter === 'express' && c.category.includes('express'));

    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.subtitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.stops.some((s) => s.toLowerCase().includes(searchTerm.toLowerCase()));

    return matchesFilter && matchesSearch;
  });

  return (
    <div className="flex flex-col w-full px-4 gap-4 text-on-surface select-none pb-8">
      {/* Header / Operational Status Bar */}
      <div className="flex items-start justify-between gap-2 pt-1">
        <div className="flex flex-col">
          <span className="font-label-mono text-label-mono uppercase tracking-widest text-on-surface-variant">
            Live Transit &amp; Dynamic Batches
          </span>
          <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface font-semibold">
            OPTIMIZED CORRIDORS
          </h1>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-container-high border border-surface-container-highest/60">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
          <span className="font-label-mono text-label-mono text-primary font-semibold">
            {efficiency}% Efficiency
          </span>
        </div>
      </div>

      {/* Search & Filter Area */}
      <section className="flex flex-col gap-2">
        <div className="relative w-full">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search corridor or stop..."
            className="w-full h-11 px-3 pr-16 rounded bg-surface-container text-on-surface placeholder:text-outline font-body-md focus:outline-none focus:ring-1 focus:ring-primary border border-surface-container-high transition-colors"
          />
          <span className="absolute right-3 top-3 font-label-mono text-label-mono text-outline uppercase tracking-wider text-[10px]">
            FILTER
          </span>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          <button
            onClick={() => setActiveFilter('all')}
            className={`filter-pill px-3 py-1.5 rounded font-label-mono text-label-mono uppercase tracking-wider whitespace-nowrap cursor-pointer transition-colors ${
              activeFilter === 'all'
                ? 'bg-surface-container-highest text-primary font-bold border border-primary/40'
                : 'bg-surface-container text-on-surface-variant hover:text-on-surface border border-surface-container-high'
            }`}
          >
            All Corridors
          </button>
          <button
            onClick={() => setActiveFilter('high')}
            className={`filter-pill px-3 py-1.5 rounded font-label-mono text-label-mono uppercase tracking-wider whitespace-nowrap cursor-pointer transition-colors ${
              activeFilter === 'high'
                ? 'bg-surface-container-highest text-primary font-bold border border-primary/40'
                : 'bg-surface-container text-on-surface-variant hover:text-on-surface border border-surface-container-high'
            }`}
          >
            High Demand
          </button>
          <button
            onClick={() => setActiveFilter('express')}
            className={`filter-pill px-3 py-1.5 rounded font-label-mono text-label-mono uppercase tracking-wider whitespace-nowrap cursor-pointer transition-colors ${
              activeFilter === 'express'
                ? 'bg-surface-container-highest text-primary font-bold border border-primary/40'
                : 'bg-surface-container text-on-surface-variant hover:text-on-surface border border-surface-container-high'
            }`}
          >
            Express Pools
          </button>
        </div>
      </section>

      {/* Schematic Vector & Leaflet Map Deck with Permanent Location Name Badges */}
      <section className="relative w-full rounded-2xl bg-surface-container-lowest overflow-hidden p-3.5 border border-surface-container-high shadow-xl">
        <div className="flex items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
            <span className="font-label-mono text-label-mono text-on-surface uppercase tracking-wider font-semibold">
              Live Network Graph
            </span>
          </div>
          <span className="font-label-mono text-label-mono text-outline text-[10px]">
            Nashik Urban Node
          </span>
        </div>

        {/* Live Leaflet Multi-Corridor Map View with ESRI Dark Tiles and Badges */}
        <div className="relative w-full h-56 rounded-xl bg-surface-dim overflow-hidden border border-surface-container-high/60">
          <LeafletMap
            center={[19.9977, 73.7803]}
            zoom={12}
            corridors={corridors}
            selectedCorridorId={selectedCorridorId}
            height="224px"
          />
        </div>

        {/* Vector Legend */}
        <div className="flex items-center justify-between pt-2.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-1 rounded-sm bg-primary"></span>
            <span className="font-label-mono text-[10px] text-on-surface font-semibold">MH-15 Central</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-1 rounded-sm bg-[#38bdf8]"></span>
            <span className="font-label-mono text-[10px] text-on-surface-variant font-semibold">MH-09 Tech</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-1 rounded-sm bg-[#9d86e9]"></span>
            <span className="font-label-mono text-[10px] text-on-surface-variant font-semibold">MH-03 Link</span>
          </div>
        </div>
      </section>

      {/* Corridors List */}
      <section className="flex flex-col gap-3" id="corridor-list">
        {filteredCorridors.map((corridor) => {
          const isSelected = selectedCorridorId === corridor.id;
          return (
            <article
              key={corridor.id}
              onClick={() => setSelectedCorridorId(corridor.id)}
              className={`corridor-card flex flex-col p-4 rounded-xl gap-3 transition-all cursor-pointer shadow-md ${
                isSelected
                  ? 'bg-surface-container-high border-2 border-primary ring-2 ring-primary/20 shadow-primary/10'
                  : 'bg-surface-container border border-surface-container-high hover:border-primary/40'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-headline-md text-headline-md font-semibold text-on-surface">
                      {corridor.name}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-primary-container/20 text-primary font-label-mono text-[10px] uppercase font-bold tracking-wider">
                      {corridor.status}
                    </span>
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
              className="w-full h-10 rounded bg-surface-container-high hover:bg-primary hover:text-on-primary text-primary font-label-mono text-label-mono uppercase tracking-wider font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-surface-container-highest/60 shadow-sm"
            >
              <span>Book Pool on this Corridor</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </article>
        );
      })}
      </section>
    </div>
  );
}
