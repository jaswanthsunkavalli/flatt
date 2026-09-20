import React, { useRef, useState, useEffect } from 'react';
import { GraphLayout, DiagramTheme, DFA } from '../types';
import { THEME_PALETTES, generateSvgString, exportToPng, downloadFile } from '../services/imageExporter';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Eye,
  EyeOff,
  Download,
  Image as ImageIcon,
  RotateCcw,
} from 'lucide-react';

interface DfaCanvasProps {
  layout: GraphLayout;
  dfa: DFA;
  theme: DiagramTheme;
  showDeadStates: boolean;
  onToggleDeadStates: () => void;
  activeState?: string;
  activeEdge?: string;
  onOpenExportModal: () => void;
}

export const DfaCanvas: React.FC<DfaCanvasProps> = ({
  layout,
  dfa,
  theme,
  showDeadStates,
  onToggleDeadStates,
  activeState,
  activeEdge,
  onOpenExportModal,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const colors = THEME_PALETTES[theme] || THEME_PALETTES.modern;

  // Auto-fit when layout changes significantly
  useEffect(() => {
    resetView();
  }, [layout.width, layout.height]);

  const resetView = () => {
    if (!containerRef.current) return;
    const containerWidth = containerRef.current.clientWidth || 800;
    const containerHeight = containerRef.current.clientHeight || 450;

    const scaleX = (containerWidth - 60) / Math.max(layout.width, 300);
    const scaleY = (containerHeight - 60) / Math.max(layout.height, 250);
    const fitScale = Math.min(Math.max(Math.min(scaleX, scaleY), 0.6), 1.4);

    setZoom(fitScale);

    // Center layout in view
    const centerX = (containerWidth - layout.width * fitScale) / 2 - layout.bounds.minX * fitScale;
    const centerY = (containerHeight - layout.height * fitScale) / 2 - layout.bounds.minY * fitScale;
    setPan({ x: centerX, y: centerY });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // only left click
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom((prev) => Math.min(Math.max(prev * zoomFactor, 0.3), 3.0));
  };

  const handleQuickPngExport = async () => {
    const svgStr = generateSvgString(layout, {
      format: 'png',
      scale: 2,
      theme,
      showDeadStates,
      useMinimized: false,
      showGrid: true,
      transparentBackground: false,
    });
    try {
      const dataUrl = await exportToPng(svgStr, 2);
      downloadFile(dataUrl, `${dfa.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_dfa_2x.png`, 'image/png');
    } catch (err) {
      console.error('Failed to export PNG', err);
    }
  };

  const handleQuickSvgExport = () => {
    const svgStr = generateSvgString(layout, {
      format: 'svg',
      scale: 1,
      theme,
      showDeadStates,
      useMinimized: false,
      showGrid: false,
      transparentBackground: false,
    });
    downloadFile(svgStr, `${dfa.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_dfa.svg`, 'image/svg+xml');
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden flex flex-col">
      {/* Diagram Canvas Controls Toolbar */}
      <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
            <span>State Diagram</span>
          </span>

          {/* Trap/Dead State Toggle */}
          <button
            id="toggle-dead-states-btn"
            type="button"
            onClick={onToggleDeadStates}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md font-medium border transition-colors ${
              showDeadStates
                ? 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
            }`}
            title="Toggle sink/dead state handling: Complete DFA (included) vs Pruned from graph generation"
          >
            {showDeadStates ? (
              <>
                <Eye className="w-3.5 h-3.5 text-slate-500" />
                <span>Trap State: Included</span>
              </>
            ) : (
              <>
                <EyeOff className="w-3.5 h-3.5 text-emerald-600" />
                <span>Trap State: Pruned</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* SVG Canvas Workspace */}
      <div
        ref={containerRef}
        id="svg-canvas-container"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        className="relative h-[380px] sm:h-[440px] w-full overflow-hidden select-none cursor-grab active:cursor-grabbing"
        style={{ backgroundColor: colors.bg }}
      >
        <svg
          className="w-full h-full"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {/* Subtle Grid pattern */}
          <defs>
            <pattern id="canvas-grid" width="28" height="28" patternUnits="userSpaceOnUse">
              <path d="M 28 0 L 0 0 0 28" fill="none" stroke={colors.grid} strokeWidth="1" />
            </pattern>

            <marker
              id="canvas-arrow"
              viewBox="0 0 10 10"
              refX="7"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill={colors.edgeStroke} />
            </marker>

            <marker
              id="canvas-start-arrow"
              viewBox="0 0 10 10"
              refX="7"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill={colors.startArrow} />
            </marker>

            <marker
              id="canvas-active-arrow"
              viewBox="0 0 10 10"
              refX="7"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#f59e0b" />
            </marker>
          </defs>

          {/* Grid background layer */}
          <rect
            x={layout.bounds.minX - 500}
            y={layout.bounds.minY - 500}
            width={layout.width + 1000}
            height={layout.height + 1000}
            fill="url(#canvas-grid)"
          />

          {/* Start State Indicator Arrows */}
          {layout.nodes
            .filter((n) => n.isStart)
            .map((n) => (
              <g key={`start-${n.id}`} className="transition-opacity">
                <line
                  x1={n.x - 48}
                  y1={n.y}
                  x2={n.x - n.radius}
                  y2={n.y}
                  stroke={colors.startArrow}
                  strokeWidth="2.5"
                  markerEnd="url(#canvas-start-arrow)"
                />
                <text
                  x={n.x - 56}
                  y={n.y + 4}
                  fontFamily="system-ui, sans-serif"
                  fontSize="12"
                  fontWeight="700"
                  fill={colors.startArrow}
                  textAnchor="end"
                >
                  start
                </text>
              </g>
            ))}

          {/* Edges (Transitions) */}
          {layout.edges.map((e) => {
            const isHighlighted = activeEdge === e.id;
            const strokeColor = isHighlighted ? '#f59e0b' : colors.edgeStroke;
            const strokeWidth = isHighlighted ? 3.5 : 2;
            const markerId = isHighlighted ? 'url(#canvas-active-arrow)' : 'url(#canvas-arrow)';
            const labelText = e.symbols.join(', ');

            return (
              <g key={e.id} id={`canvas-edge-${e.id}`}>
                <path
                  d={e.pathD}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  markerEnd={markerId}
                  className="transition-colors duration-200"
                />

                {/* Label Pill Box */}
                <rect
                  x={e.labelPoint.x - (labelText.length * 4.2 + 8)}
                  y={e.labelPoint.y - 10}
                  width={labelText.length * 8.4 + 16}
                  height={19}
                  rx="4"
                  fill={colors.edgeLabelBg}
                  stroke={isHighlighted ? '#f59e0b' : colors.edgeStroke}
                  strokeWidth="1"
                  opacity="0.95"
                  className="transition-all duration-200"
                />
                <text
                  x={e.labelPoint.x}
                  y={e.labelPoint.y + 3.8}
                  fontFamily="system-ui, sans-serif"
                  fontSize="12"
                  fontWeight="700"
                  fill={isHighlighted ? '#d97706' : colors.edgeLabelText}
                  textAnchor="middle"
                  className="pointer-events-none"
                >
                  {labelText}
                </text>
              </g>
            );
          })}

          {/* Nodes (States) */}
          {layout.nodes.map((n) => {
            const isHighlighted = activeState === n.id;
            const isHovered = hoveredNode === n.id;
            const strokeColor = isHighlighted
              ? '#f59e0b'
              : n.isAccept
              ? colors.acceptStroke
              : colors.nodeStroke;
            const strokeWidth = isHighlighted ? 3.5 : 2;
            const fillColor = n.isDead ? colors.deadNodeBg || colors.nodeBg : colors.nodeBg;

            return (
              <g
                key={n.id}
                id={`canvas-node-${n.id}`}
                onMouseEnter={() => setHoveredNode(n.id)}
                onMouseLeave={() => setHoveredNode(null)}
                className="cursor-pointer"
              >
                {/* Active glow ring during simulation */}
                {isHighlighted && (
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={n.radius + 7}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="3.5"
                    strokeDasharray="4 2"
                    className="animate-spin origin-center"
                    style={{
                      transformOrigin: `${n.x}px ${n.y}px`,
                      animationDuration: '6s',
                    }}
                  />
                )}

                {/* Main Node Circle */}
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={n.radius}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  className="transition-all duration-200"
                />

                {/* Double ring for accept states */}
                {n.isAccept && (
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={n.radius - 5}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth="1.8"
                    className="transition-colors duration-200"
                  />
                )}

                {/* State Label */}
                <text
                  x={n.x}
                  y={n.y + 4.5}
                  fontFamily="system-ui, sans-serif"
                  fontSize="13"
                  fontWeight="700"
                  fill={isHighlighted ? '#b45309' : colors.nodeText}
                  textAnchor="middle"
                  className="pointer-events-none"
                >
                  {n.label}
                </text>

                {/* Node info tooltip pill on hover */}
                {isHovered && !isHighlighted && (
                  <g>
                    <rect
                      x={n.x - 40}
                      y={n.y + n.radius + 6}
                      width={80}
                      height={18}
                      rx={3}
                      fill="#1e293b"
                      opacity="0.9"
                    />
                    <text
                      x={n.x}
                      y={n.y + n.radius + 19}
                      fontFamily="system-ui, sans-serif"
                      fontSize="10"
                      fontWeight="600"
                      fill="#ffffff"
                      textAnchor="middle"
                    >
                      {n.isAccept ? 'Accepting' : n.isDead ? 'Trap State' : 'Intermediate'}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* Floating Zoom Level Badge & Instructions */}
        <div className="absolute bottom-2 left-3 bg-white/90 backdrop-blur-xs border border-slate-200/80 rounded px-2 py-1 text-[11px] font-mono text-slate-500 shadow-2xs pointer-events-none">
          Zoom: {Math.round(zoom * 100)}% • Drag to pan • Scroll to zoom
        </div>
      </div>
    </div>
  );
};
