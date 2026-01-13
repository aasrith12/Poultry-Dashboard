(() => {
  const form = document.getElementById("signup-form");
  if (!form) return;

  const success = document.getElementById("signup-success");
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

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    ["firstName", "lastName", "email", "password", "confirm"].forEach((k) => setError(k, ""));
    if (success) success.classList.add("hidden");

    const data = {
      firstName: form.firstName.value.trim(),
      lastName: form.lastName.value.trim(),
      email: form.email.value.trim(),
      password: form.password.value,
      confirm: form.confirm.value,
    };

    let hasError = false;
    if (!data.firstName) {
      setError("firstName", "First name is required");
      hasError = true;
    }
    if (!data.lastName) {
      setError("lastName", "Last name is required");
      hasError = true;
    }
    if (!data.email) {
      setError("email", "Email is required");
      hasError = true;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      setError("email", "Enter a valid email address");
      hasError = true;
    }
    if (!data.password) {
      setError("password", "Password is required");
      hasError = true;
    } else if (data.password.length < 8) {
      setError("password", "Password must be at least 8 characters");
      hasError = true;
    }
    if (!data.confirm) {
      setError("confirm", "Please confirm your password");
      hasError = true;
    } else if (data.password !== data.confirm) {
      setError("confirm", "Passwords do not match");
      hasError = true;
    }
    if (hasError) return;

    try {
      const res = await window.BluDash.csrfFetch("/api/signup/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || "Signup failed");
      }
      if (success) {
        success.textContent = "Account created! Redirecting to login...";
        success.classList.remove("hidden");
      }
      window.location.href = "/login/";
    } catch (err) {
      if (success) {
        success.textContent = err.message || "Signup failed";
        success.classList.remove("hidden");
        success.classList.remove("text-green-700");
        success.classList.add("text-red-600");
      }
    }
  });
})();
