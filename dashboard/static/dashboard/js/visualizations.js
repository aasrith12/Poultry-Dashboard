(() => {
  const liveTitle = document.getElementById("live-title");
  const liveRefresh = document.getElementById("live-refresh");
  const liveCard = document.getElementById("live-card");
  const liveEmpty = document.getElementById("live-empty");
  const liveError = document.getElementById("live-error");
  const liveCanvas = document.getElementById("live-chart");
  const uploadTitle = document.getElementById("upload-title");
  const uploadEmpty = document.getElementById("upload-empty");
  const uploadError = document.getElementById("upload-error");
  const uploadWrap = document.getElementById("upload-chart-wrap");
  const uploadCanvas = document.getElementById("upload-chart");
  const historyEmpty = document.getElementById("upload-history-empty");
  const historyWrap = document.getElementById("upload-history-wrap");
  const historyBody = document.getElementById("upload-history-body");
  const uploadXInterval = document.getElementById("upload-x-interval");
  const uploadYStep = document.getElementById("upload-y-step");

  let liveChart = null;
  let uploadChart = null;
  let uploadSeries = [];

  const fetchJson = async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Request failed");
    return res.json();
  };

  const renderLineChart = (canvas, labels, data, label, opts = {}) => {
    if (!canvas) return null;
    if (canvas._chart) {
      canvas._chart.destroy();
    }
    const chart = new Chart(canvas, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label,
            data,
            borderColor: "#1b3554",
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.2,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            ticks: {
              maxTicksLimit: 6,
              callback: opts.xTickCallback || undefined,
            },
          },
          y: {
            ticks: {
              stepSize: opts.yStep || undefined,
            },
          },
        },
      },
    });
    canvas._chart = chart;
    return chart;
  };

  const parseMaybeDate = (v) => {
    if (!v && v !== 0) return null;
    if (v instanceof Date && !isNaN(v.getTime())) return v;
    const s = String(v).trim();
    if (!s) return null;
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) {
      const parts = s.split(":").map((p) => Number(p));
      const [hh, mm, ss] = [parts[0], parts[1], parts[2] || 0];
      const d = new Date(Date.UTC(1970, 0, 1, hh, mm, ss));
      return isNaN(d.getTime()) ? null : d;
    }
    const d1 = new Date(s);
    if (!isNaN(d1.getTime())) return d1;
    if (s.includes(" ")) {
      const d2 = new Date(s.replace(" ", "T"));
      if (!isNaN(d2.getTime())) return d2;
    }
    if (/^\d+(\.\d+)?$/.test(s)) {
      const n = Number(s);
      if (!Number.isFinite(n)) return null;
      if (n > 10_000_000_000) return new Date(n);
      if (n > 1_000_000_000) return new Date(n * 1000);
      if (n > 0 && n < 1) {
        const ms = n * 24 * 3600 * 1000;
        return new Date(Date.UTC(1970, 0, 1) + ms);
      }
      if (n > 20_000 && n < 60_000) {
        const excelEpoch = Date.UTC(1899, 11, 30);
        return new Date(excelEpoch + n * 86400000);
      }
    }
    return null;
  };

  const toNum = (v) => {
    if (v === null || v === undefined) return null;
    const n = Number(String(v).trim());
    return Number.isFinite(n) ? n : null;
  };

  const detectTimeAndTemp = (headers, rows) => {
    const sample = rows.slice(0, Math.min(200, rows.length));
    let bestTime = "";
    let bestTimeScore = -1;
    headers.forEach((h) => {
      let score = 0;
      const ln = h.toLowerCase();
      if (/(time|timestamp|date|datetime)/i.test(ln)) score += 2;
      for (const r of sample) if (parseMaybeDate(r[h])) score++;
      if (score > bestTimeScore) {
        bestTimeScore = score;
        bestTime = h;
      }
    });
    const numericRatio = (h) => {
      let ok = 0;
      let tot = 0;
      for (const r of sample) {
        const n = toNum(r[h]);
        if (n !== null) ok++;
        tot++;
      }
      return tot ? ok / tot : 0;
    };
    let bestTemp = "";
    let bestTempScore = -1;
    headers.forEach((h) => {
      const ln = h.toLowerCase();
      let score = 0;
      if (/(temp|temperature|degc|celsius)/i.test(ln)) score += 2;
      score += numericRatio(h) * 5;
      if (score > bestTempScore) {
        bestTempScore = score;
        bestTemp = h;
      }
    });
    return { timeCol: bestTime || headers[0] || "", tempCol: bestTemp };
  };

  const loadLive = async () => {
    const params = new URLSearchParams(window.location.search);
    const loggerId = params.get("id");
    if (!loggerId) {
      if (liveEmpty) liveEmpty.classList.remove("hidden");
      if (liveCard) liveCard.classList.add("hidden");
      return;
    }
    if (liveTitle) liveTitle.textContent = `Logger ${loggerId} - Temperature (last 48h)`;
    if (liveRefresh) liveRefresh.classList.remove("hidden");
    const now = Math.floor(Date.now() / 1000);
    const from = now - 48 * 3600;
    try {
      const qs = new URLSearchParams({ id: loggerId, fromTime: String(from), toTime: String(now) });
      const res = await fetchJson(`/api/blu/measurements/?${qs.toString()}`);
      const points = (res.points || [])
        .filter((p) => p.utc)
        .sort((a, b) => a.utc - b.utc);
      if (!points.length) {
        if (liveCard) liveCard.classList.remove("hidden");
        if (liveCanvas) renderLineChart(liveCanvas, ["No data"], [null], "Temperature (C)");
        return;
      }
      const labels = points.map((p) => new Date(p.utc * 1000).toLocaleString());
      const temps = points.map((p) => p.t);
      if (liveCard) liveCard.classList.remove("hidden");
      liveChart = renderLineChart(liveCanvas, labels, temps, "Temperature (C)");
    } catch (err) {
      if (liveError) {
        liveError.textContent = "Failed to load measurements";
        liveError.classList.remove("hidden");
      }
    }
  };

  const loadHistory = async () => {
    const res = await fetchJson("/api/uploads/");
    const uploads = res.uploads || [];
    if (!uploads.length) {
      if (historyEmpty) historyEmpty.classList.remove("hidden");
      if (historyWrap) historyWrap.classList.add("hidden");
      return;
    }
    if (historyEmpty) historyEmpty.classList.add("hidden");
    if (historyWrap) historyWrap.classList.remove("hidden");
    if (historyBody) historyBody.innerHTML = "";
    uploads.forEach((u) => {
      const tr = document.createElement("tr");
      tr.className = "odd:bg-white even:bg-slate-50/70 hover:bg-auburn/5 cursor-pointer";
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
        await loadUpload(u.id, u.name);
      });
      historyBody.appendChild(tr);
    });
  };

  const updateUploadChart = () => {
    if (!uploadSeries.length) return;
    const intervalHours = uploadXInterval ? Number(uploadXInterval.value) : 1;
    const yStep = uploadYStep ? Number(uploadYStep.value) : undefined;
    const stepMs = (() => {
      if (uploadSeries.length < 2) return 3600000;
      return Math.max(1, uploadSeries[1].t - uploadSeries[0].t);
    })();
    const skip = Math.max(1, Math.round((intervalHours * 3600000) / stepMs));
    const labels = uploadSeries.map((p) => new Date(p.t).toLocaleString());
    const temps = uploadSeries.map((p) => p.temp);
    const xTickCallback = (val, idx) => (idx % skip === 0 ? labels[idx] : "");
    uploadChart = renderLineChart(uploadCanvas, labels, temps, "Temperature (C)", {
      xTickCallback,
      yStep,
    });
  };

  const loadUpload = async (id, name) => {
    try {
      const res = await fetchJson(`/api/uploads/${id}/`);
      const upload = res.upload;
      const headers = (upload.headers || []).map((h) => String(h || "").trim());
      const rows = upload.rows || [];
      const { timeCol, tempCol } = detectTimeAndTemp(headers, rows);
      uploadSeries = rows
        .map((r) => {
          const d = parseMaybeDate(r[timeCol]);
          if (!d) return null;
          return { t: d.getTime(), temp: toNum(r[tempCol]) };
        })
        .filter(Boolean)
        .sort((a, b) => a.t - b.t);
      if (!uploadSeries.length) {
        if (uploadError) {
          uploadError.textContent = "No temperature/time columns detected in this file.";
          uploadError.classList.remove("hidden");
        }
        return;
      }
      if (uploadTitle) uploadTitle.textContent = `Uploaded: ${name}`;
      if (uploadEmpty) uploadEmpty.classList.add("hidden");
      if (uploadWrap) uploadWrap.classList.remove("hidden");
      if (uploadError) uploadError.classList.add("hidden");
      updateUploadChart();
      const el = document.getElementById("uploaded-chart");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      if (uploadError) {
        uploadError.textContent = "Failed to load uploaded dataset.";
        uploadError.classList.remove("hidden");
      }
    }
  };

  if (liveRefresh) liveRefresh.addEventListener("click", loadLive);
  if (uploadXInterval) uploadXInterval.addEventListener("change", updateUploadChart);
  if (uploadYStep) uploadYStep.addEventListener("change", updateUploadChart);
  loadLive();
  loadHistory();
})();
