(() => {
  const form = document.getElementById("blu-login-form");
  if (!form) return;

  const status = document.getElementById("blu-status");
  const errorEl = (name) => form.querySelector(`[data-error="${name}"]`);

  const setError = (name, message) => {
    const el = errorEl(name);
    if (!el) return;
    if (message) {
      el.textContent = message;
      el.classList.remove("hidden");
    } else {
      el.textContent = "";
      el.classList.add("hidden");
    }
  };

  const setStatus = (message, ok) => {
    if (!status) return;
    status.textContent = message;
    status.classList.remove("hidden", "text-red-600", "text-green-600");
    status.classList.add(ok ? "text-green-600" : "text-red-600");
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setError("uname", "");
    setError("upass", "");
    if (status) status.classList.add("hidden");

    const uname = form.uname.value.trim();
    const upass = form.upass.value.trim();
    let hasError = false;
    if (!uname) {
      setError("uname", "BluConsole username is required");
      hasError = true;
    }
    if (!upass) {
      setError("upass", "BluConsole password is required");
      hasError = true;
    }
    if (hasError) return;

    try {
      const res = await window.BluDash.csrfFetch("/api/blu/login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uname, upass }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "BluConsole login failed");
      }
      setStatus("BluConsole connection successful.", true);
      const params = new URLSearchParams(window.location.search);
      const next = params.get("next") || "/sensor-feed/";
      window.location.href = next;
    } catch (err) {
      setStatus(err.message || "BluConsole login failed", false);
    }
  });
})();
