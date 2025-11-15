// records.js
const API_BASE = "http://localhost:3000";

function el(sel){ return document.querySelector(sel) }
function fmtDate(d){ if(!d) return ""; const x=new Date(d); return isNaN(x)?String(d):x.toLocaleString(); }

async function safe(url){
  try{
    const r = await fetch(url, {cache:"no-store"});
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  }catch(e){ console.warn(e); return null; }
}

let currentPage = 1;

async function runSearch(page=1){
  const q = el("#q").value.trim();
  const sv = el("#schemaVersion").value.trim();
  const ft = el("#fileType").value.trim();
  currentPage = page;

  const params = new URLSearchParams();
  if (q) params.append("q", q);
  if (sv) params.append("schemaVersion", sv);
  if (ft) params.append("fileType", ft);
  params.append("page", page);

  el("#results").innerHTML = "<p style='color:var(--muted)'>Searching…</p>";

  const res = await safe(`${API_BASE}/api/records?${params.toString()}`) || await safe(`${API_BASE}/records?${params.toString()}`);
  if (!res) {
    el("#results").innerHTML = "<p style='color:#f7c2c2'>Search failed</p>";
    return;
  }

  // backend may return { items: [...], total, page, perPage } or array directly
  const items = (res.items ?? res.records ?? res.data ?? res) || [];
  const total = res.total ?? res.totalCount ?? items.length;
  const perPage = res.perPage ?? res.pageSize ?? 20;

  if (!items.length) {
    el("#results").innerHTML = "<p style='color:var(--muted)'>No records found</p>";
  } else {
    el("#results").innerHTML = items.map(it => {
      const id = it._id ?? it.id ?? it.recordId ?? "";
      const schema = it.schemaVersion ?? it.schema ?? "-";
      const rawId = it.rawId ?? it.raw ?? "";
      const preview = JSON.stringify(it.data ?? it, null, 2);
      return `<div class="panel" style="margin-bottom:10px">
        <div style="display:flex; justify-content:space-between; gap:12px; align-items:center;">
          <div style="font-weight:700">${id}</div>
          <div style="color:var(--muted)">schema: ${schema}</div>
        </div>
        <pre style="white-space:pre-wrap; margin-top:10px; font-size:13px; background:rgba(255,255,255,0.01); padding:8px; border-radius:6px; border:1px solid rgba(255,255,255,0.02)">${preview}</pre>
      </div>`;
    }).join("");
  }

  // pager
  el("#pager").innerHTML = `Page ${page} • ${total} total`;
  // simple previous/next controls
  let pagerHtml = "";
  if (page > 1) pagerHtml += `<button id="prevBtn" class="btn-link">Prev</button> `;
  if ((page * perPage) < total) pagerHtml += `<button id="nextBtn" class="btn-link">Next</button>`;
  el("#pager").innerHTML += `<div style="margin-top:8px">${pagerHtml}</div>`;

  if (document.getElementById("prevBtn")) document.getElementById("prevBtn").addEventListener("click", () => runSearch(page-1));
  if (document.getElementById("nextBtn")) document.getElementById("nextBtn").addEventListener("click", () => runSearch(page+1));
}

document.addEventListener("DOMContentLoaded", () => {
  el("#searchBtn").addEventListener("click", () => runSearch(1));
  el("#q").addEventListener("keydown", (e) => { if (e.key === "Enter") runSearch(1) });
});