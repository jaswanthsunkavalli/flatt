import React, { useState, useMemo } from 'react';
import { DFA, DiagramTheme, PatternDefinition, DfaGeneratorOptions } from './types';
import { PATTERN_CATEGORIES, pruneDeadStates } from './services/dfaGenerators';
import { computeDfaLayout } from './services/graphLayoutEngine';
import { Navbar } from './components/Navbar';
import { PatternSelector } from './components/PatternSelector';
import { DfaCanvas } from './components/DfaCanvas';
import { SimulatorControls } from './components/SimulatorControls';
import { TransitionTable } from './components/TransitionTable';
import { ExportModal } from './components/ExportModal';
import { CustomDfaEditor } from './components/CustomDfaEditor';

export default function App() {
  // Default initial pattern: Pattern 10 - Contains two consecutive b's
  const [currentPatternId, setCurrentPatternId] = useState<string>('n_consecutive_symbol');
  const [patternParams, setPatternParams] = useState<Record<string, any>>({
    n: 2,
    symbol: 'b',
    alphabet: 'a,b',
  });

  // Base DFA generated from pattern
  const [customDfa, setCustomDfa] = useState<DFA | null>(null);

  // Dead / Trap states display toggle (defaults to true so trap/dead states are immediately visible)
  const [showDeadStates, setShowDeadStates] = useState<boolean>(true);

  // Diagram Color Theme
  const [theme, setTheme] = useState<DiagramTheme>('modern');

  // Simulator state
  const [inputString, setInputString] = useState<string>('abb');
  const [activeState, setActiveState] = useState<string | undefined>();
  const [activeEdge, setActiveEdge] = useState<string | undefined>();

  // Modals
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isCustomEditorOpen, setIsCustomEditorOpen] = useState<boolean>(false);

  // Compute Base DFA
  const effectiveDfa = useMemo<DFA>(() => {
    const generatorOptions: DfaGeneratorOptions = {
      pruneDeadStates: !showDeadStates,
    };

    if (customDfa) {
      return !showDeadStates ? pruneDeadStates(customDfa) : customDfa;
    }

    for (const cat of PATTERN_CATEGORIES) {
      const found = cat.patterns.find((p) => p.id === currentPatternId);
      if (found) {
        return found.generate(patternParams, generatorOptions);
      }
    }
    return PATTERN_CATEGORIES[0].patterns[0].generate({ pattern: 'ab', alphabet: 'a,b' }, generatorOptions);
  }, [customDfa, currentPatternId, patternParams, showDeadStates]);

  // Compute Graph Layout
  const graphLayout = useMemo(() => {
    return computeDfaLayout(effectiveDfa, {
      showDeadStates,
      horizontalSpacing: 165,
      verticalSpacing: 115,
      nodeRadius: 26,
    });
  }, [effectiveDfa, showDeadStates]);

  // Handle pattern selection
  const handleSelectPattern = (pattern: PatternDefinition, initialParams?: Record<string, any>) => {
    setCustomDfa(null);
    setCurrentPatternId(pattern.id);
    const defaultParams: Record<string, any> = {};
    pattern.parameters.forEach((p) => {
      defaultParams[p.name] = p.defaultValue;
    });
    setPatternParams(initialParams ? { ...defaultParams, ...initialParams } : defaultParams);
    // Set a sensible default sample string
    if (pattern.sampleAccepted.length > 0) {
      setInputString(pattern.sampleAccepted[0]);
    }
  };

  // Handle parameter change
  const handleParamChange = (key: string, value: any) => {
    setCustomDfa(null);
    setPatternParams((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // Handle custom DFA apply
  const handleApplyCustomDfa = (dfa: DFA) => {
    setCustomDfa(dfa);
    setCurrentPatternId('custom');
    setInputString('');
  };

  // Active symbol derived from activeEdge
  const activeSymbol = useMemo(() => {
    if (!activeEdge) return undefined;
    const edge = graphLayout.edges.find((e) => e.id === activeEdge);
    return edge?.symbols[0];
  }, [activeEdge, graphLayout.edges]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans antialiased">
      {/* Top Navbar */}
      <Navbar
        currentPatternName={effectiveDfa.name}
        theme={theme}
        onThemeChange={setTheme}
        onOpenExport={() => setIsExportModalOpen(true)}
        onOpenCustomEditor={() => setIsCustomEditorOpen(true)}
        stateCount={effectiveDfa.states.length}
      />

      {/* Main Workspace Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-5">
        {/* Pattern Library & Parameter Customizer */}
        <PatternSelector
          currentPatternId={currentPatternId}
          onSelectPattern={handleSelectPattern}
          patternParams={patternParams}
          onParamChange={handleParamChange}
          currentDfa={effectiveDfa}
          onLoadTestString={(str) => setInputString(str)}
        />

        {/* Core Workspace Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Visual Diagram Canvas + Interactive Tape Simulator */}
          <div className="lg:col-span-8 space-y-5">
            {/* SVG Graph Canvas */}
            <DfaCanvas
              layout={graphLayout}
              dfa={effectiveDfa}
              theme={theme}
              showDeadStates={showDeadStates}
              onToggleDeadStates={() => setShowDeadStates((prev) => !prev)}
              activeState={activeState}
              activeEdge={activeEdge}
              onOpenExportModal={() => setIsExportModalOpen(true)}
            />

            {/* Interactive Step-by-Step Simulator */}
            <SimulatorControls
              dfa={effectiveDfa}
              inputString={inputString}
              onInputChange={setInputString}
              onStepChange={(state, edge) => {
                setActiveState(state);
                setActiveEdge(edge);
              }}
            />
          </div>

          {/* Right Column: Formal Transition Matrix */}
          <div className="lg:col-span-4 space-y-5">
            {/* Transition Table */}
            <TransitionTable
              dfa={effectiveDfa}
              activeState={activeState}
              activeSymbol={activeSymbol}
            />
          </div>
        </div>
      </main>

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        layout={graphLayout}
        dfa={effectiveDfa}
        theme={theme}
        showDeadStates={showDeadStates}
      />

      {/* Custom DFA JSON Editor Modal */}
      <CustomDfaEditor
        isOpen={isCustomEditorOpen}
        onClose={() => setIsCustomEditorOpen(false)}
        currentDfa={effectiveDfa}
        onApplyDfa={handleApplyCustomDfa}
      />
    </div>
  );
}
