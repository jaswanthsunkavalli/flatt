import { DiagramTheme, ExportSettings, GraphLayout, DFA } from '../types';

export interface ThemeColors {
  bg: string;
  grid: string;
  nodeBg: string;
  nodeStroke: string;
  nodeText: string;
  acceptStroke: string;
  edgeStroke: string;
  edgeLabelBg: string;
  edgeLabelText: string;
  startArrow: string;
  activeGlow?: string;
  deadNodeBg?: string;
}

export const THEME_PALETTES: Record<DiagramTheme, ThemeColors> = {
  academic: {
    bg: '#ffffff',
    grid: '#f1f5f9',
    nodeBg: '#ffffff',
    nodeStroke: '#0f172a',
    nodeText: '#0f172a',
    acceptStroke: '#0f172a',
    edgeStroke: '#334155',
    edgeLabelBg: '#ffffff',
    edgeLabelText: '#0f172a',
    startArrow: '#0f172a',
    deadNodeBg: '#f8fafc',
  },
  modern: {
    bg: '#f8fafc',
    grid: '#e2e8f0',
    nodeBg: '#ffffff',
    nodeStroke: '#2563eb',
    nodeText: '#1e293b',
    acceptStroke: '#10b981',
    edgeStroke: '#475569',
    edgeLabelBg: '#ffffff',
    edgeLabelText: '#2563eb',
    startArrow: '#2563eb',
    deadNodeBg: '#f1f5f9',
  },
  dark: {
    bg: '#0f172a',
    grid: '#1e293b',
    nodeBg: '#1e293b',
    nodeStroke: '#60a5fa',
    nodeText: '#f8fafc',
    acceptStroke: '#34d399',
    edgeStroke: '#94a3b8',
    edgeLabelBg: '#1e293b',
    edgeLabelText: '#38bdf8',
    startArrow: '#60a5fa',
    deadNodeBg: '#1e293b',
  },
  blueprint: {
    bg: '#0a2540',
    grid: '#14365d',
    nodeBg: '#0f3256',
    nodeStroke: '#38bdf8',
    nodeText: '#ffffff',
    acceptStroke: '#4ade80',
    edgeStroke: '#7dd3fc',
    edgeLabelBg: '#0f3256',
    edgeLabelText: '#bae6fd',
    startArrow: '#38bdf8',
    deadNodeBg: '#0b1d30',
  },
  minimal: {
    bg: '#fafafa',
    grid: '#f4f4f5',
    nodeBg: '#ffffff',
    nodeStroke: '#27272a',
    nodeText: '#18181b',
    acceptStroke: '#18181b',
    edgeStroke: '#52525b',
    edgeLabelBg: '#ffffff',
    edgeLabelText: '#18181b',
    startArrow: '#27272a',
    deadNodeBg: '#f4f4f5',
  },
};

/**
 * Builds pure standalone SVG string from GraphLayout
 */
export function generateSvgString(
  layout: GraphLayout,
  settings: ExportSettings,
  highlightState?: string,
  highlightEdge?: string
): string {
  const colors = THEME_PALETTES[settings.theme] || THEME_PALETTES.modern;
  const { width, height, bounds } = layout;
  const { minX, minY } = bounds;

  const bgRect = settings.transparentBackground
    ? ''
    : `<rect width="100%" height="100%" fill="${colors.bg}" />`;

  const gridPattern = settings.showGrid && !settings.transparentBackground
    ? `
      <defs>
        <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M 24 0 L 0 0 0 24" fill="none" stroke="${colors.grid}" stroke-width="1"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
    `
    : '';

  // Arrowhead marker
  const defs = `
    <defs>
      <marker id="arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="${colors.edgeStroke}" />
      </marker>
      <marker id="start-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="${colors.startArrow}" />
      </marker>
    </defs>
  `;

  // Start indicator arrows (q0)
  const startArrowsSvg = layout.nodes
    .filter((n) => n.isStart)
    .map((n) => {
      const arrowStartX = n.x - 48;
      const arrowStartY = n.y;
      const arrowEndX = n.x - n.radius;
      return `
        <g class="start-indicator">
          <line x1="${arrowStartX}" y1="${arrowStartY}" x2="${arrowEndX}" y2="${arrowStartY}"
                stroke="${colors.startArrow}" stroke-width="2.5" marker-end="url(#start-arrow)" />
          <text x="${arrowStartX - 8}" y="${arrowStartY + 4}" font-family="system-ui, sans-serif"
                font-size="11" font-weight="600" fill="${colors.startArrow}" text-anchor="end">start</text>
        </g>
      `;
    })
    .join('\n');

  // Edges
  const edgesSvg = layout.edges
    .map((e) => {
      const isHighlighted = highlightEdge === e.id;
      const strokeColor = isHighlighted ? '#f59e0b' : colors.edgeStroke;
      const strokeWidth = isHighlighted ? 3 : 2;
      const labelText = e.symbols.join(', ');

      return `
        <g class="edge" id="edge-${e.id}">
          <path d="${e.pathD}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}"
                stroke-linecap="round" marker-end="url(#arrow)" />
          <!-- Label backdrop -->
          <rect x="${e.labelPoint.x - (labelText.length * 4.2 + 8)}" y="${e.labelPoint.y - 10}"
                width="${labelText.length * 8.4 + 16}" height="18" rx="4"
                fill="${colors.edgeLabelBg}" stroke="${isHighlighted ? strokeColor : colors.edgeStroke}"
                stroke-width="1" opacity="0.95" />
          <text x="${e.labelPoint.x}" y="${e.labelPoint.y + 3.5}"
                font-family="system-ui, sans-serif" font-size="12" font-weight="700"
                fill="${isHighlighted ? '#d97706' : colors.edgeLabelText}" text-anchor="middle">
            ${labelText}
          </text>
        </g>
      `;
    })
    .join('\n');

  // Nodes
  const nodesSvg = layout.nodes
    .map((n) => {
      const isHighlighted = highlightState === n.id;
      const strokeColor = isHighlighted
        ? '#f59e0b'
        : n.isAccept
        ? colors.acceptStroke
        : colors.nodeStroke;
      const strokeWidth = isHighlighted ? 3.5 : 2;
      const fillColor = n.isDead ? colors.deadNodeBg || colors.nodeBg : colors.nodeBg;

      const acceptRing = n.isAccept
        ? `<circle cx="${n.x}" cy="${n.y}" r="${n.radius - 5}" fill="none"
                   stroke="${strokeColor}" stroke-width="1.8" />`
        : '';

      const highlightGlow = isHighlighted
        ? `<circle cx="${n.x}" cy="${n.y}" r="${n.radius + 6}" fill="none"
                   stroke="#f59e0b" stroke-width="3" stroke-dasharray="4 2" opacity="0.8" />`
        : '';

      return `
        <g class="node" id="node-${n.id}">
          ${highlightGlow}
          <circle cx="${n.x}" cy="${n.y}" r="${n.radius}" fill="${fillColor}"
                  stroke="${strokeColor}" stroke-width="${strokeWidth}" />
          ${acceptRing}
          <text x="${n.x}" y="${n.y + 4.5}" font-family="system-ui, sans-serif"
                font-size="13" font-weight="700" fill="${isHighlighted ? '#b45309' : colors.nodeText}"
                text-anchor="middle">
            ${n.label}
          </text>
        </g>
      `;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width} ${height}" width="${width}" height="${height}">
  ${bgRect}
  ${gridPattern}
  ${defs}
  <g id="dfa-graph">
    ${startArrowsSvg}
    ${edgesSvg}
    ${nodesSvg}
  </g>
</svg>`;
}

/**
 * Converts SVG to high-resolution PNG image data URL (1x, 2x, 3x scale)
 */
export async function exportToPng(
  svgString: string,
  scale = 2
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const URL = window.URL || window.webkitURL || window;
    const blobURL = URL.createObjectURL(svgBlob);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        URL.revokeObjectURL(blobURL);
        reject(new Error('Failed to get 2D canvas context'));
        return;
      }

      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(blobURL);

      try {
        const pngUrl = canvas.toDataURL('image/png');
        resolve(pngUrl);
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(blobURL);
      reject(err);
    };

    img.src = blobURL;
  });
}

/**
 * Downloads a string or data URI as a file
 */
export function downloadFile(content: string, fileName: string, mimeType = 'text/plain') {
  const link = document.createElement('a');
  if (content.startsWith('data:')) {
    link.href = content;
  } else {
    const blob = new Blob([content], { type: mimeType });
    link.href = URL.createObjectURL(blob);
  }
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Exports to LaTeX TikZ automata package
 */
export function generateTikzCode(dfa: DFA, layout: GraphLayout): string {
  const stateLines = layout.nodes
    .map((n) => {
      const options: string[] = ['state'];
      if (n.isStart) options.push('initial');
      if (n.isAccept) options.push('accepting');
      // Scale coordinates from px to cm
      const xCm = (n.x / 80).toFixed(2);
      const yCm = (-n.y / 80).toFixed(2);
      return `  \\node[${options.join(',')}] (${n.id}) at (${xCm}, ${yCm}) {$${n.label}$};`;
    })
    .join('\n');

  const edgeLines = layout.edges
    .map((e) => {
      const label = e.symbols.join(',');
      if (e.isSelfLoop) {
        return `  \\path[->] (${e.from}) edge [loop above] node {$${label}$} (${e.to});`;
      } else if (e.curvature > 0.05) {
        return `  \\path[->] (${e.from}) edge [bend left=20] node [above] {$${label}$} (${e.to});`;
      } else if (e.curvature < -0.05) {
        return `  \\path[->] (${e.from}) edge [bend right=20] node [below] {$${label}$} (${e.to});`;
      } else {
        return `  \\path[->] (${e.from}) edge node [above] {$${label}$} (${e.to});`;
      }
    })
    .join('\n');

  return `% Requires: \\usepackage{tikz} \\usetikzlibrary{automata,positioning,arrows}
\\begin{tikzpicture}[->,>=stealth',shorten >=1pt,auto,node distance=2.8cm,semithick]
  % States
${stateLines}

  % Transitions
${edgeLines}
\\end{tikzpicture}`;
}

/**
 * Exports to Graphviz DOT format
 */
export function generateDotCode(dfa: DFA): string {
  const acceptNodes = dfa.acceptStates.map((s) => `"${s}"`).join(' ');
  const nonAcceptNodes = dfa.states
    .filter((s) => !dfa.acceptStates.includes(s))
    .map((s) => `"${s}"`)
    .join(' ');

  // Group transitions by from -> to
  const edgeMap: Record<string, string[]> = {};
  dfa.states.forEach((from) => {
    const trans = dfa.transitions[from] || {};
    dfa.alphabet.forEach((sym) => {
      const to = trans[sym];
      if (to) {
        const key = `"${from}" -> "${to}"`;
        if (!edgeMap[key]) edgeMap[key] = [];
        edgeMap[key].push(sym);
      }
    });
  });

  const transitionLines = Object.entries(edgeMap)
    .map(([key, syms]) => `  ${key} [label="${syms.join(', ')}"];`)
    .join('\n');

  return `digraph DFA {
  rankdir=LR;
  size="8,5";
  node [shape = doublecircle]; ${acceptNodes};
  node [shape = circle]; ${nonAcceptNodes};

  // Start state indicator
  __start [shape=none, label="", width=0, height=0];
  __start -> "${dfa.startState}";

  // Transitions
${transitionLines}
}`;
}
