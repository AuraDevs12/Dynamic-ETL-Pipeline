// infer.js
const { RawRecord, SchemaVersion } = require("./db");
const deepEqual = (a,b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Determine type name for JS values
 */
function typeName(v) {
  if (v === null || v === undefined) return "null";
  if (Array.isArray(v)) return "array";
  switch (typeof v) {
    case "boolean": return "boolean";
    case "number": return Number.isInteger(v) ? "integer" : "number";
    case "object": return "object";
    default: return "string";
  }
}

/**
 * Walk object and collect field statistics (top-level and nested as dotted paths)
 */
function collectFields(obj, stats, prefix="") {
  if (obj === null || obj === undefined) return;
  if (typeof obj !== "object" || Array.isArray(obj)) {
    const p = prefix || "value";
    stats[p] = stats[p] || { types: new Set(), presentCount: 0 };
    stats[p].types.add(typeName(obj));
    stats[p].presentCount += 1;
    return;
  }
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    const path = prefix ? `${prefix}.${k}` : k;
    if (v === null || v === undefined) {
      stats[path] = stats[path] || { types: new Set(), presentCount: 0 };
      stats[path].types.add("null");
      stats[path].presentCount += 1;
    } else if (Array.isArray(v)) {
      stats[path] = stats[path] || { types: new Set(), presentCount: 0 };
      stats[path].types.add("array");
      stats[path].presentCount += 1;
      // collect first-level item types
      for (const item of v.slice(0,3)) collectFields(item, stats, `${path}[]`);
    } else if (typeof v === "object") {
      stats[path] = stats[path] || { types: new Set(), presentCount: 0 };
      stats[path].types.add("object");
      stats[path].presentCount += 1;
      collectFields(v, stats, path);
    } else {
      stats[path] = stats[path] || { types: new Set(), presentCount: 0 };
      stats[path].types.add(typeName(v));
      stats[path].presentCount += 1;
    }
  }
}

/**
 * Build schema object from stats
 */
function buildSchemaFromStats(stats, totalSamples, optionalThreshold=0.05) {
  const result = {};
  for (const [field, info] of Object.entries(stats)) {
    result[field] = {
      types: Array.from(info.types),
      presentCount: info.presentCount,
      optional: info.presentCount < (1 - optionalThreshold) * totalSamples
    };
  }
  return result;
}

/**
 * Main: sample recent raw docs, compute schema, compare with latest schema and create new version if changed
 */
async function inferAndMaybeCreateVersion(sampleSize = 50, optionalThreshold=0.05, notes="auto") {
  // get most recent sampleSize raw records
  const samples = await RawRecord.find().sort({ ingestedAt: -1 }).limit(sampleSize).exec();
  const total = samples.length;
  if (total === 0) return null;

  const stats = {};
  for (const s of samples) {
    collectFields(s.payload, stats, "");
  }
  const newSchemaFields = buildSchemaFromStats(stats, total, optionalThreshold);

  // get latest schema
  const latest = await SchemaVersion.findOne().sort({ version: -1 }).exec();
  const latestFields = latest ? latest.fields : null;

  if (!latest || !deepEqual(latestFields, newSchemaFields)) {
    const newVersionNumber = latest ? latest.version + 1 : 1;
    const created = await SchemaVersion.create({
      version: newVersionNumber,
      fields: newSchemaFields,
      totalSamples: total,
      notes
    });
    console.log("Created new schema version:", created.version);
    return created;
  } else {
    console.log("No schema change detected.");
    return null;
  }
}

module.exports = { inferAndMaybeCreateVersion };
