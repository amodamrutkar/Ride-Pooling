import React from 'react';

export default function BottomNav({ activeTab, setActiveTab }) {
  const tabs = [
    { id: 'pool', label: 'Pool', icon: 'map' },
    { id: 'routes', label: 'Routes', icon: 'timeline' },
    { id: 'stats', label: 'Stats', icon: 'insights' },
    { id: 'fleet', label: 'Fleet', icon: 'directions_car' }
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 pb-safe bg-surface/92 backdrop-blur-xl border-t border-surface-container-high/60 shadow-[0_-1px_12px_rgba(0,0,0,0.4)]">
      <div className="flex items-center justify-around h-14 max-w-xl mx-auto px-3">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center min-w-[56px] h-12 gap-0.5 transition-colors cursor-pointer select-none ${
                isActive
                  ? 'text-primary font-semibold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className={`material-symbols-outlined text-[20px] transition-transform ${isActive ? 'scale-110 text-primary' : ''}`}>
                {tab.icon}
              </span>
              <span className="font-label-mono text-label-mono uppercase tracking-wider text-[10px]">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
      <div className="h-4 flex items-center justify-center bg-surface-container-lowest/90 border-t border-surface-container-high/30">
        <span className="font-label-mono text-[9px] text-outline tracking-wider uppercase">
          Road data: OSRM · Pool Engine 3.2
        </span>
      </div>
    </nav>
  );
}
