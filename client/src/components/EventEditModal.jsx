import { useState, useEffect } from "react";
import { createPortal }       from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useUpdateEvent }     from "../hooks/useEvents";

// ── Constants ─────────────────────────────────────────────────────────────────

const EVENT_TYPES = ["assignment", "exam", "lecture", "reminder", "other"];
const STATUSES    = ["todo", "in-progress", "completed"];

const TYPE_ACCENT = {
  assignment: { fg: "#7c3aed", bg: "#ede9fe" },
  exam:       { fg: "#e11d48", bg: "#ffe4e6" },
  lecture:    { fg: "#0284c7", bg: "#e0f2fe" },
  reminder:   { fg: "#d97706", bg: "#fef3c7" },
  other:      { fg: "#64748b", bg: "#f1f5f9" },
};

const STATUS_ACCENT = {
  "todo":        { fg: "#6b7280", bg: "#f3f4f6", label: "To-Do"       },
  "in-progress": { fg: "#d97706", bg: "#fef3c7", label: "In Progress" },
  "completed":   { fg: "#059669", bg: "#d1fae5", label: "Completed"   },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert a JS Date or ISO string to the YYYY-MM-DD value a <input type="date"> expects. */
function toDateInputValue(val) {
  if (!val) return "";
  const d = new Date(val);
  if (isNaN(d.getTime())) return "";
  // Use UTC so the date in the input always matches the stored date
  const y  = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dy = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${dy}`;
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6"  y2="18" />
      <line x1="6"  y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * EventEditModal
 *
 * Props
 * ─────
 *   event      — the event object (must include _id, title, date, type, description, status)
 *   courseId   — the parent course _id string
 *   isOpen     — boolean
 *   onClose    — () => void
 */
export default function EventEditModal({ event, courseId, isOpen, onClose }) {
  const [title,       setTitle]       = useState("");
  const [date,        setDate]        = useState("");
  const [type,        setType]        = useState("other");
  const [desc,        setDesc]        = useState("");
  const [status,      setStatus]      = useState("todo");
  const [gradeWeight,  setGradeWeight]  = useState(null);
  const [earnedPoints, setEarnedPoints] = useState("");   // raw points earned, e.g. "36"
  const [totalPoints,  setTotalPoints]  = useState("");   // total possible, e.g. "40"
  const [error,       setError]       = useState("");

  const { mutateAsync: updateEvent, isPending } = useUpdateEvent();

  // Sync fields whenever the event changes (handles reopening with a different event)
  useEffect(() => {
    if (!event || !isOpen) return;
    setTitle(event.title  ?? "");
    setDate(toDateInputValue(event.date));
    setType(event.type    ?? "other");
    setDesc(event.description ?? "");
    setStatus(event.status ?? (event.completed ? "completed" : "todo"));
    setGradeWeight(event.gradeWeight   ?? null);
    setEarnedPoints(event.earnedPoints != null ? String(event.earnedPoints) : "");
    setTotalPoints(event.totalPoints   != null ? String(event.totalPoints)  : "");
    setError("");
  }, [event, isOpen]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [isOpen, onClose]);

  // Lock background scroll
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!title.trim()) { setError("Title is required."); return; }
    if (!date)         { setError("Date is required.");  return; }
    try {
      await updateEvent({
        courseId:    String(courseId),
        eventId:     String(event._id),
        title:       title.trim(),
        date,
        type,
        description: desc.trim(),
        status,
        gradeWeight,
        earnedPoints: earnedPoints !== "" ? Number(earnedPoints) : null,
        totalPoints:  totalPoints  !== "" ? Number(totalPoints)  : null,
      });
      onClose();
    } catch (err) {
      setError(err.message ?? "Update failed.");
    }
  }

  const modal = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="event-edit-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[200] flex items-center justify-center px-4"
          aria-modal="true"
          role="dialog"
          aria-label="Edit event"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 cursor-pointer"
            style={{
              backgroundColor: "rgba(0,0,0,0.28)",
              backdropFilter:      "blur(14px) saturate(150%)",
              WebkitBackdropFilter:"blur(14px) saturate(150%)",
            }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Card */}
          <motion.div
            initial={{ scale: 0.94, y: 20, opacity: 0 }}
            animate={{ scale: 1,    y: 0,  opacity: 1 }}
            exit={{    scale: 0.96, y: 10, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.34, 1.3, 0.64, 1] }}
            className="relative z-10 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="rounded-[20px] p-6"
              style={{
                background:          "rgba(255,255,255,0.96)",
                border:              "1px solid rgba(255,255,255,0.80)",
                boxShadow:           "0 24px 60px rgba(0,0,0,0.14), 0 8px 20px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.98)",
                backdropFilter:      "blur(28px) saturate(190%)",
                WebkitBackdropFilter:"blur(28px) saturate(190%)",
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <h2
                  className="text-[17px] font-semibold text-gray-900"
                  style={{ letterSpacing: "-0.022em" }}
                >
                  Edit Event
                </h2>
                <button
                  onClick={onClose}
                  className="w-7 h-7 flex items-center justify-center rounded-full
                             text-gray-400 hover:text-gray-600 hover:bg-black/[0.06]
                             transition-colors duration-100 cursor-pointer"
                  aria-label="Close"
                >
                  <XIcon />
                </button>
              </div>

              <form onSubmit={handleSubmit} noValidate className="space-y-4">

                {/* Title */}
                <div>
                  <label htmlFor="ee-title"
                    className="block text-[12px] font-medium text-gray-600 mb-1.5"
                    style={{ letterSpacing: "-0.011em" }}>
                    Title <span className="text-rose-400">*</span>
                  </label>
                  <input
                    id="ee-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    autoFocus
                    placeholder="Event title"
                    className="glass-input w-full px-3.5 py-2.5 text-[14px] text-gray-900"
                    style={{ letterSpacing: "-0.011em" }}
                  />
                </div>

                {/* Date */}
                <div>
                  <label htmlFor="ee-date"
                    className="block text-[12px] font-medium text-gray-600 mb-1.5"
                    style={{ letterSpacing: "-0.011em" }}>
                    Date <span className="text-rose-400">*</span>
                  </label>
                  <input
                    id="ee-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    className="glass-input w-full px-3.5 py-2.5 text-[14px] text-gray-700"
                    style={{ letterSpacing: "-0.011em" }}
                  />
                </div>

                {/* Type */}
                <div>
                  <p className="text-[12px] font-medium text-gray-600 mb-2"
                     style={{ letterSpacing: "-0.011em" }}>
                    Type
                  </p>
                  <div className="flex gap-1.5 flex-wrap">
                    {EVENT_TYPES.map((t) => {
                      const accent   = TYPE_ACCENT[t];
                      const selected = type === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setType(t)}
                          className="px-2.5 py-[6px] rounded-[8px] text-[12px] font-medium capitalize cursor-pointer transition-all duration-100"
                          style={selected
                            ? { background: accent.fg, color: "#fff",       boxShadow: `0 2px 6px ${accent.fg}55` }
                            : { background: accent.bg, color: accent.fg }}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Status */}
                <div>
                  <p className="text-[12px] font-medium text-gray-600 mb-2"
                     style={{ letterSpacing: "-0.011em" }}>
                    Status
                  </p>
                  <div className="flex gap-1.5 flex-wrap">
                    {STATUSES.map((s) => {
                      const accent   = STATUS_ACCENT[s];
                      const selected = status === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setStatus(s)}
                          className="px-2.5 py-[6px] rounded-[8px] text-[12px] font-medium cursor-pointer transition-all duration-100"
                          style={selected
                            ? { background: accent.fg, color: "#fff",       boxShadow: `0 2px 6px ${accent.fg}55` }
                            : { background: accent.bg, color: accent.fg }}
                        >
                          {accent.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Notes / description */}
                <div>
                  <label htmlFor="ee-desc"
                    className="block text-[12px] font-medium text-gray-600 mb-1.5"
                    style={{ letterSpacing: "-0.011em" }}>
                    Notes
                  </label>
                  <textarea
                    id="ee-desc"
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    rows={3}
                    placeholder="Optional notes or weight (e.g. Weight: 20%)"
                    className="glass-input w-full px-3.5 py-2.5 text-[14px] text-gray-900 resize-none"
                    style={{ letterSpacing: "-0.011em" }}
                  />
                </div>

                {/* Grade weight + score as X / Y */}
                <div className="space-y-3">
                  {/* Weight */}
                  <div>
                    <label htmlFor="ee-weight"
                      className="block text-[12px] font-medium text-gray-600 mb-1.5"
                      style={{ letterSpacing: "-0.011em" }}>
                      Weight <span className="text-gray-400 font-normal">(% of final grade)</span>
                    </label>
                    <input
                      id="ee-weight"
                      type="number"
                      min="0" max="100" step="0.5"
                      value={gradeWeight ?? ""}
                      onChange={(e) => setGradeWeight(e.target.value === "" ? null : Number(e.target.value))}
                      placeholder="e.g. 20"
                      className="glass-input w-full px-3.5 py-2.5 text-[14px] text-gray-900"
                      style={{ letterSpacing: "-0.011em" }}
                    />
                  </div>

                  {/* Score: X / Y */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[12px] font-medium text-gray-600"
                             style={{ letterSpacing: "-0.011em" }}>
                        Score
                      </label>
                      {earnedPoints !== "" && totalPoints !== "" && Number(totalPoints) > 0 && (
                        <span className="text-[11px] font-semibold text-indigo-500">
                          {Math.round(Number(earnedPoints) / Number(totalPoints) * 1000) / 10}%
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        id="ee-earned"
                        type="number"
                        min="0" step="0.5"
                        value={earnedPoints}
                        onChange={(e) => setEarnedPoints(e.target.value)}
                        placeholder="earned"
                        className="glass-input flex-1 px-3.5 py-2.5 text-[14px] text-gray-900 text-center"
                        style={{ letterSpacing: "-0.011em" }}
                      />
                      <span className="text-[16px] text-gray-400 font-light shrink-0">/</span>
                      <input
                        id="ee-total"
                        type="number"
                        min="0.01" step="0.5"
                        value={totalPoints}
                        onChange={(e) => setTotalPoints(e.target.value)}
                        placeholder="total"
                        className="glass-input flex-1 px-3.5 py-2.5 text-[14px] text-gray-900 text-center"
                        style={{ letterSpacing: "-0.011em" }}
                      />
                    </div>
                  </div>
                </div>

                {/* Error */}
                <AnimatePresence>
                  {error && (
                    <motion.p
                      key="err"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="text-[12px] text-rose-500 font-medium"
                    >
                      {error}
                    </motion.p>
                  )}
                </AnimatePresence>

                {/* Actions */}
                <div className="flex gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isPending}
                    className="flex-1 h-9 rounded-[10px] text-[13px] font-medium text-gray-500
                               bg-black/[0.04] hover:bg-black/[0.07] transition-colors
                               duration-100 cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="flex-1 h-9 rounded-[10px] text-[13px] font-semibold text-white
                               bg-indigo-500 hover:bg-indigo-600 transition-colors duration-100
                               cursor-pointer disabled:opacity-60 disabled:cursor-wait
                               shadow-[0_2px_8px_rgba(99,102,241,0.4)]"
                  >
                    {isPending ? "Saving…" : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(modal, document.body);
}
