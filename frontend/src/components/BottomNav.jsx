import React from 'react';

/**
 * pool-IQ Navigation Bar — Perfectly aligned 4-column responsive layout
 */
export default function BottomNav({ activeTab, setActiveTab, userRole = 'passenger' }) {
  const passengerTabs = [
    { id: 'pool', label: 'Ride', icon: 'directions_car' },
    { id: 'journey', label: 'Journey', icon: 'near_me' },
    { id: 'fairness', label: 'Fairness', icon: 'verified_user' },
    { id: 'routes', label: 'Corridors', icon: 'alt_route' }
  ];

  const adminTabs = [
    { id: 'fleet', label: 'Fleet', icon: 'hub' },
    { id: 'stats', label: 'Analytics', icon: 'insights' },
    { id: 'routes', label: 'Corridors', icon: 'alt_route' },
    { id: 'pool', label: 'Dispatch', icon: 'map' }
  ];

  const currentTabs = userRole === 'admin' ? adminTabs : passengerTabs;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-[#FAF9F6]/95 backdrop-blur-md border-t border-[#DCDAD4] shadow-sm pb-safe">
      <div className="grid grid-cols-4 max-w-md mx-auto h-16 px-2 py-1 items-center">
        {currentTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center h-full w-full rounded-xl transition-all cursor-pointer select-none py-1 ${
                isActive
                  ? 'text-[#292B29] font-bold bg-[#E5E8DF] shadow-xs'
                  : 'text-[#898B84] hover:text-[#292B29] hover:bg-[#F2EFEB]'
              }`}
            >
              <span
                className={`material-symbols-outlined text-[22px] transition-transform ${
                  isActive ? 'scale-110 text-[#52584A]' : 'text-[#898B84]'
                }`}
              >
                {tab.icon}
              </span>
              <span className="font-mono text-[10.5px] uppercase tracking-wider mt-1 whitespace-nowrap leading-none">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
