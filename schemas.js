// schemas.js
const API_BASE = "http://localhost:3000";

function fmtDate(d){
  if (!d) return "";
  const x = new Date(d);
  return isNaN(x) ? String(d) : x.toLocaleString();
}

async function safe(url){
  try{
    const r = await fetch(url, {cache:"no-store"});
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  }catch(e){
    console.warn(e);
    return null;
  }
}

async function loadSchemas(){
  const arr = (await safe(`${API_BASE}/api/schemas`)) || (await safe(`${API_BASE}/schemas`)) || [];
  const tbody = document.querySelector("#schemasTable tbody");
  tbody.innerHTML = "";
  (arr||[]).forEach(s => {
    const ver = s.version ?? s._id ?? s.name ?? "v?";
    const fields = (s.fields && Array.isArray(s.fields)) ? s.fields.map(f => f.name).slice(0,6).join(", ") : "-";
    const created = s.createdAt ?? s.created ?? s.ts ?? "";
    const change = s.changeSummary ?? s.desc ?? "-";
    tbody.innerHTML += `
      <tr>
        <td>${ver}</td>
        <td>${fields}</td>
        <td>${fmtDate(created)}</td>
        <td>${change}</td>
        <td><a class="btn-link" href="#" data-ver="${encodeURIComponent(ver)}">Details</a></td>
      </tr>
    `;
  });

  // attach handlers
  document.querySelectorAll("#schemasTable a[data-ver]").forEach(a=>{
    a.addEventListener("click", async (e)=>{
      e.preventDefault();
      const v = a.dataset.ver;
      showSchemaDetail(decodeURIComponent(v));
    });
  });
}

async function showSchemaDetail(ver){
  const detailWrap = document.getElementById("schemaDetail");
  detailWrap.style.display = "block";
  detailWrap.innerHTML = `<p style="color:var(--muted)">Loading schema ${ver}...</p>`;
  const body = await safe(`${API_BASE}/api/schemas/${encodeURIComponent(ver)}`) || await safe(`${API_BASE}/schemas/${encodeURIComponent(ver)}`);
  if (!body){
    detailWrap.innerHTML = `<p style="color:#f7c2c2">Unable to load schema details</p>`;
    return;
  }
  const fields = body.fields || [];
  const samples = body.samples || body.sampleRecords || [];
  let fieldsHtml = `<h4>Fields</h4><ul>${fields.map(f => `<li><strong>${f.name}</strong> — ${f.type}${f.optional ? " (optional)" : ""}</li>`).join("")}</ul>`;
  let samplesHtml = `<h4>Sample Records</h4>`;
  if (!samples.length) samplesHtml += "<p style='color:var(--muted)'>No sample normalized records available</p>";
  else samplesHtml += `<div style="max-height:260px; overflow:auto; border-radius:8px; padding:8px; background:rgba(255,255,255,0.02)">${samples.map(s => `<pre style="white-space:pre-wrap; font-size:12px; margin:6px 0; padding:6px; border-radius:6px; border:1px solid rgba(255,255,255,0.02)">${JSON.stringify(s, null, 2)}</pre>`).join("")}</div>`;

  detailWrap.innerHTML = `<div class="panel" style="padding:12px">${fieldsHtml}${samplesHtml}</div>`;
}

document.addEventListener("DOMContentLoaded", loadSchemas);