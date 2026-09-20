import React from 'react';
import { Network } from 'lucide-react';
import { DiagramTheme } from '../types';

interface NavbarProps {
  currentPatternName: string;
  theme: DiagramTheme;
  onThemeChange: (theme: DiagramTheme) => void;
  onOpenExport: () => void;
  onOpenCustomEditor: () => void;
  stateCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentPatternName,
  stateCount,
}) => {
  return (
    <header id="main-header" className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-30 px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20">
            <Network className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base tracking-tight text-white">DFA Designer & Diagram Studio</h1>
              <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-blue-950 text-blue-400 border border-blue-800/80">
                Deterministic
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate max-w-sm sm:max-w-md">
              Current: <span className="text-slate-200 font-medium">{currentPatternName}</span> ({stateCount} states)
            </p>
          </div>
        </div>
      </div>
    </header>
  );
};
