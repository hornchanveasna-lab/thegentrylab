/**
 * Generic floating panel primitive for TenderAI's dockable workspace —
 * draggable by its header, resizable from the bottom-right corner,
 * closable, minimizable, and brought to front on focus. Modeled on the
 * Model browser / Settings / Properties floating panels in Autodesk's
 * viewer, applied here to document-oriented panels (see DockWorkspace).
 */
import { useRef } from "react";

export interface DockPanelState {
  id: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  minimized: boolean;
}

interface DockPanelProps {
  panel: DockPanelState;
  onFocus: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onResize: (id: string, width: number, height: number) => void;
  onClose: (id: string) => void;
  onToggleMinimize: (id: string) => void;
  children: React.ReactNode;
}

const MIN_WIDTH = 320;
const MIN_HEIGHT = 220;

export function DockPanel({ panel, onFocus, onMove, onResize, onClose, onToggleMinimize, children }: DockPanelProps) {
  const dragState = useRef<{ startX: number; startY: number; panelX: number; panelY: number } | null>(null);
  const resizeState = useRef<{ startX: number; startY: number; width: number; height: number } | null>(null);

  function handleHeaderPointerDown(e: React.PointerEvent) {
    onFocus(panel.id);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = { startX: e.clientX, startY: e.clientY, panelX: panel.x, panelY: panel.y };
  }
  function handleHeaderPointerMove(e: React.PointerEvent) {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    onMove(panel.id, Math.max(0, dragState.current.panelX + dx), Math.max(0, dragState.current.panelY + dy));
  }
  function handleHeaderPointerUp(e: React.PointerEvent) {
    dragState.current = null;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }

  function handleResizePointerDown(e: React.PointerEvent) {
    e.stopPropagation();
    onFocus(panel.id);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    resizeState.current = { startX: e.clientX, startY: e.clientY, width: panel.width, height: panel.height };
  }
  function handleResizePointerMove(e: React.PointerEvent) {
    if (!resizeState.current) return;
    const dx = e.clientX - resizeState.current.startX;
    const dy = e.clientY - resizeState.current.startY;
    onResize(panel.id, Math.max(MIN_WIDTH, resizeState.current.width + dx), Math.max(MIN_HEIGHT, resizeState.current.height + dy));
  }
  function handleResizePointerUp(e: React.PointerEvent) {
    resizeState.current = null;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }

  return (
    <div
      className="fixed rounded-xl bg-[#0d0d0e] border border-white/12 shadow-2xl flex flex-col overflow-hidden"
      style={{
        left: panel.x, top: panel.y,
        width: panel.width, height: panel.minimized ? "auto" : panel.height,
        zIndex: panel.zIndex,
      }}
      onPointerDown={() => onFocus(panel.id)}
    >
      <div
        className="flex items-center gap-2 px-3 py-2 bg-white/[0.04] border-b border-white/8 cursor-grab active:cursor-grabbing select-none shrink-0"
        onPointerDown={handleHeaderPointerDown}
        onPointerMove={handleHeaderPointerMove}
        onPointerUp={handleHeaderPointerUp}
      >
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "#0696D7" }} />
        <p className="text-[11px] font-semibold truncate flex-1">{panel.title}</p>
        <button onClick={() => onToggleMinimize(panel.id)} className="w-5 h-5 flex items-center justify-center text-white/40 hover:text-white transition-colors shrink-0" title={panel.minimized ? "Expand" : "Minimize"}>
          {panel.minimized ? "▢" : "—"}
        </button>
        <button onClick={() => onClose(panel.id)} className="w-5 h-5 flex items-center justify-center text-white/40 hover:text-red-400 transition-colors shrink-0" title="Close">
          ✕
        </button>
      </div>

      {!panel.minimized && (
        <div className="flex-1 min-h-0 overflow-hidden relative">
          {children}
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
            onPointerDown={handleResizePointerDown}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" className="absolute bottom-0.5 right-0.5 opacity-30">
              <path d="M12 2 L2 12 M12 7 L7 12 M12 12 L12 12" stroke="black" strokeWidth="1.2" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}
