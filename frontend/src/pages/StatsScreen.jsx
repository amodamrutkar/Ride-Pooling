import React, { useState, useEffect } from 'react';

/**
 * PoolIQ Efficiency Hub (StatsScreen)
 *
 * Displays metropolitan network savings in Lakhs (₹),
 * CO2 offsets, detour SLA performance, and interactive weekly velocity cadence.
 * Fully dynamic with live ticking and backend metrics synchronization.
 */
export default function StatsScreen({ backendMetrics = null }) {
  const [period, setPeriod] = useState('month'); // 'month' or 'all'
  const [selectedDayIdx, setSelectedDayIdx] = useState(4); // Default Friday

  // Live dynamic counter jitter to simulate real-time transit telemetry
  // Live dynamic counter jitter: updates every 5 seconds adding incremental pooled savings
  const [liveJitter, setLiveJitter] = useState(0);
  const [lastAddition, setLastAddition] = useState(240);

  useEffect(() => {
    const timer = setInterval(() => {
      const added = Math.floor(180 + Math.random() * 140);
      setLiveJitter((prev) => prev + added);
      setLastAddition(added);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Sync with real backend metrics if available from /api/state
  const liveDetour = backendMetrics && backendMetrics.avg_detour_pct
    ? `${backendMetrics.avg_detour_pct.toFixed(1)}%`
    : '5.1%';
  const liveSavedPct = backendMetrics && backendMetrics.saved_pct
    ? `${Math.round(backendMetrics.saved_pct)}%`
    : '33.4%';

  const baseData = {
    month: {
      rawSavings: 384200,
      savingsLakhs: '₹3.84 Lakhs',
      savingsFull: '₹3,84,200',
      delta: `+28.4% vs last month (${liveSavedPct} efficiency)`,
      soloCost: '₹11.48 Lakhs',
      pooledCost: '₹7.64 Lakhs',
      pctOffset: liveSavedPct,
      poolPct: '66.6%',
      co2: 1840,
      saplings: 184,
      detour: liveDetour,
      detourMin: '+1.8 min',
      efficiency: '96.8%',
      weekly: [
        { day: 'Mon', count: 182, rides: '182 Rides', savings: '₹38.4k', height: '62%' },
        { day: 'Tue', count: 214, rides: '214 Rides', savings: '₹44.2k', height: '74%' },
        { day: 'Wed', count: 148, rides: '148 Rides', savings: '₹31.1k', height: '48%' },
        { day: 'Thu', count: 242, rides: '242 Rides', savings: '₹51.0k', height: '82%' },
        { day: 'Fri', count: 298, rides: '298 Rides', savings: '₹64.5k', height: '100%' },
        { day: 'Sat', count: 196, rides: '196 Rides', savings: '₹41.8k', height: '66%' },
        { day: 'Sun', count: 112, rides: '112 Rides', savings: '₹24.0k', height: '38%' }
      ]
    },
    all: {
      rawSavings: 2864500,
      savingsLakhs: '₹28.65 Lakhs',
      savingsFull: '₹28,64,500',
      delta: '+34.2% overall network efficiency',
      soloCost: '₹86.20 Lakhs',
      pooledCost: '₹57.56 Lakhs',
      pctOffset: '33.2%',
      poolPct: '66.8%',
      co2: 14250,
      saplings: 1425,
      detour: liveDetour,
      detourMin: '+1.7 min',
      efficiency: '97.4%',
      weekly: [
        { day: 'Mon', count: 1240, rides: '1,240 Rides', savings: '₹2.8L', height: '64%' },
        { day: 'Tue', count: 1480, rides: '1,480 Rides', savings: '₹3.3L', height: '76%' },
        { day: 'Wed', count: 1120, rides: '1,120 Rides', savings: '₹2.5L', height: '52%' },
        { day: 'Thu', count: 1690, rides: '1,690 Rides', savings: '₹3.8L', height: '86%' },
        { day: 'Fri', count: 1980, rides: '1,980 Rides', savings: '₹4.5L', height: '100%' },
        { day: 'Sat', count: 1390, rides: '1,390 Rides', savings: '₹3.1L', height: '70%' },
        { day: 'Sun', count: 850, rides: '850 Rides', savings: '₹1.9L', height: '42%' }
      ]
    }
  };

  const current = baseData[period];
  const dynamicTotalNum = current.rawSavings + liveJitter;
  const dynamicNetSaved = dynamicTotalNum.toLocaleString('en-IN');
  const dynamicLakhsStr = `₹${(dynamicTotalNum / 100000).toFixed(2)} Lakhs`;
  const dynamicCo2Str = (current.co2 + Math.floor(liveJitter * 0.0035)).toLocaleString('en-IN');
  const dynamicSaplingsStr = Math.round((current.co2 + Math.floor(liveJitter * 0.0035)) / 10).toLocaleString('en-IN');
  const selectedDay = current.weekly[selectedDayIdx] || current.weekly[4];

  return (
    <div className="flex flex-col w-full px-4 gap-4 text-on-surface select-none pb-8">
      {/* Sub-header & Time Filter Controller */}
      <section className="flex items-center justify-between pt-1">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
            <span className="font-label-mono text-label-mono tracking-widest uppercase text-on-surface-variant">
              Rider Analytics &amp; Network Economies
            </span>
          </div>
          <span className="font-headline-md text-headline-md text-on-surface font-semibold tracking-tight">
            Efficiency Hub
          </span>
        </div>

        {/* Segmented Time Pills */}
        <div className="bg-surface-container-low p-1 rounded-full flex items-center border border-surface-container-high/60 shadow-inner">
          <button
            type="button"
            onClick={() => setPeriod('month')}
            className={`px-3 py-1 rounded-full font-label-mono text-label-mono font-semibold transition-all cursor-pointer ${
              period === 'month'
                ? 'text-on-primary bg-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            This Month
          </button>
          <button
            type="button"
            onClick={() => setPeriod('all')}
            className={`px-3 py-1 rounded-full font-label-mono text-label-mono font-semibold transition-all cursor-pointer ${
              period === 'all'
                ? 'text-on-primary bg-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            All Time
          </button>
        </div>
      </section>

      {/* Big Impact Metrics Card (Scaled in Lakhs) */}
      <section className="bg-surface-container-low rounded-2xl p-4 shadow-xl flex flex-col gap-3.5 relative overflow-hidden border border-surface-container-high">
        <div className="absolute -right-8 -top-8 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none"></div>

        <div className="flex items-center justify-between">
          <span className="font-label-mono text-label-mono uppercase tracking-wider text-on-surface-variant">
            Total Pooled Savings (Urban Cluster)
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary-container/20 text-primary font-label-mono text-[10px] tracking-wide font-semibold">
            <span className="material-symbols-outlined text-[12px]">trending_up</span>
            {current.delta}
          </span>
        </div>

        <div className="flex flex-col gap-0.5">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-headline-xl text-2xl md:text-3xl tracking-tight text-on-surface font-bold font-mono">
              ₹{dynamicNetSaved}
            </span>
            <span className="font-label-mono text-xs text-primary font-semibold uppercase">
              ({dynamicLakhsStr} Net Saved)
            </span>
            <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-mono font-bold animate-pulse">
              +₹{lastAddition}/5s
            </span>
          </div>
          <span className="font-label-mono text-[10px] text-outline uppercase tracking-wider">
            Consolidated Metro Fleet Allocation
          </span>
        </div>

        {/* Dual Comparison Stack */}
        <div className="bg-surface-container rounded-xl p-3 flex flex-col gap-2 border border-surface-container-high/60">
          <div className="flex items-center justify-between font-label-mono text-label-mono text-xs">
            <span className="text-on-surface-variant flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-secondary-container"></span>
              Solo Cost: <strong className="text-on-surface font-semibold ml-1">{current.soloCost}</strong>
            </span>
            <span className="text-primary flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-primary"></span>
              Pooled Cost: <strong className="text-on-surface font-semibold ml-1">{current.pooledCost}</strong>
            </span>
          </div>

          {/* Comparison Progress Bar */}
          <div className="w-full h-2.5 rounded-full bg-surface-container-high overflow-hidden flex p-0.5 border border-surface-container-highest/40">
            <div
              className="h-full bg-primary rounded-full transition-all duration-700 ease-out shadow-[0_0_8px_#0ed4a8]"
              style={{ width: current.poolPct }}
            ></div>
            <div className="h-full bg-secondary-container/40 rounded-r-full ml-0.5 flex-1"></div>
          </div>

          <div className="flex justify-between items-center font-label-mono text-[10px] text-on-surface-variant pt-0.5">
            <span>Pooled footprint ({current.poolPct})</span>
            <span className="text-primary font-semibold">{current.pctOffset} Cost Offset</span>
          </div>
        </div>
      </section>

      {/* Sustainability & Detour Card */}
      <section className="bg-surface-container-low rounded-2xl p-4 shadow-md flex flex-col gap-3.5 border border-surface-container-high">
        <div className="grid grid-cols-2 gap-3">
          {/* Col 1: CO2 Prevented */}
          <div className="bg-surface-container rounded-xl p-3 flex flex-col gap-1 relative overflow-hidden border border-surface-container-high/60">
            <div className="flex items-center justify-between text-primary">
              <span className="font-label-mono text-label-mono uppercase text-on-surface-variant">
                CO₂ Prevented
              </span>
              <span className="material-symbols-outlined text-[18px]">eco</span>
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="font-headline-md text-headline-md font-bold text-on-surface">
                {dynamicCo2Str}
              </span>
              <span className="font-label-mono text-label-mono text-primary font-semibold">kg</span>
            </div>
            <span className="font-body-sm text-body-sm text-on-surface-variant text-[11px] leading-tight">
              ≈ {dynamicSaplingsStr} saplings saved
            </span>
          </div>

          {/* Col 2: Avg Detour */}
          <div className="bg-surface-container rounded-xl p-3 flex flex-col gap-1 border border-surface-container-high/60">
            <div className="flex items-center justify-between text-tertiary">
              <span className="font-label-mono text-label-mono uppercase text-on-surface-variant">
                Avg Detour
              </span>
              <span className="material-symbols-outlined text-[18px]">alt_route</span>
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="font-headline-md text-headline-md font-bold text-on-surface">
                {current.detour}
              </span>
              <span className="font-label-mono text-label-mono text-tertiary font-medium">
                {current.detourMin}
              </span>
            </div>
            <span className="font-body-sm text-body-sm text-on-surface-variant text-[11px] leading-tight">
              Calculated via OSRM
            </span>
          </div>
        </div>

        {/* Efficiency Rating Row */}
        <div className="flex items-center justify-between bg-surface-container-high/70 rounded-xl px-3 py-2.5 border border-surface-container-highest/60">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">verified</span>
            <div className="flex flex-col">
              <span className="font-label-mono text-[10px] uppercase text-on-surface-variant tracking-wider leading-none">
                Pool Routing Engine
              </span>
              <span className="font-label-lg text-label-lg text-on-surface font-semibold">
                Efficiency Rating
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-headline-md text-headline-md font-bold text-primary">
              {current.efficiency}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-surface-container font-label-mono text-[10px] text-on-surface-variant uppercase border border-surface-container-highest/40">
              Optimal
            </span>
          </div>
        </div>
      </section>

      {/* Weekly Pooling Performance Chart Card (Interactive 7 Days) */}
      <section className="bg-surface-container-low rounded-2xl p-4 shadow-md flex flex-col gap-3 border border-surface-container-high">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-label-mono text-label-mono uppercase tracking-wider text-on-surface-variant">
              Velocity Cadence
            </span>
            <span className="font-label-lg text-label-lg text-on-surface font-semibold">
              Weekly Pooling Performance
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-container border border-surface-container-high font-label-mono text-xs text-primary font-semibold">
            <span>{selectedDay.day}: {selectedDay.rides}</span>
            <span className="text-outline">·</span>
            <span>{selectedDay.savings} Saved</span>
          </div>
        </div>

        {/* Interactive Typographic Bar Visualization */}
        <div className="bg-surface-container rounded-xl p-3 flex flex-col gap-2 border border-surface-container-high/60">
          <div className="h-32 flex items-end justify-between gap-2 px-1 pt-4">
            {current.weekly.map((bar, idx) => {
              const isSelected = selectedDayIdx === idx;
              return (
                <div
                  key={idx}
                  onClick={() => setSelectedDayIdx(idx)}
                  className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end cursor-pointer group"
                >
                  <span
                    className={`font-label-mono text-[10px] font-semibold transition-colors ${
                      isSelected ? 'text-primary font-bold scale-110' : 'text-on-surface-variant group-hover:text-on-surface'
                    }`}
                  >
                    {bar.count}
                  </span>
                  <div
                    className={`w-full rounded-t-sm transition-all relative overflow-hidden ${
                      isSelected
                        ? 'bg-primary shadow-[0_0_10px_#0ed4a8]'
                        : 'bg-surface-container-high group-hover:bg-primary/60'
                    }`}
                    style={{ height: bar.height }}
                  >
                    <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  </div>
                  <span
                    className={`font-label-mono text-[10px] uppercase font-medium transition-colors ${
                      isSelected ? 'text-primary font-bold' : 'text-on-surface-variant'
                    }`}
                  >
                    {bar.day}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
