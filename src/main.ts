// ============================================================
// BYCORE Desktop App — main.ts
// Dashboard · Notizen · Task Manager
// ============================================================

// ===== TITLEBAR CONTROLS =====
function setupTitlebar() {
  const appWindow = (window as any).__TAURI__?.window?.getCurrentWindow?.();
  if (!appWindow) return;
  document.querySelector(".dot-red")?.addEventListener("click", () => appWindow.close());
  document.querySelector(".dot-yellow")?.addEventListener("click", () => appWindow.minimize());
  document.querySelector(".dot-green")?.addEventListener("click", () => appWindow.toggleMaximize());
}

// ============================================================
// NOTIZEN SYSTEM
// ============================================================
interface Note {
  id: string;
  title: string;
  content: string;
  created: string;
  updated: string;
  pinned: boolean;
}

function getNotes(): Note[] {
  const data = localStorage.getItem("bycore-notes");
  const raw = data ? JSON.parse(data) : [];
  return raw.map((n: any) => ({ ...n, pinned: n.pinned ?? false }));
}

function saveAllNotes(notes: Note[]) {
  localStorage.setItem("bycore-notes", JSON.stringify(notes));
}

let activeNoteId: string | null = null;
let isPreviewMode = false;
let noteSaveTimeout: any = null;

function parseMarkdown(text: string): string {
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  html = html.replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/~~(.+?)~~/g, "<del>$1</del>");
  html = html.replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>");
  html = html.replace(/\[x\]/gi, "☑");
  html = html.replace(/\[ \]/g, "☐");
  html = html.replace(/^- (.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>");
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank">$1</a>');
  html = html.replace(/^---$/gm, "<hr>");
  html = html.replace(/\n\n/g, "</p><p>");
  html = "<p>" + html + "</p>";
  html = html.replace(/<p><\/p>/g, "");
  html = html.replace(/<p>(<h[1-3]>)/g, "$1");
  html = html.replace(/(<\/h[1-3]>)<\/p>/g, "$1");
  html = html.replace(/<p>(<pre>)/g, "$1");
  html = html.replace(/(<\/pre>)<\/p>/g, "$1");
  html = html.replace(/<p>(<ul>)/g, "$1");
  html = html.replace(/(<\/ul>)<\/p>/g, "$1");
  html = html.replace(/<p>(<blockquote>)/g, "$1");
  html = html.replace(/(<\/blockquote>)<\/p>/g, "$1");
  html = html.replace(/<p>(<hr>)/g, "$1");
  html = html.replace(/(<hr>)<\/p>/g, "$1");
  return html;
}

function createNote() {
  const notes = getNotes();
  const newNote: Note = {
    id: Date.now().toString(),
    title: "",
    content: "",
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    pinned: false,
  };
  notes.unshift(newNote);
  saveAllNotes(notes);
  activeNoteId = newNote.id;
  isPreviewMode = false;
  renderNotes();
  setTimeout(() => {
    (document.getElementById("noteTitleInput") as HTMLInputElement)?.focus();
  }, 50);
}

function deleteNote(id: string) {
  let notes = getNotes();
  notes = notes.filter((n) => n.id !== id);
  saveAllNotes(notes);
  activeNoteId = notes.length > 0 ? notes[0].id : null;
  isPreviewMode = false;
  renderNotes();
}

function toggleNotePin(id: string) {
  const notes = getNotes();
  const note = notes.find((n) => n.id === id);
  if (note) {
    note.pinned = !note.pinned;
    saveAllNotes(notes);
    renderNotes();
  }
}

function updateNote(id: string, title: string, content: string) {
  const notes = getNotes();
  const note = notes.find((n) => n.id === id);
  if (note) {
    note.title = title;
    note.content = content;
    note.updated = new Date().toISOString();
    saveAllNotes(notes);
  }
}

function saveCurrentNote() {
  if (!activeNoteId) return;
  const titleInput = document.getElementById("noteTitleInput") as HTMLInputElement;
  const textarea = document.getElementById("noteTextarea") as HTMLTextAreaElement;
  if (titleInput && textarea) {
    updateNote(activeNoteId, titleInput.value, textarea.value);
  }
}

function triggerAutoSave() {
  const statusEl = document.getElementById("autoSaveStatus");
  if (statusEl) statusEl.textContent = "Speichert...";
  clearTimeout(noteSaveTimeout);
  noteSaveTimeout = setTimeout(() => {
    saveCurrentNote();
    if (statusEl) statusEl.textContent = "✓ Gespeichert";
    updateNoteSidebarItems();
  }, 500);
}

function updateNoteSidebarItems() {
  const notes = getNotes();
  document.querySelectorAll(".note-item").forEach((item) => {
    const id = item.getAttribute("data-note-id");
    const note = notes.find((n) => n.id === id);
    if (note) {
      const titleEl = item.querySelector(".note-item-title");
      const previewEl = item.querySelector(".note-item-preview");
      if (titleEl) titleEl.textContent = note.title || "Unbenannt";
      if (previewEl) previewEl.textContent = note.content.substring(0, 60) || "Leer...";
    }
  });
}

function getSortedNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.updated).getTime() - new Date(a.updated).getTime();
  });
}

function renderNotes() {
  const notes = getNotes();
  const sorted = getSortedNotes(notes);
  const activeNote = notes.find((n) => n.id === activeNoteId);

  const listEl = document.getElementById("notesList");
  if (listEl) {
    if (notes.length === 0) {
      listEl.innerHTML = '<div class="notes-empty">Noch keine Notizen. Erstelle deine erste!</div>';
    } else {
      listEl.innerHTML = sorted
        .map(
          (note) => `
          <div class="note-item ${note.id === activeNoteId ? "active" : ""} ${note.pinned ? "pinned" : ""}" data-note-id="${note.id}">
            <div class="note-item-top">
              <span class="note-item-title">${note.title || "Unbenannt"}</span>
              ${note.pinned ? '<span class="note-pin-badge">📌</span>' : ""}
            </div>
            <div class="note-item-preview">${note.content.substring(0, 60) || "Leer..."}</div>
            <div class="note-item-date">${new Date(note.updated).toLocaleDateString("de-DE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
          </div>
        `
        )
        .join("");

      listEl.querySelectorAll(".note-item").forEach((item) => {
        item.addEventListener("click", () => {
          saveCurrentNote();
          activeNoteId = item.getAttribute("data-note-id");
          isPreviewMode = false;
          renderNotes();
        });
      });
    }
  }

  const searchInput = document.getElementById("notesSearch") as HTMLInputElement;
  if (searchInput && searchInput.value.trim()) {
    applyNoteSearch(searchInput.value);
  }

  const editorArea = document.getElementById("notesEditorArea");
  if (editorArea) {
    if (!activeNote) {
      editorArea.innerHTML = `
        <div class="notes-empty-state">
          <span class="empty-icon">📝</span>
          <p>Wähle eine Notiz oder erstelle eine neue</p>
        </div>
      `;
    } else {
      const charCount = activeNote.content.length;
      const wordCount = activeNote.content.trim() ? activeNote.content.trim().split(/\s+/).length : 0;
      editorArea.innerHTML = `
        <div class="notes-editor-header">
          <input type="text" class="note-title-input" id="noteTitleInput" placeholder="Titel..." value="${(activeNote.title || "").replace(/"/g, "&quot;")}" />
          <div class="editor-actions">
            <button class="btn-editor ${!isPreviewMode ? "active" : ""}" id="btnEdit" title="Bearbeiten">✏️</button>
            <button class="btn-editor ${isPreviewMode ? "active" : ""}" id="btnPreview" title="Vorschau">👁️</button>
            <button class="btn-editor" id="btnPinNote" title="${activeNote.pinned ? "Lösen" : "Anpinnen"}">${activeNote.pinned ? "📌" : "📍"}</button>
            <button class="btn-delete" id="btnDeleteNote" title="Löschen">🗑️</button>
          </div>
        </div>
        <div class="notes-editor-content">
          <textarea class="note-textarea" id="noteTextarea" placeholder="Schreibe deine Notiz in Markdown..." style="display: ${isPreviewMode ? "none" : "block"}">${activeNote.content}</textarea>
          <div class="note-preview" id="notePreview" style="display: ${isPreviewMode ? "block" : "none"}">${parseMarkdown(activeNote.content)}</div>
        </div>
        <div class="notes-editor-footer">
          <span class="auto-save-status" id="autoSaveStatus">✓ Gespeichert</span>
          <span class="note-stats">${charCount} Zeichen · ${wordCount} Wörter</span>
        </div>
      `;

      document.getElementById("btnEdit")?.addEventListener("click", () => { isPreviewMode = false; renderNotes(); });
      document.getElementById("btnPreview")?.addEventListener("click", () => { saveCurrentNote(); isPreviewMode = true; renderNotes(); });
      document.getElementById("btnPinNote")?.addEventListener("click", () => { if (activeNoteId) toggleNotePin(activeNoteId); });
      document.getElementById("btnDeleteNote")?.addEventListener("click", () => { if (activeNoteId && confirm("Notiz wirklich löschen?")) deleteNote(activeNoteId); });

      const textarea = document.getElementById("noteTextarea") as HTMLTextAreaElement;
      const titleInput = document.getElementById("noteTitleInput") as HTMLInputElement;

      textarea?.addEventListener("input", () => {
        triggerAutoSave();
        const statsEl = document.querySelector(".note-stats");
        if (statsEl) {
          const c = textarea.value.length;
          const w = textarea.value.trim() ? textarea.value.trim().split(/\s+/).length : 0;
          statsEl.textContent = `${c} Zeichen · ${w} Wörter`;
        }
      });
      titleInput?.addEventListener("input", () => triggerAutoSave());

      textarea?.addEventListener("keydown", (e) => {
        if (e.key === "Tab") {
          e.preventDefault();
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          textarea.value = textarea.value.substring(0, start) + "  " + textarea.value.substring(end);
          textarea.selectionStart = textarea.selectionEnd = start + 2;
          textarea.dispatchEvent(new Event("input"));
        }
      });

      if (!isPreviewMode) textarea?.focus();
    }
  }
}

function applyNoteSearch(query: string) {
  const q = query.toLowerCase();
  document.querySelectorAll(".note-item").forEach((item) => {
    const title = item.querySelector(".note-item-title")?.textContent?.toLowerCase() || "";
    const preview = item.querySelector(".note-item-preview")?.textContent?.toLowerCase() || "";
    (item as HTMLElement).style.display = title.includes(q) || preview.includes(q) ? "" : "none";
  });
}

function setupNotesSearch() {
  const searchInput = document.getElementById("notesSearch") as HTMLInputElement;
  searchInput?.addEventListener("input", () => applyNoteSearch(searchInput.value));
}

// ============================================================
// TASK SYSTEM
// ============================================================
interface Task {
  id: string;
  title: string;
  description: string;
  priority: "important" | "normal" | "optional";
  status: "todo" | "progress" | "done";
  done: boolean;
  created: string;
  dueDate: string;
}

function getTasks(): Task[] {
  const data = localStorage.getItem("bycore-tasks");
  return data ? JSON.parse(data) : [];
}

function saveTasks(tasks: Task[]) {
  localStorage.setItem("bycore-tasks", JSON.stringify(tasks));
}

let taskView: "kanban" | "list" = "kanban";
let taskFilter: "all" | "important" | "normal" | "optional" = "all";
let editingTaskId: string | null = null;

function createTask(title: string, description: string, priority: Task["priority"], dueDate: string) {
  const tasks = getTasks();
  tasks.unshift({
    id: Date.now().toString(),
    title,
    description,
    priority,
    status: "todo",
    done: false,
    created: new Date().toISOString(),
    dueDate,
  });
  saveTasks(tasks);
  renderTasks();
}

function updateTask(id: string, title: string, description: string, priority: Task["priority"], status: Task["status"], dueDate: string) {
  const tasks = getTasks();
  const task = tasks.find((t) => t.id === id);
  if (task) {
    task.title = title;
    task.description = description;
    task.priority = priority;
    task.status = status;
    task.done = status === "done";
    task.dueDate = dueDate;
    saveTasks(tasks);
    renderTasks();
  }
}

function toggleTaskDone(id: string) {
  const tasks = getTasks();
  const task = tasks.find((t) => t.id === id);
  if (task) {
    task.done = !task.done;
    task.status = task.done ? "done" : "todo";
    saveTasks(tasks);
    renderTasks();
  }
}

function moveTask(id: string, newStatus: "todo" | "progress" | "done") {
  const tasks = getTasks();
  const task = tasks.find((t) => t.id === id);
  if (task) {
    task.status = newStatus;
    task.done = newStatus === "done";
    saveTasks(tasks);
    renderTasks();
  }
}

function deleteTask(id: string) {
  let tasks = getTasks();
  tasks = tasks.filter((t) => t.id !== id);
  saveTasks(tasks);
  renderTasks();
}

function isOverdue(dateStr: string): boolean {
  if (!dateStr) return false;
  const due = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

function getPriorityLabel(p: string): string {
  if (p === "important") return "🔴";
  if (p === "normal") return "🟡";
  return "⚪";
}

function getPriorityText(p: string): string {
  if (p === "important") return "Wichtig";
  if (p === "normal") return "Normal";
  return "Optional";
}

function showTaskModal(editId?: string) {
  editingTaskId = editId || null;
  const tasks = getTasks();
  const task = editId ? tasks.find((t) => t.id === editId) : null;

  const overlay = document.createElement("div");
  overlay.className = "task-modal-overlay";
  overlay.innerHTML = `
    <div class="task-modal">
      <div class="task-modal-top">
        <h2>${task ? "Task bearbeiten" : "Neuer Task"}</h2>
        <button class="btn-modal-close" id="btnCloseModal">✕</button>
      </div>
      <div class="task-modal-field">
        <label>Titel</label>
        <input type="text" id="taskModalTitle" placeholder="Was muss erledigt werden?" value="${task ? task.title.replace(/"/g, "&quot;") : ""}" />
      </div>
      <div class="task-modal-field">
        <label>Beschreibung</label>
        <textarea id="taskModalDesc" placeholder="Details (optional)..." rows="3">${task ? task.description : ""}</textarea>
      </div>
      <div class="task-modal-row">
        <div class="task-modal-field">
          <label>Priorität</label>
          <select id="taskModalPriority">
            <option value="important" ${task?.priority === "important" ? "selected" : ""}>🔴 Wichtig</option>
            <option value="normal" ${!task || task.priority === "normal" ? "selected" : ""}>🟡 Normal</option>
            <option value="optional" ${task?.priority === "optional" ? "selected" : ""}>⚪ Optional</option>
          </select>
        </div>
        <div class="task-modal-field">
          <label>Status</label>
          <select id="taskModalStatus">
            <option value="todo" ${!task || task.status === "todo" ? "selected" : ""}>📋 To Do</option>
            <option value="progress" ${task?.status === "progress" ? "selected" : ""}>🔄 In Progress</option>
            <option value="done" ${task?.status === "done" ? "selected" : ""}>✅ Done</option>
          </select>
        </div>
      </div>
      <div class="task-modal-field">
        <label>Fällig am</label>
        <input type="date" id="taskModalDue" value="${task?.dueDate || ""}" />
      </div>
      <div class="task-modal-actions">
        <button class="btn-cancel" id="btnCancelTask">Abbrechen</button>
        <button class="btn-save-task" id="btnSaveTask">${task ? "Speichern" : "Erstellen"}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  requestAnimationFrame(() => overlay.classList.add("visible"));

  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(overlay); });
  document.getElementById("btnCloseModal")?.addEventListener("click", () => closeModal(overlay));
  document.getElementById("btnCancelTask")?.addEventListener("click", () => closeModal(overlay));

  document.getElementById("btnSaveTask")?.addEventListener("click", () => {
    const title = (document.getElementById("taskModalTitle") as HTMLInputElement).value.trim();
    if (!title) {
      (document.getElementById("taskModalTitle") as HTMLInputElement).classList.add("input-error");
      return;
    }
    const desc = (document.getElementById("taskModalDesc") as HTMLTextAreaElement).value;
    const priority = (document.getElementById("taskModalPriority") as HTMLSelectElement).value as Task["priority"];
    const status = (document.getElementById("taskModalStatus") as HTMLSelectElement).value as Task["status"];
    const due = (document.getElementById("taskModalDue") as HTMLInputElement).value;

    if (editingTaskId) {
      updateTask(editingTaskId, title, desc, priority, status, due);
    } else {
      createTask(title, desc, priority, due);
    }
    closeModal(overlay);
  });

  (document.getElementById("taskModalTitle") as HTMLInputElement)?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("btnSaveTask")?.click();
  });

  (document.getElementById("taskModalTitle") as HTMLInputElement)?.focus();
}

function closeModal(overlay: HTMLElement) {
  overlay.classList.remove("visible");
  setTimeout(() => overlay.remove(), 200);
  editingTaskId = null;
}

function renderTasks() {
  const tasks = getTasks();
  const container = document.getElementById("tasksContent");
  if (!container) return;

  const filtered = taskFilter === "all" ? tasks : tasks.filter((t) => t.priority === taskFilter);

  if (taskView === "kanban") {
    const todo = filtered.filter((t) => t.status === "todo");
    const progress = filtered.filter((t) => t.status === "progress");
    const done = filtered.filter((t) => t.status === "done");

    const renderCards = (taskList: Task[], status: string) => {
      if (taskList.length === 0) return '<div class="tasks-empty"><span class="empty-icon">📋</span><p>Keine Tasks</p></div>';
      return taskList
        .map(
          (t) => `
        <div class="task-card" data-task-id="${t.id}" draggable="true">
          <div class="task-card-header">
            <span class="task-priority ${t.priority}"></span>
            <span class="task-card-title ${t.done ? "done" : ""}">${t.title}</span>
            <div class="task-checkbox ${t.done ? "checked" : ""}" data-toggle-id="${t.id}"></div>
          </div>
          ${t.description ? `<div class="task-card-desc">${t.description}</div>` : ""}
          <div class="task-card-meta">
            ${t.dueDate ? `<span class="task-due-tag ${isOverdue(t.dueDate) && !t.done ? "overdue" : ""}">📅 ${new Date(t.dueDate).toLocaleDateString("de-DE")}</span>` : ""}
            <span>${getPriorityLabel(t.priority)} ${getPriorityText(t.priority)}</span>
          </div>
          <div class="task-card-actions">
            <button class="task-action-btn" data-edit-id="${t.id}" title="Bearbeiten">✏️</button>
            ${status === "todo" ? `<button class="task-action-btn accent" data-move-progress="${t.id}" title="Starten">▶️</button>` : ""}
            ${status === "progress" ? `<button class="task-action-btn success" data-move-done="${t.id}" title="Fertig">✅</button>` : ""}
            ${status === "done" ? `<button class="task-action-btn" data-move-todo="${t.id}" title="Zurück">↩️</button>` : ""}
            <button class="task-action-btn danger" data-delete-id="${t.id}" title="Löschen">🗑️</button>
          </div>
        </div>
      `
        )
        .join("");
    };

    container.innerHTML = `
      <div class="tasks-kanban">
        <div class="kanban-column" data-status="todo">
          <div class="kanban-column-header"><h3>📋 To Do</h3><span class="kanban-count">${todo.length}</span></div>
          <div class="kanban-tasks" data-status="todo">${renderCards(todo, "todo")}</div>
        </div>
        <div class="kanban-column" data-status="progress">
          <div class="kanban-column-header"><h3>🔄 In Progress</h3><span class="kanban-count">${progress.length}</span></div>
          <div class="kanban-tasks" data-status="progress">${renderCards(progress, "progress")}</div>
        </div>
        <div class="kanban-column" data-status="done">
          <div class="kanban-column-header"><h3>✅ Done</h3><span class="kanban-count">${done.length}</span></div>
          <div class="kanban-tasks" data-status="done">${renderCards(done, "done")}</div>
        </div>
      </div>
    `;
    setupKanbanDragDrop();
  } else {
    if (filtered.length === 0) {
      container.innerHTML = '<div class="tasks-empty"><span class="empty-icon">📋</span><p>Keine Tasks vorhanden</p></div>';
    } else {
      container.innerHTML = `
        <div class="tasks-list-view">
          <div class="task-list-header-row">
            <span class="tl-col tl-check"></span>
            <span class="tl-col tl-prio">Prio</span>
            <span class="tl-col tl-title">Titel</span>
            <span class="tl-col tl-status">Status</span>
            <span class="tl-col tl-due">Fällig</span>
            <span class="tl-col tl-actions">Aktionen</span>
          </div>
          ${filtered
          .map(
            (t) => `
            <div class="task-list-item" data-task-id="${t.id}">
              <div class="tl-col tl-check"><div class="task-checkbox ${t.done ? "checked" : ""}" data-toggle-id="${t.id}"></div></div>
              <span class="tl-col tl-prio">${getPriorityLabel(t.priority)}</span>
              <div class="tl-col tl-title">
                <span class="task-card-title ${t.done ? "done" : ""}">${t.title}</span>
                ${t.description ? `<span class="task-list-desc">${t.description.substring(0, 50)}</span>` : ""}
              </div>
              <span class="tl-col tl-status">
                <select class="task-status-select" data-status-id="${t.id}">
                  <option value="todo" ${t.status === "todo" ? "selected" : ""}>To Do</option>
                  <option value="progress" ${t.status === "progress" ? "selected" : ""}>In Progress</option>
                  <option value="done" ${t.status === "done" ? "selected" : ""}>Done</option>
                </select>
              </span>
              <span class="tl-col tl-due ${isOverdue(t.dueDate) && !t.done ? "overdue" : ""}">${t.dueDate ? new Date(t.dueDate).toLocaleDateString("de-DE") : "—"}</span>
              <div class="tl-col tl-actions">
                <button class="task-action-btn" data-edit-id="${t.id}" title="Bearbeiten">✏️</button>
                <button class="task-action-btn danger" data-delete-id="${t.id}" title="Löschen">🗑️</button>
              </div>
            </div>
          `
          )
          .join("")}
        </div>
      `;
    }
  }

  bindTaskEvents(container);
  updateDashboardTaskCount();
}

function bindTaskEvents(container: HTMLElement) {
  container.querySelectorAll("[data-toggle-id]").forEach((el) => {
    el.addEventListener("click", (e) => { e.stopPropagation(); toggleTaskDone(el.getAttribute("data-toggle-id")!); });
  });
  container.querySelectorAll("[data-delete-id]").forEach((el) => {
    el.addEventListener("click", (e) => { e.stopPropagation(); if (confirm("Task löschen?")) deleteTask(el.getAttribute("data-delete-id")!); });
  });
  container.querySelectorAll("[data-edit-id]").forEach((el) => {
    el.addEventListener("click", (e) => { e.stopPropagation(); showTaskModal(el.getAttribute("data-edit-id")!); });
  });
  container.querySelectorAll("[data-move-progress]").forEach((el) => {
    el.addEventListener("click", (e) => { e.stopPropagation(); moveTask(el.getAttribute("data-move-progress")!, "progress"); });
  });
  container.querySelectorAll("[data-move-done]").forEach((el) => {
    el.addEventListener("click", (e) => { e.stopPropagation(); moveTask(el.getAttribute("data-move-done")!, "done"); });
  });
  container.querySelectorAll("[data-move-todo]").forEach((el) => {
    el.addEventListener("click", (e) => { e.stopPropagation(); moveTask(el.getAttribute("data-move-todo")!, "todo"); });
  });
  container.querySelectorAll("[data-status-id]").forEach((el) => {
    el.addEventListener("change", (e) => {
      const select = e.target as HTMLSelectElement;
      moveTask(el.getAttribute("data-status-id")!, select.value as Task["status"]);
    });
  });
}

function setupKanbanDragDrop() {
  const cards = document.querySelectorAll(".task-card[draggable]");
  const columns = document.querySelectorAll(".kanban-tasks");

  cards.forEach((card) => {
    card.addEventListener("dragstart", (e) => {
      (e as DragEvent).dataTransfer?.setData("text/plain", card.getAttribute("data-task-id") || "");
      (card as HTMLElement).classList.add("dragging");
    });
    card.addEventListener("dragend", () => {
      (card as HTMLElement).classList.remove("dragging");
      columns.forEach((col) => (col as HTMLElement).classList.remove("drag-over"));
    });
  });

  columns.forEach((col) => {
    col.addEventListener("dragover", (e) => { e.preventDefault(); (col as HTMLElement).classList.add("drag-over"); });
    col.addEventListener("dragleave", () => { (col as HTMLElement).classList.remove("drag-over"); });
    col.addEventListener("drop", (e) => {
      e.preventDefault();
      (col as HTMLElement).classList.remove("drag-over");
      const taskId = (e as DragEvent).dataTransfer?.getData("text/plain");
      const newStatus = col.getAttribute("data-status") as Task["status"];
      if (taskId && newStatus) moveTask(taskId, newStatus);
    });
  });
}

function updateDashboardTaskCount() {
  const tasks = getTasks();
  const imp = tasks.filter((t) => t.priority === "important" && !t.done).length;
  const norm = tasks.filter((t) => t.priority === "normal" && !t.done).length;
  const opt = tasks.filter((t) => t.priority === "optional" && !t.done).length;
  (window as any).__taskCounts = { important: imp, normal: norm, optional: opt };
}

function setupTasksEvents() {
  document.getElementById("btnNewTask")?.addEventListener("click", () => showTaskModal());

  document.getElementById("btnKanban")?.addEventListener("click", () => {
    taskView = "kanban";
    document.getElementById("btnKanban")?.classList.add("active");
    document.getElementById("btnList")?.classList.remove("active");
    renderTasks();
  });

  document.getElementById("btnList")?.addEventListener("click", () => {
    taskView = "list";
    document.getElementById("btnList")?.classList.add("active");
    document.getElementById("btnKanban")?.classList.remove("active");
    renderTasks();
  });

  document.querySelectorAll(".filter-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".filter-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      taskFilter = (tab.getAttribute("data-filter") || "all") as any;
      renderTasks();
    });
  });
}

// ============================================================
// KALENDER SYSTEM
// ============================================================
interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  color: string;
  created: string;
}

function getEvents(): CalendarEvent[] {
  const data = localStorage.getItem("bycore-events");
  return data ? JSON.parse(data) : [];
}

function saveEvents(events: CalendarEvent[]) {
  localStorage.setItem("bycore-events", JSON.stringify(events));
}

let calendarYear = new Date().getFullYear();
let calendarMonth = new Date().getMonth();
let selectedDate: string | null = null;
let editingEventId: string | null = null;

function getMonthName(month: number): string {
  return ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"][month];
}

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function getTodayStr(): string {
  const t = new Date();
  return toDateStr(t.getFullYear(), t.getMonth(), t.getDate());
}

function getCalendarDays(year: number, month: number): { date: string; day: number; currentMonth: boolean }[] {
  const firstDay = new Date(year, month, 1).getDay();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const days: { date: string; day: number; currentMonth: boolean }[] = [];

  for (let i = startOffset - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const pm = month === 0 ? 11 : month - 1;
    const py = month === 0 ? year - 1 : year;
    days.push({ date: toDateStr(py, pm, d), day: d, currentMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({ date: toDateStr(year, month, d), day: d, currentMonth: true });
  }
  const remaining = 42 - days.length;
  for (let d = 1; d <= remaining; d++) {
    const nm = month === 11 ? 0 : month + 1;
    const ny = month === 11 ? year + 1 : year;
    days.push({ date: toDateStr(ny, nm, d), day: d, currentMonth: false });
  }
  return days;
}

function renderCalendar() {
  const container = document.getElementById("calendarGrid");
  const sidebarEvents = document.getElementById("calendarSidebarEvents");
  const sidebarHeader = document.getElementById("calendarSidebarHeader");
  const monthLabel = document.getElementById("calMonthLabel");
  if (!container) return;

  const events = getEvents();
  const today = getTodayStr();
  if (!selectedDate) selectedDate = today;
  if (monthLabel) monthLabel.textContent = `${getMonthName(calendarMonth)} ${calendarYear}`;

  const days = getCalendarDays(calendarYear, calendarMonth);
  const weekdays = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

  container.innerHTML = `
    <div class="calendar-weekdays">
      ${weekdays.map((w) => `<div class="calendar-weekday">${w}</div>`).join("")}
    </div>
    <div class="calendar-days">
      ${days.map((d) => {
    const dayEvents = events.filter((e) => e.date === d.date);
    const isToday = d.date === today;
    const isSelected = d.date === selectedDate;
    const cls = ["calendar-day", !d.currentMonth ? "other-month" : "", isToday ? "today" : "", isSelected ? "selected" : ""].filter(Boolean).join(" ");
    return `
          <div class="${cls}" data-date="${d.date}">
            <span class="day-number">${d.day}</span>
            <div class="day-events">
              ${dayEvents.slice(0, 3).map((e) => `<div class="day-event-dot color-${e.color}">${e.startTime ? e.startTime + " " : ""}${e.title}</div>`).join("")}
              ${dayEvents.length > 3 ? `<div class="day-event-more">+${dayEvents.length - 3} mehr</div>` : ""}
            </div>
          </div>`;
  }).join("")}
    </div>
  `;

  container.querySelectorAll(".calendar-day").forEach((el) => {
    el.addEventListener("click", () => { selectedDate = el.getAttribute("data-date"); renderCalendar(); });
  });

  if (sidebarHeader && selectedDate) {
    const selDate = new Date(selectedDate + "T00:00:00");
    sidebarHeader.innerHTML = `<h2>📅 ${selDate.toLocaleDateString("de-DE", { weekday: "long" })}</h2><div class="calendar-sidebar-date">${selDate.toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" })}</div>`;
  }

  if (sidebarEvents && selectedDate) {
    const dayEvents = events.filter((e) => e.date === selectedDate).sort((a, b) => a.startTime.localeCompare(b.startTime));
    if (dayEvents.length === 0) {
      sidebarEvents.innerHTML = `<div class="sidebar-no-events"><span class="empty-icon">📅</span><p>Keine Termine an diesem Tag</p></div>`;
    } else {
      sidebarEvents.innerHTML = dayEvents.map((e) => `
        <div class="sidebar-event-item">
          <div class="event-color-bar color-${e.color}"></div>
          <div class="sidebar-event-info">
            <div class="sidebar-event-title">${e.title}</div>
            <div class="sidebar-event-time">${e.startTime}${e.endTime ? " – " + e.endTime : ""}</div>
            ${e.description ? `<div class="sidebar-event-desc">${e.description}</div>` : ""}
          </div>
          <div class="sidebar-event-actions">
            <button class="sidebar-event-btn" data-edit-event="${e.id}">✏️</button>
            <button class="sidebar-event-btn danger" data-delete-event="${e.id}">🗑️</button>
          </div>
        </div>`).join("");

      sidebarEvents.querySelectorAll("[data-edit-event]").forEach((el) => {
        el.addEventListener("click", () => showEventModal(el.getAttribute("data-edit-event")!));
      });
      sidebarEvents.querySelectorAll("[data-delete-event]").forEach((el) => {
        el.addEventListener("click", () => { if (confirm("Termin löschen?")) deleteEvent(el.getAttribute("data-delete-event")!); });
      });
    }
  }

  // Upcoming
  const upcomingEl = document.getElementById("calendarUpcoming");
  if (upcomingEl) {
    const upcoming = events.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)).slice(0, 5);
    upcomingEl.innerHTML = `<div class="upcoming-title">Nächste Termine</div>${upcoming.length === 0 ? '<p style="font-size:12px;color:var(--text-secondary)">Keine anstehenden Termine</p>'
        : upcoming.map((e) => `<div class="upcoming-item"><span class="upcoming-item-dot" style="background:${getColorVal(e.color)}"></span><span class="upcoming-item-date">${new Date(e.date + "T00:00:00").toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}</span><span class="upcoming-item-title">${e.title}</span></div>`).join("")
      }`;
  }
}

function getColorVal(c: string): string {
  const m: Record<string, string> = { blue: "var(--accent)", green: "var(--success)", red: "var(--danger)", orange: "var(--warning)", purple: "#a855f7" };
  return m[c] || "var(--accent)";
}

function createEvent(title: string, desc: string, date: string, start: string, end: string, color: string) {
  const events = getEvents();
  events.push({ id: Date.now().toString(), title, description: desc, date, startTime: start, endTime: end, color, created: new Date().toISOString() });
  saveEvents(events);
  renderCalendar();
}

function updateCalEvent(id: string, title: string, desc: string, date: string, start: string, end: string, color: string) {
  const events = getEvents();
  const ev = events.find((e) => e.id === id);
  if (ev) { ev.title = title; ev.description = desc; ev.date = date; ev.startTime = start; ev.endTime = end; ev.color = color; saveEvents(events); renderCalendar(); }
}

function deleteEvent(id: string) {
  saveEvents(getEvents().filter((e) => e.id !== id));
  renderCalendar();
}

function showEventModal(editId?: string) {
  editingEventId = editId || null;
  const ev = editId ? getEvents().find((e) => e.id === editId) : null;
  const defDate = selectedDate || getTodayStr();
  const defColor = ev?.color || "blue";

  const overlay = document.createElement("div");
  overlay.className = "event-modal-overlay";
  overlay.innerHTML = `
    <div class="event-modal">
      <div class="event-modal-top">
        <h2>${ev ? "Termin bearbeiten" : "Neuer Termin"}</h2>
        <button class="btn-modal-close" id="btnCloseEvent">✕</button>
      </div>
      <div class="event-modal-field"><label>Titel</label><input type="text" id="evTitle" placeholder="Terminname..." value="${ev ? ev.title.replace(/"/g, "&quot;") : ""}" /></div>
      <div class="event-modal-field"><label>Beschreibung</label><textarea id="evDesc" placeholder="Details (optional)..." rows="2">${ev ? ev.description : ""}</textarea></div>
      <div class="event-modal-field"><label>Datum</label><input type="date" id="evDate" value="${ev ? ev.date : defDate}" /></div>
      <div class="event-modal-row">
        <div class="event-modal-field"><label>Von</label><input type="time" id="evStart" value="${ev ? ev.startTime : "09:00"}" /></div>
        <div class="event-modal-field"><label>Bis</label><input type="time" id="evEnd" value="${ev ? ev.endTime : "10:00"}" /></div>
      </div>
      <div class="event-modal-field">
        <label>Farbe</label>
        <div class="color-picker-row" id="colorPicker">
          ${["blue", "green", "red", "orange", "purple"].map((c) => `<div class="color-option color-${c} ${defColor === c ? "selected" : ""}" data-color="${c}"></div>`).join("")}
        </div>
      </div>
      <div class="event-modal-actions">
        <button class="btn-cancel" id="btnCancelEv">Abbrechen</button>
        <button class="btn-save-task" id="btnSaveEv">${ev ? "Speichern" : "Erstellen"}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("visible"));

  let selColor = defColor;
  overlay.querySelectorAll(".color-option").forEach((o) => {
    o.addEventListener("click", () => { overlay.querySelectorAll(".color-option").forEach((x) => x.classList.remove("selected")); o.classList.add("selected"); selColor = o.getAttribute("data-color") || "blue"; });
  });

  const close = () => { overlay.classList.remove("visible"); setTimeout(() => overlay.remove(), 200); editingEventId = null; };
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  document.getElementById("btnCloseEvent")?.addEventListener("click", close);
  document.getElementById("btnCancelEv")?.addEventListener("click", close);

  document.getElementById("btnSaveEv")?.addEventListener("click", () => {
    const title = (document.getElementById("evTitle") as HTMLInputElement).value.trim();
    if (!title) { (document.getElementById("evTitle") as HTMLInputElement).classList.add("input-error"); return; }
    const desc = (document.getElementById("evDesc") as HTMLTextAreaElement).value;
    const date = (document.getElementById("evDate") as HTMLInputElement).value;
    const start = (document.getElementById("evStart") as HTMLInputElement).value;
    const end = (document.getElementById("evEnd") as HTMLInputElement).value;
    if (editingEventId) { updateCalEvent(editingEventId, title, desc, date, start, end, selColor); } else { createEvent(title, desc, date, start, end, selColor); }
    selectedDate = date;
    close();
  });

  (document.getElementById("evTitle") as HTMLInputElement)?.focus();
}

function setupCalendarEvents() {
  document.getElementById("btnPrevMonth")?.addEventListener("click", () => { calendarMonth--; if (calendarMonth < 0) { calendarMonth = 11; calendarYear--; } renderCalendar(); });
  document.getElementById("btnNextMonth")?.addEventListener("click", () => { calendarMonth++; if (calendarMonth > 11) { calendarMonth = 0; calendarYear++; } renderCalendar(); });
  document.getElementById("btnCalToday")?.addEventListener("click", () => { const t = new Date(); calendarYear = t.getFullYear(); calendarMonth = t.getMonth(); selectedDate = getTodayStr(); renderCalendar(); });
  document.getElementById("btnNewEvent")?.addEventListener("click", () => showEventModal());
}


// ============================================================
// SYSTEM MONITOR
// ============================================================
function getStorageUsage(): { used: string; keys: number; bytes: number } {
  let total = 0;
  let keys = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith("bycore-")) {
      total += (localStorage.getItem(key) || "").length * 2;
      keys++;
    }
  }
  if (total < 1024) return { used: total + " B", keys, bytes: total };
  if (total < 1024 * 1024) return { used: (total / 1024).toFixed(1) + " KB", keys, bytes: total };
  return { used: (total / (1024 * 1024)).toFixed(2) + " MB", keys, bytes: total };
}

function getAppStats() {
  const notes = getNotes();
  const tasks = getTasks();
  const events = getEvents();
  return {
    totalNotes: notes.length,
    pinnedNotes: notes.filter((n) => n.pinned).length,
    totalTasks: tasks.length,
    openTasks: tasks.filter((t) => !t.done).length,
    doneTasks: tasks.filter((t) => t.done).length,
    totalEvents: events.length,
    upcomingEvents: events.filter((e) => e.date >= getTodayStr()).length,
  };
}

let systemInterval: any = null;
let lastSystemStats: any = null;

if ((window as any).electronAPI?.onSystemStats) {
  (window as any).electronAPI.onSystemStats((stats: any) => {
    lastSystemStats = stats;
    updateSystemMonitorUI();
  });
}

function updateSystemMonitorUI() {
  if (!lastSystemStats) return;

  const statusEl = document.querySelector(".sys-status");
  if (statusEl) {
    statusEl.textContent = lastSystemStats.network.online ? "Online" : "Offline";
    statusEl.className = `sys-hero-number sys-status ${lastSystemStats.network.online ? "online" : "offline"}`;
  }

  const cpuEl = document.getElementById("sysCpuValue");
  if (cpuEl) cpuEl.textContent = lastSystemStats.cpu + "%";

  const ramEl = document.getElementById("sysRamValue");
  if (ramEl) ramEl.textContent = `${lastSystemStats.ram.used} / ${lastSystemStats.ram.total} GB`;

  const diskUsedEl = document.getElementById("sysDiskUsed");
  if (diskUsedEl) diskUsedEl.textContent = lastSystemStats.disk.used + " GB";

  const diskTotalEl = document.getElementById("sysDiskTotal");
  if (diskTotalEl) diskTotalEl.textContent = lastSystemStats.disk.total + " GB";

  const netSpeedEl = document.getElementById("sysNetSpeed");
  if (netSpeedEl) netSpeedEl.textContent = lastSystemStats.network.speed;

  const ringFill = document.querySelector(".sys-ring-fill") as any;
  const ringPercent = document.querySelector(".sys-ring-percent");
  if (ringFill && ringPercent && lastSystemStats.disk.total > 0) {
    const percent = ((lastSystemStats.disk.used / lastSystemStats.disk.total) * 100);
    ringPercent.textContent = percent.toFixed(1) + "%";
    ringFill.setAttribute("stroke-dasharray", `${percent * 2.64} 264`);
  }
}


function renderSystemMonitor() {
  const container = document.getElementById("systemContent");
  if (!container) return;

  const storage = getStorageUsage();
  const stats = getAppStats();
  const theme = localStorage.getItem("bycore-theme") || "dark";
  const userName = localStorage.getItem("bycore-username") || "Leon";
  const nav = navigator as any;
  const storagePercent = Math.min((storage.bytes / (5 * 1024 * 1024)) * 100, 100).toFixed(1);
  const totalItems = stats.totalNotes + stats.totalTasks + stats.totalEvents;

  container.innerHTML = `
    <div class="sys-hero">
      <div class="sys-hero-left">
        <div class="sys-hero-time" id="sysHeroTime">${new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</div>
        <div class="sys-hero-date" id="sysHeroDate">${new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
      </div>
      <div class="sys-hero-right">
        <div class="sys-hero-stat"><span class="sys-hero-number">${totalItems}</span><span class="sys-hero-label">Einträge gesamt</span></div>
        <div class="sys-hero-stat"><span class="sys-hero-number">${storage.used}</span><span class="sys-hero-label">Bycore Speicher</span></div>
        <div class="sys-hero-stat"><span class="sys-hero-number sys-status ${lastSystemStats?.network.online ?? navigator.onLine ? "online" : "offline"}">${lastSystemStats?.network.online ?? navigator.onLine ? "Online" : "Offline"}</span><span class="sys-hero-label">Status</span></div>
      </div>
    </div>

    <div class="sys-stats-bar">
      <div class="sys-stat-pill"><span class="sys-pill-icon">📝</span><span class="sys-pill-num">${stats.totalNotes}</span><span class="sys-pill-label">Notizen</span></div>
      <div class="sys-stat-pill"><span class="sys-pill-icon">📌</span><span class="sys-pill-num">${stats.pinnedNotes}</span><span class="sys-pill-label">Gepinnt</span></div>
      <div class="sys-stat-pill"><span class="sys-pill-icon">✅</span><span class="sys-pill-num">${stats.totalTasks}</span><span class="sys-pill-label">Tasks</span></div>
      <div class="sys-stat-pill"><span class="sys-pill-icon">🔄</span><span class="sys-pill-num">${stats.openTasks}</span><span class="sys-pill-label">Offen</span></div>
      <div class="sys-stat-pill"><span class="sys-pill-icon">✔️</span><span class="sys-pill-num">${stats.doneTasks}</span><span class="sys-pill-label">Erledigt</span></div>
      <div class="sys-stat-pill"><span class="sys-pill-icon">📅</span><span class="sys-pill-num">${stats.totalEvents}</span><span class="sys-pill-label">Termine</span></div>
      <div class="sys-stat-pill"><span class="sys-pill-icon">🔮</span><span class="sys-pill-num">${stats.upcomingEvents}</span><span class="sys-pill-label">Anstehend</span></div>
    </div>

    <div class="sys-grid">
      <div class="sys-card sys-card-accent">
        <div class="sys-card-icon">🖥️</div>
        <h3>System Hardware</h3>
        <div class="sys-rows">
          <div class="sys-row"><span class="sys-label">CPU Auslastung</span><span class="sys-value" id="sysCpuValue">${lastSystemStats?.cpu ?? "..."}%</span></div>
          <div class="sys-row"><span class="sys-label">RAM Nutzung</span><span class="sys-value" id="sysRamValue">${lastSystemStats ? `${lastSystemStats.ram.used} / ${lastSystemStats.ram.total} GB` : "..."}</span></div>
          <div class="sys-row"><span class="sys-label">Plattform</span><span class="sys-value">${navigator.platform || "Unbekannt"}</span></div>
          <div class="sys-row"><span class="sys-label">DPI Scale</span><span class="sys-value">${window.devicePixelRatio}x</span></div>
          <div class="sys-row"><span class="sys-label">Netzwerk</span><span class="sys-value" id="sysNetSpeed">${lastSystemStats?.network.speed ?? "..."}</span></div>
        </div>
      </div>
      <div class="sys-card">
        <div class="sys-card-icon">💾</div>
        <h3>Laufwerk (Disk)</h3>
        <div class="sys-storage-visual">
          <div class="sys-storage-ring">
            <svg viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border)" stroke-width="8"/>
              <circle cx="50" cy="50" r="42" fill="none" stroke="var(--accent)" stroke-width="8" stroke-dasharray="${lastSystemStats ? (lastSystemStats.disk.used / lastSystemStats.disk.total) * 100 * 2.64 : 0} 264" stroke-linecap="round" transform="rotate(-90 50 50)" class="sys-ring-fill"/>
            </svg>
            <div class="sys-ring-text"><span class="sys-ring-percent">${lastSystemStats ? ((lastSystemStats.disk.used / lastSystemStats.disk.total) * 100).toFixed(1) : "0"}%</span></div>
          </div>
          <div class="sys-storage-details">
            <div class="sys-row"><span class="sys-label">Belegt</span><span class="sys-value" id="sysDiskUsed">${lastSystemStats?.disk.used ?? "..."} GB</span></div>
            <div class="sys-row"><span class="sys-label">Gesamt</span><span class="sys-value" id="sysDiskTotal">${lastSystemStats?.disk.total ?? "..."} GB</span></div>
            <div class="sys-row"><span class="sys-label">App Cache</span><span class="sys-value">${storage.used}</span></div>
          </div>
        </div>
      </div>
      <div class="sys-card">
        <div class="sys-card-icon">⚙️</div>
        <h3>Konfiguration</h3>
        <div class="sys-rows">
          <div class="sys-row"><span class="sys-label">Benutzer</span><span class="sys-value">${userName}</span></div>
          <div class="sys-row"><span class="sys-label">Theme</span><span class="sys-value">${theme === "dark" ? "🌙 Dark" : "☀️ Light"}</span></div>
          <div class="sys-row"><span class="sys-label">Version</span><span class="sys-value">BYCORE v1.0.0</span></div>
          <div class="sys-row"><span class="sys-label">Engine</span><span class="sys-value">Electron + TypeScript</span></div>
          <div class="sys-row"><span class="sys-label">Uptime</span><span class="sys-value" id="sysUptime">0s</span></div>
        </div>
      </div>
    </div>
  `;


  clearInterval(systemInterval);
  const startTime = Date.now();
  systemInterval = setInterval(() => {
    const timeEl = document.getElementById("sysHeroTime");
    const uptimeEl = document.getElementById("sysUptime");
    if (timeEl) timeEl.textContent = new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    if (uptimeEl) {
      const sec = Math.floor((Date.now() - startTime) / 1000);
      const min = Math.floor(sec / 60);
      const hr = Math.floor(min / 60);
      uptimeEl.textContent = hr > 0 ? `${hr}h ${min % 60}m` : min > 0 ? `${min}m ${sec % 60}s` : `${sec}s`;
    }
  }, 1000);
}

function getBrowserName(): string {
  const ua = navigator.userAgent;
  if (ua.includes("Chrome") && !ua.includes("Edg")) return "Chrome " + (ua.match(/Chrome\/(\d+)/) || [])[1];
  if (ua.includes("Edg")) return "Edge " + (ua.match(/Edg\/(\d+)/) || [])[1];
  if (ua.includes("Firefox")) return "Firefox " + (ua.match(/Firefox\/(\d+)/) || [])[1];
  if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
  return "Unbekannt";
}

function setupSystemMonitor() {
  renderSystemMonitor();
}

// ============================================================
// SETTINGS
// ============================================================
function renderSettings() {
  const container = document.getElementById("settingsContent");
  if (!container) return;

  const userName = localStorage.getItem("bycore-username") || "Leon";
  const theme = localStorage.getItem("bycore-theme") || "dark";

  container.innerHTML = `
    <div class="settings-grid">
      <div class="settings-card">
        <div class="settings-card-header"><h3>👤 Profil</h3></div>
        <div class="settings-field">
          <label>Benutzername</label>
          <p class="settings-hint">Wird im Dashboard-Greeting angezeigt</p>
          <input type="text" class="settings-input" id="settingsUsername" value="${userName.replace(/"/g, "&quot;")}" placeholder="Dein Name..." />
          <button class="settings-btn" id="btnSaveUsername">Speichern</button>
        </div>
      </div>
      <div class="settings-card">
        <div class="settings-card-header"><h3>🎨 Erscheinungsbild</h3></div>
        <div class="settings-field">
          <label>Theme</label>
          <div class="settings-theme-row">
            <button class="settings-theme-btn ${theme === "dark" ? "active" : ""}" id="btnThemeDark">🌙 Dark Mode</button>
            <button class="settings-theme-btn ${theme === "light" ? "active" : ""}" id="btnThemeLight">☀️ Light Mode</button>
          </div>
        </div>
      </div>
      <div class="settings-card">
        <div class="settings-card-header"><h3>💾 Daten</h3></div>
        <div class="settings-field">
          <label>Backup exportieren</label>
          <p class="settings-hint">Alle Notizen, Tasks und Termine als JSON-Datei herunterladen</p>
          <button class="settings-btn" id="btnExportData">📦 Daten exportieren</button>
        </div>
        <div class="settings-field">
          <label>Backup importieren</label>
          <p class="settings-hint">JSON-Backup wiederherstellen</p>
          <input type="file" id="settingsImportFile" accept=".json" class="settings-file-input" />
          <button class="settings-btn" id="btnImportData">📥 Daten importieren</button>
        </div>
      </div>
      <div class="settings-card settings-card-danger">
        <div class="settings-card-header"><h3>⚠️ Gefahrenzone</h3></div>
        <div class="settings-field">
          <label>Alle Daten löschen</label>
          <p class="settings-hint">Löscht alle Notizen, Tasks, Termine und Einstellungen unwiderruflich</p>
          <button class="settings-btn settings-btn-danger" id="btnResetAll">🗑️ Alles zurücksetzen</button>
        </div>
      </div>
      <div class="settings-card">
        <div class="settings-card-header"><h3>ℹ️ Über BYCORE</h3></div>
        <div class="settings-about">
          <div class="settings-about-logo">🧊</div>
          <h2>BYCORE</h2>
          <p class="settings-version">Version 1.0.0</p>
          <p class="settings-desc">Deine persönliche Home Base – gebaut mit Tauri & TypeScript</p>
          <p class="settings-credits">Entwickelt von Leon @ aimbit GmbH</p>
        </div>
      </div>
    </div>
  `;

  document.getElementById("btnSaveUsername")?.addEventListener("click", () => {
    const input = document.getElementById("settingsUsername") as HTMLInputElement;
    const name = input.value.trim();
    if (name) {
      localStorage.setItem("bycore-username", name);
      input.classList.add("settings-input-success");
      setTimeout(() => input.classList.remove("settings-input-success"), 1500);
    }
  });

  document.getElementById("btnThemeDark")?.addEventListener("click", () => {
    isDark = true;
    document.documentElement.setAttribute("data-theme", "dark");
    localStorage.setItem("bycore-theme", "dark");
    if (themeToggle) themeToggle.textContent = "🌙";
    renderSettings();
  });
  document.getElementById("btnThemeLight")?.addEventListener("click", () => {
    isDark = false;
    document.documentElement.setAttribute("data-theme", "light");
    localStorage.setItem("bycore-theme", "light");
    if (themeToggle) themeToggle.textContent = "☀️";
    renderSettings();
  });

  document.getElementById("btnExportData")?.addEventListener("click", () => {
    const data: Record<string, any> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("bycore-")) {
        try { data[key] = JSON.parse(localStorage.getItem(key) || ""); } catch { data[key] = localStorage.getItem(key); }
      }
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bycore-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById("btnImportData")?.addEventListener("click", () => {
    const fileInput = document.getElementById("settingsImportFile") as HTMLInputElement;
    const file = fileInput?.files?.[0];
    if (!file) { alert("Bitte wähle eine JSON-Datei aus."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (typeof data !== "object") throw new Error("Ungültig");
        if (confirm(`Import: ${Object.keys(data).length} Einträge gefunden. Bestehende Daten werden überschrieben. Fortfahren?`)) {
          Object.entries(data).forEach(([key, val]) => {
            localStorage.setItem(key, typeof val === "string" ? val : JSON.stringify(val));
          });
          alert("✅ Import erfolgreich! Seite wird neu geladen.");
          location.reload();
        }
      } catch { alert("❌ Ungültige Datei. Bitte nutze ein BYCORE-Backup."); }
    };
    reader.readAsText(file);
  });

  document.getElementById("btnResetAll")?.addEventListener("click", () => {
    if (confirm("⚠️ ACHTUNG: Alle BYCORE-Daten werden unwiderruflich gelöscht!\n\nBist du sicher?")) {
      if (confirm("Wirklich ALLES löschen? Das kann nicht rückgängig gemacht werden!")) {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith("bycore-")) keysToRemove.push(key);
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
        alert("✅ Alle Daten gelöscht. Seite wird neu geladen.");
        location.reload();
      }
    }
  });
}

function setupSettings() {
  renderSettings();
}

// ============================================================
// MODULE TEMPLATES
// ============================================================
function getUpcomingDashEvents(): string {
  const events = getEvents();
  const today = getTodayStr();
  const upcoming = events
    .filter((e) => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
    .slice(0, 4);

  if (upcoming.length === 0) {
    return '<div class="event-item" style="opacity:0.5"><span class="event-time">—</span><span class="event-title">Keine anstehenden Termine</span></div>';
  }

  return upcoming.map((e) => {
    const dateLabel = e.date === today ? "Heute" : new Date(e.date + "T00:00:00").toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
    return `<div class="event-item"><span class="event-time">${e.startTime || "—"}</span><span class="event-title">${e.title}</span><span class="event-date-badge">${dateLabel}</span></div>`;
  }).join("");
}

function getDashboardHTML(): string {
  const tasks = getTasks();
  const imp = tasks.filter((t) => t.priority === "important" && !t.done).length;
  const norm = tasks.filter((t) => t.priority === "normal" && !t.done).length;
  const opt = tasks.filter((t) => t.priority === "optional" && !t.done).length;
  const totalDone = tasks.filter((t) => t.done).length;
  const totalNotes = getNotes().length;

  const hour = new Date().getHours();
  let greeting = "Guten Morgen";
  if (hour >= 12 && hour < 18) greeting = "Guten Tag";
  else if (hour >= 18) greeting = "Guten Abend";
  const userName = localStorage.getItem("bycore-username") || "Leon";

  const quotes = [
    { text: "Code is like humor. When you have to explain it, it's bad.", author: "Cory House" },
    { text: "First, solve the problem. Then, write the code.", author: "John Johnson" },
    { text: "Simplicity is the soul of efficiency.", author: "Austin Freeman" },
    { text: "Make it work, make it right, make it fast.", author: "Kent Beck" },
    { text: "The best error message is the one that never shows up.", author: "Thomas Fuchs" },
    { text: "Talk is cheap. Show me the code.", author: "Linus Torvalds" },
    { text: "Any fool can write code that a computer can understand. Good programmers write code that humans can understand.", author: "Martin Fowler" },
  ];
  const quote = quotes[Math.floor(Math.random() * quotes.length)];

  const totalTasks = tasks.length;
  const completionPct = totalTasks > 0 ? Math.round((totalDone / totalTasks) * 100) : 0;
  const strokeDash = (completionPct / 100) * 251.2;
  const events = JSON.parse(localStorage.getItem("bycore-events") || "[]");
  const todayEvents = events.filter((e: any) => e.date === new Date().toISOString().split("T")[0]).length;
  const pinnedNotes = getNotes().filter((n) => n.pinned).length;

  return `
    <div class="dashboard">
      <!-- HERO BANNER -->
      <div class="dash-hero">
        <div class="dash-hero-particles">
          <span class="particle"></span><span class="particle"></span><span class="particle"></span>
          <span class="particle"></span><span class="particle"></span><span class="particle"></span>
        </div>
        <div class="dash-hero-left">
          <p class="dash-hero-greeting">${greeting},</p>
          <h1 class="dash-hero-name">${userName} 👋</h1>
          <p class="dash-hero-date" id="date-display"></p>
        </div>
        <div class="dash-hero-center">
          <p class="clock" id="clock"></p>
        </div>
        <div class="dash-hero-right">
          <div class="dash-hero-ring">
            <svg viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="6"/>
              <circle cx="50" cy="50" r="40" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"
                stroke-dasharray="${strokeDash} 251.2" transform="rotate(-90 50 50)" class="dash-ring-fill"/>
            </svg>
            <div class="dash-ring-text">
              <span class="dash-ring-num">${completionPct}%</span>
            </div>
          </div>
          <span class="dash-ring-label">Produktivität</span>
        </div>
      </div>

      <!-- QUICK STATS BAR -->
      <div class="dash-stats-bar">
        <div class="dash-stat-chip">
          <span class="dash-chip-icon">📋</span>
          <span class="dash-chip-num">${imp + norm + opt}</span>
          <span class="dash-chip-label">Offene Tasks</span>
        </div>
        <div class="dash-stat-chip">
          <span class="dash-chip-icon">✅</span>
          <span class="dash-chip-num">${totalDone}</span>
          <span class="dash-chip-label">Erledigt</span>
        </div>
        <div class="dash-stat-chip">
          <span class="dash-chip-icon">📝</span>
          <span class="dash-chip-num">${totalNotes}</span>
          <span class="dash-chip-label">Notizen</span>
        </div>
        <div class="dash-stat-chip">
          <span class="dash-chip-icon">📌</span>
          <span class="dash-chip-num">${pinnedNotes}</span>
          <span class="dash-chip-label">Gepinnt</span>
        </div>
        <div class="dash-stat-chip">
          <span class="dash-chip-icon">📅</span>
          <span class="dash-chip-num">${todayEvents}</span>
          <span class="dash-chip-label">Heute</span>
        </div>
      </div>

      <!-- MAIN GRID -->
      <div class="dashboard-grid">
        <div class="dash-card dash-card-tasks">
          <div class="dash-card-header"><h3>Tasks</h3><span class="card-icon">✅</span></div>
          <div class="task-stats">
            <div class="task-stat-row important"><span class="label">🔴 Wichtig</span><span class="count" id="dashImp">${imp}</span></div>
            <div class="task-stat-row normal"><span class="label">🟡 Normal</span><span class="count" id="dashNorm">${norm}</span></div>
            <div class="task-stat-row optional"><span class="label">⚪ Optional</span><span class="count" id="dashOpt">${opt}</span></div>
          </div>
          <div class="dash-task-progress">
            <div class="dash-progress-bar"><div class="dash-progress-fill" style="width:${completionPct}%"></div></div>
            <span class="dash-progress-text">${totalDone}/${totalTasks} erledigt</span>
          </div>
        </div>
        <div class="dash-card dash-card-events">
          <div class="dash-card-header"><h3>Nächste Termine</h3><span class="card-icon">📅</span></div>
          <div class="event-list">
            ${getUpcomingDashEvents()}
          </div>
        </div>
        <div class="dash-card dash-card-actions">
          <div class="dash-card-header"><h3>Quick Actions</h3><span class="card-icon">⚡</span></div>
          <div class="quick-actions">
            <button class="quick-action-btn" id="qaNewNote"><span class="qa-icon">📝</span> Neue Notiz</button>
            <button class="quick-action-btn" id="qaNewTask"><span class="qa-icon">✅</span> Neuer Task</button>
            <button class="quick-action-btn" id="qaSystem"><span class="qa-icon">📊</span> System Monitor</button>
          </div>
        </div>
        <div class="dash-card quote-card">
          <div class="dash-card-header"><h3>Motivation</h3><span class="card-icon">💡</span></div>
          <p class="quote-text">"${quote.text}"</p>
          <p class="quote-author">— ${quote.author}</p>
        </div>
      </div>
    </div>
  `;
}

const moduleTemplates: Record<string, string> = {
  notes: `
    <div class="notes-container">
      <div class="notes-sidebar">
        <div class="notes-sidebar-header">
          <h2>📝 Notizen</h2>
          <div class="notes-sidebar-actions">
            <input type="text" class="notes-search" id="notesSearch" placeholder="Suchen..." />
            <button class="btn-new-note" id="btnNewNote">+ Neu</button>
          </div>
        </div>
        <div class="notes-list" id="notesList"></div>
      </div>
      <div class="notes-editor-area" id="notesEditorArea"></div>
    </div>
  `,
  tasks: `
    <div class="tasks-container">
      <div class="tasks-header">
        <h1>✅ Task Manager</h1>
        <div class="tasks-header-actions">
          <button class="btn-view-toggle active" id="btnKanban">Kanban</button>
          <button class="btn-view-toggle" id="btnList">Liste</button>
          <button class="btn-new-task" id="btnNewTask">+ Neuer Task</button>
        </div>
      </div>
      <div class="tasks-filters">
        <button class="filter-tab active" data-filter="all">Alle</button>
        <button class="filter-tab" data-filter="important">🔴 Wichtig</button>
        <button class="filter-tab" data-filter="normal">🟡 Normal</button>
        <button class="filter-tab" data-filter="optional">⚪ Optional</button>
      </div>
      <div id="tasksContent"></div>
    </div>
  `,
  calendar: `
    <div class="calendar-container">
      <div class="calendar-main">
        <div class="calendar-header">
          <h1>📅 Kalender</h1>
          <div class="calendar-nav">
            <button class="btn-cal-nav" id="btnPrevMonth">◀</button>
            <span class="calendar-month-label" id="calMonthLabel"></span>
            <button class="btn-cal-nav" id="btnNextMonth">▶</button>
            <button class="btn-cal-today" id="btnCalToday">Heute</button>
          </div>
          <div class="calendar-header-actions">
            <button class="btn-new-event" id="btnNewEvent">+ Neuer Termin</button>
          </div>
        </div>
        <div class="calendar-grid" id="calendarGrid"></div>
      </div>
      <div class="calendar-sidebar">
        <div class="calendar-sidebar-header" id="calendarSidebarHeader"></div>
        <div class="calendar-sidebar-events" id="calendarSidebarEvents"></div>
        <div class="calendar-sidebar-upcoming" id="calendarUpcoming"></div>
      </div>
    </div>
  `,
  system: `
    <div class="system-container">
      <div class="system-header"><h1>📊 System Monitor</h1></div>
      <div class="system-content" id="systemContent"></div>
    </div>
  `,
  settings: `
    <div class="settings-container">
      <div class="settings-header"><h1>⚙️ Settings</h1></div>
      <div class="settings-content" id="settingsContent"></div>
    </div>
  `,
};

// ============================================================
// ANIMATIONS & 3D EFFECTS
// ============================================================

let scrollObserver: IntersectionObserver | null = null;

function setupScrollReveal() {
  if (scrollObserver) scrollObserver.disconnect();

  scrollObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
        }
      });
    },
    { threshold: 0.05, rootMargin: "0px 0px -20px 0px" }
  );

  document.querySelectorAll(
    ".scroll-reveal, .scroll-reveal-left, .scroll-reveal-right, .scroll-reveal-scale, .scroll-reveal-flip"
  ).forEach((el) => scrollObserver!.observe(el));
}

function setup3DTilt() {
  document.querySelectorAll<HTMLElement>(
    ".dash-card, .sys-card, .settings-card, .sys-stat-pill"
  ).forEach((card) => {
    let raf: number;

    card.addEventListener("mouseenter", () => {
      card.style.transition = "transform 0.1s ease-out, box-shadow 0.15s ease-out";
    });

    card.addEventListener("mousemove", (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        const tiltX = (y - 0.5) * -10;
        const tiltY = (x - 0.5) * 10;
        card.style.transform = `perspective(800px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateY(-6px) scale(1.02)`;
        card.style.boxShadow = `0 ${(20 + tiltX).toFixed(1)}px ${(40 + Math.abs(tiltX) * 2).toFixed(1)}px rgba(0,0,0,0.4), 0 0 ${(30 + Math.abs(tiltY) * 2).toFixed(1)}px rgba(232,123,53,${(0.04 + Math.abs(tiltY) * 0.005).toFixed(3)}), inset 0 1px 0 rgba(255,255,255,0.06)`;
      });
    });

    card.addEventListener("mouseleave", () => {
      cancelAnimationFrame(raf);
      card.style.transition = "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.5s ease";
      card.style.transform = "";
      card.style.boxShadow = "";
    });
  });
}

function applyModuleAnimations() {
  // Dashboard
  document.querySelectorAll(".dash-card").forEach((el, i) => {
    el.classList.add("scroll-reveal");
    if (i < 6) el.classList.add(`delay-${i + 1}`);
  });
  const dashGreeting = document.querySelector(".dashboard-greeting");
  if (dashGreeting) dashGreeting.classList.add("scroll-reveal-left");

  // System Monitor
  const sysHero = document.querySelector(".sys-hero");
  if (sysHero) sysHero.classList.add("scroll-reveal-scale");
  document.querySelectorAll(".sys-stat-pill").forEach((el, i) => {
    el.classList.add("scroll-reveal-scale");
    if (i < 8) el.classList.add(`delay-${i + 1}`);
  });
  document.querySelectorAll(".sys-card").forEach((el, i) => {
    el.classList.add("scroll-reveal-flip");
    if (i < 6) el.classList.add(`delay-${i + 1}`);
  });

  // Settings
  document.querySelectorAll(".settings-card").forEach((el, i) => {
    el.classList.add("scroll-reveal");
    if (i < 6) el.classList.add(`delay-${i + 1}`);
  });

  // Kanban
  document.querySelectorAll(".kanban-column").forEach((el, i) => {
    el.classList.add("scroll-reveal");
    if (i < 3) el.classList.add(`delay-${i + 1}`);
  });

  // Calendar sidebar events
  document.querySelectorAll(".sidebar-event-item").forEach((el, i) => {
    el.classList.add("scroll-reveal");
    if (i < 6) el.classList.add(`delay-${i + 1}`);
  });

  // Notes list items
  document.querySelectorAll(".note-item").forEach((el, i) => {
    el.classList.add("scroll-reveal");
    if (i < 6) el.classList.add(`delay-${i + 1}`);
  });

  requestAnimationFrame(() => {
    setupScrollReveal();
    setup3DTilt();
  });
}

// ============================================================
// SIDEBAR NAVIGATION
// ============================================================
const navItems = document.querySelectorAll(".nav-item");
const contentArea = document.getElementById("contentArea");

function loadModule(moduleName: string) {
  if (activeNoteId) saveCurrentNote();
  clearInterval(systemInterval);

  navItems.forEach((item) => item.classList.remove("active"));
  document.querySelector(`[data-module="${moduleName}"]`)?.classList.add("active");

  if (!contentArea) return;

  if (moduleName === "dashboard") {
    contentArea.innerHTML = getDashboardHTML();
    updateClock();
    document.getElementById("qaNewNote")?.addEventListener("click", () => { loadModule("notes"); setTimeout(() => createNote(), 50); });
    document.getElementById("qaNewTask")?.addEventListener("click", () => { loadModule("tasks"); setTimeout(() => showTaskModal(), 50); });
    document.getElementById("qaSystem")?.addEventListener("click", () => loadModule("system"));
  } else if (moduleTemplates[moduleName]) {
    contentArea.innerHTML = moduleTemplates[moduleName];
  }

  if (moduleName === "notes") {
    document.getElementById("btnNewNote")?.addEventListener("click", createNote);
    renderNotes();
    setupNotesSearch();
  }

  if (moduleName === "tasks") {
    setupTasksEvents();
    renderTasks();
  }

  if (moduleName === "calendar") {
    setupCalendarEvents();
    renderCalendar();
  }

  if (moduleName === "system") {
    setupSystemMonitor();
  }

  if (moduleName === "settings") {
    setupSettings();
  }

  applyModuleAnimations();
  localStorage.setItem("bycore-active-module", moduleName);
}

navItems.forEach((item) => {
  item.addEventListener("click", () => {
    const target = item.getAttribute("data-module");
    if (target) loadModule(target);
  });
});

// ============================================================
// DARK / LIGHT MODE
// ============================================================
const themeToggle = document.getElementById("themeToggle");
let isDark = localStorage.getItem("bycore-theme") !== "light";

if (!isDark) {
  document.documentElement.setAttribute("data-theme", "light");
  if (themeToggle) themeToggle.textContent = "☀️";
}

themeToggle?.addEventListener("click", () => {
  isDark = !isDark;
  document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  localStorage.setItem("bycore-theme", isDark ? "dark" : "light");
  if (themeToggle) themeToggle.textContent = isDark ? "🌙" : "☀️";
});

// ============================================================
// UHR
// ============================================================
function updateClock() {
  const clockEl = document.getElementById("clock");
  const dateEl = document.getElementById("date-display");
  if (clockEl) {
    clockEl.textContent = new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString("de-DE", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  }
}

setInterval(updateClock, 1000);

// ============================================================
// STARTUP
// ============================================================
setupTitlebar();
const lastModule = localStorage.getItem("bycore-active-module") || "dashboard";
loadModule(lastModule);

(window as any).loadModule = loadModule;