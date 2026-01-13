(() => {
  const headerAuthed = document.getElementById("home-header-authed");
  const headerGuest = document.getElementById("home-header-guest");
  const alertsSection = document.getElementById("home-alerts");
  const alertsGrid = document.getElementById("alerts-grid");
  const alertsEmpty = document.getElementById("alerts-empty");
  const alertsLoading = document.getElementById("alerts-loading");
  const alertsError = document.getElementById("alerts-error");
  const statusBody = document.getElementById("sensor-status-body");

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const setHeader = (authed, lastName = "") => {
    if (authed) {
      if (headerGuest) headerGuest.classList.add("hidden");
      if (headerAuthed) headerAuthed.classList.remove("hidden");
      const greet = document.getElementById("home-greeting");
      const name = document.getElementById("home-name");
      if (greet) greet.textContent = greeting();
      if (name) name.textContent = lastName ? `Mr. ${lastName}` : "";
    } else {
      if (headerAuthed) headerAuthed.classList.add("hidden");
      if (headerGuest) headerGuest.classList.remove("hidden");
    }
  };

  const fetchJson = async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Request failed");
    return res.json();
  };

  const getLatestPoint = (points) => {
    if (!points || !points.length) return null;
    return points.reduce((latest, cur) => {
      if (!latest || (cur.utc || 0) > (latest.utc || 0)) return cur;
      return latest;
    }, null);
  };

  const renderAlerts = (alerts) => {
    if (!alertsGrid || !alertsEmpty) return;
    alertsGrid.innerHTML = "";
    if (!alerts.length) {
      alertsEmpty.textContent = "All sensors are within thresholds.";
      alertsEmpty.classList.remove("hidden");
      return;
    }
    alertsEmpty.classList.add("hidden");
    alerts.forEach((a) => {
      const card = document.createElement("div");
      card.className = `rounded-2xl border p-4 shadow-sm ${
        a.status === "high" ? "border-red-500/40 bg-red-50" : "border-blue-500/40 bg-blue-50"
      }`;
      card.innerHTML = `
        <div class="flex items-center justify-between">
          <div class="text-sm text-slate-700">
            <span class="font-semibold text-auburn">Logger:</span>
            <span class="font-medium">${a.id || "-"}</span>
            <span class="uppercase text-slate-500">(${a.type})</span>
          </div>
          <div class="text-xs rounded-full px-2 py-0.5 ${
            a.status === "high" ? "bg-red-600 text-white" : "bg-blue-600 text-white"
          }">
            ${a.status === "high" ? "Above Max" : "Below Min"}
          </div>
        </div>
        <div class="mt-2 grid grid-cols-2 gap-2 text-sm text-slate-800">
          <div>
            <div><span class="text-slate-600">Current Temp:</span> <span class="font-semibold">${a.currentT ?? "-"} C</span></div>
            <div><span class="text-slate-600">Humidity:</span> <span class="font-semibold">${a.currentH ?? "-"} %</span></div>
            <div class="text-slate-600">Range: ${a.min ?? "-"} - ${a.max ?? "-"} C</div>
          </div>
          <div>
            <div><span class="text-slate-600">When:</span> ${a.at ? new Date(a.at * 1000).toLocaleString() : "-"}</div>
            <div><span class="text-slate-600">Location:</span> ${a.label || a.org || "-"}</div>
            <div><span class="text-slate-600">Battery:</span> ${a.battery != null ? `${a.battery}%` : "-"}</div>
          </div>
        </div>
        <div class="mt-3">
          <a href="/sensor-feed/" class="text-auburn underline hover:no-underline text-sm">Open in Sensor Feed</a>
        </div>
      `;
      alertsGrid.appendChild(card);
    });
  };

  const renderStatus = (items) => {
    if (!statusBody) return;
    statusBody.innerHTML = "";
    items.forEach((s) => {
      const row = document.createElement("tr");
      row.className = "border-b hover:bg-slate-50 transition-colors";
      row.innerHTML = `
        <td class="px-3 py-2 font-medium">${s.id || "-"}</td>
        <td class="px-3 py-2">${s.label || "-"}</td>
        <td class="px-3 py-2 ${s.battery != null && s.battery < 20 ? "text-red-600 font-semibold" : ""}">
          <div class="flex items-center gap-2">
            <span>${s.battery != null ? `${s.battery}%` : "-"}</span>
            ${s.battery != null && s.battery < 20 ? '<span class="inline-flex h-2.5 w-2.5 rounded-full bg-orange-500 animate-pulse"></span>' : ""}
          </div>
        </td>
        <td class="px-3 py-2">${s.lastUpdate || "-"}</td>
        <td class="px-3 py-2">
          <div class="flex items-center gap-2 font-semibold">
            <span class="inline-flex h-2.5 w-2.5 rounded-full ${s.online ? "bg-green-500" : "bg-red-500 animate-pulse"}"></span>
            <span class="${s.online ? "text-green-600" : "text-red-600"}">${s.online ? "Online" : "OFFLINE"}</span>
          </div>
        </td>
        <td class="px-3 py-2">
          <div class="flex items-center gap-2 font-semibold">
            <span class="inline-flex h-2.5 w-2.5 rounded-full ${s.collecting ? "bg-green-500" : "bg-yellow-400 animate-pulse"}"></span>
            <span class="${s.collecting ? "text-green-600" : "text-orange-600"}">${s.collecting ? "Collecting" : "NOT Collecting"}</span>
          </div>
        </td>
      `;
      statusBody.appendChild(row);
    });
  };

  const load = async () => {
    try {
      const status = await fetchJson("/api/blu/status/");
      if (!status.authenticated) {
        setHeader(false);
        return;
      }
      const profileData = await fetchJson("/api/profile/");
      const lastName = profileData.profile?.lastName || "";
      setHeader(true, lastName);
      if (alertsSection) alertsSection.classList.remove("hidden");

      if (alertsLoading) alertsLoading.textContent = "Loading...";
      const devicesRes = await fetchJson("/api/blu/devices/");
      const devices = devicesRes.devices || [];
      const now = Math.floor(Date.now() / 1000);
      const from = now - 48 * 3600;

      const results = {};
      const concurrency = 5;
      let index = 0;
      const worker = async () => {
        while (index < devices.length) {
          const d = devices[index++];
          if (!d.id) continue;
          try {
            const q = new URLSearchParams({
              id: d.id,
              fromTime: String(from),
              toTime: String(now),
            });
            const meas = await fetchJson(`/api/blu/measurements/?${q.toString()}`);
            results[d.id] = getLatestPoint(meas.points || []);
          } catch {
            results[d.id] = null;
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(concurrency, devices.length) }, worker));

      const alerts = [];
      const statusItems = [];
      devices.forEach((d) => {
        const lv = results[d.id] || {};
        const t = lv.t ?? null;
        if (t != null && (d.min_temp != null || d.max_temp != null)) {
          if (d.min_temp != null && t < d.min_temp) {
            alerts.push({
              id: d.id,
              type: d.type,
              label: d.label,
              org: d.org,
              currentT: t,
              currentH: lv.h ?? null,
              min: d.min_temp,
              max: d.max_temp,
              at: lv.utc ?? null,
              battery: d.battery,
              status: "low",
            });
          } else if (d.max_temp != null && t > d.max_temp) {
            alerts.push({
              id: d.id,
              type: d.type,
              label: d.label,
              org: d.org,
              currentT: t,
              currentH: lv.h ?? null,
              min: d.min_temp,
              max: d.max_temp,
              at: lv.utc ?? null,
              battery: d.battery,
              status: "high",
            });
          }
        }

        const lastUtc = lv.utc ?? null;
        const minutesSince = lastUtc ? Math.floor((now - lastUtc) / 60) : null;
        const isOnline = minutesSince !== null && minutesSince < 30;
        const isDataFlowing = minutesSince !== null && minutesSince < 15;
        statusItems.push({
          id: d.id,
          label: d.label,
          battery: d.battery,
          lastUpdate: lastUtc ? new Date(lastUtc * 1000).toLocaleString() : "-",
          online: isOnline,
          collecting: isDataFlowing,
        });
      });

      alerts.sort((a, b) => (b.at || 0) - (a.at || 0));
      renderAlerts(alerts);
      renderStatus(statusItems);
      if (alertsLoading) alertsLoading.textContent = "";
    } catch (err) {
      if (alertsError) alertsError.textContent = "Failed to load devices";
    }
  };

  load();
})();
