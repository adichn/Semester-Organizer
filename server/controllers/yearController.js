import mongoose from "mongoose";
import Year      from "../models/Academic.js";
import Embedding from "../models/Embedding.js";

// ── Tiny helpers ──────────────────────────────────────────────────────────────

const uid = (req) => req.user._id;

function requireId(res, id, label = "id") {
  if (!mongoose.isValidObjectId(id)) {
    res.status(400).json({ error: `Invalid ${label}.` });
    return false;
  }
  return true;
}

const VALID_SEASONS = ["spring", "summer", "fall", "winter"];

// ── Year controllers ──────────────────────────────────────────────────────────

export async function listYears(req, res) {
  try {
    const years = await Year.find({ user: uid(req) })
      .sort({ year: -1 })
      .lean();
    res.json(years);
  } catch (err) {
    console.error("[yearController] listYears:", err);
    res.status(500).json({ error: "Internal server error." });
  }
}

export async function createYear(req, res) {
  try {
    const { year } = req.body ?? {};

    if (typeof year !== "number" || !Number.isInteger(year) || year < 1900 || year > 2200) {
      return res.status(400).json({ error: "year must be an integer between 1900 and 2200." });
    }

    const exists = await Year.exists({ user: uid(req), year });
    if (exists) {
      return res.status(409).json({
        error: `Academic year ${year}–${String(year + 1).slice(-2)} already exists.`,
      });
    }

    const doc = await Year.create({ user: uid(req), year, semesters: [] });
    res.status(201).json(doc);
  } catch (err) {
    console.error("[yearController] createYear:", err);
    res.status(500).json({ error: "Internal server error." });
  }
}

export async function deleteYear(req, res) {
  try {
    const { yearId } = req.params;
    if (!requireId(res, yearId, "yearId")) return;

    const yearDoc = await Year.findOne({ _id: yearId, user: uid(req) });
    if (!yearDoc) return res.status(404).json({ error: "Year not found." });

    const courseIds = yearDoc.semesters.flatMap((s) => s.courses.map((c) => c._id));

    await Year.deleteOne({ _id: yearId, user: uid(req) });

    if (courseIds.length) {
      await Embedding.deleteMany({ courseId: { $in: courseIds }, user: uid(req) });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("[yearController] deleteYear:", err);
    res.status(500).json({ error: "Internal server error." });
  }
}

// ── Semester controllers ──────────────────────────────────────────────────────

export async function createSemester(req, res) {
  try {
    const { yearId } = req.params;
    if (!requireId(res, yearId, "yearId")) return;

    const { name, season } = req.body ?? {};

    if (!name?.trim()) {
      return res.status(400).json({ error: "name is required." });
    }
    if (!VALID_SEASONS.includes(season)) {
      return res.status(400).json({ error: `season must be one of: ${VALID_SEASONS.join(", ")}.` });
    }

    const yearDoc = await Year.findOne({ _id: yearId, user: uid(req) });
    if (!yearDoc) return res.status(404).json({ error: "Year not found." });

    const dup = yearDoc.semesters.find(
      (s) => s.name.toLowerCase() === name.trim().toLowerCase()
    );
    if (dup) {
      return res.status(409).json({ error: `Semester "${name.trim()}" already exists.` });
    }

    yearDoc.semesters.push({ user: uid(req), name: name.trim(), season, courses: [] });
    await yearDoc.save({ validateModifiedOnly: true });

    const created = yearDoc.semesters[yearDoc.semesters.length - 1];
    res.status(201).json(created);
  } catch (err) {
    console.error("[yearController] createSemester:", err);
    res.status(500).json({ error: "Internal server error." });
  }
}

export async function deleteSemester(req, res) {
  try {
    const { yearId, semId } = req.params;
    if (!requireId(res, yearId, "yearId") || !requireId(res, semId, "semId")) return;

    const yearDoc = await Year.findOne({ _id: yearId, user: uid(req) });
    if (!yearDoc) return res.status(404).json({ error: "Year not found." });

    const sem = yearDoc.semesters.id(semId);
    if (!sem) return res.status(404).json({ error: "Semester not found." });

    const courseIds = sem.courses.map((c) => c._id);

    yearDoc.semesters.pull({ _id: semId });
    await yearDoc.save({ validateModifiedOnly: true });

    if (courseIds.length) {
      await Embedding.deleteMany({ courseId: { $in: courseIds }, user: uid(req) });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("[yearController] deleteSemester:", err);
    res.status(500).json({ error: "Internal server error." });
  }
}

// ── Course controllers ────────────────────────────────────────────────────────

export async function createCourse(req, res) {
  try {
    const { yearId, semId } = req.params;
    if (!requireId(res, yearId, "yearId") || !requireId(res, semId, "semId")) return;

    const { title, code, description, colorHex } = req.body ?? {};

    if (!title?.trim()) {
      return res.status(400).json({ error: "title is required." });
    }

    const yearDoc = await Year.findOne({ _id: yearId, user: uid(req) });
    if (!yearDoc) return res.status(404).json({ error: "Year not found." });

    const sem = yearDoc.semesters.id(semId);
    if (!sem) return res.status(404).json({ error: "Semester not found." });

    sem.courses.push({
      user:        uid(req),
      title:       title.trim(),
      code:        code?.trim().toUpperCase() ?? "",
      description: description?.trim()       ?? "",
      colorHex:    colorHex                  ?? "#6366f1",
      resources:   [],
      events:      [],
    });
    await yearDoc.save({ validateModifiedOnly: true });

    const created = sem.courses[sem.courses.length - 1];
    res.status(201).json(created);
  } catch (err) {
    console.error("[yearController] createCourse:", err);
    res.status(500).json({ error: "Internal server error." });
  }
}

export async function deleteCourse(req, res) {
  try {
    const { yearId, semId, courseId } = req.params;
    if (
      !requireId(res, yearId,   "yearId")   ||
      !requireId(res, semId,    "semId")    ||
      !requireId(res, courseId, "courseId")
    ) return;

    const yearDoc = await Year.findOne({ _id: yearId, user: uid(req) });
    if (!yearDoc) return res.status(404).json({ error: "Year not found." });

    const sem = yearDoc.semesters.id(semId);
    if (!sem) return res.status(404).json({ error: "Semester not found." });

    if (!sem.courses.id(courseId)) {
      return res.status(404).json({ error: "Course not found." });
    }

    sem.courses.pull({ _id: courseId });
    await yearDoc.save({ validateModifiedOnly: true });

    await Embedding.deleteMany({
      courseId: new mongoose.Types.ObjectId(courseId),
      user:     uid(req),
    });

    res.json({ success: true });
  } catch (err) {
    console.error("[yearController] deleteCourse:", err);
    res.status(500).json({ error: "Internal server error." });
  }
}
