(() => {
  const data = [
    { tag: "Getting started", q: "What is this dashboard and who is it for?", a: "This dashboard lets you view live and historic data from BluConsole loggers and analyze uploaded Excel exports. It is designed for cold-chain and environmental monitoring in labs, food, agriculture, and logistics." },
    { tag: "Getting started", q: "Do I need a BluConsole account to see data?", a: "You can browse the app without logging in, but to fetch live logger data you must sign in with valid BluConsole credentials. You can still upload a file and visualize it without BluConsole access." },
    { tag: "Devices & measurements", q: "What do TDL / HTDL / LTDL mean?", a: "They are logger families: TDL (temperature), HTDL (temperature + humidity), and LTDL (low-temperature range). The type decides which measurements are available." },
    { tag: "Devices & measurements", q: "What is shown as Current Temp, Humidity, and Reading Time?", a: "Current Temp and Humidity are the last recorded measurements returned by the logger. Reading Time is the timestamp of that last point, usually in the site's time zone." },
    { tag: "Devices & measurements", q: "What are Min Temp and Max Temp in the device table?", a: "They are the configured alarm thresholds on the logger (not the historical min/max). Charts and AI metrics still use the actual time series you load." },
    { tag: "Devices & measurements", q: "What is VRN?", a: "VRN is the device firmware version/build reference number. It is useful for fleet management and support." },
    { tag: "BluConsole", q: "How does the app connect to BluConsole?", a: "When you log in with BluConsole credentials, the app calls the BluConsole API to list devices and fetch their measurements for the selected time window. Your credentials are stored only in your browser session." },
    { tag: "BluConsole", q: "Why do I see no devices after logging in?", a: "Your account may have no devices, or there is a permission or org mismatch. Click Refresh, confirm your org scope in BluConsole, and check network restrictions or VPN if applicable." },
    { tag: "Uploads & charts", q: "What Excel formats can I upload?", a: "Standard Excel workbooks (.xlsx, .xlsm, .xlsb, .xls). The app reads the first worksheet and tries to detect time, temperature, and humidity columns automatically." },
    { tag: "Uploads & charts", q: "How does the app detect the time and temperature columns?", a: "It looks for common header names (time, timestamp, date, temp, temperature, etc.) and validates samples. You can still use datasets with different headers as long as they contain time-like and numeric columns." },
    { tag: "Uploads & charts", q: "Why does the X-axis show hours like 0.50h, 1.00h?", a: "For readability the chart buckets points by a chosen interval and plots the mean temperature for each bucket measured as hours from the first reading." },
    { tag: "Uploads & charts", q: "What does the AI cut-off do?", a: "It computes exposure metrics relative to a chosen temperature threshold: hours above, percent time above, upward excursions, longest streak above, and min/avg/max across the range." },
    { tag: "AI Estimation models", q: "What is baseline life?", a: "Baseline life is the expected shelf life at the reference temperature (for example, 7.16 days at 5°C). It is only used to convert equivalent time into remaining days." },
    { tag: "AI Estimation models", q: "What is reference temperature and why does it matter?", a: "Reference temperature is the storage temperature used as the baseline for calculations. Equivalent time is computed as “time at reference temp,” so changing the reference temp changes the rate and remaining life estimates." },
    { tag: "AI Estimation models", q: "What does 'Equivalent time @ reference' mean?", a: "It is the amount of time your profile is equivalent to if it had been stored at the reference temperature. It is computed by integrating temperature‑dependent spoilage rates across the time series." },
    { tag: "AI Estimation models", q: "Why do different models show different equivalent times?", a: "Each model uses a different temperature‑response relationship. Q10, Arrhenius, and MKT are not identical and will produce different equivalent times, especially when temperatures vary." },
    { tag: "AI Estimation models", q: "What is the Avg Temp + Q10 model?", a: "It computes a time‑weighted average temperature and applies a Q10 rate based on that single value. It is simple but less accurate for variable temperature profiles." },
    { tag: "AI Estimation models", q: "What is the Q10 Integrated model?", a: "It applies the Q10 rate to each time step and integrates across the full series. It is more accurate than the average‑temperature approach for changing temperatures." },
    { tag: "AI Estimation models", q: "What is the Arrhenius Integrated model?", a: "It uses the Arrhenius equation to compute temperature‑dependent spoilage rates at each time step and integrates over time. It is often used for biological and chemical degradation modeling." },
    { tag: "AI Estimation models", q: "What is MKT (Mean Kinetic Temperature)?", a: "MKT compresses a temperature profile into a single effective temperature that reflects higher temperatures more heavily. It is commonly used in stability and cold‑chain analysis." },
    { tag: "AI Estimation models", q: "Why does FEFO now match other models?", a: "FEFO uses the same equivalent‑time calculation as the other models, so its remaining‑life estimates stay consistent instead of spiking due to simple cut‑off logic." },
    { tag: "AI Estimation models", q: "Do these models use the graph data?", a: "Yes. All shelf‑life models are computed from the same active series that is displayed in the AI Estimation chart (uploaded files or live logger data)." },
    { tag: "AI Estimation models", q: "Can I download a detailed calculation report?", a: "Yes. The AI Estimation page includes a link to download a text report with inputs, equivalent time values, and remaining shelf‑life estimates for each model." },
    { tag: "AI ChatBot", q: "How do I use the AI ChatBot page?", a: "Log in to BluConsole first, then open AI ChatBot. You can ask about logger status, recent readings, alerts, or upload a file for analysis. The chat remembers sessions and you can clear history if needed." },
    { tag: "AI ChatBot", q: "What questions can the AI ChatBot answer?", a: "It can summarize sensor data, explain trends, highlight alerts, and provide shelf‑life insights based on uploads or live logger data. For live status, include a logger ID or label." },
    { tag: "AI ChatBot", q: "Why does the assistant ask for a logger ID?", a: "Live status and recent readings require a specific logger. If you provide a logger ID or choose one in the dashboard, the assistant can pull the latest data." },
    { tag: "AI ChatBot", q: "Are my chat messages saved?", a: "Yes. The chat is saved per session in the dashboard database. You can use the Clear Chats button to remove saved sessions." },
    { tag: "Alerts & battery", q: "How are alerts generated?", a: "Device-side alerts depend on thresholds configured on the logger (e.g., Min/Max Temp). In the app you will also see computed exposure metrics and can visually inspect threshold crossings on the chart." },
    { tag: "Alerts & battery", q: "Where do I see battery level?", a: "Battery state is available for supported devices in BluConsole. If the API returns it, we surface it in the device overview; otherwise it may be visible only in the BluConsole web UI." },
    { tag: "Account & data", q: "Where are my uploads stored?", a: "Uploaded files are parsed and saved to the application database, associated with your session or email." },
    { tag: "Account & data", q: "How do I keep my session after refresh?", a: "App login and BluConsole credentials persist in your session. If you are logged out on refresh, clear blockers that wipe session storage or disable private tabs, then log in again." },
    { tag: "Account & data", q: "How do I remove my data from this device?", a: "Use the Clear buttons in upload history, log out of BluConsole from the profile menu, and clear your browser session for this site." },
    { tag: "Troubleshooting", q: "Measurements look shifted or in the wrong time zone.", a: "Make sure your export has explicit timestamps with time zone or ISO-8601 strings. The app converts recognized timestamps to your local time for display." },
    { tag: "Troubleshooting", q: "Why is there 'No logger selected' or an empty chart?", a: "Choose a logger in the right panel (BluConsole loggers) or pick a file from Upload history. If it is still empty, there may be no points in the selected window." },
    { tag: "Troubleshooting", q: "The file uploaded but charts don't show values.", a: "Check that the first sheet has a header row and a time-like column plus numeric temperature values. If needed, rename headers to include words like 'time' and 'temperature'." },
    { tag: "Troubleshooting", q: "How do I export a chart image or the processed data?", a: "Use your OS or browser screenshot tools for images. For data, export from BluConsole or re-use your original file." },
  ];

  const search = document.getElementById("faq-search");
  const container = document.getElementById("faq-content");
  if (!search || !container) return;

  const render = (items) => {
    container.innerHTML = "";
    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "text-slate-600 text-center py-10";
      empty.textContent = "No FAQs match your search. Try different keywords.";
      container.appendChild(empty);
      return;
    }
    const grouped = items.reduce((acc, item) => {
      acc[item.tag] = acc[item.tag] || [];
      acc[item.tag].push(item);
      return acc;
    }, {});

    Object.keys(grouped).forEach((tag, sectionIdx) => {
      const section = document.createElement("section");
      const h = document.createElement("h2");
      h.className = "text-lg font-semibold text-auburn mb-3";
      h.textContent = tag;
      section.appendChild(h);

      const grid = document.createElement("div");
      grid.className = "grid grid-cols-1 sm:grid-cols-2 gap-4";
      grouped[tag].forEach((f, i) => {
        const id = Number(`${sectionIdx}${i}`);
        const card = document.createElement("div");
        card.className = "group rounded-2xl border border-auburn/20 bg-white shadow-sm transition-shadow";

        const button = document.createElement("button");
        button.className = "w-full text-left px-4 py-3 flex items-start gap-2 focus:outline-none";
        button.innerHTML = `<span class="mt-[2px] text-auburn">Q:</span><span class="font-medium text-slate-900">${f.q}</span>`;

        const answer = document.createElement("div");
        answer.className = "px-4 pb-4 pt-0 overflow-hidden transition-[max-height,opacity] duration-200 ease-out max-h-0 opacity-0";
        answer.innerHTML = `<div class="mt-1 rounded-xl bg-auburn/5 border border-auburn/10 p-3 text-sm text-slate-700"><span class="text-auburn font-medium">A: </span>${f.a}</div>`;

        const activate = () => {
          card.classList.add("ring-1", "ring-auburn", "shadow");
          answer.classList.remove("max-h-0", "opacity-0");
          answer.classList.add("max-h-64", "opacity-100");
        };
        const deactivate = () => {
          card.classList.remove("ring-1", "ring-auburn", "shadow");
          answer.classList.add("max-h-0", "opacity-0");
          answer.classList.remove("max-h-64", "opacity-100");
        };
        card.addEventListener("mouseenter", activate);
        card.addEventListener("mouseleave", deactivate);
        button.addEventListener("focus", activate);
        button.addEventListener("blur", deactivate);

        card.appendChild(button);
        card.appendChild(answer);
        grid.appendChild(card);
      });
      section.appendChild(grid);
      container.appendChild(section);
    });
  };

  const update = () => {
    const q = search.value.trim().toLowerCase();
    if (!q) return render(data);
    const filtered = data.filter(
      (f) =>
        f.q.toLowerCase().includes(q) ||
        f.a.toLowerCase().includes(q) ||
        f.tag.toLowerCase().includes(q)
    );
    render(filtered);
  };

  search.addEventListener("input", update);
  render(data);
})();
