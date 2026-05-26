import { Outlet } from "react-router-dom";

import { TopBar } from "./TopBar";
import { TabBar } from "./TabBar";
import { FlashFab } from "./FlashFab";

/**
 * AppShell — top-level layout wrapper.
 *
 * Mobile-first three-row layout:
 *   ┌──────────────────────────┐
 *   │ TopBar (sticky)           │ — logo + page title + 3 icons
 *   ├──────────────────────────┤
 *   │ <Outlet />                │ — current page, scrolls
 *   │   (pages handle their own │
 *   │    scrolling)             │
 *   ├──────────────────────────┤
 *   │ TabBar (sticky)           │ — 3 tabs + middle Flash FAB
 *   └──────────────────────────┘
 *
 * Desktop (md:+) uses the same layout but with wider max-width and the
 * TopBar/TabBar visually centered. SessionSidebar (M2) will slot into ChatPage
 * itself, not at the shell level — keeps shell skill-agnostic.
 */
export function AppShell() {
  return (
    <div className="min-h-dvh flex flex-col bg-eu-bg text-eu-text">
      <TopBar />
      <main className="flex-1 overflow-y-auto pb-safe">
        <Outlet />
      </main>
      <TabBar />
      {/* FAB is absolutely positioned so it floats above the TabBar's middle cutout */}
      <FlashFab />
    </div>
  );
}
