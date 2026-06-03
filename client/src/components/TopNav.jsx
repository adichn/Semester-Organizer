import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWorkspace } from "../context/WorkspaceContext.jsx";

// ── Icons ─────────────────────────────────────────────────────────────────────

function ChevronIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

// ── View config ───────────────────────────────────────────────────────────────

export const VIEWS = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    id: "courses",
    label: "Courses",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
  },
  {
    id: "calendar",
    label: "Calendar",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2.5" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    ),
  },
  {
    id: "resources",
    label: "Resources",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    id: "grades",
    label: "Grades",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  },
];

// ── Dropdown primitive ────────────────────────────────────────────────────────

function Dropdown({ trigger, children, open, onClose, align = "center" }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  const posStyle =
    align === "right"  ? { right: 0 } :
    align === "left"   ? { left: 0 }  :
    { left: "50%", transform: "translateX(-50%)" };

  return (
    <div ref={ref} className="relative">
      {trigger}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0,  scale: 1   }}
            exit={{    opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.13, ease: [0.4, 0, 0.2, 1] }}
            className="glass-modal absolute top-full mt-2 min-w-[180px] z-50 overflow-hidden rounded-[14px]"
            style={posStyle}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── View dropdown ─────────────────────────────────────────────────────────────

function ViewDropdown({ activeNav, onNavigate }) {
  const { typeMeta } = useWorkspace();
  const [open, setOpen] = useState(false);
  const visibleViews = VIEWS.filter((v) => typeMeta.views.includes(v.id));
  const current = visibleViews.find((v) => v.id === activeNav) ?? visibleViews[0];

  return (
    <Dropdown
      open={open}
      onClose={() => setOpen(false)}
      trigger={
        <button
          onClick={() => setOpen((v) => !v)}
          className={[
            "flex items-center gap-2 h-8 px-3 rounded-[9px] cursor-pointer select-none",
            "text-[13px] font-medium transition-all duration-150",
            "bg-white/60 dark:bg-white/10 hover:bg-white/80 dark:hover:bg-white/15",
            "border border-white/60 dark:border-white/15",
            "shadow-[0_0_0_0.5px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.05)]",
            "text-gray-700 dark:text-gray-200",
          ].join(" ")}
        >
          <span className="text-gray-500 dark:text-gray-400 shrink-0">{current.icon}</span>
          <span style={{ letterSpacing: "-0.011em" }}>{current.label}</span>
          <span className="text-gray-400 dark:text-gray-500 ml-0.5">
            <ChevronIcon />
          </span>
        </button>
      }
    >
      <div className="py-1.5">
        <p className="px-3.5 py-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase"
           style={{ letterSpacing: "0.07em" }}>
          View
        </p>
        {visibleViews.map((view) => {
          const isActive = activeNav === view.id;
          return (
            <button
              key={view.id}
              onClick={() => { onNavigate(view.id); setOpen(false); }}
              className={[
                "w-full flex items-center gap-3 px-3.5 py-2 text-[13px] cursor-pointer",
                "transition-colors duration-100 text-left",
                isActive
                  ? "text-gray-900 dark:text-gray-100 font-medium bg-black/[0.04] dark:bg-white/[0.06]"
                  : "text-gray-600 dark:text-gray-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]",
              ].join(" ")}
              style={{ letterSpacing: "-0.011em" }}
            >
              <span className={[
                "shrink-0",
                isActive ? "text-gray-700 dark:text-gray-300" : "text-gray-400 dark:text-gray-500",
              ].join(" ")}>
                {view.icon}
              </span>
              {view.label}
              {isActive && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  className="ml-auto text-gray-400">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </Dropdown>
  );
}

// ── User menu dropdown ────────────────────────────────────────────────────────

function UserMenu({ user, dark, onToggleTheme, onLogout, onNavigate }) {
  const [open, setOpen] = useState(false);

  return (
    <Dropdown
      open={open}
      onClose={() => setOpen(false)}
      align="right"
      trigger={
        <button
          onClick={() => setOpen((v) => !v)}
          className={[
            "flex items-center gap-2 h-8 px-2.5 rounded-[9px] cursor-pointer select-none",
            "transition-all duration-150",
            "bg-white/60 dark:bg-white/10 hover:bg-white/80 dark:hover:bg-white/15",
            "border border-white/60 dark:border-white/15",
            "shadow-[0_0_0_0.5px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.05)]",
          ].join(" ")}
          aria-label="User menu"
        >
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, #f472b6 0%, #fb7185 100%)" }}
          >
            <span className="text-white text-[9px] font-semibold leading-none">
              {user?.name?.[0]?.toUpperCase() ?? "?"}
            </span>
          </div>
          <span
            className="text-[13px] font-medium text-gray-700 dark:text-gray-200 max-w-[100px] truncate"
            style={{ letterSpacing: "-0.011em" }}
          >
            {user?.name?.split(" ")[0] ?? "Account"}
          </span>
          <span className="text-gray-400 dark:text-gray-500">
            <ChevronIcon />
          </span>
        </button>
      }
    >
      <div className="py-1.5 min-w-[192px]">
        {/* User info */}
        <div className="px-3.5 py-2 border-b border-black/[0.06] dark:border-white/[0.08] mb-1">
          <p className="text-[13px] font-medium text-gray-800 dark:text-gray-200 leading-tight"
             style={{ letterSpacing: "-0.011em" }}>
            {user?.name ?? "Unknown"}
          </p>
          <p className="text-[11px] text-gray-400 leading-tight mt-0.5 truncate">
            {user?.email ?? ""}
          </p>
        </div>

        {/* Settings link */}
        <button
          onClick={() => { onNavigate?.("settings"); setOpen(false); }}
          className="w-full flex items-center gap-3 px-3.5 py-2 text-[13px] cursor-pointer
                     text-gray-600 dark:text-gray-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]
                     transition-colors duration-100 text-left"
          style={{ letterSpacing: "-0.011em" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
            className="text-gray-400 shrink-0">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          Settings
        </button>

        {/* Theme toggle */}
        {onToggleTheme && (
          <button
            onClick={() => { onToggleTheme(); setOpen(false); }}
            className="w-full flex items-center gap-3 px-3.5 py-2 text-[13px] cursor-pointer
                       text-gray-600 dark:text-gray-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]
                       transition-colors duration-100 text-left"
            style={{ letterSpacing: "-0.011em" }}
          >
            <span className="text-gray-400 shrink-0">
              {dark ? <SunIcon /> : <MoonIcon />}
            </span>
            {dark ? "Light mode" : "Dark mode"}
          </button>
        )}

        {/* Sign out */}
        <div className="mt-1 pt-1 border-t border-black/[0.06] dark:border-white/[0.08]">
          <button
            onClick={() => { onLogout(); setOpen(false); }}
            className="w-full flex items-center gap-3 px-3.5 py-2 text-[13px] cursor-pointer
                       text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30
                       transition-colors duration-100 text-left"
            style={{ letterSpacing: "-0.011em" }}
          >
            <SignOutIcon />
            Sign out
          </button>
        </div>
      </div>
    </Dropdown>
  );
}

// ── TopNav ────────────────────────────────────────────────────────────────────

/**
 * Props
 * ─────
 *   activeNav      current view id
 *   onNavigate     (id) => void
 *   user           { name, email }
 *   onLogout       () => void
 *   onOpenSearch   () => void
 *   dark           boolean
 *   onToggleTheme  () => void
 */
export default function TopNav({
  activeNav,
  onNavigate,
  user,
  onLogout,
  onOpenSearch,
  dark,
  onToggleTheme,
}) {
  const { activeWorkspace, typeMeta } = useWorkspace();

  return (
    <header
      className="glass-sidebar shrink-0 h-12 flex items-center px-4 gap-3 z-30"
      style={{ borderRight: "none", borderBottom: "1px solid rgba(255,255,255,0.48)" }}
    >
      {/* Brand */}
      <div className="flex items-center mr-1 shrink-0">
        <span
          className="text-[14px] font-semibold text-gray-900 dark:text-white"
          style={{ letterSpacing: "-0.022em" }}
        >
          SOT
        </span>
      </div>

      {/* Separator */}
      <div className="w-px h-4 bg-black/10 dark:bg-white/15 shrink-0" />

      {/* Active workspace pill + view dropdown */}
      <div className="flex items-center gap-2">
        {/* Current workspace indicator (non-interactive — workspace selection is in right sidebar) */}
        <div
          className="flex items-center gap-1.5 h-8 px-3 rounded-[9px] select-none
                     bg-white/50 dark:bg-white/[0.08]
                     border border-white/60 dark:border-white/15
                     shadow-[0_0_0_0.5px_rgba(0,0,0,0.05)]"
        >
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: typeMeta.color }}
          />
          <span
            className="text-[13px] font-medium text-gray-700 dark:text-gray-200 max-w-[120px] truncate"
            style={{ letterSpacing: "-0.011em" }}
          >
            {activeWorkspace?.name ?? "Workspace"}
          </span>
        </div>

        <ViewDropdown activeNav={activeNav} onNavigate={onNavigate} />
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side: search + user */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <button
          onClick={onOpenSearch}
          className={[
            "flex items-center gap-2 h-8 px-3 rounded-[9px] cursor-pointer select-none",
            "text-[12px] font-medium transition-all duration-150",
            "bg-white/60 dark:bg-white/10 hover:bg-white/80 dark:hover:bg-white/15",
            "border border-white/60 dark:border-white/15",
            "shadow-[0_0_0_0.5px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.05)]",
            "text-gray-400 dark:text-gray-500",
          ].join(" ")}
          aria-label="Search (⌘K)"
        >
          <SearchIcon />
          <span className="hidden md:flex items-center gap-0.5">
            <kbd className="text-[10px] font-semibold text-gray-400 bg-white/80 border border-gray-200
                           rounded-[4px] px-1 py-0.5 leading-none">⌘</kbd>
            <kbd className="text-[10px] font-semibold text-gray-400 bg-white/80 border border-gray-200
                           rounded-[4px] px-1 py-0.5 leading-none">K</kbd>
          </span>
        </button>

        {/* User menu */}
        <UserMenu
          user={user}
          dark={dark}
          onToggleTheme={onToggleTheme}
          onLogout={onLogout}
          onNavigate={onNavigate}
        />
      </div>
    </header>
  );
}
