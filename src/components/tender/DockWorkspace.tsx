/**
 * Manages the set of currently-open floating DockPanels for a TenderShell
 * session. Panels are keyed by id so re-opening the same id (e.g. clicking
 * the "Documents" toolbar button twice) refocuses the existing panel
 * instead of stacking duplicates.
 */
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { DockPanel, type DockPanelState } from "./DockPanel";

interface OpenPanel extends DockPanelState {
  content: ReactNode;
}

interface DockWorkspaceContextValue {
  openPanel: (id: string, title: string, content: ReactNode) => void;
  closePanel: (id: string) => void;
  focusPanel: (id: string) => void;
}

const DockWorkspaceContext = createContext<DockWorkspaceContextValue | null>(null);

export function useDockWorkspace(): DockWorkspaceContextValue {
  const ctx = useContext(DockWorkspaceContext);
  if (!ctx) throw new Error("useDockWorkspace must be used within DockWorkspaceProvider");
  return ctx;
}

let cascadeOffset = 0;

export function DockWorkspaceProvider({ children }: { children: ReactNode }) {
  const [panels, setPanels] = useState<OpenPanel[]>([]);
  const zCounter = useRef(100);

  const focusPanel = useCallback((id: string) => {
    setPanels((prev) => {
      const target = prev.find((p) => p.id === id);
      if (!target) return prev;
      zCounter.current += 1;
      return prev.map((p) => (p.id === id ? { ...p, zIndex: zCounter.current } : p));
    });
  }, []);

  const openPanel = useCallback((id: string, title: string, content: ReactNode) => {
    setPanels((prev) => {
      if (prev.some((p) => p.id === id)) {
        zCounter.current += 1;
        return prev.map((p) => (p.id === id ? { ...p, content, minimized: false, zIndex: zCounter.current } : p));
      }
      zCounter.current += 1;
      cascadeOffset = (cascadeOffset + 32) % 200;
      const next: OpenPanel = {
        id, title, content,
        // 260px base x clears TenderShell's 224px-wide sidebar so new
        // panels don't spawn hidden underneath it.
        x: 260 + cascadeOffset, y: 100 + cascadeOffset,
        width: 640, height: 560,
        zIndex: zCounter.current,
        minimized: false,
      };
      return [...prev, next];
    });
  }, []);

  const closePanel = useCallback((id: string) => {
    setPanels((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const moveP = useCallback((id: string, x: number, y: number) => {
    setPanels((prev) => prev.map((p) => (p.id === id ? { ...p, x, y } : p)));
  }, []);
  const resizeP = useCallback((id: string, width: number, height: number) => {
    setPanels((prev) => prev.map((p) => (p.id === id ? { ...p, width, height } : p)));
  }, []);
  const toggleMinimize = useCallback((id: string) => {
    setPanels((prev) => prev.map((p) => (p.id === id ? { ...p, minimized: !p.minimized } : p)));
  }, []);

  return (
    <DockWorkspaceContext.Provider value={{ openPanel, closePanel, focusPanel }}>
      {children}
      {panels.map((p) => (
        <DockPanel
          key={p.id}
          panel={p}
          onFocus={focusPanel}
          onMove={moveP}
          onResize={resizeP}
          onClose={closePanel}
          onToggleMinimize={toggleMinimize}
        >
          {p.content}
        </DockPanel>
      ))}
    </DockWorkspaceContext.Provider>
  );
}
