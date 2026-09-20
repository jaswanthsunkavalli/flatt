import React from 'react';
import { PATTERN_CATEGORIES } from '../services/dfaGenerators';
import { PatternDefinition, DFA } from '../types';
import { Sparkles, Info } from 'lucide-react';

interface PatternSelectorProps {
  currentPatternId: string;
  onSelectPattern: (pattern: PatternDefinition, initialParams?: Record<string, any>) => void;
  patternParams: Record<string, any>;
  onParamChange: (key: string, value: any) => void;
  currentDfa: DFA;
  onLoadTestString?: (str: string) => void;
}

export const PatternSelector: React.FC<PatternSelectorProps> = ({
  currentPatternId,
  onSelectPattern,
  patternParams,
  onParamChange,
  currentDfa,
}) => {
  // Find current active pattern definition
  let activePattern: PatternDefinition | undefined;
  for (const cat of PATTERN_CATEGORIES) {
    const found = cat.patterns.find((p) => p.id === currentPatternId);
    if (found) {
      activePattern = found;
      break;
    }
  }

  const totalPatterns = PATTERN_CATEGORIES.reduce((acc, c) => acc + c.patterns.length, 0);

  return (
    <div id="pattern-selector-panel" className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-800 tracking-tight">Automata Pattern Library</h2>
          <p className="text-xs text-slate-500">Canonical formal language patterns with complete deterministic transitions</p>
        </div>
        <span className="text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full">
          {totalPatterns} Patterns
        </span>
      </div>

      {/* Categories and Dropdown + Parameters */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
        <div className={activePattern && activePattern.parameters.length > 0 ? 'lg:col-span-5' : 'lg:col-span-12'}>
          <label htmlFor="pattern-category-select" className="block text-xs font-semibold text-slate-700 mb-1">
            Language Pattern
          </label>
          <select
            id="pattern-category-select"
            value={currentPatternId}
            onChange={(e) => {
              const selectedId = e.target.value;
              for (const cat of PATTERN_CATEGORIES) {
                const found = cat.patterns.find((p) => p.id === selectedId);
                if (found) {
                  const defaultParams: Record<string, any> = {};
                  found.parameters.forEach((param) => {
                    defaultParams[param.name] = param.defaultValue;
                  });
                  onSelectPattern(found, defaultParams);
                  break;
                }
              }
            }}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none transition-all cursor-pointer"
          >
            {PATTERN_CATEGORIES.map((category) => (
              <optgroup key={category.id} label={category.label}>
                {category.patterns.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Dynamic Parameters for current pattern */}
        {activePattern && activePattern.parameters.length > 0 && (
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {activePattern.parameters.map((param) => (
              <div key={param.name}>
                <label
                  htmlFor={`param-${param.name}`}
                  className="block text-xs font-semibold text-slate-700 mb-1 truncate"
                  title={param.label}
                >
                  {param.label}
                </label>
                {param.type === 'select' && param.options ? (
                  <select
                    id={`param-${param.name}`}
                    value={patternParams[param.name] ?? param.defaultValue}
                    onChange={(e) => onParamChange(param.name, e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none"
                  >
                    {param.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={`param-${param.name}`}
                    type={param.type === 'number' ? 'number' : 'text'}
                    value={patternParams[param.name] ?? param.defaultValue}
                    onChange={(e) =>
                      onParamChange(
                        param.name,
                        param.type === 'number' ? Number(e.target.value) : e.target.value
                      )
                    }
                    placeholder={param.helperText}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none"
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pattern Description & Formal Math Formula */}
      {currentDfa.formula && (
        <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-2.5 flex items-start gap-2.5 text-xs text-slate-600">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="flex-1 overflow-hidden">
            <div className="font-mono text-slate-900 font-semibold text-[13px] truncate">
              {currentDfa.formula}
            </div>
            <p className="text-slate-500 text-[11px] mt-0.5">{currentDfa.description}</p>
          </div>
        </div>
      )}
    </div>
  );
};
