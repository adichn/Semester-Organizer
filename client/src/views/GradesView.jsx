import { useState, useMemo } from "react";
import { motion } from "framer-motion";

// ── Grade math ────────────────────────────────────────────────────────────────

const GRADED_TYPES = new Set(["assignment", "exam"]);

/**
 * The years query returns raw .lean() DB docs that don't include the derived
 * earnedPct field (only computed in eventController toDTO). Derive it here
 * so grade math works regardless of which code path populated the events.
 */
function resolveEarnedPct(e) {
  if (e.earnedPct != null) return e.earnedPct;
  if (e.earnedPoints != null && e.totalPoints != null && e.totalPoints > 0)
    return Math.round(e.earnedPoints / e.totalPoints * 10000) / 100;
  return null;
}

function letterGrade(pct) {
  if (pct == null) return "–";
  if (pct >= 93) return "A";
  if (pct >= 90) return "A−";
  if (pct >= 87) return "B+";
  if (pct >= 83) return "B";
  if (pct >= 80) return "B−";
  if (pct >= 77) return "C+";
  if (pct >= 73) return "C";
  if (pct >= 70) return "C−";
  if (pct >= 67) return "D+";
  if (pct >= 63) return "D";
  if (pct >= 60) return "D−";
  return "F";
}

function gradeColor(pct) {
  if (pct == null) return { text: "#9ca3af", bg: "#f3f4f6" };
  if (pct >= 90)  return { text: "#059669", bg: "#d1fae5" };
  if (pct >= 80)  return { text: "#0284c7", bg: "#e0f2fe" };
  if (pct >= 70)  return { text: "#d97706", bg: "#fef3c7" };
  if (pct >= 60)  return { text: "#ea580c", bg: "#ffedd5" };
  return             { text: "#dc2626", bg: "#fee2e2" };
}

/**
 * Compute grade metrics for a single course's events.
 * Only "assignment" and "exam" type events count toward the grade.
 *
 * Returns:
 *   earned    — grade on completed/graded work (null if nothing graded)
 *   current   — grade if all unweighted items score 0 (null if no weights at all)
 *   possible  — best-case grade if all remaining items score 100%
 *   gradedCount / totalCount
 */
function computeGrades(events) {
  const assessments = events.filter((e) => GRADED_TYPES.has(e.type));
  if (assessments.length === 0) return { earned: null, current: null, possible: null, gradedCount: 0, totalCount: 0 };

  const withWeight  = assessments.filter((e) => e.gradeWeight != null && e.gradeWeight > 0);
  // "graded" = has both a score (earnedPct from server, or computable from points) AND a weight
  const graded  = withWeight.filter((e) => resolveEarnedPct(e) != null);
  const ungraded = withWeight.filter((e) => resolveEarnedPct(e) == null);

  const totalWeight      = withWeight.reduce((s, e) => s + e.gradeWeight, 0);
  const gradedWeight     = graded.reduce((s, e) => s + e.gradeWeight, 0);
  // weightedPoints = Σ (earnedPct / 100 × gradeWeight) — each item's contribution to the final grade
  const weightedPoints   = graded.reduce((s, e) => s + (resolveEarnedPct(e) / 100) * e.gradeWeight, 0);
  const ungradedWeight   = ungraded.reduce((s, e) => s + e.gradeWeight, 0);
  // Course weight not yet assigned to any event (future items not yet added)
  const unassignedWeight = Math.max(0, 100 - totalWeight);

  // Raw marks across graded items (for display as "X / Y")
  const sumEarnedPoints = graded.reduce((s, e) => s + (e.earnedPoints ?? 0), 0);
  const sumTotalPoints  = graded.reduce((s, e) => s + (e.totalPoints  ?? 0), 0);

  const r = (n) => Math.round(n * 10) / 10;

  // earned  = average score on items you've gotten back (ignores ungraded weight)
  // current = your standing: locked scores, 0 on everything else
  // possible = best case: 100% on ungraded + unassigned course weight
  const earned   = gradedWeight > 0 ? r((weightedPoints / gradedWeight)  * 100) : null;
  const current  = totalWeight  > 0 ? r((weightedPoints / totalWeight)   * 100) : null;
  const possible = r(Math.min(100, weightedPoints + ungradedWeight + unassignedWeight));

  return {
    earned,
    current,
    possible,
    gradedCount:    graded.length,
    totalCount:     withWeight.length,
    sumEarnedPoints,
    sumTotalPoints,
  };
}

// ── Grade metric cell ─────────────────────────────────────────────────────────

function GradeCell({ label, value, sublabel, rawMarks }) {
  const color = gradeColor(value);
  return (
    <div className="flex flex-col items-center gap-1 px-3 py-2.5 rounded-[12px]"
         style={{ background: color.bg }}>
      <span className="text-[10px] font-semibold text-gray-500 uppercase"
            style={{ letterSpacing: "0.06em" }}>
        {label}
      </span>
      <div className="flex items-baseline gap-1 flex-wrap justify-center">
        {rawMarks ? (
          <span className="text-[18px] font-bold leading-none tabular-nums"
                style={{ color: color.text, letterSpacing: "-0.02em" }}>
            {rawMarks}
          </span>
        ) : (
          <span className="text-[22px] font-bold leading-none"
                style={{ color: color.text, letterSpacing: "-0.03em" }}>
            {value != null ? `${value}%` : "–"}
          </span>
        )}
        {value != null && (
          <span className="text-[12px] font-semibold" style={{ color: color.text }}>
            {rawMarks ? `${value}%` : letterGrade(value)}
          </span>
        )}
      </div>
      {sublabel && (
        <span className="text-[10px] text-gray-400 text-center leading-tight">{sublabel}</span>
      )}
    </div>
  );
}

// ── Course grade card ─────────────────────────────────────────────────────────

const cardVariant = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.4, 0, 0.2, 1] } },
};

function CourseGradeCard({ course }) {
  const grades = useMemo(() => computeGrades(course.events ?? []), [course.events]);
  const hasData = grades.totalCount > 0;

  return (
    <motion.div
      variants={cardVariant}
      className="rounded-[18px] overflow-hidden"
      style={{
        background:          "rgba(255,255,255,0.72)",
        backdropFilter:      "blur(24px) saturate(180%)",
        WebkitBackdropFilter:"blur(24px) saturate(180%)",
        border:              "1px solid rgba(255,255,255,0.60)",
        boxShadow:           "0 2px 16px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.88)",
      }}
    >
      {/* Course header strip */}
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100/70">
        <div
          className="w-9 h-9 rounded-[10px] shrink-0"
          style={{ background: course.gradientStyle ?? `linear-gradient(135deg, ${course.colorHex ?? "#6366f1"}cc, ${course.colorHex ?? "#6366f1"})` }}
        />
        <div className="flex-1 min-w-0">
          {course.code && (
            <p className="text-[10px] font-semibold text-gray-400 uppercase leading-tight"
               style={{ letterSpacing: "0.06em" }}>
              {course.code}
            </p>
          )}
          <p className="text-[14px] font-semibold text-gray-900 leading-tight truncate"
             style={{ letterSpacing: "-0.016em" }}>
            {course.title}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] text-gray-400">
            {grades.gradedCount} / {grades.totalCount} graded
          </p>
        </div>
      </div>

      {/* Grade cells */}
      <div className="p-3">
        {hasData ? (
          <div className="grid grid-cols-3 gap-2">
            <GradeCell
              label="Earned"
              value={grades.earned}
              sublabel="avg on returned work"
              rawMarks={grades.sumTotalPoints > 0
                ? `${grades.sumEarnedPoints} / ${grades.sumTotalPoints}`
                : null}
            />
            <GradeCell
              label="Current"
              value={grades.current}
              sublabel="weighted so far"
            />
            <GradeCell
              label="Possible"
              value={grades.possible}
              sublabel="best case"
            />
          </div>
        ) : (
          <div className="py-4 text-center">
            <p className="text-[13px] text-gray-400">
              No weighted assessments yet.
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Set a weight on assignments and exams to track grades.
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Semester selector ─────────────────────────────────────────────────────────

function SemesterPicker({ years, selectedId, onSelect }) {
  const semesters = years.flatMap((y) =>
    y.semesters.map((s) => ({ ...s, yearLabel: String(y.year) }))
  );

  if (semesters.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {semesters.map((s) => {
        const isActive = String(s._id) === selectedId;
        return (
          <button
            key={String(s._id)}
            onClick={() => onSelect(String(s._id))}
            className={[
              "px-3.5 py-1.5 rounded-[10px] text-[13px] font-medium transition-all duration-150 cursor-pointer",
              isActive
                ? "bg-indigo-500 text-white shadow-[0_2px_8px_rgba(99,102,241,0.4)]"
                : "bg-white/60 text-gray-600 hover:bg-white/80 border border-white/60",
            ].join(" ")}
            style={{ letterSpacing: "-0.011em" }}
          >
            {s.name}
            <span className={`ml-1.5 text-[11px] ${isActive ? "text-indigo-200" : "text-gray-400"}`}>
              {s.yearLabel}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Semester summary bar ──────────────────────────────────────────────────────

function SemesterSummary({ courses }) {
  const allGrades = courses
    .map((c) => computeGrades(c.events ?? []))
    .filter((g) => g.earned != null);

  if (allGrades.length === 0) return null;

  const avg = allGrades.reduce((s, g) => s + g.earned, 0) / allGrades.length;
  const color = gradeColor(avg);

  return (
    <div
      className="flex items-center gap-4 px-5 py-3.5 rounded-[16px]"
      style={{
        background:          "rgba(255,255,255,0.72)",
        backdropFilter:      "blur(24px)",
        WebkitBackdropFilter:"blur(24px)",
        border:              "1px solid rgba(255,255,255,0.60)",
      }}
    >
      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase" style={{ letterSpacing: "0.06em" }}>
          Semester Average
        </p>
        <div className="flex items-baseline gap-1.5 mt-0.5">
          <span className="text-[28px] font-bold leading-none"
                style={{ color: color.text, letterSpacing: "-0.035em" }}>
            {Math.round(avg * 10) / 10}%
          </span>
          <span className="text-[16px] font-semibold" style={{ color: color.text }}>
            {letterGrade(avg)}
          </span>
        </div>
      </div>
      <div className="flex-1" />
      <p className="text-[12px] text-gray-400">
        Across {allGrades.length} course{allGrades.length !== 1 ? "s" : ""} with graded work
      </p>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function GradesView({ years }) {
  const allSemesters = years.flatMap((y) => y.semesters.map((s) => ({ ...s, yearLabel: String(y.year) })));

  const [selectedSemId, setSelectedSemId] = useState(() => {
    // Default to the most recent semester
    return allSemesters.length > 0 ? String(allSemesters[allSemesters.length - 1]._id) : null;
  });

  const activeSemester = allSemesters.find((s) => String(s._id) === selectedSemId) ?? null;
  const courses = activeSemester?.courses ?? [];

  return (
    <div className="max-w-[1100px] mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1
          className="text-[32px] font-semibold text-gray-900 dark:text-white leading-tight"
          style={{ letterSpacing: "-0.03em", fontFamily: "var(--font-display)" }}
        >
          Grades
        </h1>
        <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-0.5">
          Track your performance by semester.
        </p>
      </div>

      {/* Semester picker */}
      {allSemesters.length > 0 ? (
        <SemesterPicker
          years={years}
          selectedId={selectedSemId}
          onSelect={setSelectedSemId}
        />
      ) : (
        <div className="rounded-[16px] p-8 text-center"
             style={{ background: "rgba(255,255,255,0.5)", border: "1px dashed rgba(0,0,0,0.10)" }}>
          <p className="text-[14px] font-medium text-gray-600">No semesters yet</p>
          <p className="text-[12px] text-gray-400 mt-1">Add courses in the Courses tab to get started.</p>
        </div>
      )}

      {/* Semester summary */}
      {activeSemester && <SemesterSummary courses={courses} />}

      {/* Course cards */}
      {activeSemester && (
        courses.length > 0 ? (
          <motion.div
            variants={{ show: { transition: { staggerChildren: 0.07 } } }}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
          >
            {courses.map((course) => (
              <CourseGradeCard key={String(course._id)} course={course} />
            ))}
          </motion.div>
        ) : (
          <div className="rounded-[16px] p-8 text-center"
               style={{ background: "rgba(255,255,255,0.5)", border: "1px dashed rgba(0,0,0,0.10)" }}>
            <p className="text-[14px] font-medium text-gray-600">No courses in {activeSemester.name}</p>
            <p className="text-[12px] text-gray-400 mt-1">Add courses in the Courses tab.</p>
          </div>
        )
      )}

    </div>
  );
}
