(() => {
  const getCookie = (name) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(";").shift();
    return "";
  };

  const csrfFetch = (url, options = {}) => {
    const headers = Object.assign({}, options.headers || {}, {
      "X-CSRFToken": getCookie("csrftoken"),
    });
    return fetch(url, Object.assign({}, options, { headers }));
  };

  const logoutBtn = document.querySelector("[data-bu-logout]");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await csrfFetch("/api/blu/logout/", { method: "POST" });
      } finally {
        window.location.href = "/login/";
      }
    });
  }

  window.BluDash = { csrfFetch };
})();
