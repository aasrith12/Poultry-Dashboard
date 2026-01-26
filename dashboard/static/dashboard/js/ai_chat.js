(() => {
  const form = document.getElementById("chat-form");
  const log = document.getElementById("chat-log");
  const upload = document.getElementById("chat-upload");
  const uploadHint = document.getElementById("chat-upload-hint");
  const statusBadge = document.getElementById("ai-chat-status");
  const historyWrap = document.getElementById("chat-history");
  const historyEmpty = document.getElementById("chat-history-empty");
  const newChatBtn = document.getElementById("new-chat");
  const clearChatsBtn = document.getElementById("clear-chats");

  const MAX_SIZE = 5 * 1024 * 1024;
  let currentSessionId = null;
  let pendingAttachment = null;

  const addMessage = (role, text) => {
    if (!log) return;
    const card = document.createElement("div");
    card.className = "rounded-2xl border border-slate-200 bg-white p-4 text-slate-800";
    card.innerHTML = `
      <p class="font-medium ${role === "user" ? "text-brick" : "text-auburn"} mb-1">${role === "user" ? "You" : "Assistant"}</p>
      <p class="whitespace-pre-line">${text}</p>
    `;
    log.appendChild(card);
  };

  const formatDt = (iso) => {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  const clearLog = () => {
    if (log) log.innerHTML = "";
  };

  const detectColumns = (headers, rows) => {
    const sample = rows.slice(0, Math.min(200, rows.length));
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
      if (/^\d+(\.\d+)?$/.test(s)) {
        const n = Number(s);
        if (!Number.isFinite(n)) return null;
        if (n > 10_000_000_000) return new Date(n);
        if (n > 1_000_000_000) return new Date(n * 1000);
        if (n > 20_000 && n < 60_000) {
          const excelEpoch = new Date(Date.UTC(1899, 11, 30));
          return new Date(excelEpoch.getTime() + n * 86400000);
        }
      }
      return null;
    };
    const toNum = (v) => {
      if (v === null || v === undefined) return null;
      const n = Number(String(v).trim());
      return Number.isFinite(n) ? n : null;
    };

    let timeCol = "";
    let bestTimeScore = -1;
    headers.forEach((h) => {
      let score = 0;
      const ln = h.toLowerCase();
      if (/(time|timestamp|date|datetime)/i.test(ln)) score += 2;
      for (const r of sample) if (parseMaybeDate(r[h])) score++;
      if (score > bestTimeScore) {
        bestTimeScore = score;
        timeCol = h;
      }
    });
    if (!timeCol && headers.length) timeCol = headers[0];

    let tempCol = "";
    let tempScore = -1;
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
      let score = 0;
      if (/(temp|temperature|degc|celsius)/i.test(ln)) score += 2;
      score += numericRatio(h) * 5;
      if (score > tempScore) {
        tempScore = score;
        tempCol = h;
      }
    });

    return { timeCol, tempCol };
  };

  const summarizeWorkbook = (file, wb) => {
    const name = file.name;
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const headers = (data[0] || []).map((h) => String(h ?? "").trim());
    const rows = data.slice(1);
    const { timeCol, tempCol } = detectColumns(headers, rows.map((r) => {
      const obj = {};
      headers.forEach((h, i) => (obj[h] = r[i]));
      return obj;
    }));
    let tMin = null;
    let tMax = null;
    let tSum = 0;
    let tCount = 0;
    let timeStart = null;
    let timeEnd = null;
    let tempAtStart = null;
    let tempAtEnd = null;

    rows.forEach((r) => {
      const rowObj = {};
      headers.forEach((h, i) => (rowObj[h] = r[i]));
      if (tempCol && rowObj[tempCol] != null) {
        const n = Number(rowObj[tempCol]);
        if (Number.isFinite(n)) {
          tMin = tMin == null ? n : Math.min(tMin, n);
          tMax = tMax == null ? n : Math.max(tMax, n);
          tSum += n;
          tCount += 1;
        }
      }
      if (timeCol && rowObj[timeCol] != null) {
        const d = parseMaybeDate(rowObj[timeCol]);
        if (d) {
          if (!timeStart || d < timeStart) {
            timeStart = d;
            const n = Number(rowObj[tempCol]);
            tempAtStart = Number.isFinite(n) ? n : tempAtStart;
          }
          if (!timeEnd || d > timeEnd) {
            timeEnd = d;
            const n = Number(rowObj[tempCol]);
            tempAtEnd = Number.isFinite(n) ? n : tempAtEnd;
          }
        }
      }
    });

    return {
      type: "excel",
      name,
      sheet: sheetName,
      rows: rows.length,
      headers,
      timeCol,
      tempCol,
      tempMin: tMin,
      tempMax: tMax,
      tempAvg: tCount ? tSum / tCount : null,
      timeStart: timeStart ? timeStart.toISOString() : null,
      timeEnd: timeEnd ? timeEnd.toISOString() : null,
      tempAtStart,
      tempAtEnd,
      tempSamples: tCount,
    };
  };

  if (upload) {
    upload.addEventListener("change", async () => {
      if (!upload.files || !upload.files.length) return;
      const file = upload.files[0];
      if (file.size > MAX_SIZE) {
        if (uploadHint) {
          uploadHint.textContent = "File too large. Max size is 5 MB.";
          uploadHint.classList.remove("hidden");
          uploadHint.classList.add("text-red-600");
        }
        upload.value = "";
        return;
      }
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await window.BluDash.csrfFetch("/api/ai-chat/attachment/", {
          method: "POST",
          body: fd,
        });
        const data = await res.json();
        if (!res.ok) {
          pendingAttachment = null;
          if (uploadHint) {
            uploadHint.textContent = data.error || "Attachment could not be parsed.";
            uploadHint.classList.remove("hidden");
            uploadHint.classList.add("text-red-600");
          }
          return;
        }
        pendingAttachment = data.attachment || null;
      } catch {
        pendingAttachment = null;
      }

      if (uploadHint) {
        uploadHint.textContent = pendingAttachment ? `Attached: ${file.name}` : "Attachment could not be parsed.";
        uploadHint.classList.remove("hidden", "text-red-600");
      }
    });
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const prompt = form.prompt.value.trim();
      if (!prompt) return;
      addMessage("user", prompt);
      try {
        const res = await window.BluDash.csrfFetch("/api/ai-chat/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            session_id: currentSessionId,
            attachment: pendingAttachment,
          }),
        });
        const data = await res.json();
        if (data.session_id) {
          currentSessionId = data.session_id;
        }
        if (!res.ok) {
          addMessage("assistant", data.error || "AI service is not configured yet.");
        } else {
          addMessage("assistant", data.answer || "No response.");
          await loadSessions();
        }
      } catch {
        addMessage("assistant", "Failed to reach AI service.");
      } finally {
        form.prompt.value = "";
        pendingAttachment = null;
        if (upload) upload.value = "";
        if (uploadHint) uploadHint.classList.add("hidden");
        await loadSessions();
      }
    });
  }

  const loadStatus = async () => {
    if (!statusBadge) return;
    try {
      const res = await fetch("/api/ai-chat/status/");
      const data = await res.json();
      if (res.ok && data.connected) {
        statusBadge.textContent = "LLM connected";
        statusBadge.classList.remove("bg-auburn/5", "text-auburn", "border-auburn/20");
        statusBadge.classList.add("bg-green-50", "text-green-700", "border-green-200");
      } else {
        statusBadge.textContent = "LLM not connected yet";
      }
    } catch {
      statusBadge.textContent = "LLM status unavailable";
    }
  };

  const loadSessions = async () => {
    if (!historyWrap || !historyEmpty) return;
    try {
      const res = await fetch("/api/ai-chat/sessions/");
      const data = await res.json();
      const sessions = data.sessions || [];
      historyWrap.innerHTML = "";
      if (!sessions.length) {
        historyEmpty.classList.remove("hidden");
        return;
      }
      historyEmpty.classList.add("hidden");
      sessions.forEach((s) => {
        const btn = document.createElement("button");
        btn.className =
          "w-full text-left rounded-lg border border-slate-200 px-3 py-2 hover:border-auburn/40";
        btn.innerHTML = `
          <div class="text-sm font-medium text-slate-800">${s.title}</div>
          <div class="text-xs text-slate-500">${formatDt(s.updated_at)}</div>
        `;
        btn.addEventListener("click", async () => {
          currentSessionId = s.id;
          await loadSessionMessages(s.id);
        });
        historyWrap.appendChild(btn);
      });
    } catch {
      historyEmpty.classList.remove("hidden");
    }
  };

  const loadSessionMessages = async (sessionId) => {
    clearLog();
    try {
      const res = await fetch(`/api/ai-chat/sessions/${sessionId}/`);
      const data = await res.json();
      const messages = data.messages || [];
      messages.forEach((m) => addMessage(m.role, m.content));
    } catch {
      addMessage("assistant", "Unable to load this chat history.");
    }
  };

  if (newChatBtn) {
    newChatBtn.addEventListener("click", () => {
      currentSessionId = null;
      clearLog();
      addMessage(
        "assistant",
        "New chat started. Ask about logger readings, temperature trends, shelf-life, or upload a file."
      );
    });
  }

  if (clearChatsBtn) {
    clearChatsBtn.addEventListener("click", async () => {
      if (!confirm("Delete all saved chats? This cannot be undone.")) return;
      try {
        await window.BluDash.csrfFetch("/api/ai-chat/sessions/clear/", { method: "DELETE" });
        currentSessionId = null;
        clearLog();
        await loadSessions();
        addMessage("assistant", "All chats cleared. Start a new conversation anytime.");
      } catch {
        addMessage("assistant", "Failed to clear chats.");
      }
    });
  }

  loadStatus();
  loadSessions();
})();
