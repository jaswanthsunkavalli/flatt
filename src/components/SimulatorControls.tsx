import React, { useState, useEffect, useRef } from 'react';
import { DFA, SimulationResult } from '../types';
import { simulateDFA } from '../services/simulator';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Flame,
  ListOrdered,
} from 'lucide-react';

interface SimulatorControlsProps {
  dfa: DFA;
  inputString: string;
  onInputChange: (val: string) => void;
  onStepChange: (currentState: string, activeEdgeId?: string) => void;
}

export const SimulatorControls: React.FC<SimulatorControlsProps> = ({
  dfa,
  inputString,
  onInputChange,
  onStepChange,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(800); // ms per step
  const [showBatchTests, setShowBatchTests] = useState(false);

  // Compute full simulation result
  const simulation: SimulationResult = simulateDFA(dfa, inputString);
  const totalSteps = simulation.steps.length;

  // Active state & active transition edge at current step
  const activeState =
    currentStepIndex === 0
      ? dfa.startState
      : simulation.steps[currentStepIndex - 1]?.toState || dfa.startState;

  const activeEdge =
    currentStepIndex > 0 && currentStepIndex <= totalSteps
      ? `${simulation.steps[currentStepIndex - 1].fromState}-->${simulation.steps[currentStepIndex - 1].toState}`
      : undefined;

  // Notify parent on step change for diagram highlights
  useEffect(() => {
    onStepChange(activeState, activeEdge);
  }, [currentStepIndex, activeState, activeEdge]);

  // Reset step index when input string or DFA changes
  useEffect(() => {
    setCurrentStepIndex(0);
    setIsPlaying(false);
  }, [inputString, dfa]);

  // Auto-play timer
  const playTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isPlaying) {
      if (currentStepIndex >= totalSteps) {
        setIsPlaying(false);
        return;
      }
      playTimerRef.current = setTimeout(() => {
        setCurrentStepIndex((prev) => {
          const next = prev + 1;
          if (next >= totalSteps) {
            setIsPlaying(false);
          }
          return next;
        });
      }, playbackSpeed);
    }
    return () => {
      if (playTimerRef.current) clearTimeout(playTimerRef.current);
    };
  }, [isPlaying, currentStepIndex, totalSteps, playbackSpeed]);

  const handleStepForward = () => {
    setIsPlaying(false);
    if (currentStepIndex < totalSteps) {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  const handleStepBack = () => {
    setIsPlaying(false);
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentStepIndex(0);
  };

  const handleJumpToEnd = () => {
    setIsPlaying(false);
    setCurrentStepIndex(totalSteps);
  };

  const isAtEnd = currentStepIndex === totalSteps;
  const isFinalAccepted = isAtEnd && simulation.isAccepted;
  const isFinalRejected = isAtEnd && !simulation.isAccepted;

  // Dynamic quick test strings mapped to DFA alphabet
  const [s0, s1] = [dfa.alphabet[0] || '0', dfa.alphabet[1] || (dfa.alphabet[0] === '0' ? '1' : 'b')];
  const batchTestCases = [
    '',
    `${s0}`,
    `${s1}`,
    `${s0}${s0}`,
    `${s0}${s1}`,
    `${s1}${s0}`,
    `${s1}${s1}`,
    `${s0}${s0}${s1}`,
    `${s0}${s1}${s0}`,
    `${s1}${s0}${s1}`,
    `${s1}${s1}${s0}`,
    `${s1}${s0}${s0}${s1}`,
    `${s1}${s0}${s1}${s0}`,
    `${s1}${s1}${s0}${s0}`,
    `${s0}${s1}${s0}${s1}${s0}`,
  ];

  return (
    <div id="simulator-controls-panel" className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
      {/* Panel Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-bold text-slate-800">DFA String Simulator & Tape Playback</h3>
        </div>
        <button
          type="button"
          onClick={() => setShowBatchTests(!showBatchTests)}
          className="text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded transition-colors flex items-center gap-1.5"
        >
          <ListOrdered className="w-3.5 h-3.5" />
          <span>{showBatchTests ? 'Hide Test Suite' : 'Batch Test Suite'}</span>
        </button>
      </div>

      {/* Input String Input */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="dfa-input-tape" className="text-xs font-semibold text-slate-700">
            Input Tape String (Alphabet: &#123;{dfa.alphabet.join(', ')}&#125;)
          </label>
          <span className="text-[11px] text-slate-400 font-mono">Length: {inputString.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              id="dfa-input-tape"
              type="text"
              value={inputString}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder="e.g. 10101 or leave empty for ε"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono font-semibold text-slate-900 tracking-wider focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => onInputChange('')}
            className="text-xs font-semibold px-2.5 py-2 text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors"
            title="Clear String (Epsilon ε)"
          >
            ε (empty)
          </button>
        </div>
      </div>

      {/* Invalid Symbol Alert */}
      {!simulation.isValidAlphabet && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-2.5 flex items-center gap-2 text-xs text-rose-700">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{simulation.message}</span>
        </div>
      )}

      {/* Visual Tape Cells */}
      {simulation.isValidAlphabet && (
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">
            <span>Tape Cells</span>
            <span>
              Step {currentStepIndex} of {totalSteps}
            </span>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto pb-2 pt-1 scrollbar-thin">
            {inputString.length === 0 ? (
              <div
                className={`w-11 h-11 rounded-md border font-mono text-sm font-bold flex items-center justify-center transition-all ${
                  currentStepIndex === 0
                    ? 'bg-amber-100 border-amber-500 text-amber-900 ring-2 ring-amber-400/50'
                    : 'bg-slate-50 border-slate-300 text-slate-400'
                }`}
              >
                ε
              </div>
            ) : (
              inputString.split('').map((char, index) => {
                const isCurrent = index === currentStepIndex;
                const isPassed = index < currentStepIndex;
                return (
                  <div
                    key={index}
                    onClick={() => {
                      setIsPlaying(false);
                      setCurrentStepIndex(index);
                    }}
                    className={`shrink-0 w-10 h-10 rounded-md border font-mono text-sm font-bold flex flex-col items-center justify-center cursor-pointer transition-all ${
                      isCurrent
                        ? 'bg-amber-100 border-amber-500 text-amber-900 ring-2 ring-amber-400/50 shadow-xs'
                        : isPassed
                        ? 'bg-blue-50 border-blue-300 text-blue-800'
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    <span>{char}</span>
                    <span className="text-[9px] font-normal text-slate-400 -mt-1">{index}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Playback Controls & Status Badge */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
        {/* Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleReset}
            disabled={currentStepIndex === 0}
            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            title="Reset to Start"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleStepBack}
            disabled={currentStepIndex === 0}
            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            title="Step Backward"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (isAtEnd) {
                setCurrentStepIndex(0);
                setIsPlaying(true);
              } else {
                setIsPlaying(!isPlaying);
              }
            }}
            disabled={!simulation.isValidAlphabet}
            className={`px-3 py-1.5 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-2xs ${
              isPlaying
                ? 'bg-amber-500 text-white hover:bg-amber-600'
                : 'bg-blue-600 text-white hover:bg-blue-500'
            } disabled:opacity-40`}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span>{isPlaying ? 'Pause' : isAtEnd ? 'Replay' : 'Play'}</span>
          </button>
          <button
            type="button"
            onClick={handleStepForward}
            disabled={isAtEnd || !simulation.isValidAlphabet}
            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            title="Step Forward"
          >
            <SkipForward className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleJumpToEnd}
            disabled={isAtEnd || !simulation.isValidAlphabet}
            className="text-xs font-semibold px-2 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            title="Jump to End"
          >
            Fast Forward
          </button>
        </div>

        {/* Speed Slider */}
        <div className="flex items-center gap-2">
          <label htmlFor="playback-speed-select" className="text-[11px] font-medium text-slate-500">
            Speed:
          </label>
          <select
            id="playback-speed-select"
            value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded px-2 py-1 focus:outline-none"
          >
            <option value={1500}>0.5x (Slow)</option>
            <option value={800}>1.0x (Normal)</option>
            <option value={400}>2.0x (Fast)</option>
            <option value={150}>4.0x (Instant)</option>
          </select>
        </div>

        {/* Current State & Acceptance Status */}
        <div className="flex items-center gap-2">
          <div className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md font-mono font-bold">
            State: <span className="text-blue-600">{activeState}</span>
          </div>

          {isFinalAccepted && (
            <div className="flex items-center gap-1.5 bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1 rounded-md text-xs font-bold shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>ACCEPTED</span>
            </div>
          )}

          {isFinalRejected && (
            <div className="flex items-center gap-1.5 bg-rose-100 text-rose-800 border border-rose-300 px-3 py-1 rounded-md text-xs font-bold shadow-2xs">
              <XCircle className="w-4 h-4 text-rose-600" />
              <span>REJECTED</span>
            </div>
          )}

          {!isAtEnd && simulation.isValidAlphabet && (
            <div className="text-xs text-slate-500 font-medium px-2 py-1">
              Step {currentStepIndex}/{totalSteps}
            </div>
          )}
        </div>
      </div>

      {/* Path Trace Log */}
      {simulation.steps.length > 0 && (
        <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-2.5 text-xs">
          <div className="text-[11px] font-semibold text-slate-500 mb-1">State Transition Path:</div>
          <div className="font-mono text-slate-800 flex flex-wrap items-center gap-1 text-[11px]">
            <span className="font-bold text-blue-700 bg-blue-100/70 px-1 rounded">{dfa.startState}</span>
            {simulation.steps.map((step, idx) => {
              const isPastOrCurrent = idx < currentStepIndex;
              return (
                <span
                  key={idx}
                  className={`flex items-center gap-1 ${
                    isPastOrCurrent ? 'text-slate-900 font-semibold' : 'text-slate-400'
                  }`}
                >
                  <span>→</span>
                  <span className="bg-slate-200 text-slate-700 px-1 rounded text-[10px]">
                    '{step.symbol}'
                  </span>
                  <span>→</span>
                  <span
                    className={`px-1 rounded ${
                      idx === currentStepIndex - 1
                        ? 'bg-amber-200 text-amber-900 font-bold'
                        : isPastOrCurrent
                        ? 'bg-slate-100 text-slate-800'
                        : 'text-slate-400'
                    }`}
                  >
                    {step.toState}
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Batch Test Suite Drawer */}
      {showBatchTests && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span>Automated Test Suite (15 Test Cases)</span>
            <span className="text-[11px] font-normal text-slate-500">Click any row to test on canvas</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {batchTestCases.map((testStr, i) => {
              const testRes = simulateDFA(dfa, testStr);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => onInputChange(testStr)}
                  className={`p-2 rounded-lg border text-left flex items-center justify-between text-xs font-mono transition-all cursor-pointer ${
                    testRes.isAccepted
                      ? 'bg-emerald-50/70 border-emerald-300 hover:bg-emerald-100/80 text-emerald-900'
                      : 'bg-rose-50/70 border-rose-300 hover:bg-rose-100/80 text-rose-900'
                  }`}
                >
                  <span className="font-semibold truncate max-w-[80px]">
                    {testStr === '' ? 'ε (empty)' : testStr}
                  </span>
                  {testRes.isAccepted ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
