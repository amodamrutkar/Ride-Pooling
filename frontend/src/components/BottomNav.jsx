import React from 'react';

/**
 * poolIQ Navigation Bar — Dynamically adapts to Passenger vs Admin Mode
 */
export default function BottomNav({ activeTab, setActiveTab, userRole = 'passenger' }) {
  const passengerTabs = [
    { id: 'pool', label: 'Ride', icon: 'directions_car' },
    { id: 'journey', label: 'My Journey', icon: 'near_me' },
    { id: 'fairness', label: 'Fairness Vault', icon: 'verified_user' },
    { id: 'routes', label: 'Corridors', icon: 'alt_route' }
  ];

  const adminTabs = [
    { id: 'fleet', label: 'Fleet Grid', icon: 'hub' },
    { id: 'stats', label: 'Analytics', icon: 'insights' },
    { id: 'routes', label: 'Corridors', icon: 'alt_route' },
    { id: 'pool', label: 'Live Pool', icon: 'map' }
  ];

  const currentTabs = userRole === 'admin' ? adminTabs : passengerTabs;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 pb-safe bg-[#FAF9F6]/95 backdrop-blur-md border-t border-[#DCDAD4] shadow-sm">
      <div className="flex items-center justify-around h-14 max-w-xl mx-auto px-4">
        {currentTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center py-1 px-4 rounded-xl transition-all cursor-pointer select-none ${
                isActive
                  ? 'text-[#292B29] font-bold bg-[#E5E8DF] shadow-xs'
                  : 'text-[#898B84] hover:text-[#292B29] hover:bg-[#F2EFEB]'
              }`}
            >
              <span className={`material-symbols-outlined text-[20px] transition-transform ${isActive ? 'scale-110 text-[#52584A]' : 'text-[#898B84]'}`}>
                {tab.icon}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wider mt-0.5">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
      <div className="h-3.5 flex items-center justify-center bg-[#EAE8E3]/60 border-t border-[#DCDAD4]/60">
        <span className="font-mono text-[8.5px] text-[#898B84] tracking-widest uppercase">
          {userRole === 'admin' ? 'Operator Console · Spatial Cluster Synced' : 'poolIQ Passenger · Nashik Urban Network'}
        </span>
      </div>
    </nav>
  );
}
