// dashboard.js — updated and resilient to backend shapes
const API_BASE = "http://localhost:3000";

function fmtDate(isoOrTs) {
  if (!isoOrTs) return "";
  const d = new Date(isoOrTs);
  if (isNaN(d.getTime())) return String(isoOrTs);
  return d.toLocaleString();
}

async function safeJson(url) {
  try {
    const r = await fetch(url, {cache: "no-store"});
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch (e) {
    console.warn("fetch failed:", url, e);
    return null;
  }
}

async function loadDashboard() {
  // 1) Prefer backend summary endpoint
  let body = await safeJson(`${API_BASE}/api/dashboard`);

  // 2) Fallback to components if summary not available
  if (!body) {
    const stats = (await safeJson(`${API_BASE}/api/stats`)) || (await safeJson(`${API_BASE}/stats`)) || {};
    const schemaList = (await safeJson(`${API_BASE}/api/schemas`)) || (await safeJson(`${API_BASE}/schemas`)) || [];
    const uploads = (await safeJson(`${API_BASE}/api/uploads`)) || (await safeJson(`${API_BASE}/uploads`)) || [];

    body = {
      rawRecords: stats.rawRecords ?? stats.raw ?? stats.raw_count ?? 0,
      normalizedRecords: stats.normalizedRecords ?? stats.normalized ?? stats.normalized_count ?? 0,
      schemaVersions: stats.schemaVersions ?? stats.schema_versions ?? schemaList.length,
      fileTypes: stats.fileTypes ?? stats.fileTypesCount ?? 0,
      schemaList,
      uploads,
    };
  }

  // Some backends return nested objects; normalize names
  const rawCount = body.rawRecords ?? body.raw ?? body.raw_count ?? 0;
  const normCount = body.normalizedRecords ?? body.normalized ?? body.normalized_count ?? 0;
  const schemaCount = body.schemaVersions ?? body.schema_versions ?? (body.schemaList ? body.schemaList.length : 0);
  const fileTypes = body.fileTypes ?? body.fileTypesCount ?? 0;

  document.getElementById("rawRecords").innerText = rawCount ?? "--";
  document.getElementById("normalizedRecords").innerText = normCount ?? "--";
  document.getElementById("schemaVersions").innerText = schemaCount ?? "--";
  document.getElementById("fileTypes").innerText = fileTypes ?? "--";

  const schemas = body.schemaList ?? body.schemas ?? [];
  const uploads = body.uploads ?? body.recentUploads ?? [];

  // Fill schema table
  const schemaTbody = document.querySelector("#schemaTable tbody");
  if (schemaTbody) {
    schemaTbody.innerHTML = "";
    (schemas || []).forEach(s => {
      const ver = s.version ?? s.name ?? s._id ?? "v?";
      const samples = s.count ?? s.samples ?? s.samplesCount ?? "-";
      const updated = s.updatedAt ?? s.updated ?? s.lastModified ?? s.createdAt ?? s.ts ?? "";
      schemaTbody.innerHTML += `
        <tr>
          <td>${ver}</td>
          <td>${samples}</td>
          <td>${fmtDate(updated)}</td>
          <td><a class="btn-link" href="schemas.html#v=${encodeURIComponent(ver)}">View</a></td>
        </tr>
      `;
    });
  }

  // Fill uploads table
  const uploadsTbody = document.querySelector("#uploadsTable tbody");
  if (uploadsTbody) {
    uploadsTbody.innerHTML = "";
    (uploads || []).forEach(u => {
      const filename = u.filename ?? u.originalName ?? u.name ?? "-";
      const type = u.type ?? u.mime ?? u.fileType ?? "-";
      const time = u.timestamp ?? u.createdAt ?? u.time ?? u.receivedAt ?? "";
      const viewLink = (u.url || u.path) ? `<a class="btn-link" href="${u.url || u.path}" target="_blank">Open</a>` : "";
      uploadsTbody.innerHTML += `
        <tr>
          <td>${filename}</td>
          <td>${type}</td>
          <td>${fmtDate(time)}</td>
          <td>${viewLink}</td>
        </tr>
      `;
    });
  }
}

document.addEventListener("DOMContentLoaded", loadDashboard);