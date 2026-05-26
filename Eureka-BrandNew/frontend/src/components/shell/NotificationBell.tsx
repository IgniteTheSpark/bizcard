import { useState } from "react";
import { Bell } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * NotificationBell — TopBar icon → popover with recent 5 + link to full page.
 *
 * M0: placeholder. Shows "暂无通知".
 * M6 wires this to useNotifications() (SSE subscription + history fetch).
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  // M6: replace with `const { unread } = useNotifications();`
  const unread = 0;

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="通知"
        onClick={() => setOpen((v) => !v)}
        className="relative p-1.5 rounded-eu-sm text-eu-text-mid hover:text-eu-text-hi hover:bg-eu-surface-hover transition-colors duration-eu-fast"
      >
        <Bell size={18} strokeWidth={1.75} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-eu-accent-red-solid" />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className={[
              "absolute right-0 top-full mt-2 z-50",
              "w-72 rounded-eu-md",
              "bg-eu-surface-raised border border-eu-border shadow-eu-md",
            ].join(" ")}
          >
            <div className="p-eu-md text-eu-sm text-eu-text-mid">暂无通知。</div>
            <div className="border-t border-eu-rule">
              <Link
                to="/notifications"
                onClick={() => setOpen(false)}
                className="block px-eu-md py-eu-sm text-eu-sm text-eu-brand-hi hover:bg-eu-surface-hover"
              >
                查看全部 →
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
