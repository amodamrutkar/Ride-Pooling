import React, { useState, useRef, useEffect } from 'react';

/**
 * poolIQ Header with Muted Aesthetic & Profile Role Switcher (Passenger vs Admin)
 */
export default function Header({
  title = "pool-IQ",
  showBack = false,
  onBack = null,
  onTuneClick = null,
  userRole = 'passenger',
  setUserRole = null,
  backendStatus = 'Online'
}) {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRoleSelect = (role) => {
    if (setUserRole) setUserRole(role);
    setShowProfileMenu(false);
  };

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-[#FAF9F6]/90 backdrop-blur-md border-b border-[#DCDAD4] shadow-xs pt-safe">
      <div className="h-14 px-4 flex items-center justify-between max-w-5xl mx-auto">
        {/* Brand & Left Navigation */}
        <div className="flex items-center gap-2">
          {showBack && (
            <button
              onClick={onBack}
              className="w-8 h-8 -ml-1 mr-1 flex items-center justify-center rounded-xl text-[#292B29] hover:bg-[#EAE8E3] transition-colors cursor-pointer"
              aria-label="Back"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </button>
          )}

          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-[#EAE8E3] text-[#52584A] border border-[#DCDAD4]">
              <span className="material-symbols-outlined text-[19px]">route</span>
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="font-sans font-bold text-base tracking-tight text-[#292B29]">
                pool-IQ
              </span>
              <span className="text-[10px] font-mono tracking-wider uppercase text-[#898B84] hidden sm:inline">
                {userRole === 'admin' ? 'Dispatcher Pro' : 'Urban Pooling'}
              </span>
            </div>
          </div>
        </div>

        {/* Right Controls: Role Badge, Engine Status, Tune & Profile */}
        <div className="flex items-center gap-2.5">
          {/* Active Mode Pill */}
          <span className={`hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider border ${
            userRole === 'admin'
              ? 'bg-[#30312F] text-[#F6F5F1] border-[#424440]'
              : 'bg-[#E5E8DF] text-[#343B30] border-[#DCDAD4]'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${userRole === 'admin' ? 'bg-[#858C7B]' : 'bg-[#52584A] animate-pulse'}`}></span>
            {userRole === 'admin' ? 'Admin Console' : 'Passenger Mode'}
          </span>

          {/* Operator Engine Controls button (Only in admin mode or if clicked) */}
          {onTuneClick && userRole === 'admin' && (
            <button
              onClick={onTuneClick}
              className="w-8 h-8 flex items-center justify-center rounded-xl text-[#292B29] hover:bg-[#EAE8E3] border border-[#DCDAD4] transition-colors cursor-pointer"
              title="Engine Controls & Zero-Trust Gate"
            >
              <span className="material-symbols-outlined text-[18px]">tune</span>
            </button>
          )}

          {/* Profile Button with Interactive Role Switcher Dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-1.5 p-1 rounded-xl hover:bg-[#EAE8E3] border border-transparent hover:border-[#DCDAD4] transition-all cursor-pointer"
              title="Account & Role Switcher"
              id="profile-role-switcher"
            >
              <div className="w-8 h-8 rounded-xl bg-[#858C7B] text-white flex items-center justify-center shadow-xs text-xs font-bold">
                NK
              </div>
              <span className="material-symbols-outlined text-[16px] text-[#686B66]">expand_more</span>
            </button>

            {/* Profile Popover / Role Switcher Menu */}
            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-[#FAF9F6] rounded-2xl p-3 shadow-xl border border-[#DCDAD4] z-[100] animate-fade-in flex flex-col gap-3">
                {/* User Identity */}
                <div className="flex items-center gap-2.5 pb-2 border-b border-[#DCDAD4]">
                  <div className="w-9 h-9 rounded-xl bg-[#858C7B] text-white flex items-center justify-center text-xs font-bold">
                    NK
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-[#292B29] truncate">Nakul Karpe</span>
                    <span className="text-[11px] font-mono text-[#898B84] truncate">karpenakul885</span>
                  </div>
                </div>

                {/* Role Switcher Section */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#898B84] font-semibold px-1">
                    Select Workspace Role
                  </span>

                  {/* Passenger Option */}
                  <button
                    onClick={() => handleRoleSelect('passenger')}
                    className={`flex items-start gap-2.5 p-2 rounded-xl text-left transition-all cursor-pointer ${
                      userRole === 'passenger'
                        ? 'bg-[#E5E8DF] border border-[#858C7B]/40 text-[#292B29]'
                        : 'hover:bg-[#F2EFEB] text-[#686B66]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px] text-[#52584A] mt-0.5">person</span>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-[#292B29]">Passenger Mode</span>
                      <span className="text-[10.5px] text-[#898B84]">Request rides, routes &amp; active tracking</span>
                    </div>
                    {userRole === 'passenger' && (
                      <span className="material-symbols-outlined text-[16px] text-[#52584A] ml-auto">check</span>
                    )}
                  </button>

                  {/* Admin Option */}
                  <button
                    onClick={() => handleRoleSelect('admin')}
                    className={`flex items-start gap-2.5 p-2 rounded-xl text-left transition-all cursor-pointer ${
                      userRole === 'admin'
                        ? 'bg-[#30312F] text-[#F6F5F1] border border-[#424440]'
                        : 'hover:bg-[#F2EFEB] text-[#686B66]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px] text-[#858C7B] mt-0.5">admin_panel_settings</span>
                    <div className="flex flex-col">
                      <span className={`text-xs font-semibold ${userRole === 'admin' ? 'text-[#F6F5F1]' : 'text-[#292B29]'}`}>
                        Admin &amp; Dispatcher
                      </span>
                      <span className={`text-[10.5px] ${userRole === 'admin' ? 'text-[#A3A69D]' : 'text-[#898B84]'}`}>
                        Fleet telemetry, stats &amp; zero-trust gate
                      </span>
                    </div>
                    {userRole === 'admin' && (
                      <span className="material-symbols-outlined text-[16px] text-[#858C7B] ml-auto">check</span>
                    )}
                  </button>
                </div>

                {/* Footer status */}
                <div className="pt-2 border-t border-[#DCDAD4] flex items-center justify-between text-[10px] font-mono text-[#898B84]">
                  <span>Engine: {backendStatus}</span>
                  <span className="text-[#52584A] font-semibold">v3.2</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
