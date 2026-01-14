(() => {
  const form = document.getElementById("chat-form");
  const log = document.getElementById("chat-log");
  const upload = document.getElementById("chat-upload");
  const uploadHint = document.getElementById("chat-upload-hint");
  const statusBadge = document.getElementById("ai-chat-status");

  const MAX_SIZE = 5 * 1024 * 1024;

  const addMessage = (role, text) => {
    if (!log) return;
    const card = document.createElement("div");
    card.className = "rounded-2xl border border-slate-200 bg-white p-4 text-slate-800";
    card.innerHTML = `
      <p class="font-medium ${role === "user" ? "text-brick" : "text-auburn"} mb-1">${role === "user" ? "You" : "Assistant"}</p>
      <p>${text}</p>
    `;
    log.appendChild(card);
  };

  if (upload) {
    upload.addEventListener("change", () => {
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
      if (uploadHint) {
        uploadHint.textContent = `Attached: ${file.name}`;
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
          body: JSON.stringify({ prompt }),
        });
        const data = await res.json();
        if (!res.ok) {
          addMessage("assistant", data.error || "AI service is not configured yet.");
        } else {
          addMessage("assistant", data.answer || "No response.");
        }
      } catch {
        addMessage("assistant", "Failed to reach AI service.");
      } finally {
        form.prompt.value = "";
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

  loadStatus();
})();
