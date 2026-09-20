import React from 'react';
import { DFA } from '../types';
import { Table, Binary, CheckCircle } from 'lucide-react';

interface TransitionTableProps {
  dfa: DFA;
  activeState?: string;
  activeSymbol?: string;
}

export const TransitionTable: React.FC<TransitionTableProps> = ({
  dfa,
  activeState,
  activeSymbol,
}) => {
  return (
    <div id="transition-table-panel" className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Table className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-bold text-slate-800">Formal Transition Matrix (δ)</h3>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium">
          <span className="flex items-center gap-1">
            <span className="font-mono font-bold text-blue-600">→</span> Start state
          </span>
          <span className="flex items-center gap-1">
            <span className="font-mono font-bold text-emerald-600">*</span> Accept state
          </span>
        </div>
      </div>

      {/* Formal 5-tuple Definition */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700 font-mono space-y-1">
        <div>
          <span className="font-bold text-slate-900">M = (Q, Σ, δ, q₀, F)</span>
        </div>
        <div className="text-[11px] text-slate-600 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5">
          <div>Q = &#123;{dfa.states.join(', ')}&#125;</div>
          <div>Σ = &#123;{dfa.alphabet.join(', ')}&#125;</div>
          <div>q₀ = {dfa.startState}</div>
          <div>F = &#123;{dfa.acceptStates.length > 0 ? dfa.acceptStates.join(', ') : '∅'}&#125;</div>
        </div>
      </div>

      {/* Matrix Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-xs text-left border-collapse font-mono">
          <thead className="bg-slate-100/80 text-slate-700 border-b border-slate-200">
            <tr>
              <th className="py-2 px-3 font-bold border-r border-slate-200">State (q ∈ Q)</th>
              {dfa.alphabet.map((sym) => (
                <th
                  key={sym}
                  className={`py-2 px-3 font-bold text-center transition-colors ${
                    activeSymbol === sym ? 'bg-amber-100 text-amber-900' : ''
                  }`}
                >
                  Input '{sym}'
                </th>
              ))}
              <th className="py-2 px-3 font-bold text-center border-l border-slate-200">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-800">
            {dfa.states.map((state) => {
              const isStart = state === dfa.startState;
              const isAccept = dfa.acceptStates.includes(state);
              const isCurrent = activeState === state;

              let statePrefix = '';
              if (isStart && isAccept) statePrefix = '→ * ';
              else if (isStart) statePrefix = '→ ';
              else if (isAccept) statePrefix = '* ';

              return (
                <tr
                  key={state}
                  className={`transition-colors ${
                    isCurrent
                      ? 'bg-amber-100/70 font-bold text-amber-950'
                      : isAccept
                      ? 'bg-emerald-50/40 hover:bg-emerald-50/70'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="py-2 px-3 font-bold border-r border-slate-200 whitespace-nowrap">
                    <span
                      className={`${
                        isStart
                          ? 'text-blue-600'
                          : isAccept
                          ? 'text-emerald-700'
                          : 'text-slate-700'
                      }`}
                    >
                      {statePrefix}
                      {state}
                    </span>
                  </td>

                  {dfa.alphabet.map((sym) => {
                    const dest = dfa.transitions[state]?.[sym] || '—';
                    const isCellActive = isCurrent && activeSymbol === sym;

                    return (
                      <td
                        key={sym}
                        className={`py-2 px-3 text-center transition-colors ${
                          isCellActive
                            ? 'bg-amber-300 text-amber-950 font-extrabold ring-2 ring-amber-500'
                            : ''
                        }`}
                      >
                        {dest}
                      </td>
                    );
                  })}

                  <td className="py-2 px-3 text-center border-l border-slate-200 text-[11px] font-sans">
                    {isAccept ? (
                      <span className="text-emerald-700 font-semibold bg-emerald-100/80 px-1.5 py-0.5 rounded">
                        Accepting
                      </span>
                    ) : (
                      <span className="text-slate-400">Non-accepting</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
