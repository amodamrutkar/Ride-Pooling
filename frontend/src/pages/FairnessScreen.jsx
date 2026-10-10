import React, { useState } from 'react';

/**
 * Fairness Vault & Co-Op — Breakthrough Shared Mobility Feature
 *
 * Capabilities that DO NOT exist in existing solutions (UberPool / BlaBlaCar):
 * 1. Automated SLA Detour Rebate Guarantee: Instant automated compensation credit if detour exceeds SLA
 * 2. Co-Rider Harmony & Commute Vibe Lock: Quiet commute, women-verified matching, AC temperature consensus
 * 3. Nashik Green Co-Op Karma: Verified carbon offset ledger with municipal transit rebates
 */
export default function FairnessScreen() {
  const [quietCommute, setQuietCommute] = useState(true);
  const [womenVerified, setWomenVerified] = useState(false);
  const [temperature, setTemperature] = useState(23);
  const [luggageLock, setLuggageLock] = useState(true);

  const [claimStatus, setClaimStatus] = useState('active'); // 'active' | 'claimed'

  return (
    <div className="flex flex-col w-full px-4 gap-4 text-[#292B29] select-none pb-8 animate-fade-in">
      {/* Header Banner */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#52584A]"></span>
            <span className="font-mono text-[10.5px] uppercase tracking-wider text-[#686B66] font-semibold">
              Industry First Feature
            </span>
          </div>
          <h1 className="font-sans text-xl md:text-2xl font-bold tracking-tight text-[#292B29]">
            Fairness Vault &amp; Co-Op
          </h1>
        </div>
        <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-[#E5E8DF] border border-[#DCDAD4] text-[#343B30] font-mono text-[11px] font-semibold">
          <span className="material-symbols-outlined text-[15px] text-[#52584A]">verified_user</span>
          <span>SLA Protected</span>
        </div>
      </div>

      {/* 1. Automated SLA Detour Rebate Guarantee Card */}
      <div className="rounded-2xl p-4 bg-[#FAF9F6] border border-[#DCDAD4] shadow-xs flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-[#E5E8DF] text-[#52584A] flex items-center justify-center border border-[#DCDAD4]">
              <span className="material-symbols-outlined text-[19px]">account_balance_wallet</span>
            </span>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-[#292B29]">Zero-Breach Detour Guarantee</span>
              <span className="text-[11px] text-[#898B84]">Automated Instant Rebate Contract</span>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-[#E5E8DF] font-mono text-[10px] font-bold text-[#343B30] border border-[#DCDAD4]">
            15% CAP
          </span>
        </div>

        <p className="text-xs text-[#686B66] leading-relaxed">
          In typical carpooling, unexpected detours cost you time with zero recourse. Under <strong>poolIQ's Fairness Vault</strong>, if your ride detour exceeds 15% of your direct baseline, the engine automatically credits 25% of your fare back to your wallet.
        </p>

        {/* Live Contract Status */}
        <div className="p-3 rounded-xl bg-[#F2EFEB] border border-[#DCDAD4] flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10.5px] font-mono text-[#898B84] uppercase">Current Ride Protection</span>
            <span className="text-xs font-bold text-[#292B29] font-mono">Max Detour Permitted: 3.2 min</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#52584A] animate-pulse"></span>
            <span className="font-mono text-xs font-bold text-[#52584A]">Active &amp; Guarded</span>
          </div>
        </div>
      </div>

      {/* 2. Co-Rider Harmony & Vibe Lock (Novel: Pre-set shared ride preferences) */}
      <div className="rounded-2xl p-4 bg-[#FAF9F6] border border-[#DCDAD4] shadow-xs flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#898B84] font-semibold">
              Algorithmic Compatibility
            </span>
            <span className="text-sm font-bold text-[#292B29]">Co-Rider Harmony Preferences</span>
          </div>
          <span className="material-symbols-outlined text-[#858C7B] text-[20px]">tune</span>
        </div>
        <p className="text-[11.5px] text-[#686B66]">
          The dispatch solver matches co-riders with compatible trip preferences to ensure a quiet, respectful shared commute.
        </p>

        {/* Toggle options */}
        <div className="flex flex-col gap-2 pt-1">
          {/* Option 1: Quiet Commute */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#F2EFEB] border border-[#DCDAD4]">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[18px] text-[#52584A]">volume_off</span>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-[#292B29]">Quiet Commute Lock</span>
                <span className="text-[10px] text-[#898B84]">Matched with silent co-riders (no speaker calls)</span>
              </div>
            </div>
            <button
              onClick={() => setQuietCommute(!quietCommute)}
              className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer ${quietCommute ? 'bg-[#52584A]' : 'bg-[#DCDAD4]'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white transition-transform ${quietCommute ? 'translate-x-5' : 'translate-x-0'}`}></div>
            </button>
          </div>

          {/* Option 2: Women-Verified Matching */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#F2EFEB] border border-[#DCDAD4]">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[18px] text-[#52584A]">shield_person</span>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-[#292B29]">Women-Verified Pool</span>
                <span className="text-[10px] text-[#898B84]">Exclusive matching with verified women riders</span>
              </div>
            </div>
            <button
              onClick={() => setWomenVerified(!womenVerified)}
              className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer ${womenVerified ? 'bg-[#52584A]' : 'bg-[#DCDAD4]'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white transition-transform ${womenVerified ? 'translate-x-5' : 'translate-x-0'}`}></div>
            </button>
          </div>

          {/* Option 3: Guaranteed Luggage Allocation */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#F2EFEB] border border-[#DCDAD4]">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[18px] text-[#52584A]">luggage</span>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-[#292B29]">Boot Space Reservation</span>
                <span className="text-[10px] text-[#898B84]">Guarantees 1 large suitcase capacity in vehicle boot</span>
              </div>
            </div>
            <button
              onClick={() => setLuggageLock(!luggageLock)}
              className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer ${luggageLock ? 'bg-[#52584A]' : 'bg-[#DCDAD4]'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white transition-transform ${luggageLock ? 'translate-x-5' : 'translate-x-0'}`}></div>
            </button>
          </div>

          {/* Option 4: Climate Consensus */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#F2EFEB] border border-[#DCDAD4]">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[18px] text-[#52584A]">ac_unit</span>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-[#292B29]">Cabin Climate Consensus</span>
                <span className="text-[10px] text-[#898B84]">Fleet-standard cabin comfort temperature</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTemperature(t => Math.max(20, t - 1))}
                className="w-6 h-6 rounded-lg bg-white border border-[#DCDAD4] text-xs font-bold cursor-pointer"
              >
                -
              </button>
              <span className="font-mono text-xs font-bold text-[#292B29]">{temperature}°C</span>
              <button
                onClick={() => setTemperature(t => Math.min(26, t + 1))}
                className="w-6 h-6 rounded-lg bg-white border border-[#DCDAD4] text-xs font-bold cursor-pointer"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Nashik Green Co-op Karma Ledger */}
      <div className="rounded-2xl p-4 bg-[#FAF9F6] border border-[#DCDAD4] shadow-xs flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#898B84] font-semibold">
              Municipal Carbon Co-Op
            </span>
            <span className="text-sm font-bold text-[#292B29]">Nashik Green Karma Ledger</span>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-[#E5E8DF] font-mono text-[11px] font-bold text-[#343B30]">
            Tier: Silver Pooler
          </span>
        </div>

        {/* Carbon stats row */}
        <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-[#F2EFEB] border border-[#DCDAD4] text-center">
          <div className="flex flex-col items-center">
            <span className="font-mono text-[10px] text-[#898B84]">CO₂ Offset</span>
            <span className="text-base font-bold text-[#52584A] font-mono mt-0.5">38.4 kg</span>
            <span className="text-[10px] text-[#686B66]">This Month</span>
          </div>
          <div className="flex flex-col items-center border-l border-[#DCDAD4]">
            <span className="font-mono text-[10px] text-[#898B84]">City Rank</span>
            <span className="text-base font-bold text-[#292B29] font-mono mt-0.5">#42</span>
            <span className="text-[10px] text-[#686B66]">Nashik West</span>
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-[#E5E8DF]/60 border border-[#DCDAD4] flex items-center justify-between">
          <span className="text-xs text-[#343B30] font-medium">
            Earned ₹45 Municipal Transit Discount Voucher
          </span>
          <button
            onClick={() => setClaimStatus('claimed')}
            className={`px-3 py-1 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer ${
              claimStatus === 'claimed'
                ? 'bg-[#52584A] text-white'
                : 'bg-white border border-[#DCDAD4] text-[#292B29] hover:bg-[#F2EFEB]'
            }`}
          >
            {claimStatus === 'claimed' ? 'Claimed ✓' : 'Claim Voucher'}
          </button>
        </div>
      </div>
    </div>
  );
}
