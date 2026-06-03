import Task, { VALID_DOMAINS } from "../models/Task.js";
import mongoose from "mongoose";

// ── Helpers ───────────────────────────────────────────────────────────────────

const uid = (req) => req.user._id;

// Parses a date-only string ("YYYY-MM-DD") as local noon to avoid UTC-offset
// shifting the date to the previous day for users behind UTC.
function parseDateLocal(str) {
  if (!str) return undefined;
  const [y, m, d] = String(str).split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// Serialises a Mongoose doc to plain JSON, including virtuals (priorityScore).
function toDTO(doc) {
  return doc.toJSON();
}

// ── GET /api/tasks ────────────────────────────────────────────────────────────
// Query params: domain, status, sortBy ("priority" | "dueDate" | "created")
export async function listTasks(req, res) {
  try {
    const filter = { user: uid(req) };
    if (req.query.workspaceId) {
      // Specific workspace: show tasks that belong to it.
      // Legacy tasks with null workspaceId are intentionally excluded so each
      // workspace only shows its own items.
      filter.workspaceId = req.query.workspaceId;
    }
    // domain filter is secondary; workspaceId takes precedence when provided
    if (!req.query.workspaceId && req.query.domain) filter.domain = req.query.domain;
    if (req.query.status) filter.status = req.query.status;

    const tasks = await Task.find(filter).lean({ virtuals: true });

    const sortBy = req.query.sortBy ?? "priority";
    if (sortBy === "priority") {
      tasks.sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0));
    } else if (sortBy === "dueDate") {
      tasks.sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate) - new Date(b.dueDate);
      });
    } else {
      // "created" — newest first (default Mongo _id order)
      tasks.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
    }

    res.json(tasks);
  } catch (err) {
    console.error("[taskController] listTasks:", err);
    res.status(500).json({ error: "Internal server error." });
  }
}

// ── GET /api/tasks/:id ────────────────────────────────────────────────────────
// Returns a single task (includes priorityScore + warmUpPrompt for Context Mode).
export async function getTask(req, res) {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ error: "Invalid task id" });

    const task = await Task.findOne({ _id: req.params.id, user: uid(req) });
    if (!task) return res.status(404).json({ error: "Task not found" });

    res.json(toDTO(task));
  } catch (err) {
    console.error("[taskController] getTask:", err);
    res.status(500).json({ error: "Internal server error." });
  }
}

// ── POST /api/tasks ───────────────────────────────────────────────────────────
// Body: { title, description?, domain, dueDate?, gradeBusinessValue?,
//         estimatedEffort?, warmUpPrompt?, courseRef?, tags?, status? }
export async function createTask(req, res) {
  try {
    const {
      title,
      description,
      domain,
      workspaceId,
      startDate,
      dueDate,
      gradeBusinessValue,
      estimatedEffort,
      warmUpPrompt,
      courseRef,
      tags,
      status,
    } = req.body;

    if (!title?.trim())
      return res.status(400).json({ error: "title is required" });

    if (!VALID_DOMAINS.includes(domain))
      return res.status(400).json({ error: `domain must be one of: ${VALID_DOMAINS.join(", ")}` });

    const task = await Task.create({
      user:        uid(req),
      title:       title.trim(),
      description: description?.trim() ?? "",
      domain,
      workspaceId: workspaceId?.trim() ?? null,
      startDate:   parseDateLocal(startDate),
      dueDate:     parseDateLocal(dueDate),
      gradeBusinessValue: gradeBusinessValue ?? 50,
      estimatedEffort:    estimatedEffort    ?? 1,
      warmUpPrompt: warmUpPrompt?.trim() ?? "",
      courseRef:    courseRef    ?? null,
      tags:         Array.isArray(tags) ? tags.map((t) => String(t).trim()) : [],
      status:       status ?? "todo",
    });

    res.status(201).json(toDTO(task));
  } catch (err) {
    if (err.name === "ValidationError")
      return res.status(400).json({ error: err.message });
    console.error("[taskController] createTask:", err);
    res.status(500).json({ error: "Internal server error." });
  }
}

// ── PATCH /api/tasks/:id ──────────────────────────────────────────────────────
// Partial update — any subset of task fields.
export async function updateTask(req, res) {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ error: "Invalid task id" });

    const allowed = [
      "title", "description", "domain", "workspaceId", "startDate", "dueDate",
      "gradeBusinessValue", "estimatedEffort",
      "warmUpPrompt", "courseRef", "tags", "status",
    ];

    const updates = {};
    for (const key of allowed) {
      if (key in req.body) updates[key] = req.body[key];
    }

    if (updates.startDate) updates.startDate = parseDateLocal(updates.startDate);
    if (updates.dueDate)   updates.dueDate   = parseDateLocal(updates.dueDate);

    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, user: uid(req) },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!task) return res.status(404).json({ error: "Task not found" });

    res.json(toDTO(task));
  } catch (err) {
    if (err.name === "ValidationError")
      return res.status(400).json({ error: err.message });
    console.error("[taskController] updateTask:", err);
    res.status(500).json({ error: "Internal server error." });
  }
}

// ── DELETE /api/tasks/:id ─────────────────────────────────────────────────────
export async function deleteTask(req, res) {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ error: "Invalid task id" });

    const task = await Task.findOneAndDelete({ _id: req.params.id, user: uid(req) });
    if (!task) return res.status(404).json({ error: "Task not found" });

    res.json({ ok: true });
  } catch (err) {
    console.error("[taskController] deleteTask:", err);
    res.status(500).json({ error: "Internal server error." });
  }
}
