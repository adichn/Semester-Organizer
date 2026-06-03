import mongoose from "mongoose";
import Year from "../models/Academic.js";

const VALID_TYPES    = ["assignment", "exam", "lecture", "reminder", "other"];
const VALID_STATUSES = ["todo", "in-progress", "completed"];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Walk semester subdocs to find a course by _id. */
function findCourse(yearDoc, courseId) {
  for (const sem of yearDoc.semesters) {
    const course = sem.courses.id(courseId);
    if (course) return course;
  }
  return null;
}

function toDTO(ev) {
  const ep = ev.earnedPoints ?? null;
  const tp = ev.totalPoints  ?? null;
  // Percentage for convenience: earnedPoints / totalPoints * 100, rounded to 2 dp
  const earnedPct = (ep != null && tp > 0) ? Math.round(ep / tp * 10000) / 100 : null;
  return {
    _id:          ev._id,
    title:        ev.title,
    description:  ev.description ?? "",
    date:         ev.date,
    type:         ev.type,
    status:       ev.status ?? (ev.completed ? "completed" : "todo"),
    completed:    ev.completed ?? false,
    gradeWeight:  ev.gradeWeight  ?? null,
    earnedPoints: ep,
    totalPoints:  tp,
    earnedPct,                  // derived — frontend uses this for grade math
  };
}

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * POST /api/courses/:courseId/events
 * Body: { title, date, type?, description? }
 */
export async function createEvent(req, res) {
  try {
    const { courseId } = req.params;
    const { title, date, type = "other", description = "" } = req.body;

    if (!mongoose.isValidObjectId(courseId))
      return res.status(400).json({ error: "Invalid courseId." });
    if (!title?.trim())
      return res.status(400).json({ error: "title is required." });
    if (!date || isNaN(new Date(date).getTime()))
      return res.status(400).json({ error: "A valid date is required." });
    if (!VALID_TYPES.includes(type))
      return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(", ")}.` });

    const yearDoc = await Year.findOne({
      user: req.user._id,
      "semesters.courses._id": new mongoose.Types.ObjectId(courseId),
    });
    if (!yearDoc) return res.status(404).json({ error: "Course not found." });

    const course = findCourse(yearDoc, courseId);
    if (!course)  return res.status(404).json({ error: "Course not found." });

    course.events.push({
      user:        req.user._id,
      title:       title.trim(),
      description: description.trim(),
      date:        new Date(date),
      type,
      status:      "todo",
      completed:   false,
    });

    await yearDoc.save();

    const saved = course.events[course.events.length - 1];
    return res.status(201).json({ event: toDTO(saved) });
  } catch (err) {
    console.error("[eventController] createEvent:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
}

/**
 * PATCH /api/courses/:courseId/events/:eventId
 * Body: { title?, date?, type?, description?, status?, completed? }
 * Uses arrayFilters to avoid rewriting the full Year document.
 */
export async function updateEvent(req, res) {
  try {
    const { courseId, eventId } = req.params;

    if (!mongoose.isValidObjectId(courseId) || !mongoose.isValidObjectId(eventId))
      return res.status(400).json({ error: "Invalid id." });

    const { title, date, type, description, status, completed, gradeWeight, earnedPoints, totalPoints } = req.body;

    if (type    && !VALID_TYPES.includes(type))
      return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(", ")}.` });
    if (status  && !VALID_STATUSES.includes(status))
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}.` });

    const prefix = "semesters.$[].courses.$[crs].events.$[evt]";
    const $set   = {};

    if (title       !== undefined) $set[`${prefix}.title`]       = title.trim();
    if (date        !== undefined) $set[`${prefix}.date`]        = new Date(date);
    if (type        !== undefined) $set[`${prefix}.type`]        = type;
    if (description !== undefined) $set[`${prefix}.description`] = description.trim();
    if (status      !== undefined) {
      $set[`${prefix}.status`]    = status;
      $set[`${prefix}.completed`] = status === "completed";
    } else if (completed !== undefined) {
      $set[`${prefix}.completed`] = completed;
      $set[`${prefix}.status`]    = completed ? "completed" : "todo";
    }
    if (gradeWeight  !== undefined) $set[`${prefix}.gradeWeight`]  = gradeWeight  === null ? null : Number(gradeWeight);
    if (earnedPoints !== undefined) $set[`${prefix}.earnedPoints`] = earnedPoints === null ? null : Number(earnedPoints);
    if (totalPoints  !== undefined) $set[`${prefix}.totalPoints`]  = totalPoints  === null ? null : Number(totalPoints);

    if (!Object.keys($set).length)
      return res.status(400).json({ error: "Nothing to update." });

    const courseOid = new mongoose.Types.ObjectId(courseId);
    const eventOid  = new mongoose.Types.ObjectId(eventId);

    const updated = await Year.findOneAndUpdate(
      {
        user:                           req.user._id,
        "semesters.courses._id":        courseOid,
        "semesters.courses.events._id": eventOid,
      },
      { $set },
      {
        arrayFilters: [{ "crs._id": courseOid }, { "evt._id": eventOid }],
        new:          true,
      }
    );

    if (!updated) return res.status(404).json({ error: "Event not found." });

    const course = findCourse(updated, courseId);
    const ev     = course?.events.id(eventId);
    if (!ev) return res.status(404).json({ error: "Event not found after update." });

    return res.json({ event: toDTO(ev) });
  } catch (err) {
    console.error("[eventController] updateEvent:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
}

/**
 * POST /api/courses/:courseId/events/batch
 * Body: { events: [{ title, date, type?, description? }] }
 *
 * Human-in-the-loop save: inserts all user-approved pending extractions at once.
 * Invalid rows (missing title/date) are silently skipped so a single bad item
 * from the LLM never blocks the whole batch.
 */
export async function batchCreateEvents(req, res) {
  try {
    const { courseId } = req.params;
    const { events: items } = req.body;

    if (!mongoose.isValidObjectId(courseId))
      return res.status(400).json({ error: "Invalid courseId." });
    if (!Array.isArray(items) || items.length === 0)
      return res.status(400).json({ error: "events must be a non-empty array." });

    const yearDoc = await Year.findOne({
      user: req.user._id,
      "semesters.courses._id": new mongoose.Types.ObjectId(courseId),
    });
    if (!yearDoc) return res.status(404).json({ error: "Course not found." });

    const course = findCourse(yearDoc, courseId);
    if (!course)  return res.status(404).json({ error: "Course not found." });

    const created = [];
    for (const item of items) {
      const { title, date, type = "other", description = "" } = item ?? {};
      if (!title?.trim() || !date || isNaN(new Date(date).getTime())) continue;
      const safeType = VALID_TYPES.includes(type) ? type : "other";
      course.events.push({
        user:        req.user._id,
        title:       String(title).trim().slice(0, 200),
        description: String(description ?? "").trim(),
        date:        new Date(date),
        type:        safeType,
        status:      "todo",
        completed:   false,
      });
      created.push(course.events[course.events.length - 1]);
    }

    if (created.length === 0)
      return res.status(400).json({ error: "No valid events in the batch." });

    await yearDoc.save();
    return res.status(201).json({ created: created.map(toDTO) });
  } catch (err) {
    console.error("[eventController] batchCreateEvents:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
}

/**
 * DELETE /api/courses/:courseId/events/:eventId
 */
export async function deleteEvent(req, res) {
  try {
    const { courseId, eventId } = req.params;

    if (!mongoose.isValidObjectId(courseId) || !mongoose.isValidObjectId(eventId))
      return res.status(400).json({ error: "Invalid id." });

    const courseOid = new mongoose.Types.ObjectId(courseId);
    const eventOid  = new mongoose.Types.ObjectId(eventId);

    const result = await Year.findOneAndUpdate(
      { user: req.user._id, "semesters.courses._id": courseOid },
      { $pull: { "semesters.$[].courses.$[crs].events": { _id: eventOid } } },
      { arrayFilters: [{ "crs._id": courseOid }] }
    );

    if (!result) return res.status(404).json({ error: "Course not found." });
    return res.json({ ok: true });
  } catch (err) {
    console.error("[eventController] deleteEvent:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
}
