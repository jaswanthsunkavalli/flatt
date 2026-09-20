export interface DFA {
  name: string;
  description: string;
  alphabet: string[];
  states: string[];
  startState: string;
  acceptStates: string[];
  // transitions[state][symbol] = nextState
  transitions: Record<string, Record<string, string>>;
  category?: string;
  formula?: string;
}

export interface SimulationStep {
  stepIndex: number;
  fromState: string;
  symbol: string;
  toState: string;
}

export interface SimulationResult {
  inputString: string;
  isValidAlphabet: boolean;
  invalidSymbol?: string;
  steps: SimulationStep[];
  currentState: string;
  isAccepted: boolean;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  message: string;
}

export interface GraphNode {
  id: string;
  label: string;
  isStart: boolean;
  isAccept: boolean;
  isDead: boolean;
  x: number;
  y: number;
  layer: number;
  radius: number;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  symbols: string[];
  isSelfLoop: boolean;
  curvature: number; // positive = curves one way, negative = curves other way, 0 = straight
  startPoint: { x: number; y: number };
  endPoint: { x: number; y: number };
  controlPoint?: { x: number; y: number };
  labelPoint: { x: number; y: number };
  pathD: string;
}

export interface GraphLayout {
  nodes: GraphNode[];
  edges: GraphEdge[];
  width: number;
  height: number;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

export type DiagramTheme = 'academic' | 'modern' | 'dark' | 'blueprint' | 'minimal';

export interface ExportSettings {
  format: 'png' | 'svg' | 'tikz' | 'dot' | 'json';
  scale: 1 | 2 | 3 | 4;
  theme: DiagramTheme;
  showDeadStates: boolean;
  useMinimized: boolean;
  showGrid: boolean;
  transparentBackground: boolean;
}

export interface DfaGeneratorOptions {
  /**
   * When true, completely prunes sink / dead states (non-accepting states
   * from which no accepting state can be reached) from the state set and
   * transition matrix, yielding an optimized graph representation while
   * maintaining 100% logical language recognition correctness.
   */
  pruneDeadStates?: boolean;
}

export interface PatternCategory {
  id: string;
  label: string;
  patterns: PatternDefinition[];
}

export interface PatternDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  parameters: {
    name: string;
    label: string;
    type: 'string' | 'number' | 'select';
    defaultValue: string | number;
    options?: { label: string; value: string | number }[];
    helperText?: string;
  }[];
  generate: (params: Record<string, any>, options?: DfaGeneratorOptions) => DFA;
  sampleAccepted: string[];
  sampleRejected: string[];
}
