import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

/**
 * ModalContext — tracks how many full-screen modals are currently mounted.
 *
 * Why: FloatingDock uses `backdrop-blur-md` which creates a compositing
 * layer — even when a higher z-index modal backdrop covers it, Chromium can
 * render the dock through it (saturated dock items like the Agent pill + red
 * date badge bleed through). The reliable fix is to remove the dock from the
 * scene while any modal is open.
 *
 * Every full-screen modal (CreateAssetMenu, FlashSheet, AssetDetailDrawer)
 * calls `useModalMount()` and the dock subscribes via `useIsAnyModalOpen()`.
 */

interface ModalContextValue {
  count: number;
  register: () => void;
  unregister: () => void;
}

const ModalContext = createContext<ModalContextValue | null>(null);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);

  const register = useCallback(() => setCount((n) => n + 1), []);
  const unregister = useCallback(() => setCount((n) => Math.max(0, n - 1)), []);

  return (
    <ModalContext.Provider value={{ count, register, unregister }}>
      {children}
    </ModalContext.Provider>
  );
}

/** Call from any full-screen modal: increments on mount, decrements on unmount. */
export function useModalMount() {
  const ctx = useContext(ModalContext);
  // No-op if no provider (e.g. in unit tests) — fail soft so callers don't crash
  useEffect(() => {
    if (!ctx) return;
    ctx.register();
    return () => ctx.unregister();
  }, [ctx]);
}

export function useIsAnyModalOpen(): boolean {
  const ctx = useContext(ModalContext);
  return (ctx?.count ?? 0) > 0;
}
