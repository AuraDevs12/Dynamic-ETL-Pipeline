// upload.js
const API_BASE = "http://localhost:3000";

function qs(sel) { 
  return document.querySelector(sel); 
}

document.addEventListener("DOMContentLoaded", () => {
  const form = qs("#uploadForm");
  const fileInput = qs("#fileInput");
  const fileNameDisplay = qs("#fileName");
  const meta = qs("#meta");
  const status = qs("#status");
  const progressWrap = qs("#progressWrap");
  const progressBar = qs("#progressBar");
  const submitBtn = qs("#submitBtn");

  // Update filename visually when a file is selected
  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    fileNameDisplay.innerText = file ? file.name : "No file chosen";
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const file = fileInput.files[0];
    if (!file) {
      status.innerText = "Please choose a file.";
      return;
    }

    // metadata JSON parse
    let metadata = {};
    try {
      const t = meta.value.trim();
      if (t) metadata = JSON.parse(t);
    } catch (err) {
      status.innerText = "Invalid metadata JSON.";
      return;
    }

    // Prepare form data
    const fd = new FormData();
    fd.append("file", file); // backend can accept "file" because we use multer.any()
    fd.append("metadata", JSON.stringify(metadata));

    // Use XHR for real progress bar
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/api/upload`, true);

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) {
        progressWrap.style.display = "block";
        const pct = Math.round((ev.loaded / ev.total) * 100);
        progressBar.style.width = pct + "%";
      }
    };

    xhr.onload = () => {
      progressWrap.style.display = "none";

      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);

          // FIXED: extract ID from results array
          let id = null;
          if (res.results && Array.isArray(res.results) && res.results.length > 0) {
            id = res.results[0].id || null;
          }

          status.style.color = "#bfe8d4";
          status.innerHTML = `Upload successful. ID: <code>${id}</code>`;

          // Reset fields
          fileInput.value = "";
          fileNameDisplay.innerText = "No file chosen";
          meta.value = "";
        } catch (err) {
          status.style.color = "#bfe8d4";
          status.innerText = "Upload successful";
        }
      } else {
        status.style.color = "#f7c2c2";
        status.innerText = `Upload failed: ${xhr.status} ${xhr.statusText || ""}`;
      }
    };

    xhr.onerror = () => {
      progressWrap.style.display = "none";
      status.style.color = "#f7c2c2";
      status.innerText = "Upload failed (network error)";
    };

    submitBtn.disabled = true;
    status.style.color = "var(--muted)";
    status.innerText = "Uploading...";

    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4) submitBtn.disabled = false;
    };

    xhr.send(fd);
  });
});