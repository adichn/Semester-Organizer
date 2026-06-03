import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FormModal, Field, GlassButton } from "./ui";
import { useCreateEvent, useDeleteEvent } from "../hooks/useEvents";
import EventEditModal from "./EventEditModal";

// ── Constants ─────────────────────────────────────────────────────────────────

const WEEKDAYS    = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const EVENT_TYPES = ["assignment", "exam", "lecture", "reminder", "other"];

const TYPE_ACCENT = {
  assignment: { fg: "#7c3aed", bg: "#ede9fe" },
  exam:       { fg: "#e11d48", bg: "#ffe4e6" },
  lecture:    { fg: "#0284c7", bg: "#e0f2fe" },
  reminder:   { fg: "#d97706", bg: "#fef3c7" },
  other:      { fg: "#64748b", bg: "#f1f5f9" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildCells(year, month) {
  const firstDow    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells       = Array(firstDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function isoDate(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function ChevLeft() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}
function ChevRight() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.4" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5"  y1="12" x2="19" y2="12" />
    </svg>
  );
}
function XIcon({ size = 11 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <line x1="18" y1="6" x2="6"  y2="18" />
      <line x1="6"  y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ── Calendar header ───────────────────────────────────────────────────────────

function CalHeader({ month, year, semester, onPrev, onNext, onToday, onAdd }) {
  return (
    <div
      className="flex items-center justify-between px-5 py-4 rounded-[20px]"
      style={{
        background:          "rgba(255,255,255,0.76)",
        backdropFilter:      "blur(40px) saturate(200%)",
        WebkitBackdropFilter:"blur(40px) saturate(200%)",
        border:              "1px solid rgba(255,255,255,0.7)",
        boxShadow:           "0 4px 32px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.95)",
      }}
    >
      <div className="flex items-center gap-1.5">
        <motion.button
          whileTap={{ scale: 0.87 }}
          onClick={onPrev}
          className="w-8 h-8 flex items-center justify-center rounded-full
                     text-gray-500 hover:bg-black/[0.07] transition-colors cursor-pointer"
          aria-label="Previous month"
        >
          <ChevLeft />
        </motion.button>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${year}-${month}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{    opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="w-[148px] select-none"
          >
            <h2
              className="text-[22px] font-semibold text-gray-900 leading-none"
              style={{ letterSpacing: "-0.026em" }}
            >
              {MONTH_NAMES[month]}
            </h2>
            <p className="text-[12px] text-gray-400 mt-[3px] leading-none">{year}</p>
          </motion.div>
        </AnimatePresence>

        <motion.button
          whileTap={{ scale: 0.87 }}
          onClick={onNext}
          className="w-8 h-8 flex items-center justify-center rounded-full
                     text-gray-500 hover:bg-black/[0.07] transition-colors cursor-pointer"
          aria-label="Next month"
        >
          <ChevRight />
        </motion.button>
      </div>

      <div className="flex items-center gap-2">
        {semester?.name && (
          <span
            className="hidden sm:inline-flex items-center text-[12px] text-gray-500 font-medium
                       px-2.5 py-1 rounded-[8px] bg-black/[0.04] border border-black/[0.05]"
            style={{ letterSpacing: "-0.011em" }}
          >
            {semester.name}
          </span>
        )}
        <GlassButton variant="ghost" size="sm" onClick={onToday}>Today</GlassButton>
        <GlassButton variant="primary" size="sm" icon={<PlusIcon />} onClick={onAdd}>
          Add Event
        </GlassButton>
      </div>
    </div>
  );
}

// ── Event pill (inline in day cell) ──────────────────────────────────────────

function EventPill({ event, onEdit }) {
  const accent = TYPE_ACCENT[event.type] ?? TYPE_ACCENT.other;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onEdit(event); }}
      className="flex items-center gap-1 px-1.5 py-[3px] rounded-[5px] truncate select-none
                 w-full text-left hover:brightness-95 transition-all duration-100 cursor-pointer"
      style={{
        background: `${event.courseColor}18`,
        borderLeft: `2.5px solid ${event.courseColor}`,
      }}
      title={`Edit: ${event.title} · ${event.courseTitle}`}
    >
      <span
        className="truncate text-[10.5px] font-medium leading-tight"
        style={{ color: event.courseColor }}
      >
        {event.title}
      </span>
      <span
        className="shrink-0 text-[9px] font-semibold capitalize px-[4px] py-[1px] rounded-[3px] leading-tight"
        style={{ color: accent.fg, background: accent.bg }}
      >
        {event.type === "assignment" ? "asgn" : event.type}
      </span>
    </button>
  );
}

// ── Day cell ──────────────────────────────────────────────────────────────────

const MAX_PILLS = 3;

function DayCell({ day, events, isToday, isSelected, isLastRow, isLastCol, onClick, onEditEvent }) {
  const visible = events.slice(0, MAX_PILLS);
  const extra   = events.length - MAX_PILLS;

  return (
    <div
      role={day ? "button" : undefined}
      tabIndex={day ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
      className={[
        "relative flex flex-col gap-[3px] p-[8px] select-none transition-colors duration-100",
        !isLastRow ? "border-b border-gray-200/55" : "",
        !isLastCol ? "border-r border-gray-200/55" : "",
        day && !isToday && !isSelected ? "hover:bg-white/55 cursor-pointer" : "",
        day &&  isSelected && !isToday ? "bg-indigo-50/60"                  : "",
        !day                           ? "bg-gray-100/20"                   : "",
      ].join(" ")}
      style={{ minHeight: 100 }}
    >
      {day && (
        <>
          {/* Date number */}
          <span
            className={[
              "w-[26px] h-[26px] flex items-center justify-center rounded-full shrink-0",
              "text-[12px] font-medium transition-all duration-150 self-start",
              isToday
                ? "bg-indigo-500 text-white shadow-[0_1px_8px_rgba(99,102,241,0.45)]"
                : isSelected
                  ? "text-indigo-600 font-semibold"
                  : "text-gray-700",
            ].join(" ")}
          >
            {day}
          </span>

          {/* Event pills */}
          {visible.length > 0 && (
            <div className="flex flex-col gap-[2px] w-full mt-0.5">
              {visible.map((ev) => (
                <EventPill key={ev._id} event={ev} onEdit={onEditEvent} />
              ))}
              {extra > 0 && (
                <span className="text-[10px] text-gray-400 px-1 leading-tight">
                  +{extra} more
                </span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Detail panel event card ───────────────────────────────────────────────────

function PencilIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function EventCard({ event, onDelete, deleting, onEdit }) {
  const accent = TYPE_ACCENT[event.type] ?? TYPE_ACCENT.other;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: deleting ? 0.4 : 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.18 }}
      className="flex items-start gap-3 px-3 py-2.5 rounded-[12px]
                 bg-white/55 hover:bg-white/75 transition-colors group"
    >
      <div
        className="w-[3px] self-stretch rounded-full shrink-0"
        style={{ background: event.courseColor, minHeight: 18 }}
      />

      <div className="flex-1 min-w-0">
        <p
          className={[
            "text-[13px] font-medium text-gray-900 leading-snug truncate",
            event.completed ? "line-through opacity-50" : "",
          ].join(" ")}
          style={{ letterSpacing: "-0.012em" }}
        >
          {event.title}
        </p>
        <div className="flex items-center gap-1.5 mt-[3px] flex-wrap">
          <span className="text-[11px] text-gray-400 truncate max-w-[120px]">
            {event.courseTitle}
          </span>
          <span className="text-gray-300 text-[10px]">·</span>
          <span
            className="text-[10px] font-semibold capitalize px-[6px] py-[2px] rounded-[5px]"
            style={{ color: accent.fg, background: accent.bg }}
          >
            {event.type}
          </span>
          {event.description && (
            <p className="w-full text-[11px] text-gray-400 leading-snug mt-0.5 line-clamp-2">
              {event.description}
            </p>
          )}
        </div>
      </div>

      {/* Edit button */}
      <button
        onClick={onEdit}
        className="opacity-0 group-hover:opacity-100 w-[20px] h-[20px] flex items-center
                   justify-center text-gray-400 hover:text-indigo-500 rounded-full
                   hover:bg-indigo-50 transition-all cursor-pointer shrink-0 mt-[1px]"
        aria-label="Edit event"
      >
        <PencilIcon />
      </button>

      {/* Delete button */}
      <button
        onClick={onDelete}
        disabled={deleting}
        className="opacity-0 group-hover:opacity-100 w-[20px] h-[20px] flex items-center
                   justify-center text-gray-400 hover:text-rose-500 rounded-full
                   hover:bg-rose-50 transition-all cursor-pointer shrink-0 mt-[1px]"
        aria-label="Delete event"
      >
        <XIcon />
      </button>
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function GlobalCalendar({ courses = [], semester }) {
  const today = new Date();

  const [current, setCurrent] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState(null);

  const [editingEvent, setEditingEvent] = useState(null); // enriched event object

  const [showAdd,  setShowAdd]  = useState(false);
  const [evTitle,  setEvTitle]  = useState("");
  const [evDate,   setEvDate]   = useState("");
  const [evType,   setEvType]   = useState("assignment");
  const [evCourse, setEvCourse] = useState("");
  const [evDesc,   setEvDesc]   = useState("");
  const [evError,  setEvError]  = useState("");

  const createEvent = useCreateEvent();
  const deleteEvent = useDeleteEvent();

  const year  = current.getFullYear();
  const month = current.getMonth();

  // Flatten events and tag with course meta
  const allEvents = courses.flatMap((c) =>
    (c.events ?? []).map((ev) => ({
      ...ev,
      _id:         String(ev._id),
      date:        new Date(ev.date),
      courseTitle: c.title,
      courseColor: c.colorHex ?? "#6366f1",
      courseId:    String(c._id),
    }))
  );

  // Index by "Y-M-D" UTC — dates are stored as UTC midnight in MongoDB.
  // Using UTC accessors ensures an event saved for "March 15" always lands on
  // March 15 in the grid, regardless of the user's local timezone offset.
  const eventsByDate = {};
  for (const ev of allEvents) {
    const key = `${ev.date.getUTCFullYear()}-${ev.date.getUTCMonth()}-${ev.date.getUTCDate()}`;
    (eventsByDate[key] ??= []).push(ev);
  }
  function eventsForDay(y, m, d) {
    return eventsByDate[`${y}-${m}-${d}`] ?? [];
  }

  const cells = buildCells(year, month);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const selectedEvents = selectedDay != null ? eventsForDay(year, month, selectedDay) : [];

  function prevMonth() { setCurrent(new Date(year, month - 1, 1)); }
  function nextMonth() { setCurrent(new Date(year, month + 1, 1)); }
  function goToday() {
    setCurrent(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDay(today.getDate());
  }

  function openAdd(prefillDay = null) {
    const day = prefillDay ?? selectedDay;
    setEvTitle(""); setEvDesc(""); setEvError("");
    setEvDate(day != null ? isoDate(year, month, day) : "");
    setEvType("assignment");
    setEvCourse(courses.length > 0 ? String(courses[0]._id) : "");
    setShowAdd(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setEvError("");
    if (!evTitle.trim()) { setEvError("Title is required.");      return; }
    if (!evDate)         { setEvError("Date is required.");       return; }
    if (!evCourse)       { setEvError("Please select a course."); return; }
    try {
      await createEvent.mutateAsync({
        courseId:    evCourse,
        title:       evTitle.trim(),
        date:        evDate,
        type:        evType,
        description: evDesc.trim() || undefined,
      });
      setShowAdd(false);
    } catch (err) {
      setEvError(err.message);
    }
  }

  const selectedLabel = selectedDay != null
    ? new Date(year, month, selectedDay).toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric",
      })
    : null;

  const panelStyle = {
    background:          "rgba(255,255,255,0.7)",
    backdropFilter:      "blur(28px) saturate(180%)",
    WebkitBackdropFilter:"blur(28px) saturate(180%)",
    border:              "1px solid rgba(255,255,255,0.62)",
    boxShadow:           "0 4px 20px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.92)",
  };

  return (
    <div className="flex flex-col gap-3">

      {/* Header */}
      <CalHeader
        month={month} year={year} semester={semester}
        onPrev={prevMonth} onNext={nextMonth}
        onToday={goToday} onAdd={() => openAdd()}
      />

      {/* Grid + detail panel side-by-side on large screens */}
      <div className="flex gap-3 items-start">

        {/* ── Month grid ─────────────────────────────────────────────────── */}
        <div
          className="flex-1 rounded-[20px] overflow-hidden"
          style={{
            background:          "rgba(255,255,255,0.66)",
            backdropFilter:      "blur(24px) saturate(160%)",
            WebkitBackdropFilter:"blur(24px) saturate(160%)",
            border:              "1px solid rgba(255,255,255,0.58)",
            boxShadow:           "0 2px 24px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.88)",
          }}
        >
          {/* DOW row */}
          <div className="grid grid-cols-7 border-b border-gray-200/60">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="py-2.5 text-center text-[10px] font-semibold text-gray-400"
                style={{ letterSpacing: "0.07em" }}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Week rows */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${year}-${month}`}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{    opacity: 0, y: -5 }}
              transition={{ duration: 0.16, ease: [0.4, 0, 0.2, 1] }}
            >
              {weeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7">
                  {week.map((day, di) => {
                    const dayEvts = day ? eventsForDay(year, month, day) : [];
                    const isToday =
                      day != null &&
                      today.getFullYear() === year &&
                      today.getMonth()    === month &&
                      today.getDate()     === day;

                    return (
                      <DayCell
                        key={`${wi}-${di}`}
                        day={day}
                        events={dayEvts}
                        isToday={isToday}
                        isSelected={day === selectedDay}
                        isLastRow={wi === weeks.length - 1}
                        isLastCol={di === 6}
                        onClick={() => day && setSelectedDay(day === selectedDay ? null : day)}
                        onEditEvent={setEditingEvent}
                      />
                    );
                  })}
                </div>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── Day detail panel (side panel on lg, below on sm) ─────────── */}
        <AnimatePresence>
          {selectedDay != null && (
            <motion.div
              key="day-panel"
              initial={{ opacity: 0, x: 16, scale: 0.98 }}
              animate={{ opacity: 1,  x: 0,  scale: 1    }}
              exit={{    opacity: 0,  x: 16, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.34, 1.1, 0.64, 1] }}
              className="w-full lg:w-[280px] shrink-0 rounded-[20px] p-4"
              style={panelStyle}
            >
              {/* Panel header */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase"
                     style={{ letterSpacing: "0.06em" }}>
                    {new Date(year, month, selectedDay)
                      .toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}
                  </p>
                  <h3
                    className="text-[20px] font-semibold text-gray-900 leading-none mt-0.5"
                    style={{ letterSpacing: "-0.022em" }}
                  >
                    {selectedDay}
                  </h3>
                  <p className="text-[12px] text-gray-400 mt-0.5">
                    {MONTH_NAMES[month]} {year}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => openAdd()}
                    className="w-7 h-7 flex items-center justify-center rounded-full cursor-pointer
                               text-gray-400 hover:text-indigo-600 hover:bg-indigo-50
                               transition-colors"
                    aria-label="Add event"
                  >
                    <PlusIcon />
                  </button>
                  <button
                    onClick={() => setSelectedDay(null)}
                    className="w-7 h-7 flex items-center justify-center rounded-full cursor-pointer
                               text-gray-400 hover:text-gray-700 hover:bg-black/[0.06]
                               transition-colors"
                    aria-label="Close"
                  >
                    <XIcon size={10} />
                  </button>
                </div>
              </div>

              {/* Events */}
              {selectedEvents.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-[13px] text-gray-400">No events</p>
                  <button
                    onClick={() => openAdd()}
                    className="mt-1 text-[12px] text-indigo-500 hover:text-indigo-700
                               font-medium cursor-pointer transition-colors"
                  >
                    + Add one
                  </button>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  <div className="space-y-2">
                    {selectedEvents.map((ev) => (
                      <EventCard
                        key={ev._id}
                        event={ev}
                        deleting={deleteEvent.isPending && deleteEvent.variables?.eventId === ev._id}
                        onDelete={() => deleteEvent.mutate({ courseId: ev.courseId, eventId: ev._id })}
                        onEdit={() => setEditingEvent(ev)}
                      />
                    ))}
                  </div>
                </AnimatePresence>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Course legend */}
      {courses.length > 0 && (
        <div className="flex items-center gap-x-4 gap-y-1.5 flex-wrap px-1 pb-1">
          {courses.map((c) => (
            <div key={String(c._id)} className="flex items-center gap-1.5">
              <span
                className="w-[7px] h-[7px] rounded-full shrink-0"
                style={{ background: c.colorHex ?? "#6366f1" }}
              />
              <span className="text-[11px] text-white/65 truncate max-w-[120px]">
                {c.title}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Edit Event modal */}
      <EventEditModal
        event={editingEvent}
        courseId={editingEvent?.courseId}
        isOpen={!!editingEvent}
        onClose={() => setEditingEvent(null)}
      />

      {/* Add Event modal */}
      <FormModal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        onSubmit={handleSubmit}
        title="New Event"
        submitLabel="Add Event"
        loading={createEvent.isPending}
        error={evError}
      >
        <Field
          label="Title" id="ev-title" required
          placeholder="e.g. Final Exam"
          value={evTitle}
          onChange={(e) => setEvTitle(e.target.value)}
        />

        <Field
          label="Date" id="ev-date" type="date" required
          value={evDate}
          onChange={(e) => setEvDate(e.target.value)}
        />

        <div>
          <label
            htmlFor="ev-course"
            className="block text-[12px] font-medium text-gray-600 mb-1.5"
            style={{ letterSpacing: "-0.011em" }}
          >
            Course <span className="text-rose-400 ml-0.5">*</span>
          </label>
          <select
            id="ev-course"
            value={evCourse}
            onChange={(e) => setEvCourse(e.target.value)}
            className="glass-input w-full px-3.5 py-2.5 text-[14px] text-gray-900 appearance-none cursor-pointer"
            style={{ letterSpacing: "-0.011em" }}
          >
            <option value="">Select a course…</option>
            {courses.map((c) => (
              <option key={String(c._id)} value={String(c._id)}>
                {c.title}{c.code ? ` · ${c.code}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <p className="text-[12px] font-medium text-gray-600 mb-2" style={{ letterSpacing: "-0.011em" }}>
            Event type
          </p>
          <div className="flex gap-1.5 flex-wrap">
            {EVENT_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setEvType(t)}
                className={[
                  "px-2.5 py-[6px] rounded-[8px] text-[12px] font-medium capitalize",
                  "transition-colors duration-100 cursor-pointer",
                  evType === t
                    ? "bg-indigo-500 text-white shadow-sm"
                    : "bg-black/[0.05] text-gray-600 hover:bg-black/[0.09]",
                ].join(" ")}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <Field
          label="Notes" id="ev-desc"
          placeholder="Optional notes…"
          value={evDesc}
          onChange={(e) => setEvDesc(e.target.value)}
        />
      </FormModal>
    </div>
  );
}
