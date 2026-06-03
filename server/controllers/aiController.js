import { Types }  from "mongoose";
import Year       from "../models/Academic.js";
import Embedding  from "../models/Embedding.js";
import { embed }  from "../config/geminiClient.js";

/**
 * POST /api/ai/query
 *
 * Body: { courseId, prompt }
 *
 * 1. Verify the requesting user owns the course (via the nested Year document)
 * 2. Embed the question with Voyage AI
 * 3. Run Atlas $vectorSearch (index "vector_index") — top 3 chunks for that course
 * 4. Build a grounded system prompt and call Claude via req.aiClient (set by aiGatekeeper)
 * 5. Return { answer, sources, usage }
 */
export async function queryAI(req, res) {
  try {
    const { courseId, prompt } = req.body;

    if (!courseId || typeof courseId !== "string" || !courseId.trim()) {
      return res.status(400).json({ error: "courseId is required." });
    }
    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({ error: "prompt is required." });
    }

    // ── 1. Ownership check ───────────────────────────────────────────────────
    const courseExists = await Year.exists({
      user: req.user._id,
      "semesters.courses._id": courseId,
    });

    if (!courseExists) {
      return res.status(404).json({ error: "Course not found." });
    }

    // ── 2. Embed the question ────────────────────────────────────────────────
    const [queryVector] = await embed([prompt.trim()]);

    // ── 3. Atlas Vector Search ───────────────────────────────────────────────
    const chunks = await Embedding.aggregate([
      {
        $vectorSearch: {
          index:        "vector_index",
          path:         "embedding",
          queryVector,
          numCandidates: 30,
          limit:         3,
          filter: {
            courseId: { $eq: new Types.ObjectId(courseId) },
            user:     { $eq: new Types.ObjectId(String(req.user._id)) },
          },
        },
      },
      {
        $project: {
          _id:        1,
          content:    1,
          chunkIndex: 1,
          resource:   1,
          score:      { $meta: "vectorSearchScore" },
        },
      },
    ]);

    if (chunks.length === 0) {
      return res.status(200).json({
        answer:  "I couldn't find any relevant material in this course's resources to answer that question.",
        sources: [],
        usage:   null,
      });
    }

    // ── 4. Build grounded prompt & call Claude ───────────────────────────────
    const context = chunks
      .map((c, i) => `[Chunk ${i + 1} — ${c.resource?.title ?? "Unknown source"}, part ${c.chunkIndex + 1}]\n${c.content}`)
      .join("\n\n---\n\n");

    const systemPrompt = [
      "You are a precise academic assistant. Answer the student's question using ONLY the provided course material excerpts below.",
      "If the excerpts do not contain enough information to answer the question fully, say so clearly — do not fabricate details.",
      "Cite the source chunk numbers (e.g. [Chunk 1]) where relevant.",
      "",
      "=== COURSE MATERIAL ===",
      context,
      "=== END OF MATERIAL ===",
    ].join("\n");

    const response = await req.aiClient.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: 1024,
      system:     systemPrompt,
      messages:   [{ role: "user", content: prompt.trim() }],
    });

    const answer = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    // ── 5. Shape the response ────────────────────────────────────────────────
    const sources = chunks.map((c) => ({
      title:      c.resource?.title  ?? "Unknown",
      type:       c.resource?.type   ?? "document",
      url:        c.resource?.url    ?? null,
      chunkIndex: c.chunkIndex,
      score:      c.score,
    }));

    return res.status(200).json({
      answer,
      sources,
      usage: {
        inputTokens:  response.usage?.input_tokens  ?? null,
        outputTokens: response.usage?.output_tokens ?? null,
        keySource:    req.aiKeySource,
      },
    });
  } catch (err) {
    console.error("[aiController] queryAI error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
}
