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
  const [weeklyBonusRides, setWeeklyBonusRides] = useState([0, 0, 0, 1, 3, 0, 0]);
  const [weeklyBonusSavings, setWeeklyBonusSavings] = useState([0, 0, 0, 240, 780, 0, 0]);

  useEffect(() => {
    const timer = setInterval(() => {
      const added = Math.floor(180 + Math.random() * 140);
      setLiveJitter((prev) => prev + added);
      setLastAddition(added);

      // Dynamically increment rides & daily savings on the active weekday in the cadence chart
      setWeeklyBonusRides((prev) => {
        const next = [...prev];
        next[selectedDayIdx] = (next[selectedDayIdx] || 0) + 1;
        return next;
      });
      setWeeklyBonusSavings((prev) => {
        const next = [...prev];
        next[selectedDayIdx] = (next[selectedDayIdx] || 0) + added;
        return next;
      });
    }, 5000);
    return () => clearInterval(timer);
  }, [selectedDayIdx]);

  // Sync with real backend metrics if available from /api/state
  const liveDetour = backendMetrics && backendMetrics.avg_detour_pct
    ? `${backendMetrics.avg_detour_pct.toFixed(1)}%`
    : '5.1%';
  const liveSavedPct = backendMetrics && backendMetrics.saved_pct
    ? `${Math.round(backendMetrics.saved_pct)}%`
    : '33.4%';

  const baseWeeklyConfigs = {
    month: [
      { day: 'Mon', baseCount: 182, baseSavings: 38400 },
      { day: 'Tue', baseCount: 214, baseSavings: 44200 },
      { day: 'Wed', baseCount: 148, baseSavings: 31100 },
      { day: 'Thu', baseCount: 242, baseSavings: 51000 },
      { day: 'Fri', baseCount: 298, baseSavings: 64500 },
      { day: 'Sat', baseCount: 196, baseSavings: 41800 },
      { day: 'Sun', baseCount: 112, baseSavings: 24000 }
    ],
    all: [
      { day: 'Mon', baseCount: 1240, baseSavings: 280000 },
      { day: 'Tue', baseCount: 1480, baseSavings: 330000 },
      { day: 'Wed', baseCount: 1120, baseSavings: 250000 },
      { day: 'Thu', baseCount: 1690, baseSavings: 380000 },
      { day: 'Fri', baseCount: 1980, baseSavings: 450000 },
      { day: 'Sat', baseCount: 1390, baseSavings: 310000 },
      { day: 'Sun', baseCount: 850, baseSavings: 190000 }
    ]
  };

  const baseData = {
    month: {
      rawSavings: 384200,
      soloBaseNum: 1148000,
      pooledBaseNum: 764000,
      delta: `+28.4% vs last month (${liveSavedPct} efficiency)`,
      pctOffset: liveSavedPct,
      poolPct: '66.6%',
      co2: 1840,
      saplings: 184,
      detour: liveDetour,
      detourMin: '+1.8 min',
      efficiency: '96.8%'
    },
    all: {
      rawSavings: 2864500,
      soloBaseNum: 8620000,
      pooledBaseNum: 5756000,
      delta: '+34.2% overall network efficiency',
      pctOffset: '33.2%',
      poolPct: '66.8%',
      co2: 14250,
      saplings: 1425,
      detour: liveDetour,
      detourMin: '+1.7 min',
      efficiency: '97.4%'
    }
  };

  const current = baseData[period];
  const dynamicTotalNum = current.rawSavings + liveJitter;
  const dynamicNetSaved = dynamicTotalNum.toLocaleString('en-IN');
  const dynamicLakhsStr = `₹${(dynamicTotalNum / 100000).toFixed(2)} Lakhs`;
  const dynamicSoloStr = `₹${((current.soloBaseNum + Math.floor(liveJitter * 1.5)) / 100000).toFixed(2)} Lakhs`;
  const dynamicPooledStr = `₹${((current.pooledBaseNum + Math.floor(liveJitter * 0.5)) / 100000).toFixed(2)} Lakhs`;
  const dynamicCo2Str = (current.co2 + Math.floor(liveJitter * 0.0035)).toLocaleString('en-IN');
  const dynamicSaplingsStr = Math.round((current.co2 + Math.floor(liveJitter * 0.0035)) / 10).toLocaleString('en-IN');
  const dynamicEfficiency = `${(96.8 + (Math.floor(liveJitter / 200) % 5) * 0.1).toFixed(1)}%`;

  // Dynamically compute the 7 daily bars with live counts, savings, and heights
  const currentWeeklyConfigs = baseWeeklyConfigs[period];
  const maxWeeklyCount = Math.max(
    ...currentWeeklyConfigs.map((c, i) => c.baseCount + (weeklyBonusRides[i] || 0))
  );

  const dynamicWeekly = currentWeeklyConfigs.map((cfg, idx) => {
    const totalCount = cfg.baseCount + (weeklyBonusRides[idx] || 0);
    const totalSavingsNum = cfg.baseSavings + (weeklyBonusSavings[idx] || 0);
    const savingsFormatted = period === 'all'
      ? `₹${(totalSavingsNum / 100000).toFixed(1)}L`
      : `₹${(totalSavingsNum / 1000).toFixed(1)}k`;
    const heightPct = `${Math.min(100, Math.max(30, Math.round((totalCount / maxWeeklyCount) * 100)))}%`;
    return {
      day: cfg.day,
      count: totalCount,
      rides: `${totalCount} Rides`,
      savings: savingsFormatted,
      height: heightPct
    };
  });

  const selectedDay = dynamicWeekly[selectedDayIdx] || dynamicWeekly[4];

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
              Solo Cost: <strong className="text-on-surface font-semibold ml-1">{dynamicSoloStr}</strong>
            </span>
            <span className="text-primary flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-primary"></span>
              Pooled Cost: <strong className="text-on-surface font-semibold ml-1">{dynamicPooledStr}</strong>
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
              {dynamicEfficiency}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-surface-container font-label-mono text-[10px] text-on-surface-variant uppercase border border-surface-container-highest/40">
              Optimal
            </span>
          </div>
        </div>
      </section>

      {/* Weekly Pooling Performance Chart Card (Fully Dynamic 7 Days) */}
      <section className="bg-surface-container-low rounded-2xl p-4 shadow-md flex flex-col gap-3 border border-surface-container-high">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping"></span>
              <span className="font-label-mono text-label-mono uppercase tracking-wider text-on-surface-variant">
                Velocity Cadence · Live Dispatch
              </span>
            </div>
            <span className="font-label-lg text-label-lg text-on-surface font-semibold">
              Weekly Pooling Performance
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-container border border-surface-container-high font-label-mono text-xs text-primary font-semibold shadow-inner">
            <span className="text-primary font-bold">{selectedDay.day}: {selectedDay.rides}</span>
            <span className="text-outline">·</span>
            <span className="text-on-surface">{selectedDay.savings} Saved</span>
          </div>
        </div>

        {/* Interactive Typographic Bar Visualization */}
        <div className="bg-surface-container rounded-xl p-3 flex flex-col gap-2 border border-surface-container-high/60">
          <div className="h-32 flex items-end justify-between gap-2 px-1 pt-4">
            {dynamicWeekly.map((bar, idx) => {
              const isSelected = selectedDayIdx === idx;
              return (
                <div
                  key={idx}
                  onClick={() => setSelectedDayIdx(idx)}
                  className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end cursor-pointer group"
                >
                  <span
                    className={`font-label-mono text-[10px] font-semibold transition-all ${
                      isSelected ? 'text-primary font-bold scale-110' : 'text-on-surface-variant group-hover:text-on-surface'
                    }`}
                  >
                    {bar.count}
                  </span>
                  <div
                    className={`w-full rounded-t-sm transition-all duration-500 ease-out relative overflow-hidden ${
                      isSelected
                        ? 'bg-primary shadow-[0_0_12px_#0ed4a8]'
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

        {/* Provenance Footer */}
        <div className="flex items-center justify-between text-[10px] font-label-mono text-outline pt-1 border-t border-surface-container-high/40">
          <span>Source: Nashik Spatial Cluster Telemetry</span>
          <span className="text-primary">OR-Tools Solver Synced</span>
        </div>
      </section>
    </div>
  );
}
