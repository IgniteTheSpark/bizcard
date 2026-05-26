import { MessageCircle, Calendar, Library } from "lucide-react";
import { NavLink } from "react-router-dom";

interface TabDef {
  to: string;
  label: string;
  icon: typeof MessageCircle;
}

const TABS: TabDef[] = [
  { to: "/chat",     label: "对话",   icon: MessageCircle },
  { to: "/calendar", label: "日历",   icon: Calendar      },
  { to: "/library",  label: "资产库", icon: Library       },
];

/**
 * TabBar — bottom nav with 3 destinations and a center slot for the Flash FAB.
 *
 * 4-column grid: [chat] [FAB spacer] [calendar] [library].
 * The FAB itself is absolutely positioned by AppShell so it visually punches
 * through the bar (we just leave column 2 empty for the cutout).
 */
export function TabBar() {
  return (
    <nav className="sticky bottom-0 z-30 pb-safe bg-eu-surface/85 backdrop-blur border-t border-eu-rule">
      <div className="grid grid-cols-4 h-14 max-w-md mx-auto">
        <TabButton tab={TABS[0]!} />
        <div aria-hidden="true" /> {/* FAB cutout */}
        <TabButton tab={TABS[1]!} />
        <TabButton tab={TABS[2]!} />
      </div>
    </nav>
  );
}

function TabButton({ tab }: { tab: TabDef }) {
  const Icon = tab.icon;
  return (
    <NavLink
      to={tab.to}
      className={({ isActive }) =>
        [
          "flex flex-col items-center justify-center gap-0.5 text-eu-xs",
          "transition-colors duration-eu-fast ease-eu-out",
          isActive ? "text-eu-brand-hi" : "text-eu-text-mid hover:text-eu-text-hi",
        ].join(" ")
      }
    >
      <Icon size={20} strokeWidth={1.75} />
      <span>{tab.label}</span>
    </NavLink>
  );
}
