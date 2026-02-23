(() => {
  const cutoffLinePlugin = {
    id: "cutoffLine",
    beforeDraw(chart, args, opts) {
      const value = opts?.value;
      if (value == null || Number.isNaN(value)) return;
      const y = chart.scales.y.getPixelForValue(value);
      const ctx = chart.ctx;
      ctx.save();
      ctx.strokeStyle = "#ea711a";
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(chart.chartArea.left, y);
      ctx.lineTo(chart.chartArea.right, y);
      ctx.stroke();
      ctx.restore();
    },
  };
  Chart.register(cutoffLinePlugin);
  const badge = document.getElementById("ai-active-badge");
  const cutoffInput = document.getElementById("cutoff");
  const xIntervalSelect = document.getElementById("ai-x-interval");
  const yStepSelect = document.getElementById("ai-y-step");
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
  const refTempInput = document.getElementById("ai-ref-temp");
  const baselineInput = document.getElementById("ai-baseline-life");
  const modelListBody = document.getElementById("ai-model-list-body");
  const selectedModelLabel = document.getElementById("ai-selected-model-label");
  const modelConfidenceNote = document.getElementById("ai-model-confidence-note");
  const confidenceHelpOpen = document.getElementById("ai-confidence-help-open");
  const confidenceHelpModal = document.getElementById("ai-confidence-help-modal");
  const confidenceHelpBackdrop = document.getElementById("ai-confidence-help-backdrop");
  const confidenceHelpClose = document.getElementById("ai-confidence-help-close");
  const modelComparisonOpen = document.getElementById("ai-model-comparison-open");
  const modelComparisonModal = document.getElementById("ai-model-comparison-modal");
  const modelComparisonBackdrop = document.getElementById("ai-model-comparison-backdrop");
  const modelComparisonClose = document.getElementById("ai-model-comparison-close");
  const modelComparisonBody = document.getElementById("ai-model-comparison-body");
  const modelComparisonSummary = document.getElementById("ai-model-comparison-summary");
  const modelPanels = document.querySelectorAll("[data-ai-model-panel]");
  const modelAvgQ10 = document.getElementById("ai-model-avgq10");
  const modelQ10Int = document.getElementById("ai-model-q10int");
  const modelArrInt = document.getElementById("ai-model-arrint");
  const modelMktQ10 = document.getElementById("ai-model-mktq10");
  const modelMktArr = document.getElementById("ai-model-mktarr");
  const reportDownload = document.getElementById("ai-report-download");
  const devicesList = document.getElementById("ai-devices-list");
  const devicesLoading = document.getElementById("ai-devices-loading");
  const devicesEmpty = document.getElementById("ai-devices-empty");
  const historyList = document.getElementById("ai-history-list");
  const historyEmpty = document.getElementById("ai-history-empty");

  let chart = null;
  let activeSeries = [];
  let activeLabel = "Nothing selected";
  let activeModel = "fefo";
  let lastFefoMetrics = null;
  let lastReport = null;

  const DEFAULT_Q10 = 3.0;
  const DEFAULT_EA = 90000.0;
  const GAS_R = 8.314;
  const MODEL_LABELS = {
    fefo: "FEFO (Monte Carlo)",
    avgq10: "Avg Temp + Q10",
    q10int: "Q10 Integrated",
    arrint: "Arrhenius Integrated",
    mktq10: "MKT + Q10",
    mktarr: "MKT + Arrhenius",
  };

  const fetchJson = async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Request failed");
    return res.json();
  };

  const setConfidenceHelpModalOpen = (open) => {
    if (!confidenceHelpModal) return;
    confidenceHelpModal.classList.toggle("hidden", !open);
    document.body.classList.toggle("overflow-hidden", open);
  };

  const setModelComparisonModalOpen = (open) => {
    if (!modelComparisonModal) return;
    modelComparisonModal.classList.toggle("hidden", !open);
    document.body.classList.toggle("overflow-hidden", open);
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
    // Time-only (HH:MM or HH:MM:SS)
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
      // Excel time fraction or date serial
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

  const prepareIntervals = (series) => {
    if (!series || series.length < 2) return { temps: [], dtDays: [], totalDays: 0 };
    const sorted = [...series]
      .filter((p) => p && p.temp != null && Number.isFinite(p.temp) && Number.isFinite(p.t))
      .sort((a, b) => a.t - b.t);
    const temps = [];
    const dtDays = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      const dtMs = b.t - a.t;
      if (dtMs <= 0) continue;
      temps.push(a.temp);
      dtDays.push(dtMs / 86400000);
    }
    const totalDays = dtDays.reduce((sum, v) => sum + v, 0);
    return { temps, dtDays, totalDays };
  };

  const rrQ10 = (T, Tref, Q10) => Math.pow(Q10, (T - Tref) / 10.0);

  const rrArrhenius = (T, Tref, Ea) => {
    const Tk = T + 273.15;
    const TrefK = Tref + 273.15;
    return Math.exp(-(Ea / GAS_R) * ((1 / Tk) - (1 / TrefK)));
  };

  const computeMkt = (temps, dtDays, Ea) => {
    if (!temps.length) return null;
    const total = dtDays.reduce((sum, v) => sum + v, 0);
    if (!total) return null;
    const weights = dtDays.map((v) => v / total);
    const B = Ea / GAS_R;
    let inner = 0;
    for (let i = 0; i < temps.length; i++) {
      const Tk = temps[i] + 273.15;
      inner += weights[i] * Math.exp(-B / Tk);
    }
    if (inner <= 0) return null;
    const TmktK = -B / Math.log(inner);
    return TmktK - 273.15;
  };

  const clampDays = (v) => (Number.isFinite(v) ? Math.max(v, 0) : NaN);

  const renderModelSummary = (el, title, summary) => {
    if (!el) return;
    el.innerHTML = `
      <div class="text-slate-500 text-xs uppercase tracking-wide mb-2">${title}</div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        ${summary
          .map(
            (item) => `
            <div class="rounded-lg border border-slate-200 p-3">
              <div class="text-[11px] text-slate-500 mb-1">${item.label}</div>
              <div class="text-base font-semibold">${item.value}</div>
            </div>
          `
          )
          .join("")}
      </div>
      <div class="mt-3 text-[13px] text-slate-600">
        Assumptions: baseline life at reference temp; Q10=${DEFAULT_Q10.toFixed(1)}, Ea=${DEFAULT_EA.toFixed(0)} J/mol.
      </div>
    `;
  };

  const renderChart = (bucketed, cutoffVal, yStep) => {
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
      options: {
        responsive: true,
        plugins: {
          legend: { display: true },
          cutoffLine: { value: cutoffVal },
        },
        scales: {
          y: {
            ticks: {
              stepSize: yStep || undefined,
            },
          },
        },
      },
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

  const renderFefo = (series, refTemp, baselineLife) => {
    if (!fefoBody || !fefoSummary) return null;
    const { temps, dtDays, totalDays } = prepareIntervals(series);
    if (!temps.length || !totalDays) return null;

    const teq = dtDays.reduce(
      (sum, dt, i) => sum + dt * rrQ10(temps[i], refTemp, DEFAULT_Q10),
      0
    );
    const remaining = clampDays(baselineLife - teq);
    const remainingPct = baselineLife > 0 ? (remaining / baselineLife) * 100 : 0;
    const reductionPct = 100 - remainingPct;

    const samples = Array.from({ length: 500 }, () => remaining + (Math.random() * 2 - 1));
    const riskOfLoss = (samples.filter((v) => v < 4).length / samples.length) * 100;

    fefoBody.innerHTML = "";
    const tr = document.createElement("tr");
    tr.className = "odd:bg-white even:bg-slate-50";
    tr.innerHTML = `
      <td class="px-4 py-2 text-slate-700">${teq.toFixed(2)}</td>
      <td class="px-4 py-2 text-slate-700">${riskOfLoss.toFixed(1)}</td>
      <td class="px-4 py-2 text-slate-700">${remaining.toFixed(2)}</td>
      <td class="px-4 py-2 text-slate-700">${remainingPct.toFixed(1)}</td>
      <td class="px-4 py-2 text-slate-700">${reductionPct.toFixed(1)}</td>
    `;
    fefoBody.appendChild(tr);

    fefoSummary.innerHTML = `
      <p>
        FEFO uses Q10-integrated equivalent time at the reference temperature.
        Equivalent time: <span class="font-semibold">${teq.toFixed(2)} days</span> at
        <span class="text-auburn font-semibold">${refTemp.toFixed(2)} C</span>.
        Estimated remaining life: <span class="font-semibold">${remaining.toFixed(2)} days</span>
        (${remainingPct.toFixed(1)}% remaining).
        Simulated <span class="font-semibold">${riskOfLoss.toFixed(1)}%</span> risk of loss.
      </p>
    `;
    return { teq, riskOfLoss, remaining, remainingPct, reductionPct };
  };

  const renderModelListTable = (rows) => {
    if (!modelListBody) return;
    modelListBody.innerHTML = "";
    rows.forEach((row) => {
      const tr = document.createElement("tr");
      tr.dataset.aiModelRow = row.key;
      tr.tabIndex = 0;
      tr.className =
        "cursor-pointer border-t border-slate-100 focus:outline-none focus:ring-2 focus:ring-auburn/30 odd:bg-white even:bg-slate-50";
      tr.innerHTML = `
        <td class="px-4 py-2 text-slate-800">${row.label}</td>
        <td class="px-4 py-2 text-slate-700">${row.remaining}</td>
        <td class="px-4 py-2 text-slate-700">${row.confidence}</td>
      `;
      if (row.reason) tr.title = row.reason;
      modelListBody.appendChild(tr);
    });
  };

  const clampPct = (v) => Math.max(0, Math.min(100, v));

  const computeSamplingQuality = (series) => {
    const sorted = [...(series || [])].filter((p) => Number.isFinite(p?.t)).sort((a, b) => a.t - b.t);
    if (sorted.length < 2) {
      return { pointCount: sorted.length, spanHours: 0, medianGapHours: 0, maxGapHours: 0 };
    }
    const gaps = [];
    for (let i = 1; i < sorted.length; i++) {
      const gapH = (sorted[i].t - sorted[i - 1].t) / 3600000;
      if (gapH > 0) gaps.push(gapH);
    }
    const sortedGaps = [...gaps].sort((a, b) => a - b);
    const medianGapHours = sortedGaps.length
      ? sortedGaps[Math.floor(sortedGaps.length / 2)]
      : 0;
    return {
      pointCount: sorted.length,
      spanHours: (sorted[sorted.length - 1].t - sorted[0].t) / 3600000,
      medianGapHours,
      maxGapHours: sortedGaps.length ? sortedGaps[sortedGaps.length - 1] : 0,
    };
  };

  const computeModelConfidenceMap = ({
    series,
    baselineLife,
    cutoff,
    temps,
    dtDays,
    remainingByModel,
    exposure,
    totalDays,
  }) => {
    const sampling = computeSamplingQuality(series);
    const weightedAvg =
      totalDays > 0 ? temps.reduce((sum, t, i) => sum + t * dtDays[i], 0) / totalDays : NaN;
    const variance =
      totalDays > 0
        ? temps.reduce((sum, t, i) => sum + Math.pow(t - weightedAvg, 2) * dtDays[i], 0) / totalDays
        : NaN;
    const tempStd = Number.isFinite(variance) ? Math.sqrt(Math.max(variance, 0)) : NaN;

    const finiteRemainings = Object.values(remainingByModel).filter((v) => Number.isFinite(v));
    const meanRemaining = finiteRemainings.length
      ? finiteRemainings.reduce((a, b) => a + b, 0) / finiteRemainings.length
      : NaN;
    const disagreement = finiteRemainings.length
      ? Math.max(...finiteRemainings) - Math.min(...finiteRemainings)
      : NaN;
    const disagreementPctOfBaseline =
      Number.isFinite(disagreement) && baselineLife > 0 ? (disagreement / baselineLife) * 100 : 0;

    const globalPenalties = [];
    let globalPenalty = 0;
    if (sampling.pointCount < 8) {
      globalPenalty += 30;
      globalPenalties.push("very few readings");
    } else if (sampling.pointCount < 20) {
      globalPenalty += 15;
      globalPenalties.push("limited readings");
    }
    if (sampling.maxGapHours > 8) {
      globalPenalty += 20;
      globalPenalties.push("long data gaps");
    } else if (sampling.maxGapHours > 3) {
      globalPenalty += 10;
      globalPenalties.push("some data gaps");
    }
    if (sampling.spanHours < 2) {
      globalPenalty += 12;
      globalPenalties.push("short monitoring window");
    }
    if (disagreementPctOfBaseline > 70) {
      globalPenalty += 18;
      globalPenalties.push("models disagree strongly");
    } else if (disagreementPctOfBaseline > 35) {
      globalPenalty += 10;
      globalPenalties.push("moderate model disagreement");
    }

    const hotExcursions = Number.isFinite(exposure?.excursions) ? exposure.excursions : 0;
    const pctAbove = Number.isFinite(exposure?.pctAbove) ? exposure.pctAbove : 0;
    const overCutoffMax =
      Number.isFinite(exposure?.maxTemp) && Number.isFinite(cutoff) ? Math.max(0, exposure.maxTemp - cutoff) : 0;

    const scoreFor = (key) => {
      let score = 88 - globalPenalty;
      const reasons = [];
      if (globalPenalties.length) reasons.push(...globalPenalties);
      if (Number.isFinite(meanRemaining) && Number.isFinite(remainingByModel[key])) {
        const delta = Math.abs(remainingByModel[key] - meanRemaining);
        const deltaPct = baselineLife > 0 ? (delta / baselineLife) * 100 : 0;
        if (deltaPct > 35) {
          score -= 14;
          reasons.push("far from other model estimates");
        } else if (deltaPct > 18) {
          score -= 7;
          reasons.push("some disagreement vs other models");
        }
      }

      if (key === "avgq10") {
        if (Number.isFinite(tempStd) && tempStd > 5) {
          score -= 16;
          reasons.push("high temperature variability reduces average-temp reliability");
        } else if (Number.isFinite(tempStd) && tempStd > 2.5) {
          score -= 8;
          reasons.push("moderate temperature swings");
        }
        if (hotExcursions >= 4) {
          score -= 8;
          reasons.push("multiple excursions favor integrated models");
        }
      }
      if (key === "q10int" || key === "arrint") {
        if (sampling.maxGapHours <= 2 && sampling.pointCount >= 20) {
          score += 5;
          reasons.push("good time-series coverage supports integrated model");
        }
        if (sampling.maxGapHours > 6) {
          score -= 6;
          reasons.push("integration confidence reduced by gaps");
        }
      }
      if (key === "mktq10" || key === "mktarr") {
        if (hotExcursions >= 2 || pctAbove > 10 || overCutoffMax > 4) {
          score += 6;
          reasons.push("spike-sensitive profile suits MKT weighting");
        } else {
          score -= 5;
          reasons.push("limited spike behavior reduces MKT advantage");
        }
      }
      if (key === "fefo") {
        if (Number.isFinite(lastFefoMetrics?.riskOfLoss) && (lastFefoMetrics.riskOfLoss === 0 || lastFefoMetrics.riskOfLoss === 100)) {
          score -= 4;
          reasons.push("FEFO risk is threshold-sensitive in this simplified simulation");
        }
      }
      if (pctAbove > 60) {
        score -= 4;
        reasons.push("extreme warm exposure increases uncertainty in shelf-life assumptions");
      }
      score = Math.round(clampPct(score));
      const reasonText = reasons.length
        ? reasons.slice(0, 3).join("; ")
        : "Good data coverage and model agreement";
      return { score, reason: reasonText };
    };

    return {
      fefo: scoreFor("fefo"),
      avgq10: scoreFor("avgq10"),
      q10int: scoreFor("q10int"),
      arrint: scoreFor("arrint"),
      mktq10: scoreFor("mktq10"),
      mktarr: scoreFor("mktarr"),
    };
  };

  const buildModelComparison = ({
    baselineLife,
    remainingByModel,
    confidenceByModel,
    exposure,
    cutoff,
    tempStdC,
    maxGapHours,
  }) => {
    const keys = ["fefo", "avgq10", "q10int", "arrint", "mktq10", "mktarr"];
    const finiteRemainings = keys.map((k) => remainingByModel[k]).filter((v) => Number.isFinite(v));
    const consensus = finiteRemainings.length
      ? [...finiteRemainings].sort((a, b) => a - b)[Math.floor(finiteRemainings.length / 2)]
      : NaN;
    const spread = finiteRemainings.length ? Math.max(...finiteRemainings) - Math.min(...finiteRemainings) : NaN;
    const spreadPct = Number.isFinite(spread) && baselineLife > 0 ? (spread / baselineLife) * 100 : 0;
    const hasSpikes =
      (Number.isFinite(exposure?.excursions) && exposure.excursions >= 2) ||
      (Number.isFinite(exposure?.pctAbove) && exposure.pctAbove > 10) ||
      (Number.isFinite(exposure?.maxTemp) && Number.isFinite(cutoff) && exposure.maxTemp - cutoff > 4);
    const tempStd = Number.isFinite(tempStdC) ? tempStdC : NaN;

    const rows = keys.map((key) => {
      const remaining = remainingByModel[key];
      const reductionPct =
        Number.isFinite(remaining) && baselineLife > 0 ? Math.max(0, (1 - remaining / baselineLife) * 100) : NaN;
      const conf = confidenceByModel[key]?.score ?? NaN;
      const delta = Number.isFinite(consensus) && Number.isFinite(remaining) ? remaining - consensus : NaN;
      const deltaAbsPct = Number.isFinite(delta) && baselineLife > 0 ? (Math.abs(delta) / baselineLife) * 100 : NaN;
      const agreementScore = Number.isFinite(deltaAbsPct) ? Math.round(clampPct(100 - deltaAbsPct * 2.2)) : NaN;
      let biasLabel = "N/A";
      if (Number.isFinite(delta)) {
        if (delta > 0.4) biasLabel = `Optimistic (+${delta.toFixed(2)} d)`;
        else if (delta < -0.4) biasLabel = `Conservative (${delta.toFixed(2)} d)`;
        else biasLabel = `Neutral (${delta.toFixed(2)} d)`;
      }

      let suitabilityBonus = 0;
      if (key === "avgq10" && Number.isFinite(tempStd)) suitabilityBonus += tempStd < 2.5 ? 6 : tempStd > 5 ? -8 : 0;
      if ((key === "q10int" || key === "arrint") && Number.isFinite(maxGapHours)) {
        suitabilityBonus += maxGapHours <= 2 ? 8 : maxGapHours > 6 ? -8 : 0;
      }
      if ((key === "mktq10" || key === "mktarr")) suitabilityBonus += hasSpikes ? 8 : -5;
      if (key === "fefo") suitabilityBonus += Number.isFinite(lastFefoMetrics?.riskOfLoss) ? -2 : 0;

      const rankScore = (Number.isFinite(conf) ? conf * 0.55 : 0) + (Number.isFinite(agreementScore) ? agreementScore * 0.35 : 0) + 10 + suitabilityBonus;
      return {
        key,
        model: MODEL_LABELS[key],
        refShelfLife: baselineLife,
        remaining,
        reductionPct,
        confidence: conf,
        agreementScore,
        biasLabel,
        rankScore,
      };
    });

    rows.sort((a, b) => (b.rankScore || -Infinity) - (a.rankScore || -Infinity));
    rows.forEach((row, idx) => {
      row.rank = idx + 1;
    });

    const best = rows[0];
    const summaryParts = [];
    if (best) {
      summaryParts.push(
        `Rank #1 (heuristic) is ${best.model} because it combines ${Number.isFinite(best.confidence) ? `${best.confidence}% confidence` : "available confidence"}`
      );
      if (Number.isFinite(best.agreementScore)) summaryParts.push(`${best.agreementScore}% agreement score`);
      summaryParts.push(`and a profile-suitability advantage for this dataset shape.`);
    }
    if (Number.isFinite(spreadPct)) {
      if (spreadPct > 35) summaryParts.push(`Model spread is high (${spreadPct.toFixed(1)}% of baseline life), so compare results cautiously.`);
      else summaryParts.push(`Model spread is moderate (${spreadPct.toFixed(1)}% of baseline life), so consensus is relatively stable.`);
    }

    return {
      rows,
      summary: summaryParts.join(" "),
    };
  };

  const renderModelComparisonModal = () => {
    if (!modelComparisonBody || !modelComparisonSummary) return;
    if (!lastReport?.comparisonTable) {
      modelComparisonBody.innerHTML = `
        <tr><td colspan="12" class="px-4 py-3 text-slate-500">Run an estimation first to view the model comparison table.</td></tr>
      `;
      modelComparisonSummary.textContent = "No comparison yet.";
      return;
    }
    const fmt = (v, digits = 2) => (Number.isFinite(v) ? Number(v).toFixed(digits) : "N/A");
    modelComparisonBody.innerHTML = "";
    lastReport.comparisonTable.rows.forEach((row) => {
      const tr = document.createElement("tr");
      tr.className = "border-t border-slate-100 odd:bg-white even:bg-slate-50";
      tr.innerHTML = `
        <td class="px-3 py-2">${row.model}</td>
        <td class="px-3 py-2">${fmt(row.refShelfLife)}</td>
        <td class="px-3 py-2">${fmt(row.remaining)}</td>
        <td class="px-3 py-2">${fmt(row.reductionPct, 1)}</td>
        <td class="px-3 py-2">${fmt(row.confidence, 0)}</td>
        <td class="px-3 py-2">${fmt(row.agreementScore, 0)}</td>
        <td class="px-3 py-2">${row.biasLabel}</td>
        <td class="px-3 py-2 text-slate-500">N/A*</td>
        <td class="px-3 py-2 text-slate-500">N/A*</td>
        <td class="px-3 py-2 text-slate-500">N/A*</td>
        <td class="px-3 py-2 text-slate-500">N/A*</td>
        <td class="px-3 py-2 font-semibold ${row.rank === 1 ? "text-auburn" : ""}">#${row.rank}</td>
      `;
      modelComparisonBody.appendChild(tr);
    });
    modelComparisonSummary.textContent = lastReport.comparisonTable.summary || "Ranking is based on heuristic comparison.";
  };

  const renderShelfLifeModels = () => {
    if (!activeSeries.length) return;
    const refTemp = refTempInput ? Number(refTempInput.value) : 5.0;
    const baselineLife = baselineInput ? Number(baselineInput.value) : 7.16;
    const refTempSafe = Number.isFinite(refTemp) ? refTemp : 5.0;
    const baselineSafe = Number.isFinite(baselineLife) ? baselineLife : 7.16;
    const { temps, dtDays, totalDays } = prepareIntervals(activeSeries);
    if (!temps.length || !totalDays) return;
    const fmt = (v, digits = 2) => (Number.isFinite(v) ? v.toFixed(digits) : "-");

    const totalHours = totalDays * 24;
    const Tavg = temps.reduce((sum, t, i) => sum + t * dtDays[i], 0) / totalDays;

    const teqAvgQ10 = totalDays * rrQ10(Tavg, refTempSafe, DEFAULT_Q10);
    const LavgQ10 = clampDays(baselineSafe - teqAvgQ10);

    const teqQ10 = dtDays.reduce(
      (sum, dt, i) => sum + dt * rrQ10(temps[i], refTempSafe, DEFAULT_Q10),
      0
    );
    const Lq10 = clampDays(baselineSafe - teqQ10);

    const teqArr = dtDays.reduce(
      (sum, dt, i) => sum + dt * rrArrhenius(temps[i], refTempSafe, DEFAULT_EA),
      0
    );
    const Larr = clampDays(baselineSafe - teqArr);

    const Tmkt = computeMkt(temps, dtDays, DEFAULT_EA);
    const teqMktQ10 = Tmkt == null ? NaN : totalDays * rrQ10(Tmkt, refTempSafe, DEFAULT_Q10);
    const LmktQ10 = clampDays(baselineSafe - teqMktQ10);
    const teqMktArr = Tmkt == null ? NaN : totalDays * rrArrhenius(Tmkt, refTempSafe, DEFAULT_EA);
    const LmktArr = clampDays(baselineSafe - teqMktArr);
    const exposure = computeExposure(activeSeries, Number(cutoffInput?.value));
    const remainingByModel = {
      fefo: Number.isFinite(lastFefoMetrics?.remaining) ? lastFefoMetrics.remaining : NaN,
      avgq10: LavgQ10,
      q10int: Lq10,
      arrint: Larr,
      mktq10: LmktQ10,
      mktarr: LmktArr,
    };
    const confidenceByModel = computeModelConfidenceMap({
      series: activeSeries,
      baselineLife: baselineSafe,
      cutoff: Number(cutoffInput?.value),
      temps,
      dtDays,
      remainingByModel,
      exposure,
      totalDays,
    });
    const sampling = computeSamplingQuality(activeSeries);
    const tempVariance =
      totalDays > 0
        ? temps.reduce((sum, t, i) => sum + Math.pow(t - Tavg, 2) * dtDays[i], 0) / totalDays
        : NaN;
    const tempStdC = Number.isFinite(tempVariance) ? Math.sqrt(Math.max(tempVariance, 0)) : NaN;

    lastReport = {
      label: activeLabel,
      refTemp: refTempSafe,
      baselineLife: baselineSafe,
      totalHours,
      totalDays,
      Tavg,
      teqAvgQ10,
      teqQ10,
      teqArr,
      Tmkt,
      teqMktQ10,
      teqMktArr,
      LavgQ10,
      Lq10,
      Larr,
      LmktQ10,
      LmktArr,
      confidenceByModel,
      maxGapHours: sampling.maxGapHours,
      pointCount: sampling.pointCount,
      tempStdC,
      fefoRemaining: lastFefoMetrics?.remaining,
      fefoTeq: lastFefoMetrics?.teq,
      fefoRiskOfLoss: lastFefoMetrics?.riskOfLoss,
      cutoff: Number(cutoffInput?.value),
      Q10: DEFAULT_Q10,
      Ea: DEFAULT_EA,
      generatedAt: new Date().toISOString(),
    };
    lastReport.comparisonTable = buildModelComparison({
      baselineLife: baselineSafe,
      remainingByModel,
      confidenceByModel,
      exposure,
      cutoff: Number(cutoffInput?.value),
      tempStdC,
      maxGapHours: sampling.maxGapHours,
    });
    renderModelComparisonModal();

    renderModelListTable([
      {
        key: "fefo",
        label: MODEL_LABELS.fefo,
        remaining: `${fmt(lastFefoMetrics?.remaining)} d`,
        confidence: `${confidenceByModel.fefo.score}`,
        reason: confidenceByModel.fefo.reason,
      },
      {
        key: "avgq10",
        label: MODEL_LABELS.avgq10,
        remaining: `${fmt(LavgQ10)} d`,
        confidence: `${confidenceByModel.avgq10.score}`,
        reason: confidenceByModel.avgq10.reason,
      },
      {
        key: "q10int",
        label: MODEL_LABELS.q10int,
        remaining: `${fmt(Lq10)} d`,
        confidence: `${confidenceByModel.q10int.score}`,
        reason: confidenceByModel.q10int.reason,
      },
      {
        key: "arrint",
        label: MODEL_LABELS.arrint,
        remaining: `${fmt(Larr)} d`,
        confidence: `${confidenceByModel.arrint.score}`,
        reason: confidenceByModel.arrint.reason,
      },
      {
        key: "mktq10",
        label: MODEL_LABELS.mktq10,
        remaining: `${fmt(LmktQ10)} d`,
        confidence: `${confidenceByModel.mktq10.score}`,
        reason: confidenceByModel.mktq10.reason,
      },
      {
        key: "mktarr",
        label: MODEL_LABELS.mktarr,
        remaining: `${fmt(LmktArr)} d`,
        confidence: `${confidenceByModel.mktarr.score}`,
        reason: confidenceByModel.mktarr.reason,
      },
    ]);
    setActiveModel(activeModel);

    renderModelSummary(modelAvgQ10, "Average Temperature + Q10", [
      { label: "Total span", value: `${totalHours.toFixed(2)} h` },
      { label: "Time-weighted avg temp", value: `${fmt(Tavg)} C` },
      { label: "Equivalent time @ ref", value: `${fmt(teqAvgQ10)} d` },
      { label: "Remaining shelf life", value: `${fmt(LavgQ10)} d` },
    ]);

    renderModelSummary(modelQ10Int, "Q10 Integrated (time-step)", [
      { label: "Total span", value: `${totalHours.toFixed(2)} h` },
      { label: "Equivalent time @ ref", value: `${fmt(teqQ10)} d` },
      { label: "Remaining shelf life", value: `${fmt(Lq10)} d` },
      { label: "Reference temp", value: `${fmt(refTempSafe)} C` },
    ]);

    renderModelSummary(modelArrInt, "Arrhenius Integrated", [
      { label: "Total span", value: `${totalHours.toFixed(2)} h` },
      { label: "Equivalent time @ ref", value: `${fmt(teqArr)} d` },
      { label: "Remaining shelf life", value: `${fmt(Larr)} d` },
      { label: "Reference temp", value: `${fmt(refTempSafe)} C` },
    ]);

    renderModelSummary(modelMktQ10, "Mean Kinetic Temperature + Q10", [
      { label: "Total span", value: `${totalHours.toFixed(2)} h` },
      { label: "MKT", value: `${fmt(Tmkt)} C` },
      { label: "Equivalent time @ ref", value: `${fmt(teqMktQ10)} d` },
      { label: "Remaining shelf life", value: `${fmt(LmktQ10)} d` },
    ]);

    renderModelSummary(modelMktArr, "Mean Kinetic Temperature + Arrhenius", [
      { label: "Total span", value: `${totalHours.toFixed(2)} h` },
      { label: "MKT", value: `${fmt(Tmkt)} C` },
      { label: "Equivalent time @ ref", value: `${fmt(teqMktArr)} d` },
      { label: "Remaining shelf life", value: `${fmt(LmktArr)} d` },
    ]);
  };

  const setActiveModel = (model) => {
    activeModel = model;
    const modelRows = document.querySelectorAll("[data-ai-model-row]");
    modelRows.forEach((row) => {
      const isActive = row.dataset.aiModelRow === model;
      row.classList.toggle("bg-auburn/10", isActive);
      row.classList.toggle("ring-1", isActive);
      row.classList.toggle("ring-inset", isActive);
      row.classList.toggle("ring-auburn/30", isActive);
      row.classList.toggle("text-auburn", isActive);
    });
    if (selectedModelLabel) {
      selectedModelLabel.textContent = MODEL_LABELS[model] || MODEL_LABELS.fefo;
    }
    if (modelConfidenceNote) {
      const c = lastReport?.confidenceByModel?.[model];
      modelConfidenceNote.textContent = c
        ? `Heuristic confidence: ${c.score}% (${c.reason}).`
        : "";
    }
    modelPanels.forEach((panel) => {
      panel.classList.toggle("hidden", panel.dataset.aiModelPanel !== model);
    });
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
    const intervalHours = xIntervalSelect ? Number(xIntervalSelect.value) : 1;
    const bucketed = bucketMeanByInterval(activeSeries, intervalHours * 3600000);
    const yStep = yStepSelect ? Number(yStepSelect.value) : undefined;
    renderChart(bucketed, cutoffVal, yStep);
    const exposure = computeExposure(activeSeries, cutoffVal);
    renderMetrics(exposure);
    const refTemp = refTempInput ? Number(refTempInput.value) : 5.0;
    const baselineLife = baselineInput ? Number(baselineInput.value) : 7.16;
    const refTempSafe = Number.isFinite(refTemp) ? refTemp : 5.0;
    const baselineSafe = Number.isFinite(baselineLife) ? baselineLife : 7.16;
    lastFefoMetrics = renderFefo(activeSeries, refTempSafe, baselineSafe);
    renderShelfLifeModels();
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
  if (xIntervalSelect) xIntervalSelect.addEventListener("change", updateView);
  if (yStepSelect) yStepSelect.addEventListener("change", updateView);
  if (refTempInput) refTempInput.addEventListener("change", updateView);
  if (baselineInput) baselineInput.addEventListener("change", updateView);
  if (reportDownload) {
    reportDownload.addEventListener("click", () => {
      if (!lastReport) return;
      const fmt = (v, digits = 2) => (Number.isFinite(v) ? v.toFixed(digits) : "-");
      const lines = [
        "Poultry Dashboard - Detailed Calculation Report",
        `Generated: ${lastReport.generatedAt}`,
        `Dataset: ${lastReport.label}`,
        "",
        "Inputs",
        `- Reference temperature (C): ${fmt(lastReport.refTemp)}`,
        `- Baseline life (days): ${fmt(lastReport.baselineLife)}`,
        `- Cut-off (C): ${fmt(lastReport.cutoff)}`,
        `- Q10: ${fmt(lastReport.Q10, 1)}`,
        `- Ea (J/mol): ${fmt(lastReport.Ea, 0)}`,
        "",
        "Formulas (summary)",
        "1) Equivalent time at reference:",
        "   t_eq = sum(dt_i * RR(T_i))",
        "2) Q10 rate:",
        "   RR_Q10(T) = Q10^((T - T_ref)/10)",
        "3) Arrhenius rate:",
        "   RR_Arr(T) = exp(-(Ea/R) * (1/T_K - 1/T_ref,K))",
        "4) MKT:",
        "   B = Ea/R; w_i = dt_i / sum(dt_i)",
        "   T_MKT = -B / ln(sum(w_i * exp(-B / T_i,K)))",
        "5) Remaining shelf life:",
        "   L_remaining = L_ref - t_eq",
        "",
        "Summary",
        `- Total span: ${fmt(lastReport.totalHours)} h`,
        `- Time-weighted average temp: ${fmt(lastReport.Tavg)} C`,
        `- Mean kinetic temp (MKT): ${fmt(lastReport.Tmkt)} C`,
        "",
        "Equivalent Time @ Reference (days)",
        `- Avg Temp + Q10: ${fmt(lastReport.teqAvgQ10)}`,
        `- Q10 Integrated: ${fmt(lastReport.teqQ10)}`,
        `- Arrhenius Integrated: ${fmt(lastReport.teqArr)}`,
        `- MKT + Q10: ${fmt(lastReport.teqMktQ10)}`,
        `- MKT + Arrhenius: ${fmt(lastReport.teqMktArr)}`,
        "",
        "Remaining Shelf Life (days)",
        `- Avg Temp + Q10: ${fmt(lastReport.LavgQ10)}`,
        `- Q10 Integrated: ${fmt(lastReport.Lq10)}`,
        `- Arrhenius Integrated: ${fmt(lastReport.Larr)}`,
        `- MKT + Q10: ${fmt(lastReport.LmktQ10)}`,
        `- MKT + Arrhenius: ${fmt(lastReport.LmktArr)}`,
        "",
        "Notes",
        "- Equivalent time uses time-step integration over the active chart data.",
        "- Baseline life only affects remaining days calculations.",
      ];
      const blob = new Blob([lines.join("\n")], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `poultry-calculation-report-${new Date().toISOString().slice(0, 10)}.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  }
  if (modelListBody) {
    modelListBody.addEventListener("click", (e) => {
      const row = e.target.closest("[data-ai-model-row]");
      if (!row) return;
      setActiveModel(row.dataset.aiModelRow || "fefo");
    });
    modelListBody.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const row = e.target.closest("[data-ai-model-row]");
      if (!row) return;
      e.preventDefault();
      setActiveModel(row.dataset.aiModelRow || "fefo");
    });
  }
  if (confidenceHelpOpen) {
    confidenceHelpOpen.addEventListener("click", () => setConfidenceHelpModalOpen(true));
  }
  if (confidenceHelpClose) {
    confidenceHelpClose.addEventListener("click", () => setConfidenceHelpModalOpen(false));
  }
  if (confidenceHelpBackdrop) {
    confidenceHelpBackdrop.addEventListener("click", () => setConfidenceHelpModalOpen(false));
  }
  if (modelComparisonOpen) {
    modelComparisonOpen.addEventListener("click", () => {
      renderModelComparisonModal();
      setModelComparisonModalOpen(true);
    });
  }
  if (modelComparisonClose) {
    modelComparisonClose.addEventListener("click", () => setModelComparisonModalOpen(false));
  }
  if (modelComparisonBackdrop) {
    modelComparisonBackdrop.addEventListener("click", () => setModelComparisonModalOpen(false));
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && confidenceHelpModal && !confidenceHelpModal.classList.contains("hidden")) {
      setConfidenceHelpModalOpen(false);
    }
    if (e.key === "Escape" && modelComparisonModal && !modelComparisonModal.classList.contains("hidden")) {
      setModelComparisonModalOpen(false);
    }
  });
  setActiveModel(activeModel);
  setActiveLabel(activeLabel);
  loadDevices();
  loadHistory();
})();
