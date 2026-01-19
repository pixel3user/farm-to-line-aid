import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

const STORAGE_KEY = "ftla:debugOverlay:enabled";

function readStoredEnabled(): boolean | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === null) return null;
    if (value === "true") return true;
    if (value === "false") return false;
    return null;
  } catch {
    return null;
  }
}

function writeStoredEnabled(enabled: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    // ignore
  }
}

export default function DebugOverlay() {
  const location = useLocation();
  const defaultEnabled = import.meta.env.DEV;
  const [enabled, setEnabled] = useState<boolean>(() => readStoredEnabled() ?? defaultEnabled);

  useEffect(() => {
    writeStoredEnabled(enabled);
  }, [enabled]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!import.meta.env.DEV) return;
      if (event.key.toLowerCase() !== "d") return;
      if (!event.ctrlKey || !event.shiftKey) return;
      event.preventDefault();
      setEnabled((prev) => !prev);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const buildInfo = useMemo(() => {
    const mode = import.meta.env.MODE;
    const base = import.meta.env.BASE_URL;
    return { mode, base };
  }, []);

  if (!enabled) return null;

  return (
    <div className="fixed bottom-2 right-2 z-[9999] max-w-[90vw] rounded-md border bg-background/95 p-3 text-xs shadow-lg backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium">Debug</div>
          <div className="text-muted-foreground">
            <div className="truncate">mode: {buildInfo.mode}</div>
            <div className="truncate">base: {buildInfo.base}</div>
            <div className="truncate">path: {location.pathname}</div>
          </div>
        </div>
        <button
          type="button"
          className="rounded border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
          onClick={() => setEnabled(false)}
          aria-label="Hide debug overlay"
        >
          Hide
        </button>
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground">Toggle: Ctrl+Shift+D</div>
    </div>
  );
}
