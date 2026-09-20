import { DFA, GraphNode, GraphEdge, GraphLayout } from '../types';
import { findDeadStates } from './dfaMinimizer';

export interface LayoutOptions {
  showDeadStates?: boolean;
  horizontalSpacing?: number;
  verticalSpacing?: number;
  nodeRadius?: number;
}

/**
 * Computes a publication-quality DFA diagram layout arranged in a crystal-clear STRAIGHT LINE.
 * Features:
 * - All active and dead states positioned on a single horizontal axis (Y = constant)
 * - Start state pinned to the leftmost position
 * - Direct forward transitions render as crisp horizontal arrows
 * - Self-loops sit gracefully atop nodes
 * - Long forward jumps arch above intermediate nodes
 * - Backward transitions arch below nodes with depth scaling to eliminate crossings
 * - Opposing transitions curve symmetrically apart (forward above, return below)
 * - Complete symbol bundling (e.g. "a, b") on unified edges
 */
export function computeDfaLayout(dfa: DFA, options: LayoutOptions = {}): GraphLayout {
  const {
    showDeadStates = true,
    nodeRadius = 26,
  } = options;

  const deadStates = findDeadStates(dfa);

  // 1. Determine visible states based on dead state toggle
  const visibleStates = dfa.states.filter((s) => {
    if (!showDeadStates && deadStates.has(s)) {
      return false;
    }
    return true;
  });

  // 2. Arrange states strictly in a SINGLE STRAIGHT LINE from left to right
  const startState = dfa.startState;
  const nonDeadVisible = visibleStates.filter((s) => s !== startState && !deadStates.has(s));

  // Natural ordering for non-dead states:
  // Prefer natural numeric order (q1, q2, q3...) if applicable, else follow BFS traversal
  const canNumericSort = nonDeadVisible.every((s) => /^q?\d+$/.test(s));
  let orderedNonDead: string[] = [];

  if (canNumericSort) {
    orderedNonDead = [...nonDeadVisible].sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''), 10);
      const numB = parseInt(b.replace(/\D/g, ''), 10);
      return numA - numB;
    });
  } else {
    // Topological / BFS traversal order from start state
    const bfsOrder: string[] = [];
    const visited = new Set<string>([startState]);
    const queue: string[] = [startState];

    while (queue.length > 0) {
      const curr = queue.shift()!;
      const trans = dfa.transitions[curr] || {};
      for (const sym of dfa.alphabet) {
        const next = trans[sym];
        if (next && nonDeadVisible.includes(next) && !visited.has(next)) {
          visited.add(next);
          bfsOrder.push(next);
          queue.push(next);
        }
      }
    }

    // Append any non-dead states not reached by forward BFS
    nonDeadVisible.forEach((s) => {
      if (!visited.has(s)) {
        bfsOrder.push(s);
      }
    });

    orderedNonDead = bfsOrder;
  }

  // Dead states always sit cleanly at the right end of the line
  const deadVisible = visibleStates.filter((s) => deadStates.has(s) && s !== startState);
  const orderedStates: string[] = [startState, ...orderedNonDead, ...deadVisible];

  // 3. Assign coordinates: Y is identical for ALL states (100% straight line)
  const nodeMap: Record<string, GraphNode> = {};
  const startX = 100;
  const centerY = 200;
  // Adaptive horizontal spacing for clean breathing room
  const spacing = Math.max(160, Math.min(230, 950 / Math.max(orderedStates.length, 3)));

  orderedStates.forEach((stateId, index) => {
    nodeMap[stateId] = {
      id: stateId,
      label: stateId,
      isStart: stateId === startState,
      isAccept: dfa.acceptStates.includes(stateId),
      isDead: deadStates.has(stateId),
      x: startX + index * spacing,
      y: centerY,
      layer: index,
      radius: nodeRadius,
    };
  });

  const nodes: GraphNode[] = Object.values(nodeMap);

  // 4. Build and Bundle Edges (Combine symbols on identical source -> target)
  const edgeSymbolMap: Record<string, string[]> = {};

  visibleStates.forEach((from) => {
    const trans = dfa.transitions[from] || {};
    dfa.alphabet.forEach((sym) => {
      const to = trans[sym];
      if (to && visibleStates.includes(to)) {
        const key = `${from}-->${to}`;
        if (!edgeSymbolMap[key]) {
          edgeSymbolMap[key] = [];
        }
        if (!edgeSymbolMap[key].includes(sym)) {
          edgeSymbolMap[key].push(sym);
        }
      }
    });
  });

  // 5. Construct GraphEdges with mathematically separated curvatures
  const edges: GraphEdge[] = [];

  Object.entries(edgeSymbolMap).forEach(([key, symbols]) => {
    const [fromId, toId] = key.split('-->');
    const fromNode = nodeMap[fromId];
    const toNode = nodeMap[toId];

    if (!fromNode || !toNode) return;

    const fromIndex = orderedStates.indexOf(fromId);
    const toIndex = orderedStates.indexOf(toId);
    const isSelfLoop = fromId === toId;
    const reverseKey = `${toId}-->${fromId}`;
    const hasReverse = !!edgeSymbolMap[reverseKey];
    const span = Math.abs(toIndex - fromIndex);

    let curvature = 0;

    if (!isSelfLoop) {
      if (toIndex > fromIndex) {
        // Forward edge (Left to Right)
        if (span === 1) {
          // Adjacent states
          if (hasReverse) {
            // Forward curves ABOVE the line
            curvature = -0.32;
          } else {
            // Crisp straight horizontal line
            curvature = 0;
          }
        } else {
          // Long forward jump: arch ABOVE intermediate nodes
          curvature = -(0.30 + (span - 1) * 0.08);
        }
      } else {
        // Backward edge (Right to Left): arch BELOW the line
        // Curvature scales with span so return arcs nest without overlapping
        curvature = -(0.30 + (span - 1) * 0.09);
      }
    }

    const pathData = calculateEdgePath(fromNode, toNode, isSelfLoop, curvature);

    edges.push({
      id: key,
      from: fromId,
      to: toId,
      symbols,
      isSelfLoop,
      curvature,
      startPoint: pathData.start,
      endPoint: pathData.end,
      controlPoint: pathData.control,
      labelPoint: pathData.label,
      pathD: pathData.d,
    });
  });

  // 6. Calculate bounding box including start arrow, node radii, control points, and labels
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  nodes.forEach((n) => {
    minX = Math.min(minX, n.x - (n.isStart ? 85 : 40));
    minY = Math.min(minY, n.y - 45);
    maxX = Math.max(maxX, n.x + 40);
    maxY = Math.max(maxY, n.y + 45);
  });

  edges.forEach((e) => {
    minX = Math.min(minX, e.labelPoint.x - 25);
    minY = Math.min(minY, e.labelPoint.y - 25);
    maxX = Math.max(maxX, e.labelPoint.x + 25);
    maxY = Math.max(maxY, e.labelPoint.y + 25);
    if (e.controlPoint) {
      minX = Math.min(minX, e.controlPoint.x - 25);
      minY = Math.min(minY, e.controlPoint.y - 25);
      maxX = Math.max(maxX, e.controlPoint.x + 25);
      maxY = Math.max(maxY, e.controlPoint.y + 25);
    }
  });

  if (minX === Infinity) {
    minX = 0;
    minY = 0;
    maxX = 500;
    maxY = 300;
  }

  const margin = 40;
  const bounds = {
    minX: Math.floor(minX - margin),
    minY: Math.floor(minY - margin),
    maxX: Math.ceil(maxX + margin),
    maxY: Math.ceil(maxY + margin),
  };

  return {
    nodes,
    edges,
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY,
    bounds,
  };
}

/**
 * Geometric calculation for straight, curved, and self-loop edge paths
 */
function calculateEdgePath(
  from: GraphNode,
  to: GraphNode,
  isSelfLoop: boolean,
  curvature: number
): {
  start: { x: number; y: number };
  end: { x: number; y: number };
  control?: { x: number; y: number };
  label: { x: number; y: number };
  d: string;
} {
  const r = from.radius;

  if (isSelfLoop) {
    // Elegant loop sitting atop the node
    const loopRadius = 22;
    const loopHeight = 36;
    const startX = from.x - 10;
    const startY = from.y - r;
    const endX = from.x + 10;
    const endY = from.y - r;

    const cp1X = from.x - loopRadius;
    const cp1Y = from.y - r - loopHeight;
    const cp2X = from.x + loopRadius;
    const cp2Y = from.y - r - loopHeight;

    const d = `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;
    const label = { x: from.x, y: from.y - r - loopHeight - 8 };

    return {
      start: { x: startX, y: startY },
      end: { x: endX, y: endY },
      control: { x: from.x, y: from.y - r - loopHeight },
      label,
      d,
    };
  }

  // Calculate angle between nodes
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);

  if (Math.abs(curvature) < 0.01) {
    // Pure horizontal straight edge with arrowhead stopping at node perimeter
    const startX = from.x + Math.cos(angle) * r;
    const startY = from.y + Math.sin(angle) * r;
    const endX = to.x - Math.cos(angle) * (r + 4);
    const endY = to.y - Math.sin(angle) * (r + 4);

    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;
    // Label sits cleanly above the straight line
    const labelX = midX;
    const labelY = midY - 14;

    return {
      start: { x: startX, y: startY },
      end: { x: endX, y: endY },
      label: { x: labelX, y: labelY },
      d: `M ${startX} ${startY} L ${endX} ${endY}`,
    };
  }

  // Curved quadratic Bezier edge
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;

  // Normal vector perpendicular to chord
  const perpX = -Math.sin(angle);
  const perpY = Math.cos(angle);

  const offset = dist * curvature;
  const cpX = midX + perpX * offset;
  const cpY = midY + perpY * offset;

  // Direction from start to control point
  const angleStart = Math.atan2(cpY - from.y, cpX - from.x);
  const startX = from.x + Math.cos(angleStart) * r;
  const startY = from.y + Math.sin(angleStart) * r;

  // Direction from control point to end
  const angleEnd = Math.atan2(to.y - cpY, to.x - cpX);
  const endX = to.x - Math.cos(angleEnd) * (r + 4);
  const endY = to.y - Math.sin(angleEnd) * (r + 4);

  // Label positioned outside apex: above if curve is above line, below if curve is below
  const isAbove = cpY < from.y;
  const labelX = cpX;
  const labelY = isAbove ? cpY - 12 : cpY + 16;

  const d = `M ${startX} ${startY} Q ${cpX} ${cpY} ${endX} ${endY}`;

  return {
    start: { x: startX, y: startY },
    end: { x: endX, y: endY },
    control: { x: cpX, y: cpY },
    label: { x: labelX, y: labelY },
    d,
  };
}
