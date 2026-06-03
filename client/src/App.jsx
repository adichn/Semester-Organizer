import { useEffect, useState, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import TopNav          from "./components/TopNav";
import RightSidebar    from "./components/RightSidebar";
import WorkspaceModal  from "./components/WorkspaceModal";
import YearView        from "./views/YearView";
import SemesterView    from "./views/SemesterView";
import CourseView      from "./views/CourseView";
import DashboardView   from "./views/DashboardView";
import ResourcesView   from "./views/ResourcesView";
import SettingsView    from "./views/SettingsView";
import GradesView      from "./views/GradesView";
import GlobalCalendar  from "./components/GlobalCalendar";
import LoginPage       from "./pages/LoginPage";
import CommandMenu     from "./components/CommandMenu";
import { useYears }    from "./hooks/useAcademic";
import { useTheme }    from "./hooks/useTheme";
import { getUser, saveAuth, clearAuth } from "./utils/auth";
import { WorkspaceProvider, useWorkspace } from "./context/WorkspaceContext";
import "./App.css";

// Gradients that show through glassmorphism surfaces
const BG_LIGHT = "linear-gradient(135deg, #c4b5f7 0%, #93b8f5 22%, #bae1fb 44%, #d8b4f8 66%, #fbcfe8 88%, #fde68a 100%)";
const BG_DARK  = "linear-gradient(135deg, #1e1b4b 0%, #0f172a 22%, #1e293b 44%, #2d1b4b 66%, #1a1040 88%, #0c1a2e 100%)";

// Slide transition used for year → semester → course drilling
const pageVariants = {
  initial: (dir) => ({ x: dir > 0 ? 60 : -60, opacity: 0, filter: "blur(6px)" }),
  animate: {
    x: 0, opacity: 1, filter: "blur(0px)",
    transition: { duration: 0.32, ease: [0.4, 0, 0.2, 1] },
  },
  exit: (dir) => ({
    x: dir > 0 ? -60 : 60, opacity: 0, filter: "blur(4px)",
    transition: { duration: 0.22, ease: [0.4, 0, 1, 1] },
  }),
};

// Simple fade for top-level nav switches
const fadeVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.26, ease: [0.4, 0, 0.2, 1] } },
  exit:    { opacity: 0,       transition: { duration: 0.18 } },
};

// ── Auth wrapper ──────────────────────────────────────────────────────────────
export default function App() {
  const [authUser, setAuthUser] = useState(getUser);
  const { dark, toggle: toggleTheme } = useTheme();

  function handleAuthSuccess(token, user) {
    saveAuth(token, user);
    setAuthUser(user);
  }
  function handleLogout() {
    clearAuth();
    setAuthUser(null);
  }

  if (!authUser) return <LoginPage onSuccess={handleAuthSuccess} />;
  return (
    <WorkspaceProvider>
      <AppShell authUser={authUser} onLogout={handleLogout} dark={dark} onToggleTheme={toggleTheme} />
    </WorkspaceProvider>
  );
}

// ── AppShell ──────────────────────────────────────────────────────────────────
function AppShell({ authUser, onLogout, dark, onToggleTheme }) {
  const { data: years = [], isLoading, isError } = useYears();
  const { createWorkspace, typeMeta, workspaces, userWorkspaceCount, activeWorkspace } = useWorkspace();

  // ── Nav + breadcrumb state ────────────────────────────────────────────────
  const [activeNav,      setActiveNav]      = useState("dashboard");
  const [page,           setPage]           = useState("year");
  const [direction,      setDir]            = useState(1);
  const [cmdOpen,        setCmdOpen]        = useState(false);
  const [sidebarOpen,    setSidebarOpen]    = useState(true);
  const [wsModalOpen,    setWsModalOpen]    = useState(false);

  // Auto-open modal when user has no user-created workspaces yet (Home is always present)
  useEffect(() => {
    if (userWorkspaceCount === 0) setWsModalOpen(true);
  }, [userWorkspaceCount]);

  const [activeYearId,     setActiveYearId]     = useState(null);
  const [activeSemesterId, setActiveSemesterId] = useState(null);
  const [activeCourseId,   setActiveCourseId]   = useState(null);

  // ⌘K / Ctrl+K
  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);

  // Auto-select the most recent year on first load
  useEffect(() => {
    if (years.length > 0 && !activeYearId) {
      setActiveYearId(String(years[0]._id));
    }
  }, [years, activeYearId]);

  // Derive live objects from IDs (always in sync with React Query cache)
  const activeYear = useMemo(
    () => years.find((y) => String(y._id) === activeYearId) ?? null,
    [years, activeYearId]
  );
  const activeSemester = useMemo(
    () => activeYear?.semesters.find((s) => String(s._id) === activeSemesterId) ?? null,
    [activeYear, activeSemesterId]
  );
  const activeCourse = useMemo(
    () => activeSemester?.courses.find((c) => String(c._id) === activeCourseId) ?? null,
    [activeSemester, activeCourseId]
  );

  // Auto-pop when a deleted item disappears from the cache
  useEffect(() => {
    if (page === "semester" && activeYear && !activeSemester) setPage("year");
  }, [activeSemester, page, activeYear]);
  useEffect(() => {
    if (page === "course" && activeSemester && !activeCourse) setPage("semester");
  }, [activeCourse, page, activeSemester]);

  // Redirect to dashboard if active view is not available in current workspace type
  // "settings" is always reachable regardless of workspace type
  useEffect(() => {
    if (activeNav !== "settings" && !typeMeta.views.includes(activeNav)) {
      setActiveNav("dashboard");
      setPage("year");
    }
  }, [typeMeta, activeNav]);

  // ── Navigation helpers ────────────────────────────────────────────────────

  /**
   * Push deeper into the breadcrumb (year → semester → course).
   *
   * FIX #2: We deliberately do NOT call setActiveNav here. The user stays in
   * whatever top-level nav they are in (typically "courses"). Calling
   * setActiveNav("dashboard") was the bug that redirected users to the Dashboard
   * every time they drilled into a semester or course.
   */
  function push(newPage, ids = {}) {
    setDir(1);
    if (ids.semesterId) setActiveSemesterId(ids.semesterId);
    if (ids.courseId)   setActiveCourseId(ids.courseId);
    setPage(newPage);
  }

  function pop() {
    setDir(-1);
    setPage((prev) => (prev === "course" ? "semester" : "year"));
  }

  // ── Routing flags ─────────────────────────────────────────────────────────
  const isDashboard = activeNav === "dashboard";
  const isCalendar  = activeNav === "calendar";
  const isResources = activeNav === "resources";
  const isSettings  = activeNav === "settings";
  const isGrades    = activeNav === "grades";
  // "courses" nav + any other unknown nav → breadcrumb view
  const isBreadcrumb = !isDashboard && !isCalendar && !isResources && !isSettings && !isGrades;

  // AnimatePresence key — change triggers a cross-fade / slide
  const pageKey = isDashboard  ? "dash"
    : isCalendar               ? `cal-${activeSemesterId ?? "none"}`
    : isResources              ? "resources"
    : isSettings               ? "settings"
    : isGrades                 ? "grades"
    : page === "year"          ? `year-${activeYearId}`
    : page === "semester"      ? `sem-${activeSemesterId}`
    :                            `crs-${activeCourseId}`;

  // ── Shell ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen overflow-hidden font-sans" style={{ background: dark ? BG_DARK : BG_LIGHT }}>

      <TopNav
        activeNav={activeNav}
        onNavigate={(id) => {
          setActiveNav(id);
          if (id === "courses") setPage("year");
        }}
        user={authUser}
        onLogout={onLogout}
        onOpenSearch={() => setCmdOpen(true)}
        dark={dark}
        onToggleTheme={onToggleTheme}
      />

      <div className="flex flex-1 relative" style={{ overflow: "clip" }}>
      <main className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait" custom={direction}>

          {/* ── Dashboard ────────────────────────────────────────────────── */}
          {isDashboard && (
            <motion.div
              key={pageKey}
              variants={fadeVariants}
              initial="initial" animate="animate" exit="exit"
              className="absolute inset-0 overflow-y-auto p-10"
            >
              <DashboardView
                years={years}
                user={authUser}
                onNavigateToCourse={(courseId, semesterId) => {
                  setActiveNav("courses");
                  push("course", { semesterId, courseId });
                }}
              />
            </motion.div>
          )}

          {/* ── Calendar ─────────────────────────────────────────────────── */}
          {isCalendar && (
            <motion.div
              key={pageKey}
              variants={fadeVariants}
              initial="initial" animate="animate" exit="exit"
              className="absolute inset-0 overflow-y-auto p-10"
            >
              {activeWorkspace?.type === "home" ? (
                // Home workspace: show all courses from all semesters
                <GlobalCalendar
                  courses={years.flatMap((y) => y.semesters.flatMap((s) => s.courses))}
                  semester={null}
                />
              ) : activeSemester ? (
                <GlobalCalendar courses={activeSemester.courses} semester={activeSemester} />
              ) : (
                <CalendarEmptyState
                  hasYears={years.length > 0}
                  hasYear={!!activeYear}
                  onGoToDashboard={() => setActiveNav("dashboard")}
                />
              )}
            </motion.div>
          )}

          {/* ── Resources ────────────────────────────────────────────────── */}
          {isResources && (
            <motion.div
              key={pageKey}
              variants={fadeVariants}
              initial="initial" animate="animate" exit="exit"
              className="absolute inset-0 overflow-y-auto p-10"
            >
              <ResourcesView years={years} />
            </motion.div>
          )}

          {/* ── Settings ─────────────────────────────────────────────────── */}
          {isSettings && (
            <motion.div
              key={pageKey}
              variants={fadeVariants}
              initial="initial" animate="animate" exit="exit"
              className="absolute inset-0 overflow-y-auto p-10"
            >
              <SettingsView user={authUser} onLogout={onLogout} />
            </motion.div>
          )}

          {/* ── Grades ───────────────────────────────────────────────────── */}
          {isGrades && (
            <motion.div
              key={pageKey}
              variants={fadeVariants}
              initial="initial" animate="animate" exit="exit"
              className="absolute inset-0 overflow-y-auto p-10"
            >
              <GradesView years={years} />
            </motion.div>
          )}

          {/* ── Breadcrumb: Courses → Year → Semester → Course ───────────── */}
          {isBreadcrumb && (
            <motion.div
              key={pageKey}
              custom={direction}
              variants={pageVariants}
              initial="initial" animate="animate" exit="exit"
              className="absolute inset-0 overflow-y-auto p-10"
            >
              {page === "year" && (
                <YearView
                  years={years}
                  isLoading={isLoading}
                  isError={isError}
                  activeYearId={activeYearId}
                  onYearChange={setActiveYearId}
                  onSelectSemester={(sem) =>
                    push("semester", { semesterId: String(sem._id) })
                  }
                />
              )}

              {page === "semester" && activeSemester && (
                <SemesterView
                  semester={activeSemester}
                  yearId={activeYearId}
                  onSelectCourse={(course) =>
                    push("course", { courseId: String(course._id) })
                  }
                  onBack={pop}
                />
              )}

              {page === "course" && activeCourse && (
                <CourseView
                  course={activeCourse}
                  semester={activeSemester}
                  yearId={activeYearId}
                  onBack={pop}
                />
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      <RightSidebar
        expanded={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
        onNewWorkspace={() => setWsModalOpen(true)}
        onNavigate={setActiveNav}
        activeNav={activeNav}
      />
      </div>

      <WorkspaceModal
        isOpen={wsModalOpen}
        onClose={() => setWsModalOpen(false)}
        onCreate={(name, type) => createWorkspace(name, type)}
      />

      <CommandMenu
        yearData={activeYear}
        onNavigateToCourse={(course, semester) => {
          setActiveNav("courses");
          push("course", {
            semesterId: String(semester._id),
            courseId:   String(course._id),
          });
        }}
        open={cmdOpen}
        onOpenChange={setCmdOpen}
      />
    </div>
  );
}

// ── Calendar empty state ──────────────────────────────────────────────────────
function CalendarEmptyState({ hasYears, hasYear, onGoToDashboard }) {
  const message = !hasYears
    ? "Create an academic year first to use the calendar."
    : !hasYear
      ? "Select an academic year to view its calendar."
      : "Open a semester from Courses to see its events here.";

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
      <div
        className="w-16 h-16 rounded-[20px] flex items-center justify-center"
        style={{
          background:          "rgba(255,255,255,0.4)",
          backdropFilter:      "blur(20px)",
          WebkitBackdropFilter:"blur(20px)",
          border:              "1px solid rgba(255,255,255,0.5)",
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
          stroke="rgba(255,255,255,0.85)" strokeWidth="1.6"
          strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2.5" />
          <path d="M16 2v4M8 2v4M3 10h18" />
          <circle cx="8"  cy="15" r="1" fill="rgba(255,255,255,0.85)" stroke="none" />
          <circle cx="12" cy="15" r="1" fill="rgba(255,255,255,0.85)" stroke="none" />
          <circle cx="16" cy="15" r="1" fill="rgba(255,255,255,0.85)" stroke="none" />
        </svg>
      </div>

      <div>
        <p className="text-white/90 text-[15px] font-medium" style={{ letterSpacing: "-0.016em" }}>
          No semester selected
        </p>
        <p className="text-white/55 text-[13px] mt-1 max-w-[280px] leading-relaxed">{message}</p>
      </div>

      <button
        onClick={onGoToDashboard}
        className="px-4 py-2 rounded-[10px] text-[13px] font-medium cursor-pointer
                   transition-all duration-150 hover:scale-105 active:scale-95"
        style={{
          background:          "rgba(255,255,255,0.25)",
          backdropFilter:      "blur(16px)",
          WebkitBackdropFilter:"blur(16px)",
          border:              "1px solid rgba(255,255,255,0.4)",
          color:               "rgba(255,255,255,0.9)",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.35)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.25)")}
      >
        Go to Dashboard
      </button>
    </div>
  );
}
