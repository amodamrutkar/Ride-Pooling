import React from 'react';

export default function Header({ title = "Live Pool", showBack = false, onBack = null, onTuneClick = null }) {
  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-surface/85 backdrop-blur-xl pt-safe shadow-[0_1px_8px_rgba(0,0,0,0.25)] border-b border-surface-container-high/40">
      <div className="h-14 px-4 flex items-center justify-between max-w-xl mx-auto">
        <div className="flex items-center gap-2">
          {showBack ? (
            <button
              onClick={onBack}
              className="w-10 h-10 -ml-2 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
              aria-label="Back"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </button>
          ) : (
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-surface-container-high text-primary">
              <span className="material-symbols-outlined text-[18px]">alt_route</span>
            </span>
          )}
          <h1 className="font-label-mono text-label-mono uppercase text-on-surface tracking-wider font-semibold truncate">
            {title}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface-container-high/80 text-[10px] font-label-mono text-primary font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
            SYNC
          </span>
          {onTuneClick && (
            <button
              onClick={onTuneClick}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
              title="Settings"
            >
              <span className="material-symbols-outlined text-[20px]">tune</span>
            </button>
          )}
          <div className="w-8 h-8 rounded-full ring-1 ring-primary/40 bg-surface-container-high flex items-center justify-center overflow-hidden">
            <span className="material-symbols-outlined text-primary text-[20px]">person</span>
          </div>
        </div>
      </div>
    </header>
  );
}
