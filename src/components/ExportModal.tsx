import React, { useState } from 'react';
import { DFA, DiagramTheme, ExportSettings, GraphLayout } from '../types';
import {
  generateSvgString,
  exportToPng,
  downloadFile,
  generateTikzCode,
  generateDotCode,
} from '../services/imageExporter';
import {
  X,
  Download,
  Copy,
  Check,
  FileImage,
  Code2,
  Settings,
  Sparkles,
  Layers,
} from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  layout: GraphLayout;
  dfa: DFA;
  theme: DiagramTheme;
  showDeadStates: boolean;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  layout,
  dfa,
  theme: initialTheme,
  showDeadStates: initialShowDead,
}) => {
  const [activeTab, setActiveTab] = useState<'image' | 'code'>('image');
  const [format, setFormat] = useState<'png' | 'svg' | 'tikz' | 'dot' | 'json'>('png');
  const [scale, setScale] = useState<1 | 2 | 3 | 4>(2);
  const [theme, setTheme] = useState<DiagramTheme>(initialTheme);
  const [transparentBg, setTransparentBg] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const exportSettings: ExportSettings = {
    format,
    scale,
    theme,
    showDeadStates: initialShowDead,
    useMinimized: false,
    showGrid,
    transparentBackground: transparentBg,
  };

  const svgString = generateSvgString(layout, exportSettings);
  const tikzCode = generateTikzCode(dfa, layout);
  const dotCode = generateDotCode(dfa);
  const jsonCode = JSON.stringify(dfa, null, 2);

  const currentCode =
    format === 'svg'
      ? svgString
      : format === 'tikz'
      ? tikzCode
      : format === 'dot'
      ? dotCode
      : jsonCode;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async () => {
    setIsExporting(true);
    const baseName = dfa.name.toLowerCase().replace(/[^a-z0-9]/g, '_');

    try {
      if (format === 'png') {
        const dataUrl = await exportToPng(svgString, scale);
        downloadFile(dataUrl, `${baseName}_scale${scale}x.png`, 'image/png');
      } else if (format === 'svg') {
        downloadFile(svgString, `${baseName}.svg`, 'image/svg+xml');
      } else if (format === 'tikz') {
        downloadFile(tikzCode, `${baseName}_tikz.tex`, 'text/x-tex');
      } else if (format === 'dot') {
        downloadFile(dotCode, `${baseName}.dot`, 'text/vnd.graphviz');
      } else if (format === 'json') {
        downloadFile(jsonCode, `${baseName}.json`, 'application/json');
      }
    } catch (err) {
      console.error('Export failed', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-blue-400" />
            <h3 className="font-bold text-sm">Export High-Resolution Diagram & Code</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Format Tabs */}
          <div>
            <label className="block font-semibold text-slate-700 mb-2">Export Format</label>
            <div className="grid grid-cols-5 gap-2">
              <button
                type="button"
                onClick={() => setFormat('png')}
                className={`py-2 px-2.5 rounded-lg border text-center font-semibold transition-all ${
                  format === 'png'
                    ? 'bg-blue-50 border-blue-500 text-blue-700 ring-2 ring-blue-400/30'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <FileImage className="w-4 h-4 mx-auto mb-1 text-blue-600" />
                <span>PNG (Raster)</span>
              </button>

              <button
                type="button"
                onClick={() => setFormat('svg')}
                className={`py-2 px-2.5 rounded-lg border text-center font-semibold transition-all ${
                  format === 'svg'
                    ? 'bg-blue-50 border-blue-500 text-blue-700 ring-2 ring-blue-400/30'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Code2 className="w-4 h-4 mx-auto mb-1 text-emerald-600" />
                <span>Vector SVG</span>
              </button>

              <button
                type="button"
                onClick={() => setFormat('tikz')}
                className={`py-2 px-2.5 rounded-lg border text-center font-semibold transition-all ${
                  format === 'tikz'
                    ? 'bg-blue-50 border-blue-500 text-blue-700 ring-2 ring-blue-400/30'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Layers className="w-4 h-4 mx-auto mb-1 text-purple-600" />
                <span>LaTeX TikZ</span>
              </button>

              <button
                type="button"
                onClick={() => setFormat('dot')}
                className={`py-2 px-2.5 rounded-lg border text-center font-semibold transition-all ${
                  format === 'dot'
                    ? 'bg-blue-50 border-blue-500 text-blue-700 ring-2 ring-blue-400/30'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Settings className="w-4 h-4 mx-auto mb-1 text-amber-600" />
                <span>Graphviz DOT</span>
              </button>

              <button
                type="button"
                onClick={() => setFormat('json')}
                className={`py-2 px-2.5 rounded-lg border text-center font-semibold transition-all ${
                  format === 'json'
                    ? 'bg-blue-50 border-blue-500 text-blue-700 ring-2 ring-blue-400/30'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Sparkles className="w-4 h-4 mx-auto mb-1 text-cyan-600" />
                <span>DFA JSON</span>
              </button>
            </div>
          </div>

          {/* PNG / Image Specific Settings */}
          {format === 'png' && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
              <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                <FileImage className="w-3.5 h-3.5 text-blue-600" />
                <span>Image Resolution Scaling</span>
              </h4>

              <div className="grid grid-cols-4 gap-2">
                {[
                  { value: 1, label: '1x Standard', desc: 'Web preview' },
                  { value: 2, label: '2x Retina', desc: 'Print & Slides' },
                  { value: 3, label: '3x Ultra-HD', desc: 'Publication 300 DPI' },
                  { value: 4, label: '4x 4K Print', desc: 'Maximum fidelity' },
                ].map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setScale(s.value as any)}
                    className={`p-2 rounded-lg border text-left transition-all ${
                      scale === s.value
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="font-bold text-xs">{s.label}</div>
                    <div
                      className={`text-[10px] ${
                        scale === s.value ? 'text-blue-100' : 'text-slate-400'
                      }`}
                    >
                      {s.desc}
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-4 pt-1">
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={transparentBg}
                    onChange={(e) => setTransparentBg(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs text-slate-700 font-medium">Transparent Background</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showGrid}
                    onChange={(e) => setShowGrid(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs text-slate-700 font-medium">Include Diagram Grid</span>
                </label>
              </div>
            </div>
          )}

          {/* Theme selection for diagram output */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-slate-700">Diagram Color Theme</label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {[
                { id: 'academic', label: 'Academic B&W', border: '#0f172a' },
                { id: 'modern', label: 'Modern Blue', border: '#2563eb' },
                { id: 'dark', label: 'Slate Dark', border: '#60a5fa' },
                { id: 'blueprint', label: 'Blueprint', border: '#38bdf8' },
                { id: 'minimal', label: 'Minimal Mono', border: '#52525b' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTheme(t.id as DiagramTheme)}
                  className={`px-2 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                    theme === t.id
                      ? 'bg-blue-50 border-blue-500 text-blue-800 ring-2 ring-blue-300'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-middle"
                    style={{ backgroundColor: t.border }}
                  />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Code Preview for vector / text formats */}
          {format !== 'png' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">Source Code Preview</span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-0.5 rounded transition-colors"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copied!' : 'Copy Code'}</span>
                </button>
              </div>
              <pre className="bg-slate-900 text-slate-200 p-3 rounded-xl font-mono text-[11px] max-h-48 overflow-y-auto scrollbar-thin">
                {currentCode}
              </pre>
            </div>
          )}
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

          <div className="flex items-center gap-2">
            {format !== 'png' && (
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied to Clipboard' : 'Copy'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleDownload}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-sm transition-all disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>
                {isExporting ? 'Exporting...' : `Download ${format.toUpperCase()}`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
