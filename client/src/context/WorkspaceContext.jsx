import { createContext, useContext, useState, useEffect, useCallback } from "react";

// ── Workspace type definitions ─────────────────────────────────────────────────
// `isSystem: true` = created automatically, not user-creatable, not deletable.

export const WORKSPACE_TYPE_META = {
  // System-only: always the first workspace, shows everything
  home: {
    label:       "Home",
    description: "Unified overview of all workspaces and events",
    color:       "#6b7280",
    taskDomain:  null,                           // no domain filter → show all tasks
    views:       ["dashboard", "calendar", "grades"],
    icon:        "home",
    isSystem:    true,
  },
  // User-creatable types below
  default: {
    label:       "General",
    description: "General-purpose workspace for everyday tasks and notes",
    color:       "#6366f1",
    taskDomain:  null,
    views:       ["dashboard", "resources"],
    icon:        "grid",
  },
  work: {
    label:       "Work",
    description: "Professional focus for projects and deliverables",
    color:       "#3b82f6",
    taskDomain:  "Professional",
    views:       ["dashboard", "resources"],
    icon:        "briefcase",
  },
  academic: {
    label:       "Academic",
    description: "Full suite with courses, calendar, and resources",
    color:       "#22c55e",
    taskDomain:  "Academic",
    views:       ["dashboard", "courses", "calendar", "grades", "resources"],
    icon:        "book",
  },
};

export const WORKSPACE_DEFAULT_TASK_DOMAIN = {
  home:     null,
  default:  "Personal",
  work:     "Professional",
  academic: "Academic",
};

// ── System Home workspace ──────────────────────────────────────────────────────
export const HOME_WORKSPACE_ID = "ws_home";

export const HOME_WORKSPACE = {
  id:       HOME_WORKSPACE_ID,
  name:     "Home",
  type:     "home",
  isSystem: true,
};

// ── Persistence ───────────────────────────────────────────────────────────────

const STORAGE_KEY = "so_workspaces_v2";
const ACTIVE_KEY  = "so_active_workspace_v2";

/** Returns [HOME_WORKSPACE, ...user-created workspaces from localStorage]. */
function loadWorkspaces() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Strip any previously-stored system / legacy default workspaces
      const user = parsed.filter((w) => !w.isSystem && w.id !== "ws_default");
      if (Array.isArray(user)) return [HOME_WORKSPACE, ...user];
    }
  } catch {}
  return [HOME_WORKSPACE];
}

// ── Context ───────────────────────────────────────────────────────────────────

const WorkspaceContext = createContext(null);

export function WorkspaceProvider({ children }) {
  const [workspaces, setWorkspaces] = useState(loadWorkspaces);
  const [activeId,   setActiveId]   = useState(() => {
    const stored = localStorage.getItem(ACTIVE_KEY);
    const all    = loadWorkspaces();
    if (stored && all.find((w) => w.id === stored)) return stored;
    return all[0]?.id ?? null;   // default to Home
  });

  // Persist only the user-created portion (system workspaces are re-injected on load)
  useEffect(() => {
    const toSave = workspaces.filter((w) => !w.isSystem);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  }, [workspaces]);

  useEffect(() => {
    if (activeId) localStorage.setItem(ACTIVE_KEY, activeId);
  }, [activeId]);

  // Keep activeId pointing at a real workspace
  useEffect(() => {
    if (workspaces.length > 0 && (!activeId || !workspaces.find((w) => w.id === activeId))) {
      setActiveId(workspaces[0].id);
    }
  }, [workspaces, activeId]);

  const activeWorkspace = workspaces.find((w) => w.id === activeId) ?? workspaces[0] ?? null;
  const typeMeta = WORKSPACE_TYPE_META[activeWorkspace?.type ?? "home"];

  // Number of user-created (non-system) workspaces
  const userWorkspaceCount = workspaces.filter((w) => !w.isSystem).length;

  const createWorkspace = useCallback((name, type) => {
    const id = `ws_${Date.now()}`;
    const ws = { id, name: name.trim(), type, createdAt: Date.now() };
    setWorkspaces((prev) => [...prev, ws]);
    setActiveId(id);
    return ws;
  }, []);

  const deleteWorkspace = useCallback((id) => {
    const ws = workspaces.find((w) => w.id === id);
    if (!ws || ws.isSystem) return;   // cannot delete system workspaces
    setWorkspaces((prev) => prev.filter((w) => w.id !== id));
    setActiveId((prev) => {
      if (prev !== id) return prev;
      // Fall back to Home
      return HOME_WORKSPACE_ID;
    });
  }, [workspaces]);

  return (
    <WorkspaceContext.Provider value={{
      workspaces,
      userWorkspaceCount,
      activeWorkspace,
      activeId,
      setActiveId,
      typeMeta,
      createWorkspace,
      deleteWorkspace,
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  return ctx;
}
