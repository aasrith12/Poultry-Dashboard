(() => {
  const avatar = document.getElementById("profile-avatar");
  const form = document.getElementById("profile-form");
  const photoInput = document.getElementById("profile-photo-input");
  const saved = document.getElementById("profile-saved");
  const nameEl = document.getElementById("profile-name");
  const emailEl = document.getElementById("profile-email");
  const notesGrid = document.getElementById("notes-grid");
  const notesCount = document.getElementById("notes-count");
  const notesSaved = document.getElementById("notes-saved");
  const noteForm = document.getElementById("note-form");
  const noteHeading = document.getElementById("note-heading");
  const noteCancel = document.getElementById("note-cancel");

  let photoDataUrl = "";
  let editingId = null;

  const fetchJson = async (url, options) => {
    const res = options ? await window.BluDash.csrfFetch(url, options) : await fetch(url);
    if (!res.ok) throw new Error("Request failed");
    return res.json();
  };

  const setAvatar = (url, initials) => {
    if (!avatar) return;
    avatar.innerHTML = "";
    if (url) {
      const img = document.createElement("img");
      img.src = url;
      img.alt = "Profile";
      img.className = "h-full w-full object-cover";
      avatar.appendChild(img);
    } else {
      avatar.textContent = initials || "?";
    }
  };

  const getInitials = (first, last) => {
    return [first?.trim()?.[0], last?.trim()?.[0]].filter(Boolean).join("").toUpperCase();
  };

  const loadProfile = async () => {
    const res = await fetchJson("/api/profile/");
    const profile = res.profile || {};
    const firstName = profile.firstName || "";
    const lastName = profile.lastName || "";
    if (form) {
      form.firstName.value = firstName;
      form.lastName.value = lastName;
    }
    photoDataUrl = profile.photoDataUrl || "";
    setAvatar(photoDataUrl, getInitials(firstName, lastName));
    if (nameEl) nameEl.textContent = [firstName, lastName].filter(Boolean).join(" ").trim() || "Your profile";
    if (emailEl) emailEl.textContent = profile.email || "Guest (BluConsole-only login)";
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    const payload = {
      firstName: form.firstName.value.trim(),
      lastName: form.lastName.value.trim(),
      photoDataUrl: photoDataUrl || "",
    };
    await fetchJson("/api/profile/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setAvatar(photoDataUrl, getInitials(payload.firstName, payload.lastName));
    if (nameEl) nameEl.textContent = [payload.firstName, payload.lastName].filter(Boolean).join(" ").trim() || "Your profile";
    if (saved) {
      saved.classList.remove("hidden");
      setTimeout(() => saved.classList.add("hidden"), 900);
    }
  };

  const loadNotes = async () => {
    const res = await fetchJson("/api/notes/");
    const notes = res.notes || [];
    if (notesGrid) notesGrid.innerHTML = "";
    if (notesCount) notesCount.textContent = `${notes.length} ${notes.length === 1 ? "note" : "notes"}`;
    if (!notes.length) {
      const p = document.createElement("p");
      p.className = "text-slate-600";
      p.textContent = "No notes yet - add your first one above.";
      notesGrid.appendChild(p);
      return;
    }
    notes.forEach((n) => {
      const card = document.createElement("article");
      card.className = "bg-white border border-auburn/30 rounded-2xl p-5 shadow-sm relative";
      card.innerHTML = `
        <div class="absolute -top-2 left-5 h-1.5 w-16 rounded-full bg-brick"></div>
        <h4 class="text-auburn font-semibold">${n.title}</h4>
        <p class="mt-2 text-slate-700 whitespace-pre-wrap">${n.body}</p>
        <div class="mt-4 flex items-center justify-between text-xs text-slate-500">
          <span>${new Date(n.updated_at || n.created_at).toLocaleString()}${n.updated_at ? " (edited)" : ""}</span>
          <div class="flex items-center gap-2">
            <button class="px-2 py-1 rounded border border-auburn/40 text-auburn hover:bg-auburn/5" data-edit="${n.id}">Edit</button>
            <button class="px-2 py-1 rounded border border-red-500/40 text-red-600 hover:bg-red-50" data-delete="${n.id}">Delete</button>
          </div>
        </div>
      `;
      card.querySelector(`[data-edit="${n.id}"]`).addEventListener("click", () => {
        editingId = n.id;
        noteForm.title.value = n.title;
        noteForm.body.value = n.body;
        if (noteHeading) noteHeading.textContent = "Edit note";
        if (noteCancel) noteCancel.classList.remove("hidden");
      });
      card.querySelector(`[data-delete="${n.id}"]`).addEventListener("click", async () => {
        await window.BluDash.csrfFetch(`/api/notes/${n.id}/`, { method: "DELETE" });
        await loadNotes();
      });
      notesGrid.appendChild(card);
    });
  };

  const saveNote = async (e) => {
    e.preventDefault();
    const payload = {
      title: noteForm.title.value.trim(),
      body: noteForm.body.value.trim(),
    };
    if (!payload.title || !payload.body) return;
    if (editingId) {
      await window.BluDash.csrfFetch(`/api/notes/${editingId}/`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await window.BluDash.csrfFetch("/api/notes/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    editingId = null;
    noteForm.reset();
    if (noteHeading) noteHeading.textContent = "Add a quick note";
    if (noteCancel) noteCancel.classList.add("hidden");
    if (notesSaved) {
      notesSaved.classList.remove("hidden");
      setTimeout(() => notesSaved.classList.add("hidden"), 900);
    }
    await loadNotes();
  };

  if (photoInput) {
    photoInput.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (!file || !file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => {
        photoDataUrl = reader.result;
        setAvatar(photoDataUrl, "");
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    });
  }

  if (form) form.addEventListener("submit", saveProfile);
  if (noteForm) noteForm.addEventListener("submit", saveNote);
  if (noteCancel) {
    noteCancel.addEventListener("click", () => {
      editingId = null;
      noteForm.reset();
      if (noteHeading) noteHeading.textContent = "Add a quick note";
      noteCancel.classList.add("hidden");
    });
  }

  loadProfile();
  loadNotes();
})();
