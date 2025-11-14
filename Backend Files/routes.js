// routes.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const os = require("os");
const path = require("path");
const fs = require("fs");
const { extractFile } = require("./extractor");
const { RawRecord, SchemaVersion, NormalizedRecord } = require("./db");
const { inferAndMaybeCreateVersion } = require("./infer");
const { normalizePending } = require("./transform");

// Multer temp storage
const upload = multer({ dest: path.join(os.tmpdir(), 'uploads') });

/**
 * POST /api/ingest
 * Accepts raw JSON (fallback for direct JSON POST)
 */
router.post("/ingest", async (req, res) => {
  try {
    const payload = req.body;
    const source = req.query.source || req.headers["x-source"] || "ingest";
    const doc = await RawRecord.create({ payload, source });
    res.status(201).json({ id: doc._id, msg: "ingested" });
    // background work (fire-and-forget)
    inferAndMaybeCreateVersion(parseInt(process.env.SAMPLE_SIZE || "50"), parseFloat(process.env.SCHEMA_OPTIONAL_THRESHOLD || "0.05"), "on-ingest")
      .catch(e => console.error("infer error:", e.message));
    normalizePending().catch(e => console.error("normalize error:", e.message));
  } catch (err) {
    console.error("ingest error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/upload
 * Accepts files in multipart form-data (field name: files)
 */
router.post("/upload", upload.array("files", 10), async (req, res) => {
  const files = req.files || [];
  const source = req.query.source || req.headers["x-source"] || "upload";
  if (files.length === 0) return res.status(400).json({ error: "no files uploaded (field name: files)" });

  const results = [];
  for (const f of files) {
    const tempPath = f.path;
    try {
      const extracted = await extractFile(tempPath, f.originalname, f.mimetype);
      const meta = {
        filename: f.originalname,
        mimetype: f.mimetype,
        size: f.size,
        encoding: f.encoding,
        uploadedAt: new Date()
      };

      const payloadToStore = (extracted.type === 'json') ? extracted.payload : { _extractedText: extracted.payload };

      const doc = await RawRecord.create({
        payload: payloadToStore,
        source,
        fileMetadata: meta
      });

      results.push({ id: doc._id, filename: f.originalname, extractionType: extracted.type });

      // background infer & normalize
      inferAndMaybeCreateVersion(parseInt(process.env.SAMPLE_SIZE || '50'), parseFloat(process.env.SCHEMA_OPTIONAL_THRESHOLD || '0.05'), 'upload')
        .catch(e => console.error("bg infer error:", e.message));
      normalizePending().catch(e => console.error("bg normalize error:", e.message));

    } catch (err) {
      console.error("file extract error for", f.originalname, err);
      results.push({ filename: f.originalname, error: err.message });
    } finally {
      try { fs.unlinkSync(tempPath); } catch (e) {}
    }
  }

  res.json({ ok: true, results });
});

/**
 * GET endpoints for raw/schema/normalized
 */
router.get("/raw", async (req, res) => {
  const docs = await RawRecord.find().sort({ ingestedAt: -1 }).limit(200);
  res.json(docs);
});

router.get("/raw/:id", async (req, res) => {
  try {
    const doc = await RawRecord.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "not found" });
    res.json(doc);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get("/schema/latest", async (req, res) => {
  const latest = await SchemaVersion.findOne().sort({ version: -1 });
  if (!latest) return res.status(404).json({ error: "no schema yet" });
  res.json(latest);
});

router.get("/schemas", async (req, res) => {
  const docs = await SchemaVersion.find().sort({ version: -1 }).limit(50);
  res.json(docs);
});

router.get("/normalized", async (req, res) => {
  const docs = await NormalizedRecord.find().sort({ normalizedAt: -1 }).limit(200);
  res.json(docs);
});

/**
 * Admin: force run inference + normalization
 */
router.post("/admin/run", async (req, res) => {
  try {
    const s = await inferAndMaybeCreateVersion(parseInt(process.env.SAMPLE_SIZE || '50'), parseFloat(process.env.SCHEMA_OPTIONAL_THRESHOLD || '0.05'), 'manual');
    await normalizePending();
    res.json({ ok: true, createdSchema: s ? s.version : null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
