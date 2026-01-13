(() => {
  const devicesBody = document.getElementById("devices-body");
  const refreshBtn = document.getElementById("refresh-devices");
  const lastRefreshed = document.getElementById("last-refreshed");
  const liveLoading = document.getElementById("live-loading");
  const quickUpload = document.getElementById("quick-upload");
  const manualUpload = document.getElementById("manual-upload");
  const previewEmpty = document.getElementById("preview-empty");
  const previewWrap = document.getElementById("preview-table-wrap");
  const previewHead = document.getElementById("preview-head");
  const previewBody = document.getElementById("preview-body");
  const loadedFile = document.getElementById("loaded-file");
  const clearPreview = document.getElementById("clear-preview");
  const historyEmpty = document.getElementById("history-empty");
  const historyWrap = document.getElementById("history-table-wrap");
  const historyBody = document.getElementById("history-body");
  const clearHistory = document.getElementById("clear-history");

  let devices = [];

  const fetchJson = async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Request failed");
    return res.json();
  };

  const getLatest = (points) => {
    if (!points || !points.length) return null;
    return points.reduce((latest, cur) => {
      if (!latest || (cur.utc || 0) > (latest.utc || 0)) return cur;
      return latest;
    }, null);
  };

  const renderDevices = () => {
    if (!devicesBody) return;
    devicesBody.innerHTML = "";
    if (!devices.length) {
      const row = document.createElement("tr");
      row.innerHTML =
        '<td class="px-3 py-3 text-slate-700" colSpan="10">No devices found for your organization.</td>';
      devicesBody.appendChild(row);
      return;
    }
    devices.forEach((d) => {
      const row = document.createElement("tr");
      row.className = "odd:bg-white even:bg-slate-50/70 hover:bg-auburn/5";
      row.innerHTML = `
        <td class="px-3 py-2 border-b border-slate-200/70 text-slate-800">${d.id ?? "-"}</td>
        <td class="px-3 py-2 border-b border-slate-200/70 text-slate-800 uppercase">${d.type ?? "-"}</td>
        <td class="px-3 py-2 border-b border-slate-200/70 text-slate-800">${d.label ?? "-"}</td>
        <td class="px-3 py-2 border-b border-slate-200/70 text-slate-800">${d.cur_t ?? "-"}</td>
        <td class="px-3 py-2 border-b border-slate-200/70 text-slate-800">${d.cur_h ?? "-"}</td>
        <td class="px-3 py-2 border-b border-slate-200/70 text-slate-800 whitespace-nowrap">
          ${d.liveAtUtc ? new Date(d.liveAtUtc * 1000).toLocaleString() : "-"}
        </td>
        <td class="px-3 py-2 border-b border-slate-200/70 text-slate-800">${d.min_temp ?? "-"}</td>
        <td class="px-3 py-2 border-b border-slate-200/70 text-slate-800">${d.max_temp ?? "-"}</td>
        <td class="px-3 py-2 border-b border-slate-200/70 text-slate-800">${d.vrn ?? "-"}</td>
        <td class="px-3 py-2 border-b border-slate-200/70">
          <a href="/visualizations/?id=${encodeURIComponent(String(d.id ?? ""))}&type=${d.type}" class="inline-flex items-center justify-center w-8 h-8 rounded-md border border-sky-500 text-sky-600 bg-white hover:bg-sky-50" title="View chart">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="10" width="3" height="11" stroke="currentColor" strokeWidth="2" />
              <rect x="10.5" y="6" width="3" height="15" stroke="currentColor" strokeWidth="2" />
              <rect x="18" y="3" width="3" height="18" stroke="currentColor" strokeWidth="2" />
            </svg>
          </a>
        </td>
      `;
      devicesBody.appendChild(row);
    });
  };

  const loadDevices = async () => {
    if (refreshBtn) refreshBtn.disabled = true;
    try {
      const res = await fetchJson("/api/blu/devices/");
      devices = (res.devices || []).map((d) => ({
        ...d,
        cur_t: null,
        cur_h: null,
        liveAtUtc: null,
      }));
      renderDevices();
      if (lastRefreshed) lastRefreshed.textContent = `Last refreshed: ${new Date().toLocaleString()}`;
      await loadLiveForDevices();
    } catch {
      renderDevices();
    } finally {
      if (refreshBtn) refreshBtn.disabled = false;
    }
  };

  const loadLiveForDevices = async () => {
    if (!devices.length) return;
    if (liveLoading) liveLoading.textContent = "Updating live readings...";
    const now = Math.floor(Date.now() / 1000);
    const from = now - 48 * 3600;
    const results = {};
    let idx = 0;
    const pool = 5;
    const worker = async () => {
      while (idx < devices.length) {
        const d = devices[idx++];
        if (!d.id) continue;
        try {
          const qs = new URLSearchParams({
            id: String(d.id),
            fromTime: String(from),
            toTime: String(now),
          });
          const res = await fetchJson(`/api/blu/measurements/?${qs.toString()}`);
          results[d.id] = getLatest(res.points || []);
        } catch {
          results[d.id] = null;
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(pool, devices.length) }, worker));

    devices = devices.map((d) => {
      const r = results[d.id];
      if (!r) return d;
      return { ...d, cur_t: r.t ?? null, cur_h: r.h ?? null, liveAtUtc: r.utc ?? null };
    });
    renderDevices();
    if (liveLoading) liveLoading.textContent = "";
  };

  const renderPreview = (name, headers, rows) => {
    if (previewHead) previewHead.innerHTML = "";
    if (previewBody) previewBody.innerHTML = "";
    if (headers && headers.length && previewHead) {
      const tr = document.createElement("tr");
      headers.forEach((h) => {
        const th = document.createElement("th");
        th.className = "px-3 py-2 text-left font-semibold border-b border-auburn/20 whitespace-nowrap";
        th.textContent = h;
        tr.appendChild(th);
      });
      previewHead.appendChild(tr);
    }
    if (rows && rows.length && previewBody) {
      rows.forEach((r) => {
        const tr = document.createElement("tr");
        tr.className = "odd:bg-white even:bg-slate-50/70 hover:bg-auburn/5";
        headers.forEach((h) => {
          const td = document.createElement("td");
          td.className = "px-3 py-2 border-b border-slate-200/70 text-slate-800 whitespace-nowrap";
          const val = r[h];
          td.textContent = val == null ? "" : String(val);
          tr.appendChild(td);
        });
        previewBody.appendChild(tr);
      });
    }
    if (previewEmpty) previewEmpty.classList.add("hidden");
    if (previewWrap) previewWrap.classList.remove("hidden");
    if (loadedFile) {
      loadedFile.textContent = `Loaded: ${name} - ${rows.length} row${rows.length === 1 ? "" : "s"}`;
      loadedFile.classList.remove("hidden");
    }
    if (clearPreview) clearPreview.classList.remove("hidden");
  };

  const clearPreviewTable = () => {
    if (previewEmpty) previewEmpty.classList.remove("hidden");
    if (previewWrap) previewWrap.classList.add("hidden");
    if (loadedFile) loadedFile.classList.add("hidden");
    if (clearPreview) clearPreview.classList.add("hidden");
    if (previewHead) previewHead.innerHTML = "";
    if (previewBody) previewBody.innerHTML = "";
  };

  const saveUpload = async (name, headers, rows) => {
    const res = await window.BluDash.csrfFetch("/api/uploads/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, headers, rows }),
    });
    if (!res.ok) throw new Error("Save failed");
  };

  const parseFile = async (file) => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const firstSheetName = wb.SheetNames[0];
    const ws = wb.Sheets[firstSheetName];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const headers = (data[0] || []).map((h) => String(h ?? "").trim());
    const rows = data.slice(1).map((arr) => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = arr[i];
      });
      return obj;
    });
    return { headers, rows };
  };

  const handleUpload = async (file) => {
    if (!file) return;
    const { headers, rows } = await parseFile(file);
    await saveUpload(file.name, headers, rows);
    renderPreview(file.name, headers, rows);
    await loadHistory();
  };

  const loadHistory = async () => {
    const res = await fetchJson("/api/uploads/");
    const uploads = res.uploads || [];
    if (!uploads.length) {
      if (historyEmpty) historyEmpty.classList.remove("hidden");
      if (historyWrap) historyWrap.classList.add("hidden");
      if (clearHistory) clearHistory.classList.add("hidden");
      return;
    }
    if (historyEmpty) historyEmpty.classList.add("hidden");
    if (historyWrap) historyWrap.classList.remove("hidden");
    if (clearHistory) clearHistory.classList.remove("hidden");
    if (historyBody) historyBody.innerHTML = "";
    uploads.forEach((u) => {
      const tr = document.createElement("tr");
      tr.className = "odd:bg-white even:bg-slate-50/70 hover:bg-auburn/5 cursor-pointer";
      tr.title = `Click to open "${u.name}" (${u.row_count} rows)`;
      tr.innerHTML = `
        <td class="px-3 py-2 border-b border-slate-200/70 text-slate-800 break-all">
          ${u.name}
          <div class="text-[11px] text-slate-500">${u.row_count} row${u.row_count === 1 ? "" : "s"}</div>
        </td>
        <td class="px-3 py-2 border-b border-slate-200/70 text-slate-800 whitespace-nowrap">
          ${new Date(u.created_at).toLocaleString()}
        </td>
      `;
      tr.addEventListener("click", async () => {
        const detail = await fetchJson(`/api/uploads/${u.id}/`);
        const upload = detail.upload;
        renderPreview(upload.name, upload.headers || [], upload.rows || []);
        const el = document.getElementById("manual-preview");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      historyBody.appendChild(tr);
    });
  };

  if (refreshBtn) refreshBtn.addEventListener("click", loadDevices);
  if (quickUpload) quickUpload.addEventListener("change", (e) => handleUpload(e.target.files?.[0]));
  if (manualUpload) manualUpload.addEventListener("change", (e) => handleUpload(e.target.files?.[0]));
  if (clearPreview) clearPreview.addEventListener("click", clearPreviewTable);
  if (clearHistory) {
    clearHistory.addEventListener("click", async () => {
      if (!confirm("Clear upload history for this account? This removes saved datasets too.")) return;
      await window.BluDash.csrfFetch("/api/uploads/clear/", { method: "DELETE" });
      clearPreviewTable();
      await loadHistory();
    });
  }

  clearPreviewTable();
  loadDevices();
  loadHistory();
})();
