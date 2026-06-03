import { Schema, model } from "mongoose";

// ── Leaf schemas ────────────────────────────────────────────────────────────

const ResourceSchema = new Schema(
  {
    user:    { type: Schema.Types.ObjectId, ref: "User", required: true },
    title:   { type: String, required: true, trim: true },
    url:     { type: String, trim: true },
    fileKey: { type: String, trim: true }, // original filename of the uploaded file
    type: {
      type:    String,
      enum:    ["link", "file", "video", "document", "other"],
      default: "link",
    },
    // First 50 000 chars of extracted text — enough for direct AI prompting without
    // needing a vector-search round-trip on short documents.  Full content lives as
    // overlapping chunks in the Embedding collection.
    rawText: { type: String, default: "" },
    // Byte size of the original upload (set by the controller)
    fileSize: { type: Number, default: 0 },
  },
  { _id: true, timestamps: { createdAt: "uploadedAt", updatedAt: false } }
);

const EventSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    date: { type: Date, required: true },
    type: {
      type: String,
      enum: ["assignment", "exam", "lecture", "reminder", "other"],
      default: "other",
    },
    // Three-state status for assignments; completed mirrors status === "completed"
    // so existing queries that filter on `completed` keep working.
    status: {
      type: String,
      enum: ["todo", "in-progress", "completed"],
      default: "todo",
    },
    completed: { type: Boolean, default: false },
    // Grade weight: how much this item is worth in the final course grade (0–100 %)
    gradeWeight:  { type: Number, min: 0, max: 100, default: null },
    // Raw points earned and total possible — e.g. 36 / 40.
    // Null until the user grades the item. Percentage is computed as earnedPoints/totalPoints*100.
    earnedPoints: { type: Number, min: 0, default: null },
    totalPoints:  { type: Number, min: 0, default: null },
  },
  { _id: true, timestamps: true }
);

// ── Course ───────────────────────────────────────────────────────────────────

const CourseSchema = new Schema(
  {
    user:        { type: Schema.Types.ObjectId, ref: "User", required: true },
    title:       { type: String, required: true, trim: true },
    // Short course identifier, e.g. "CS 401" — stored upper-case
    code:        { type: String, trim: true, uppercase: true, default: "" },
    description: { type: String, trim: true, default: "" },
    // Hex colour used to derive the card gradient in the UI
    colorHex:    { type: String, trim: true, default: "#6366f1" },
    // Academic weight (credit hours) — used as ROI difficulty factor for School tasks
    weight:               { type: Number, min: 0, max: 6, default: 3 },
    // Live grade (0–100). Undefined until the user sets it.
    currentGrade:         { type: Number, min: 0, max: 100 },
    // Subjective difficulty 1–10; multiplied into the ROI priority score for School tasks.
    // 5 is neutral (1× factor), 10 doubles the urgency.
    difficultyMultiplier: { type: Number, min: 1, max: 10, default: 5 },
    resources: [ResourceSchema],
    events:    [EventSchema],
  },
  { _id: true, timestamps: true }
);

// ── Semester ─────────────────────────────────────────────────────────────────

const SemesterSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true }, // e.g. "Fall 2025"
    season: {
      type: String,
      enum: ["spring", "summer", "fall", "winter"],
      required: true,
    },
    courses: [CourseSchema],
  },
  { _id: true, timestamps: true }
);

// ── Year (top-level document) ────────────────────────────────────────────────

const YearSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    year: { type: Number, required: true }, // e.g. 2025
    semesters: [SemesterSchema],
  },
  { timestamps: true }
);

// Prevent duplicate years per user
YearSchema.index({ user: 1, year: 1 }, { unique: true });

export default model("Year", YearSchema);
