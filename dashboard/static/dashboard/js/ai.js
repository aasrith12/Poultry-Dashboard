(() => {
  const badge = document.getElementById("ai-active-badge");
  const cutoffInput = document.getElementById("cutoff");
  const empty = document.getElementById("ai-empty");
  const chartWrap = document.getElementById("ai-chart-wrap");
  const chartCanvas = document.getElementById("ai-chart");
  const metricsWrap = document.getElementById("ai-method1");
  const metricsGrid = document.getElementById("ai-metrics");
  const cutoffLabel = document.getElementById("ai-cutoff-label");
  const cutoffLabel2 = document.getElementById("ai-cutoff-label-2");
  const fefoWrap = document.getElementById("ai-method2");
  const fefoBody = document.getElementById("ai-fefo-body");
  const fefoSummary = document.getElementById("ai-fefo-summary");
  const devicesList = document.getElementById("ai-devices-list");
  const devicesLoading = document.getElementById("ai-devices-loading");
  const devicesEmpty = document.getElementById("ai-devices-empty");
  const historyList = document.getElementById("ai-history-list");
  const historyEmpty = document.getElementById("ai-history-empty");

  let chart = null;
  let activeSeries = [];
  let activeLabel = "Nothing selected";

  const fetchJson = async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Request failed");
    return res.json();
  };

  const toNum = (v) => {
    if (v === null || v === undefined) return null;
    const n = Number(String(v).trim());
    return Number.isFinite(n) ? n : null;
  };

  const parseMaybeDate = (v) => {
    if (!v && v !== 0) return null;
    if (v instanceof Date && !isNaN(v.getTime())) return v;
    const s = String(v).trim();
    if (!s) return null;
    const d1 = new Date(s);
    if (!isNaN(d1.getTime())) return d1;
    if (s.includes(" ")) {
      const d2 = new Date(s.replace(" ", "T"));
      if (!isNaN(d2.getTime())) return d2;
    }
    if (/^\d+$/.test(s)) {
      const n = Number(s);
      const guess = s.length >= 13 ? new Date(n) : new Date(n * 1000);
      if (!isNaN(guess.getTime())) return guess;
    }
    return null;
  };

  const detectColumns = (headers, rows) => {
    const sample = rows.slice(0, Math.min(200, rows.length));
    let timeCol = "";
    let bestScore = -1;
    headers.forEach((h) => {
      let s = 0;
      const ln = h.toLowerCase();
      if (/(time|timestamp|date|datetime)/i.test(ln)) s += 2;
      for (const r of sample) if (parseMaybeDate(r[h])) s++;
      if (s > bestScore) {
        bestScore = s;
        timeCol = h;
      }
    });
    if (!timeCol && headers.length) timeCol = headers[0];

    let tempCol = "";
    let tScore = -1;
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
    headers.forEach((h) => {
      const ln = h.toLowerCase();
      let s = 0;
      if (/(temp|temperature|degc|celsius)/i.test(ln)) s += 2;
      s += numericRatio(h) * 5;
      if (s > tScore) {
        tScore = s;
        tempCol = h;
      }
    });
    return { timeCol, tempCol };
  };

  const bucketMeanByInterval = (series, intervalMs) => {
    if (!series.length) return [];
    const sorted = [...series].sort((a, b) => a.t - b.t);
    const t0 = sorted[0].t;
    const buckets = new Map();
    sorted.forEach((p) => {
      if (p.temp == null || !Number.isFinite(p.temp)) return;
      const idx = Math.floor((p.t - t0) / intervalMs);
      const key = idx * intervalMs;
      const b = buckets.get(key) || { sum: 0, cnt: 0, tStart: t0 + key, tEnd: t0 + key + intervalMs };
      b.sum += p.temp;
      b.cnt += 1;
      buckets.set(key, b);
    });
    return Array.from(buckets.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, b]) => {
        const mid = Math.round((b.tStart + b.tEnd) / 2);
        const hrsFromStart = (mid - t0) / 3600000;
        return { tMid: mid, hourLabel: `${hrsFromStart.toFixed(2)}h`, meanC: b.cnt ? b.sum / b.cnt : NaN };
      });
  };

  const computeExposure = (series, cutoffC) => {
    if (!series || series.length < 2) {
      return { totalHours: 0, hoursAbove: 0, pctAbove: 0, excursions: 0, longestStreakHrs: 0, minTemp: NaN, maxTemp: NaN, avgTemp: NaN };
    }
    const pts = series.filter((p) => p.temp != null && Number.isFinite(p.temp)).sort((a, b) => a.t - b.t);
    if (pts.length < 2) {
      return { totalHours: 0, hoursAbove: 0, pctAbove: 0, excursions: 0, longestStreakHrs: 0, minTemp: NaN, maxTemp: NaN, avgTemp: NaN };
    }
    let totalDt = 0;
    let area = 0;
    let hoursAbove = 0;
    let excursions = 0;
    let longestStreakMs = 0;
    let currentStreakMs = 0;
    let minTemp = Infinity;
    let maxTemp = -Infinity;
    pts.forEach((p) => {
      minTemp = Math.min(minTemp, p.temp);
      maxTemp = Math.max(maxTemp, p.temp);
    });
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const dt = b.t - a.t;
      if (dt <= 0) continue;
      area += ((a.temp + b.temp) / 2) * dt;
      totalDt += dt;
      const aboveA = a.temp >= cutoffC;
      const aboveB = b.temp >= cutoffC;
      if (aboveA && aboveB) {
        hoursAbove += dt / 3600000;
        currentStreakMs += dt;
      } else if (!aboveA && !aboveB) {
        longestStreakMs = Math.max(longestStreakMs, currentStreakMs);
        currentStreakMs = 0;
      } else {
        const dy = b.temp - a.temp;
        const r = (cutoffC - a.temp) / dy;
        const tCross = a.t + r * dt;
        if (!aboveA && aboveB) {
          excursions++;
          const dtAbove = b.t - tCross;
          hoursAbove += dtAbove / 3600000;
          currentStreakMs = dtAbove;
        } else {
          const dtAbove = tCross - a.t;
          hoursAbove += dtAbove / 3600000;
          currentStreakMs += dtAbove;
          longestStreakMs = Math.max(longestStreakMs, currentStreakMs);
          currentStreakMs = 0;
        }
      }
    }
    longestStreakMs = Math.max(longestStreakMs, currentStreakMs);
    const totalHours = totalDt / 3600000;
    const avgTemp = totalDt > 0 ? area / totalDt : NaN;
    const pctAbove = totalHours > 0 ? (hoursAbove / totalHours) * 100 : 0;
    return {
      totalHours,
      hoursAbove,
      pctAbove,
      excursions,
      longestStreakHrs: longestStreakMs / 3600000,
      minTemp: minTemp === Infinity ? NaN : minTemp,
      maxTemp: maxTemp === -Infinity ? NaN : maxTemp,
      avgTemp,
    };
  };

  const renderChart = (bucketed) => {
    if (!chartCanvas) return;
    if (chartCanvas._chart) chartCanvas._chart.destroy();
    chartCanvas._chart = new Chart(chartCanvas, {
      type: "line",
      data: {
        labels: bucketed.map((b) => b.hourLabel),
        datasets: [
          {
            label: "Mean C",
            data: bucketed.map((b) => b.meanC),
            borderColor: "#1b3554",
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.2,
          },
        ],
      },
      options: { responsive: true, plugins: { legend: { display: true } } },
    });
  };

  const renderMetrics = (exposure) => {
    if (!metricsGrid) return;
    const cards = [
      { label: "Total span", value: `${exposure.totalHours.toFixed(2)} h` },
      { label: "Hours above", value: `${exposure.hoursAbove.toFixed(2)} h` },
      { label: "% time above", value: `${exposure.pctAbove.toFixed(1)}%` },
      { label: "Excursions", value: `${exposure.excursions}` },
      { label: "Longest streak", value: `${exposure.longestStreakHrs.toFixed(2)} h` },
      { label: "Min / Avg / Max", value: `${Number.isFinite(exposure.minTemp) ? exposure.minTemp.toFixed(2) : "-"} / ${Number.isFinite(exposure.avgTemp) ? exposure.avgTemp.toFixed(2) : "-"} / ${Number.isFinite(exposure.maxTemp) ? exposure.maxTemp.toFixed(2) : "-"} C` },
    ];
    metricsGrid.innerHTML = "";
    cards.forEach((c) => {
      const div = document.createElement("div");
      div.className = "rounded-xl border border-slate-200 p-3";
      div.innerHTML = `<div class="text-slate-500 text-xs mb-1">${c.label}</div><div class="text-lg font-semibold">${c.value}</div>`;
      metricsGrid.appendChild(div);
    });
  };

  const renderFefo = (exposure, cutoffC) => {
    if (!fefoBody || !fefoSummary) return;
    const timeAbove = exposure.hoursAbove;
    const shelfLifeDays = Math.max(-0.3796 * timeAbove + 7.1597, 0);
    const shelfLifeRemainingPct = (shelfLifeDays / 7.16) * 100;
    const shelfLifeReductionPct = 100 - shelfLifeRemainingPct;
    const samples = Array.from({ length: 500 }, () => shelfLifeDays + (Math.random() * 2 - 1));
    const riskOfLoss = (samples.filter((v) => v < 4).length / samples.length) * 100;

    const tableRows = [0, 2, 4, 6, 8].map((h) => {
      const y = Math.max(-0.3796 * h + 7.1597, 0);
      const yPct = (y / 7.16) * 100;
      const redPct = 100 - yPct;
      const sim = Array.from({ length: 500 }, () => y + (Math.random() * 2 - 1));
      const risk = (sim.filter((v) => v < 4).length / sim.length) * 100;
      return { h, risk, y, yPct, redPct };
    });

    fefoBody.innerHTML = "";
    tableRows.forEach((r) => {
      const tr = document.createElement("tr");
      tr.className = "odd:bg-white even:bg-slate-50";
      tr.innerHTML = `
        <td class="px-4 py-2 text-slate-700">${r.h}</td>
        <td class="px-4 py-2 text-slate-700">${r.risk.toFixed(1)}</td>
        <td class="px-4 py-2 text-slate-700">${r.y.toFixed(2)}</td>
        <td class="px-4 py-2 text-slate-700">${r.yPct.toFixed(1)}</td>
        <td class="px-4 py-2 text-slate-700">${r.redPct.toFixed(1)}</td>
      `;
      fefoBody.appendChild(tr);
    });

    fefoSummary.innerHTML = `
      <p>
        Based on <span class="font-medium">${timeAbove.toFixed(2)} hours</span> above
        <span class="text-auburn font-semibold">${cutoffC.toFixed(2)} C</span>,
        estimated shelf-life is <span class="font-semibold">${shelfLifeDays.toFixed(2)} days</span>
        (${shelfLifeRemainingPct.toFixed(1)}% remaining, ${shelfLifeReductionPct.toFixed(1)}% reduction).
        Simulated <span class="font-semibold">${riskOfLoss.toFixed(1)}%</span> risk of loss.
      </p>
    `;
  };

  const setActiveLabel = (label) => {
    activeLabel = label;
    if (badge) badge.textContent = label;
  };

  const updateView = () => {
    if (!activeSeries.length) {
      if (empty) empty.classList.remove("hidden");
      if (chartWrap) chartWrap.classList.add("hidden");
      if (metricsWrap) metricsWrap.classList.add("hidden");
      if (fefoWrap) fefoWrap.classList.add("hidden");
      return;
    }
    if (empty) empty.classList.add("hidden");
    if (chartWrap) chartWrap.classList.remove("hidden");
    const cutoffVal = Number(cutoffInput.value);
    if (!Number.isFinite(cutoffVal)) return;
    if (cutoffLabel) cutoffLabel.textContent = `${cutoffVal.toFixed(2)} C`;
    if (cutoffLabel2) cutoffLabel2.textContent = `${cutoffVal.toFixed(2)} C`;
    const bucketed = bucketMeanByInterval(activeSeries, 3600000);
    renderChart(bucketed);
    const exposure = computeExposure(activeSeries, cutoffVal);
    renderMetrics(exposure);
    renderFefo(exposure, cutoffVal);
    if (metricsWrap) metricsWrap.classList.remove("hidden");
    if (fefoWrap) fefoWrap.classList.remove("hidden");
  };

  const loadDevices = async () => {
    if (devicesLoading) devicesLoading.classList.remove("hidden");
    try {
      const res = await fetchJson("/api/blu/devices/");
      const devices = res.devices || [];
      if (!devices.length) {
        if (devicesEmpty) devicesEmpty.classList.remove("hidden");
        return;
      }
      devices.forEach((d) => {
        const btn = document.createElement("button");
        btn.className = "text-left px-3 py-2 rounded-lg border border-slate-200 hover:border-auburn/40";
        btn.textContent = d.label || d.id;
        btn.addEventListener("click", async () => {
          setActiveLabel(`BluConsole - Logger ${d.id}`);
          const now = Math.floor(Date.now() / 1000);
          const from = now - 48 * 3600;
          const qs = new URLSearchParams({ id: d.id, fromTime: String(from), toTime: String(now) });
          const meas = await fetchJson(`/api/blu/measurements/?${qs.toString()}`);
          activeSeries = (meas.points || [])
            .filter((p) => p.utc)
            .map((p) => ({ t: p.utc * 1000, temp: p.t }))
            .sort((a, b) => a.t - b.t);
          updateView();
        });
        if (devicesList) devicesList.appendChild(btn);
      });
    } catch {
      if (devicesEmpty) devicesEmpty.classList.remove("hidden");
    } finally {
      if (devicesLoading) devicesLoading.classList.add("hidden");
    }
  };

  const loadHistory = async () => {
    const res = await fetchJson("/api/uploads/");
    const uploads = res.uploads || [];
    if (!uploads.length) {
      if (historyEmpty) historyEmpty.classList.remove("hidden");
      return;
    }
    if (historyEmpty) historyEmpty.classList.add("hidden");
    uploads.forEach((u) => {
      const btn = document.createElement("button");
      btn.className = "text-left px-3 py-2 rounded-lg border border-slate-200 hover:border-auburn/40";
      btn.textContent = u.name;
      btn.addEventListener("click", async () => {
        const detail = await fetchJson(`/api/uploads/${u.id}/`);
        const upload = detail.upload;
        const headers = (upload.headers || []).map((h) => String(h || "").trim());
        const rows = upload.rows || [];
        const { timeCol, tempCol } = detectColumns(headers, rows);
        activeSeries = rows
          .map((r) => {
            const d = parseMaybeDate(r[timeCol]);
            const temp = toNum(r[tempCol]);
            return d ? { t: d.getTime(), temp } : null;
          })
          .filter(Boolean)
          .sort((a, b) => a.t - b.t);
        setActiveLabel(`Uploaded - ${u.name}`);
        updateView();
      });
      if (historyList) historyList.appendChild(btn);
    });
  };

  if (cutoffInput) cutoffInput.addEventListener("change", updateView);
  setActiveLabel(activeLabel);
  loadDevices();
  loadHistory();
})();
