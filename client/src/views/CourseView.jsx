import { useState, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import GlassCard       from "../components/GlassCard";
import ProgressBar     from "../components/ProgressBar";
import ProgressRing    from "../components/ProgressRing";
import DeleteModal     from "../components/DeleteModal";
import ResourceManager from "../components/ResourceManager";
import {
  useAssignments,
  useUpdateAssignment,
  useCreateAssignment,
} from "../hooks/useAssignments";
import { useDeleteEvent } from "../hooks/useEvents";
import { useDeleteCourse } from "../hooks/useAcademic";
import EventEditModal     from "../components/EventEditModal";

// ── Static config ─────────────────────────────────────────────────────────────

const EVENT_STYLE = {
  assignment: { pill: "bg-violet-100 text-violet-700", dot: "bg-violet-500" },
  exam:       { pill: "bg-rose-100   text-rose-700",   dot: "bg-rose-500" },
  lecture:    { pill: "bg-sky-100    text-sky-700",     dot: "bg-sky-500" },
  reminder:   { pill: "bg-amber-100  text-amber-700",  dot: "bg-amber-500" },
  other:      { pill: "bg-gray-100   text-gray-600",   dot: "bg-gray-400" },
};

const STATUS_CONFIG = {
  "todo":        { label: "To-Do",       ring: "bg-gray-100   text-gray-600",   dot: "bg-gray-400",    next: "in-progress" },
  "in-progress": { label: "In Progress", ring: "bg-amber-50   text-amber-700",  dot: "bg-amber-400",   next: "completed"   },
  "completed":   { label: "Completed",   ring: "bg-emerald-50 text-emerald-700",dot: "bg-emerald-500", next: "todo"        },
};

// ── Animation variants ────────────────────────────────────────────────────────

const tabFade = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.4, 0, 0.2, 1] } },
  exit:    { opacity: 0,       transition: { duration: 0.12 } },
};

const listStagger = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.045 } },
};

const listItem = {
  hidden: { opacity: 0, x: -12 },
  show:   { opacity: 1, x: 0, transition: { duration: 0.26, ease: [0.4, 0, 0.2, 1] } },
};

// ── Small helpers ─────────────────────────────────────────────────────────────

function formatDate(date) {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function relativeDate(date) {
  const d    = new Date(date);
  const days = Math.round((d - new Date()) / 86_400_000);
  if (days === 0)  return "Today";
  if (days === 1)  return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 1 && days < 8) return `In ${days} days`;
  if (days < -1)  return `${Math.abs(days)}d ago`;
  return formatDate(date);
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

// ── EventRow — event list item with inline delete confirm ────────────────────

function EventRow({ ev, courseId, style, isPast = false, onEdit }) {
  const [confirming, setConfirming] = useState(false);
  const { mutate: deleteEvent, isPending } = useDeleteEvent();

  function handleDelete(e) {
    e.stopPropagation();
    deleteEvent({ courseId, eventId: ev._id });
  }

  return (
    <motion.li
      variants={listItem}
      className={[
        "group relative flex items-center gap-3 px-4 py-3",
        isPast ? "opacity-60" : "",
      ].join(" ")}
    >
      {/* Leading icon */}
      {isPast && ev.completed ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className="text-emerald-500 shrink-0">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <span className={`w-2 h-2 rounded-full shrink-0 ${style(ev.type).dot}`} />
      )}

      {/* Title + date */}
      <div className="flex-1 min-w-0">
        <p className={[
          "text-[13px] font-medium text-gray-900 leading-tight",
          isPast && ev.completed ? "line-through text-gray-700" : "",
        ].join(" ")} style={{ letterSpacing: "-0.011em" }}>
          {ev.title}
        </p>
        <p className="text-[11px] text-gray-400 mt-0.5">{formatDate(ev.date)}</p>
      </div>

      {/* Type pill or relative date */}
      {isPast ? (
        <div className="flex items-center gap-1.5 shrink-0">
          {(() => {
            const pct = resolveEarnedPct(ev);
            return pct != null ? (
              <span className={[
                "text-[11px] font-semibold px-2 py-0.5 rounded-md",
                pct >= 90 ? "bg-emerald-100 text-emerald-700" :
                pct >= 80 ? "bg-sky-100 text-sky-700" :
                pct >= 70 ? "bg-amber-100 text-amber-700" :
                pct >= 60 ? "bg-orange-100 text-orange-700" :
                "bg-rose-100 text-rose-700",
              ].join(" ")}>
                {ev.earnedPoints != null && ev.totalPoints != null
                  ? `${ev.earnedPoints}/${ev.totalPoints}`
                  : `${pct}%`}
              </span>
            ) : null;
          })()}
          {resolveEarnedPct(ev) == null && (
            ev.type === "assignment" || ev.type === "exam" ? (
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(ev); }}
                className="text-[11px] font-medium px-2 py-0.5 rounded-md
                           bg-gray-100 text-gray-400 hover:bg-indigo-50 hover:text-indigo-500
                           transition-colors cursor-pointer border border-dashed border-gray-200
                           hover:border-indigo-200"
              >
                + grade
              </button>
            ) : (
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${style(ev.type).pill} opacity-70`}>
                {ev.type}
              </span>
            )
          )}
          {ev.gradeWeight != null && (
            <span className="text-[10px] text-gray-400">{ev.gradeWeight}%</span>
          )}
        </div>
      ) : (
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${style(ev.type).pill}`}>
          {relativeDate(ev.date)}
        </span>
      )}

      {/* Edit button — always visible on hover when not confirming */}
      {!confirming && (
        <motion.button
          onClick={(e) => { e.stopPropagation(); onEdit(ev); }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
          className="opacity-0 group-hover:opacity-100 shrink-0 p-1 rounded-[6px]
                     text-gray-400 hover:text-indigo-500 hover:bg-indigo-50
                     transition-all duration-150 cursor-pointer"
          title="Edit event"
        >
          <PencilIcon />
        </motion.button>
      )}

      {/* Delete — inline confirm */}
      <AnimatePresence mode="wait">
        {confirming ? (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-1.5 shrink-0"
          >
            <span className="text-[11px] text-rose-500 font-medium">Delete?</span>
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="px-2 py-0.5 rounded-[6px] text-[11px] font-semibold bg-rose-50 text-rose-600
                         hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer
                         disabled:opacity-50 disabled:cursor-wait active:scale-95"
            >
              {isPending ? "…" : "Yes"}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setConfirming(false); }}
              className="px-2 py-0.5 rounded-[6px] text-[11px] font-semibold bg-gray-100 text-gray-500
                         hover:bg-gray-200 border border-gray-200 transition-colors cursor-pointer
                         active:scale-95"
            >
              No
            </button>
          </motion.div>
        ) : (
          <motion.button
            key="trash"
            onClick={(e) => { e.stopPropagation(); setConfirming(true); }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0 }}
            whileHover={{ opacity: 1 }}
            className="opacity-0 group-hover:opacity-100 shrink-0 p-1 rounded-[6px]
                       text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition-all
                       duration-150 cursor-pointer"
            title="Delete event"
          >
            <TrashIcon />
          </motion.button>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

// ── StatusBadge — click to cycle through statuses ────────────────────────────

function StatusBadge({ status, onClick, isPending }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG["todo"];
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      disabled={isPending}
      className={[
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full",
        "text-[11px] font-semibold transition-opacity duration-100",
        "cursor-pointer hover:opacity-75 active:scale-95 disabled:cursor-wait",
        cfg.ring,
      ].join(" ")}
      title="Click to change status"
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </button>
  );
}

// ── Add-assignment inline form ────────────────────────────────────────────────

function AddAssignmentForm({ courseId, onClose }) {
  const [title, setTitle]   = useState("");
  const [date,  setDate]    = useState("");
  const { mutate, isPending, error } = useCreateAssignment(courseId);

  function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim() || !date) return;
    mutate(
      { title: title.trim(), date },
      { onSuccess: onClose }
    );
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
    >
      <GlassCard variant="subtle" className="p-4 mb-3">
        <p className="text-[12px] font-semibold text-gray-700 mb-3" style={{ letterSpacing: "-0.011em" }}>
          New Assignment
        </p>
        <div className="space-y-2.5">
          <input
            type="text"
            placeholder="Assignment title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
            className="w-full px-3 py-2 rounded-[8px] text-[13px] outline-none
                       bg-white/70 border border-gray-200/80 text-gray-900
                       placeholder:text-gray-300
                       focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100
                       transition-all duration-150"
          />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-[8px] text-[13px] outline-none
                       bg-white/70 border border-gray-200/80 text-gray-700
                       focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100
                       transition-all duration-150"
          />
        </div>

        {error && (
          <p className="text-[11px] text-rose-500 mt-2">{error.message}</p>
        )}

        <div className="flex gap-2 mt-3">
          <motion.button
            type="submit"
            disabled={isPending || !title.trim() || !date}
            whileTap={{ scale: 0.97 }}
            className="flex-1 py-2 rounded-[8px] text-[13px] font-semibold text-white
                       bg-gradient-to-r from-indigo-500 to-violet-500
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-opacity duration-150 cursor-pointer"
          >
            {isPending ? "Adding…" : "Add Assignment"}
          </motion.button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-[8px] text-[13px] font-medium text-gray-500
                       bg-gray-100/70 hover:bg-gray-200/70 transition-colors duration-100 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </GlassCard>
    </motion.form>
  );
}

// ── Assignment row ────────────────────────────────────────────────────────────

function AssignmentRow({ assignment, courseId }) {
  const { mutate, isPending } = useUpdateAssignment(courseId);
  const cfg = STATUS_CONFIG[assignment.status] ?? STATUS_CONFIG["todo"];

  function cycleStatus() {
    mutate({ assignmentId: assignment._id, status: cfg.next });
  }

  return (
    <motion.li
      variants={listItem}
      layout
      className={[
        "flex items-center gap-3 px-4 py-3.5",
        assignment.status === "completed" ? "opacity-55" : "",
      ].join(" ")}
    >
      {/* Status badge — click to advance */}
      <StatusBadge
        status={assignment.status}
        onClick={cycleStatus}
        isPending={isPending}
      />

      {/* Title + date */}
      <div className="flex-1 min-w-0">
        <p
          className={[
            "text-[13px] font-medium text-gray-900 leading-tight truncate",
            assignment.status === "completed" ? "line-through text-gray-500" : "",
          ].join(" ")}
          style={{ letterSpacing: "-0.011em" }}
        >
          {assignment.title}
        </p>
        {assignment.description && (
          <p className="text-[11px] text-gray-400 truncate mt-0.5">
            {assignment.description}
          </p>
        )}
      </div>

      {/* Due date */}
      <span className="text-[11px] text-gray-400 shrink-0 tabular-nums">
        {relativeDate(assignment.date)}
      </span>
    </motion.li>
  );
}

// ── Assignments tab ───────────────────────────────────────────────────────────

const STATUS_ORDER = ["in-progress", "todo", "completed"];
const STATUS_SECTION_LABEL = {
  "in-progress": "In Progress",
  "todo":        "To-Do",
  "completed":   "Completed",
};

function AssignmentsTab({ course }) {
  const seedData = course.events.filter((e) => e.type === "assignment");
  const { data: assignments = [], isError } = useAssignments(course._id, seedData);
  const [showForm, setShowForm] = useState(false);

  const done  = assignments.filter((a) => a.status === "completed").length;
  const total = assignments.length;

  const grouped = STATUS_ORDER.reduce((acc, status) => {
    acc[status] = assignments.filter((a) => a.status === status);
    return acc;
  }, {});

  return (
    <div>
      {/* Summary ring + add button */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-4">
          <ProgressRing value={done} max={total} size={64} strokeWidth={5.5} />
          <div>
            <p className="text-[13px] font-medium text-gray-900" style={{ letterSpacing: "-0.011em" }}>
              {done} of {total} complete
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {grouped["in-progress"].length > 0
                ? `${grouped["in-progress"].length} in progress`
                : grouped["todo"].length > 0
                ? `${grouped["todo"].length} remaining`
                : "All done!"}
            </p>
          </div>
        </div>

        <motion.button
          onClick={() => setShowForm((v) => !v)}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-[13px]
                     font-medium text-gray-700 bg-gray-100
                     border border-gray-200 hover:bg-gray-200 transition-colors
                     duration-150 cursor-pointer"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add
        </motion.button>
      </div>

      {/* Inline add form */}
      <AnimatePresence>
        {showForm && (
          <AddAssignmentForm
            courseId={course._id}
            onClose={() => setShowForm(false)}
          />
        )}
      </AnimatePresence>

      {isError && (
        <p className="text-[12px] text-amber-200/80 mb-4">
          Showing cached data — couldn't reach the server.
        </p>
      )}

      {/* Status sections */}
      {total === 0 && !showForm ? (
        <GlassCard variant="subtle" className="flex flex-col items-center py-10 text-center">
          <span className="text-2xl mb-2">✓</span>
          <p className="text-[14px] font-medium text-gray-700">No assignments yet</p>
          <p className="text-[12px] text-gray-400 mt-1">Click "Add" to create your first one.</p>
        </GlassCard>
      ) : (
        <div className="space-y-4">
          {STATUS_ORDER.map((status) => {
            const items = grouped[status];
            if (items.length === 0) return null;
            return (
              <section key={status}>
                <p
                  className="text-[10px] font-semibold text-gray-500 uppercase mb-2"
                  style={{ letterSpacing: "0.07em" }}
                >
                  {STATUS_SECTION_LABEL[status]} · {items.length}
                </p>
                <GlassCard
                  variant={status === "in-progress" ? "elevated" : "default"}
                  className="divide-y divide-gray-100/60"
                >
                  <motion.ul variants={listStagger} initial="hidden" animate="show">
                    {items.map((a) => (
                      <AssignmentRow key={a._id} assignment={a} courseId={course._id} />
                    ))}
                  </motion.ul>
                </GlassCard>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Resources tab — delegates entirely to ResourceManager ─────────────────────

function ResourcesTab({ course }) {
  return <ResourceManager course={course} />;
}

// ── Grade math (mirrors GradesView logic) ────────────────────────────────────

const GRADED_TYPES = new Set(["assignment", "exam"]);

/**
 * Resolve earnedPct for an event.
 * The years query returns raw DB docs (no earnedPct), so we derive it from
 * earnedPoints / totalPoints when the pre-computed field is absent.
 */
function resolveEarnedPct(e) {
  if (e.earnedPct != null) return e.earnedPct;
  if (e.earnedPoints != null && e.totalPoints != null && e.totalPoints > 0)
    return Math.round(e.earnedPoints / e.totalPoints * 10000) / 100;
  return null;
}

function letterGrade(pct) {
  if (pct == null) return "–";
  if (pct >= 93) return "A";  if (pct >= 90) return "A−";
  if (pct >= 87) return "B+"; if (pct >= 83) return "B";
  if (pct >= 80) return "B−"; if (pct >= 77) return "C+";
  if (pct >= 73) return "C";  if (pct >= 70) return "C−";
  if (pct >= 67) return "D+"; if (pct >= 63) return "D";
  if (pct >= 60) return "D−"; return "F";
}

function gradeColors(pct) {
  if (pct == null) return { text: "#9ca3af", bg: "#f3f4f6" };
  if (pct >= 90)  return { text: "#059669", bg: "#d1fae5" };
  if (pct >= 80)  return { text: "#0284c7", bg: "#e0f2fe" };
  if (pct >= 70)  return { text: "#d97706", bg: "#fef3c7" };
  if (pct >= 60)  return { text: "#ea580c", bg: "#ffedd5" };
  return             { text: "#dc2626", bg: "#fee2e2" };
}

function computeCourseGrades(events) {
  const assessments = events.filter((e) => GRADED_TYPES.has(e.type));
  const withWeight  = assessments.filter((e) => e.gradeWeight != null && e.gradeWeight > 0);
  const graded      = withWeight.filter((e) => resolveEarnedPct(e) != null);
  const ungraded    = withWeight.filter((e) => resolveEarnedPct(e) == null);

  const totalWeight    = withWeight.reduce((s, e) => s + e.gradeWeight, 0);
  const gradedWeight   = graded.reduce((s, e)   => s + e.gradeWeight, 0);
  // Contribution of graded items toward the final 100% grade
  const weightedPoints = graded.reduce((s, e)   => s + (resolveEarnedPct(e) / 100) * e.gradeWeight, 0);
  const ungradedWeight = ungraded.reduce((s, e) => s + e.gradeWeight, 0);
  // Weight not yet assigned to any event — e.g. future assessments not yet added
  const unassignedWeight = Math.max(0, 100 - totalWeight);

  // Raw marks across all graded items (for the Earned cell display)
  const sumEarnedPoints = graded.reduce((s, e) => s + (e.earnedPoints ?? 0), 0);
  const sumTotalPoints  = graded.reduce((s, e) => s + (e.totalPoints  ?? 0), 0);

  const r = (n) => Math.round(n * 10) / 10;
  return {
    // Average score on items already returned/graded (ignores ungraded weight)
    earned:   gradedWeight > 0 ? r((weightedPoints / gradedWeight)  * 100) : null,
    // Actual standing: locked scores + 0 on everything else
    current:  totalWeight  > 0 ? r((weightedPoints / totalWeight)   * 100) : null,
    // Best case: locked scores + 100% on ungraded items + 100% on not-yet-added course weight
    possible: r(Math.min(100, weightedPoints + ungradedWeight + unassignedWeight)),
    gradedCount:    graded.length,
    weightedCount:  withWeight.length,
    totalWeight,
    sumEarnedPoints,
    sumTotalPoints,
  };
}

// ── Grade summary cell ────────────────────────────────────────────────────────

/**
 * rawMarks: optional "X / Y" string shown instead of percentage (used for Earned cell).
 * value:    still used for background colour even when rawMarks is shown.
 */
function GradeSummaryCell({ label, value, sublabel, rawMarks }) {
  const color = gradeColors(value);
  return (
    <div className="flex flex-col items-center gap-1 px-3 py-3 rounded-[12px]"
         style={{ background: color.bg }}>
      <span className="text-[9px] font-semibold text-gray-500 uppercase"
            style={{ letterSpacing: "0.07em" }}>
        {label}
      </span>
      <div className="flex items-baseline gap-1 flex-wrap justify-center">
        {rawMarks ? (
          <span className="text-[18px] font-bold leading-none tabular-nums"
                style={{ color: color.text, letterSpacing: "-0.02em" }}>
            {rawMarks}
          </span>
        ) : (
          <span className="text-[20px] font-bold leading-none"
                style={{ color: color.text, letterSpacing: "-0.03em" }}>
            {value != null ? `${value}%` : "–"}
          </span>
        )}
        {value != null && (
          <span className="text-[11px] font-semibold" style={{ color: color.text }}>
            {rawMarks ? `${value}%` : letterGrade(value)}
          </span>
        )}
      </div>
      {sublabel && (
        <span className="text-[9px] text-gray-400 text-center leading-tight">{sublabel}</span>
      )}
    </div>
  );
}

// ── Grade item row ────────────────────────────────────────────────────────────

function GradeItemRow({ ev, courseId, onEdit, dimmed = false }) {
  const earnedPct = resolveEarnedPct(ev);
  const color = gradeColors(earnedPct);
  const isPast = new Date(ev.date) <= new Date();

  return (
    <motion.div
      variants={listItem}
      className={[
        "flex items-center gap-3 px-4 py-3 group",
        dimmed ? "opacity-55" : "",
      ].join(" ")}
    >
      {/* Type dot */}
      <span className={`w-2 h-2 rounded-full shrink-0 mt-0.5 ${(EVENT_STYLE[ev.type] ?? EVENT_STYLE.other).dot}`} />

      {/* Title + meta */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-gray-900 leading-tight truncate"
           style={{ letterSpacing: "-0.011em" }}>
          {ev.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-[11px] text-gray-400">{formatDate(ev.date)}</span>
          {ev.gradeWeight != null && (
            <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-400
                             px-1.5 py-0.5 rounded-[5px]">
              {ev.gradeWeight}% weight
            </span>
          )}
        </div>
      </div>

      {/* Score badge */}
      <div className="shrink-0 flex items-center gap-2">
        {earnedPct != null ? (
          <div className="flex items-center gap-1.5">
            {ev.earnedPoints != null && ev.totalPoints != null && (
              <span className="text-[12px] text-gray-400 tabular-nums">
                {ev.earnedPoints}/{ev.totalPoints}
              </span>
            )}
            <span
              className="text-[13px] font-bold px-2.5 py-0.5 rounded-[8px] tabular-nums"
              style={{ color: color.text, background: color.bg }}
            >
              {earnedPct}% <span className="text-[11px]">{letterGrade(earnedPct)}</span>
            </span>
          </div>
        ) : isPast ? (
          <button
            onClick={() => onEdit(ev)}
            className="text-[11px] font-medium px-2.5 py-1 rounded-[8px]
                       bg-gray-50 text-gray-400 hover:bg-indigo-50 hover:text-indigo-500
                       transition-colors cursor-pointer border border-dashed border-gray-200
                       hover:border-indigo-200"
          >
            + enter score
          </button>
        ) : (
          <span className="text-[11px] text-gray-300 font-medium">
            {!isPast ? relativeDate(ev.date) : "—"}
          </span>
        )}

        {/* Edit button — always visible */}
        <button
          onClick={() => onEdit(ev)}
          className="p-1.5 rounded-[7px] text-gray-400 hover:text-indigo-500
                     hover:bg-indigo-50 transition-all duration-150 cursor-pointer
                     opacity-0 group-hover:opacity-100"
          title="Edit"
        >
          <PencilIcon />
        </button>
      </div>
    </motion.div>
  );
}

// ── Grades tab ────────────────────────────────────────────────────────────────

function GradesTab({ course, onEdit }) {
  const now = new Date();

  const assessments = useMemo(
    () => course.events.filter((e) => GRADED_TYPES.has(e.type)),
    [course.events]
  );

  const grades = useMemo(() => computeCourseGrades(course.events), [course.events]);

  // Four buckets — use resolveEarnedPct so raw DB docs (no earnedPct field) work too
  const scored   = useMemo(() =>
    assessments.filter((e) => resolveEarnedPct(e) != null)
               .sort((a, b) => new Date(b.date) - new Date(a.date)),
    [assessments]
  );

  const awaitingScore = useMemo(() =>
    assessments.filter((e) => resolveEarnedPct(e) == null && new Date(e.date) <= now)
               .sort((a, b) => new Date(b.date) - new Date(a.date)),
    [assessments]
  );

  const upcoming = useMemo(() =>
    assessments.filter((e) => resolveEarnedPct(e) == null && new Date(e.date) > now)
               .sort((a, b) => new Date(a.date) - new Date(b.date)),
    [assessments]
  );

  const unweighted = useMemo(() =>
    assessments.filter((e) => e.gradeWeight == null || e.gradeWeight === 0),
    [assessments]
  );

  const hasAny = assessments.length > 0;

  if (!hasAny) {
    return (
      <GlassCard variant="subtle" className="flex flex-col items-center py-12 text-center">
        <span className="text-3xl mb-3">📊</span>
        <p className="text-[14px] font-medium text-gray-700">No assessments yet</p>
        <p className="text-[12px] text-gray-400 mt-1">
          Add assignments or exams in the Events tab, then set weights and scores here.
        </p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Grade summary ──────────────────────────────────────────────────── */}
      {grades.totalWeight > 0 ? (
        <GlassCard variant="elevated" className="p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold text-gray-500 uppercase"
               style={{ letterSpacing: "0.06em" }}>
              Grade Summary
            </p>
            <span className="text-[11px] text-gray-400">
              {grades.gradedCount} of {grades.weightedCount} weighted items scored
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <GradeSummaryCell
              label="Earned"
              value={grades.earned}
              sublabel="avg on returned work"
              rawMarks={
                grades.sumTotalPoints > 0
                  ? `${grades.sumEarnedPoints} / ${grades.sumTotalPoints}`
                  : null
              }
            />
            <GradeSummaryCell label="Current"  value={grades.current}  sublabel="weighted so far"  />
            <GradeSummaryCell label="Possible" value={grades.possible} sublabel="best case remaining" />
          </div>
        </GlassCard>
      ) : (
        <div
          className="px-4 py-3 rounded-[12px] text-[12px] text-amber-700 font-medium"
          style={{ background: "#fef3c7", border: "1px solid #fde68a" }}
        >
          Set a weight on your assessments to see grade projections.
        </div>
      )}

      {/* ── Scored ────────────────────────────────────────────────────────── */}
      {scored.length > 0 && (
        <section>
          <p className="text-[10px] font-semibold text-emerald-600 uppercase mb-2"
             style={{ letterSpacing: "0.07em" }}>
            Graded · {scored.length}
          </p>
          <GlassCard variant="elevated" className="divide-y divide-gray-100/70 overflow-hidden">
            <motion.div variants={listStagger} initial="hidden" animate="show">
              {scored.map((ev) => (
                <GradeItemRow key={ev._id} ev={ev} courseId={course._id} onEdit={onEdit} />
              ))}
            </motion.div>
          </GlassCard>
        </section>
      )}

      {/* ── Awaiting score ────────────────────────────────────────────────── */}
      {awaitingScore.length > 0 && (
        <section>
          <p className="text-[10px] font-semibold text-amber-600 uppercase mb-2"
             style={{ letterSpacing: "0.07em" }}>
            Awaiting Score · {awaitingScore.length}
          </p>
          <GlassCard className="divide-y divide-gray-100/60 overflow-hidden">
            <motion.div variants={listStagger} initial="hidden" animate="show">
              {awaitingScore.map((ev) => (
                <GradeItemRow key={ev._id} ev={ev} courseId={course._id} onEdit={onEdit} />
              ))}
            </motion.div>
          </GlassCard>
        </section>
      )}

      {/* ── Upcoming ──────────────────────────────────────────────────────── */}
      {upcoming.length > 0 && (
        <section>
          <p className="text-[10px] font-semibold text-indigo-500 uppercase mb-2"
             style={{ letterSpacing: "0.07em" }}>
            Upcoming · {upcoming.length}
          </p>
          <GlassCard className="divide-y divide-gray-100/60 overflow-hidden">
            <motion.div variants={listStagger} initial="hidden" animate="show">
              {upcoming.map((ev) => (
                <GradeItemRow key={ev._id} ev={ev} courseId={course._id} onEdit={onEdit} dimmed />
              ))}
            </motion.div>
          </GlassCard>
        </section>
      )}

      {/* ── Unweighted ────────────────────────────────────────────────────── */}
      {unweighted.length > 0 && (
        <section>
          <p className="text-[10px] font-semibold text-gray-400 uppercase mb-2"
             style={{ letterSpacing: "0.07em" }}>
            No Weight Set · {unweighted.length}
          </p>
          <GlassCard variant="subtle" className="divide-y divide-gray-100/50 overflow-hidden">
            <motion.div variants={listStagger} initial="hidden" animate="show">
              {unweighted.map((ev) => (
                <GradeItemRow key={ev._id} ev={ev} courseId={course._id} onEdit={onEdit} dimmed />
              ))}
            </motion.div>
          </GlassCard>
        </section>
      )}

    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const TABS = ["assignments", "events", "grades", "resources"];

export default function CourseView({ course, semester, yearId, onBack }) {
  const [tab,          setTab]          = useState("assignments");
  const [deleteOpen,   setDeleteOpen]   = useState(false);
  const [editingEvent, setEditingEvent] = useState(null); // { ev, courseId }
  const { mutateAsync: deleteCourse, isPending: isDeleting } = useDeleteCourse();
  const now = new Date();

  const assignments = course.events.filter((e) => e.type === "assignment");
  const done        = assignments.filter((e) => e.completed || e.status === "completed").length;

  const upcoming = course.events
    .filter((e) => !e.completed && new Date(e.date) > now)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const past = course.events
    .filter((e) => e.completed || new Date(e.date) <= now)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const style = (type) => EVENT_STYLE[type] ?? EVENT_STYLE.other;

  const deleteDescription =
    `This will permanently remove ${course.events.length} event${course.events.length !== 1 ? "s" : ""} ` +
    `and ${course.resources.length} resource${course.resources.length !== 1 ? "s" : ""}.`;

  return (
    <>
    <div>
      {/* ── Breadcrumb ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <motion.button
          whileHover={{ x: -2 }}
          whileTap={{ scale: 0.93 }}
          onClick={onBack}
          className="flex items-center gap-1 text-[13px] text-gray-500 hover:text-gray-900 transition-colors cursor-pointer"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {semester?.name}
        </motion.button>
        <span className="text-gray-400 text-[13px]">/</span>
        <span className="text-[13px] text-gray-900 font-medium">{course.title}</span>
      </div>

      {/* ── Course header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-start gap-4">
          <div
            className="w-12 h-12 rounded-[14px] shadow-md shrink-0 mt-0.5"
            style={{ background: course.gradientStyle }}
          />
          <div>
            <p className="text-[11px] font-semibold text-gray-500 uppercase mb-0.5" style={{ letterSpacing: "0.06em" }}>
              {course.code}
            </p>
            <h1
              className="text-[26px] font-semibold text-gray-900 leading-tight"
              style={{ letterSpacing: "-0.03em" }}
            >
              {course.title}
            </h1>
            {course.description && (
              <p className="text-[13px] text-gray-500 mt-1">{course.description}</p>
            )}
          </div>
        </div>

        <motion.button
          onClick={() => setDeleteOpen(true)}
          whileHover={{ scale: 1.06, backgroundColor: "rgba(255,255,255,0.22)" }}
          whileTap={{ scale: 0.94 }}
          className="flex items-center gap-2 px-3 py-2 rounded-[10px] text-[13px]
                     font-medium text-gray-600 hover:text-rose-600
                     bg-gray-100 hover:bg-rose-50 transition-colors duration-150
                     border border-gray-200 cursor-pointer shrink-0 mt-1"
        >
          <TrashIcon />
          Delete Course
        </motion.button>
      </div>

      {/* ── Stats strip ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "Assignments",   value: `${done} / ${assignments.length}` },
          { label: "Upcoming",      value: String(upcoming.length) },
          { label: "Resources",     value: String(course.resources.length) },
        ].map((s) => (
          <GlassCard key={s.label} variant="subtle" className="px-4 py-3">
            <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1" style={{ letterSpacing: "0.06em" }}>
              {s.label}
            </p>
            <p className="text-[22px] font-semibold text-gray-900 leading-none" style={{ letterSpacing: "-0.03em" }}>
              {s.value}
            </p>
          </GlassCard>
        ))}
      </div>

      <GlassCard variant="subtle" className="px-4 py-3 mb-6">
        <ProgressBar value={done} max={assignments.length} showLabel />
      </GlassCard>

      {/* ── Tab control ───────────────────────────────────────────────────── */}
      <div className="flex items-center mb-5 p-1 rounded-[11px] bg-black/[0.05] w-fit">
        {TABS.map((t) => (
          <motion.button
            key={t}
            onClick={() => setTab(t)}
            className={[
              "relative px-4 py-1.5 text-[13px] font-medium rounded-[8px] cursor-pointer",
              "transition-colors duration-100 capitalize min-w-[96px] text-center",
              tab === t ? "text-gray-900" : "text-gray-500 hover:text-gray-900",
            ].join(" ")}
          >
            {tab === t && (
              <motion.span
                layoutId="course-tab-pill"
                className="absolute inset-0 rounded-[8px] bg-white/85 shadow-sm"
                style={{ zIndex: 0 }}
                transition={{ type: "spring", stiffness: 440, damping: 36 }}
              />
            )}
            <span className="relative z-10">{t}</span>
          </motion.button>
        ))}
      </div>

      {/* ── Tab content ───────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {tab === "assignments" && (
          <motion.div key="assignments" {...tabFade}>
            <AssignmentsTab course={course} />
          </motion.div>
        )}

        {tab === "events" && (
          <motion.div key="events" {...tabFade} className="space-y-6">
            {upcoming.length > 0 && (
              <section>
                <p className="text-[11px] font-semibold text-gray-500 uppercase mb-3" style={{ letterSpacing: "0.06em" }}>
                  Upcoming · {upcoming.length}
                </p>
                <GlassCard variant="elevated" className="divide-y divide-gray-100/70">
                  <motion.ul variants={listStagger} initial="hidden" animate="show">
                    {upcoming.map((ev) => (
                      <EventRow key={ev._id} ev={ev} courseId={course._id} style={style}
                        onEdit={(e) => setEditingEvent({ ev: e, courseId: course._id })} />
                    ))}
                  </motion.ul>
                </GlassCard>
              </section>
            )}

            {past.length > 0 && (
              <section>
                <p className="text-[11px] font-semibold text-gray-400 uppercase mb-3" style={{ letterSpacing: "0.06em" }}>
                  Past · {past.length}
                </p>
                <GlassCard className="divide-y divide-gray-100/50">
                  <motion.ul variants={listStagger} initial="hidden" animate="show">
                    {past.map((ev) => (
                      <EventRow key={ev._id} ev={ev} courseId={course._id} style={style} isPast
                        onEdit={(e) => setEditingEvent({ ev: e, courseId: course._id })} />
                    ))}
                  </motion.ul>
                </GlassCard>
              </section>
            )}
          </motion.div>
        )}

        {tab === "grades" && (
          <motion.div key="grades" {...tabFade}>
            <GradesTab
              course={course}
              onEdit={(ev) => setEditingEvent({ ev, courseId: course._id })}
            />
          </motion.div>
        )}

        {tab === "resources" && (
          <motion.div key="resources" {...tabFade}>
            <ResourcesTab course={course} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>

    <EventEditModal
      event={editingEvent?.ev}
      courseId={editingEvent?.courseId}
      isOpen={!!editingEvent}
      onClose={() => setEditingEvent(null)}
    />

    <DeleteModal
      isOpen={deleteOpen}
      onClose={() => setDeleteOpen(false)}
      onConfirm={async () => {
        await deleteCourse({
          yearId:   String(yearId),
          semId:    String(semester._id),
          courseId: String(course._id),
        });
        onBack();
      }}
      loading={isDeleting}
      entityType="Course"
      entityName={course.title}
      description={deleteDescription}
    />
    </>
  );
}
