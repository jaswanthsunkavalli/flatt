import React, { useState } from 'react';
import { DFA } from '../types';
import { X, Check, AlertCircle, FileCode, Sparkles } from 'lucide-react';

interface CustomDfaEditorProps {
  isOpen: boolean;
  onClose: () => void;
  currentDfa: DFA;
  onApplyDfa: (dfa: DFA) => void;
}

export const CustomDfaEditor: React.FC<CustomDfaEditorProps> = ({
  isOpen,
  onClose,
  currentDfa,
  onApplyDfa,
}) => {
  const [jsonText, setJsonText] = useState(() => JSON.stringify(currentDfa, null, 2));
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleApply = () => {
    try {
      const parsed = JSON.parse(jsonText);

      // Validation
      if (!Array.isArray(parsed.states) || parsed.states.length === 0) {
        throw new Error("'states' must be a non-empty array of strings.");
      }
      if (!Array.isArray(parsed.alphabet) || parsed.alphabet.length === 0) {
        throw new Error("'alphabet' must be a non-empty array of symbols.");
      }
      if (!parsed.startState || !parsed.states.includes(parsed.startState)) {
        throw new Error(`'startState' ("${parsed.startState}") must belong to 'states'.`);
      }
      if (!Array.isArray(parsed.acceptStates)) {
        throw new Error("'acceptStates' must be an array.");
      }
      for (const acc of parsed.acceptStates) {
        if (!parsed.states.includes(acc)) {
          throw new Error(`Accept state "${acc}" is not present in 'states'.`);
        }
      }
      if (typeof parsed.transitions !== 'object' || parsed.transitions === null) {
        throw new Error("'transitions' must be a map from state -> { symbol: nextState }.");
      }

      const validDfa: DFA = {
        name: parsed.name || 'Custom DFA',
        description: parsed.description || 'User-defined custom finite automaton.',
        alphabet: parsed.alphabet,
        states: parsed.states,
        startState: parsed.startState,
        acceptStates: parsed.acceptStates,
        transitions: parsed.transitions,
        category: 'custom',
        formula: parsed.formula || 'Custom Language',
      };

      setErrorMsg(null);
      onApplyDfa(validDfa);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid JSON format or DFA constraints not met.');
    }
  };

  const sampleJsonPreset = {
    name: "Contains Substring '101'",
    description: "Strings containing '101' as a substring",
    alphabet: ['0', '1'],
    states: ['q0', 'q1', 'q2', 'q3'],
    startState: 'q0',
    acceptStates: ['q3'],
    transitions: {
      q0: { '0': 'q0', '1': 'q1' },
      q1: { '0': 'q2', '1': 'q1' },
      q2: { '0': 'q0', '1': 'q3' },
      q3: { '0': 'q3', '1': 'q3' },
    },
    formula: "L = { w ∈ {0,1}* | '101' ∈ Substrings(w) }",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-blue-400" />
            <h3 className="font-bold text-sm">Custom DFA JSON Specification</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-3 overflow-y-auto flex-1 text-xs">
          <div className="flex items-center justify-between">
            <p className="text-slate-600">
              Paste or edit the canonical DFA JSON object. The graph layout, edge bundling, and simulator will
              automatically synchronize.
            </p>
            <button
              type="button"
              onClick={() => setJsonText(JSON.stringify(sampleJsonPreset, null, 2))}
              className="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3" /> Load Preset
            </button>
          </div>

          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-2.5 flex items-start gap-2 text-rose-700">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            rows={14}
            className="w-full bg-slate-900 text-emerald-400 p-3.5 rounded-xl font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none scrollbar-thin"
            spellCheck={false}
          />
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleApply}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-sm transition-all"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Apply DFA</span>
          </button>
        </div>
      </div>
    </div>
  );
};
