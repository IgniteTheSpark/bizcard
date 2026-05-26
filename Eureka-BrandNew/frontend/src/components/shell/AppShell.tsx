import { Outlet } from "react-router-dom";

import { TopBar } from "./TopBar";
import { FloatingDock } from "./FloatingDock";

/**
 * AppShell — top-level layout wrapper.
 *
 * Two-row layout (mobile-first; desktop same shape, wider content):
 *   ┌──────────────────────────┐
 *   │ TopBar (sticky)           │ — logo + page title + 3 icons
 *   ├──────────────────────────┤
 *   │ <Outlet />                │ — current page, scrolls, has bottom
 *   │   (pages own their scroll)│   padding so dock doesn't overlap content
 *   └──────────────────────────┘
 *           [ FloatingDock ]    — floats over content, doesn't take layout space
 *
 * Per spec amendment (2026-05-26): the original bottom TabBar + middle FAB is
 * replaced by a single FloatingDock capsule that holds: 今天 / 资产库 / + /
 * 闪念 / Agent. SessionSidebar (M2) slots into ChatPage itself, not the shell.
 */
export function AppShell() {
  return (
    <div className="min-h-dvh flex flex-col bg-eu-bg text-eu-text">
      <TopBar />
      {/* pb-28 reserves room for the floating dock + safe area */}
      <main className="flex-1 overflow-y-auto pb-28">
        <Outlet />
      </main>
      <FloatingDock />
    </div>
  );
}
