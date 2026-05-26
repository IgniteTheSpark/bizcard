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
    // h-dvh (not min-h-dvh) so flex-1 children get a determinate height to
    // fill — pages that use h-full inside (e.g. ChatPage with sidebar +
    // input column) need this to lay out their own bottom bar correctly.
    <div className="h-dvh flex flex-col bg-eu-bg text-eu-text overflow-hidden">
      <TopBar />
      {/* pb-28 reserves room for the floating dock + safe area */}
      <main className="flex-1 overflow-y-auto pb-28 min-h-0">
        <Outlet />
      </main>
      <FloatingDock />
    </div>
  );
}
