// ============================================================
// BYCORE — Presentations
// Slide-Creator mit Editor, Vorschau und Präsentations-Modus
// ============================================================

interface Slide {
  id: string;
  content: string;    // HTML content
  bgColor: string;
  textColor: string;
}

interface Presentation {
  id: string;
  title: string;
  slides: Slide[];
  updated_at: string;
}

const PRES_STORAGE_KEY = 'bycore-presentations';
let presentations: Presentation[] = [];
let activePresId: string | null = null;
let activeSlideIndex = 0;
let presAutoSaveTimeout: any = null;

function loadPresentations(): void {
  try {
    presentations = JSON.parse(localStorage.getItem(PRES_STORAGE_KEY) || '[]');
  } catch {
    presentations = [];
  }
}

function savePresentations(): void {
  localStorage.setItem(PRES_STORAGE_KEY, JSON.stringify(presentations));
}

function schedulePresSave(): void {
  clearTimeout(presAutoSaveTimeout);
  presAutoSaveTimeout = setTimeout(() => {
    savePresentations();
    const el = document.getElementById('presAutoSave');
    if (el) { el.textContent = 'Gespeichert'; setTimeout(() => { if (el) el.textContent = ''; }, 1500); }
  }, 500);
}

function createSlide(): Slide {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    content: '<h1>Neue Folie</h1><p>Inhalt hier eingeben...</p>',
    bgColor: '#1a1a2e',
    textColor: '#ffffff',
  };
}

export function renderPresentations(): string {
  loadPresentations();

  const listItems = presentations.map(p => `
    <div class="pres-doc-item ${p.id === activePresId ? 'active' : ''}" data-pid="${p.id}">
      <div class="pres-doc-title">${p.title}</div>
      <div class="pres-doc-date">${p.slides.length} Folie(n) · ${new Date(p.updated_at).toLocaleDateString('de-DE')}</div>
      <button class="pres-doc-delete" data-pdel="${p.id}" title="Löschen">✕</button>
    </div>
  `).join('');

  return `
  <div class="pres-container">
    <div class="pres-sidebar">
      <div class="pres-sidebar-header">
        <h2>Präsentationen</h2>
        <button class="pres-btn-new" id="presNewBtn">+ Neu</button>
      </div>
      <div class="pres-doc-list" id="presDocList">
        ${listItems || '<div class="pres-doc-empty">Keine Präsentationen</div>'}
      </div>
    </div>
    <div class="pres-editor-area" id="presEditorArea">
      <div class="pres-empty-state">
        <div class="empty-icon">🎬</div>
        <div>Präsentation auswählen oder neue erstellen</div>
      </div>
    </div>
  </div>`;
}

function renderPresEditor(): void {
  const area = document.getElementById('presEditorArea');
  if (!area || !activePresId) return;
  const pres = presentations.find(p => p.id === activePresId);
  if (!pres) return;

  const slide = pres.slides[activeSlideIndex] || pres.slides[0];
  if (!slide) return;

  // Slide thumbnails
  const thumbs = pres.slides.map((s, i) => `
    <div class="pres-thumb ${i === activeSlideIndex ? 'active' : ''}" data-sidx="${i}">
      <div class="pres-thumb-num">${i + 1}</div>
      <div class="pres-thumb-preview" style="background:${s.bgColor};color:${s.textColor};font-size:6px;padding:4px;overflow:hidden;">${s.content.replace(/<[^>]+>/g, ' ').slice(0, 40)}</div>
    </div>
  `).join('');

  area.innerHTML = `
    <div class="pres-toolbar">
      <input type="text" class="pres-title-input" id="presTitleInput" value="${pres.title}" placeholder="Titel">
      <div class="pres-toolbar-group">
        <button class="pres-tool-btn" id="presAddSlide">+ Folie</button>
        <button class="pres-tool-btn" id="presDelSlide">🗑 Folie</button>
        <label class="pres-tool-label">BG:
          <input type="color" class="pres-tool-color" id="presBgColor" value="${slide.bgColor}">
        </label>
        <label class="pres-tool-label">Text:
          <input type="color" class="pres-tool-color" id="presTextColor" value="${slide.textColor}">
        </label>
      </div>
      <div class="pres-toolbar-right">
        <button class="pres-tool-btn pres-play-btn" id="presPlay">▶ Präsentieren</button>
        <span class="pres-autosave" id="presAutoSave"></span>
      </div>
    </div>
    <div class="pres-workspace">
      <div class="pres-thumbs-panel" id="presThumbs">
        ${thumbs}
      </div>
      <div class="pres-slide-editor">
        <div class="pres-slide-canvas" id="presCanvas"
          contenteditable="true"
          style="background:${slide.bgColor};color:${slide.textColor}"
        >${slide.content}</div>
      </div>
    </div>
  `;

  setupPresEditor(pres);
}

function setupPresEditor(pres: Presentation): void {
  const canvas = document.getElementById('presCanvas') as HTMLElement;
  const titleInput = document.getElementById('presTitleInput') as HTMLInputElement;

  // Title
  titleInput?.addEventListener('input', () => {
    pres.title = titleInput.value || 'Unbenannt';
    pres.updated_at = new Date().toISOString();
    schedulePresSave();
    refreshPresSidebar();
  });

  // Canvas content change
  canvas?.addEventListener('input', () => {
    const slide = pres.slides[activeSlideIndex];
    if (slide) {
      slide.content = canvas.innerHTML;
      pres.updated_at = new Date().toISOString();
      schedulePresSave();
    }
  });

  // BG color
  document.getElementById('presBgColor')?.addEventListener('input', (e) => {
    const color = (e.target as HTMLInputElement).value;
    const slide = pres.slides[activeSlideIndex];
    if (slide) {
      slide.bgColor = color;
      canvas.style.background = color;
      pres.updated_at = new Date().toISOString();
      schedulePresSave();
    }
  });

  // Text color
  document.getElementById('presTextColor')?.addEventListener('input', (e) => {
    const color = (e.target as HTMLInputElement).value;
    const slide = pres.slides[activeSlideIndex];
    if (slide) {
      slide.textColor = color;
      canvas.style.color = color;
      pres.updated_at = new Date().toISOString();
      schedulePresSave();
    }
  });

  // Add slide
  document.getElementById('presAddSlide')?.addEventListener('click', () => {
    pres.slides.splice(activeSlideIndex + 1, 0, createSlide());
    activeSlideIndex++;
    pres.updated_at = new Date().toISOString();
    schedulePresSave();
    renderPresEditor();
  });

  // Delete slide
  document.getElementById('presDelSlide')?.addEventListener('click', () => {
    if (pres.slides.length <= 1) return;
    pres.slides.splice(activeSlideIndex, 1);
    if (activeSlideIndex >= pres.slides.length) activeSlideIndex = pres.slides.length - 1;
    pres.updated_at = new Date().toISOString();
    schedulePresSave();
    renderPresEditor();
  });

  // Thumbs click
  document.getElementById('presThumbs')?.addEventListener('click', (e) => {
    const thumb = (e.target as HTMLElement).closest('[data-sidx]') as HTMLElement;
    if (thumb) {
      // Save current slide content first
      const current = pres.slides[activeSlideIndex];
      if (current && canvas) current.content = canvas.innerHTML;

      activeSlideIndex = parseInt(thumb.dataset.sidx!);
      renderPresEditor();
    }
  });

  // Presentation mode
  document.getElementById('presPlay')?.addEventListener('click', () => {
    // Save current content
    const current = pres.slides[activeSlideIndex];
    if (current && canvas) current.content = canvas.innerHTML;
    savePresentations();
    startPresentation(pres);
  });
}

function startPresentation(pres: Presentation): void {
  let idx = 0;

  const overlay = document.createElement('div');
  overlay.className = 'pres-fullscreen';
  overlay.innerHTML = `
    <div class="pres-fs-slide" id="presFsSlide"
      style="background:${pres.slides[0].bgColor};color:${pres.slides[0].textColor}">
      ${pres.slides[0].content}
    </div>
    <div class="pres-fs-controls">
      <span class="pres-fs-counter" id="presFsCounter">1 / ${pres.slides.length}</span>
      <button class="pres-fs-btn" id="presFsExit">✕ Beenden</button>
    </div>
  `;
  document.body.appendChild(overlay);

  const slideEl = document.getElementById('presFsSlide')!;
  const counterEl = document.getElementById('presFsCounter')!;

  function showSlide(i: number) {
    idx = Math.max(0, Math.min(i, pres.slides.length - 1));
    const s = pres.slides[idx];
    slideEl.innerHTML = s.content;
    slideEl.style.background = s.bgColor;
    slideEl.style.color = s.textColor;
    counterEl.textContent = `${idx + 1} / ${pres.slides.length}`;
  }

  function handleKey(e: KeyboardEvent) {
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') showSlide(idx + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'Backspace') showSlide(idx - 1);
    else if (e.key === 'Escape') close();
  }

  function close() {
    document.removeEventListener('keydown', handleKey);
    overlay.remove();
  }

  document.addEventListener('keydown', handleKey);
  document.getElementById('presFsExit')?.addEventListener('click', close);

  // Click to advance
  slideEl.addEventListener('click', () => {
    if (idx < pres.slides.length - 1) showSlide(idx + 1);
  });
}

function refreshPresSidebar(): void {
  const listEl = document.getElementById('presDocList');
  if (!listEl) return;
  if (presentations.length === 0) {
    listEl.innerHTML = '<div class="pres-doc-empty">Keine Präsentationen</div>';
    return;
  }
  listEl.innerHTML = presentations.map(p => `
    <div class="pres-doc-item ${p.id === activePresId ? 'active' : ''}" data-pid="${p.id}">
      <div class="pres-doc-title">${p.title}</div>
      <div class="pres-doc-date">${p.slides.length} Folie(n) · ${new Date(p.updated_at).toLocaleDateString('de-DE')}</div>
      <button class="pres-doc-delete" data-pdel="${p.id}" title="Löschen">✕</button>
    </div>
  `).join('');
}

export function initPresentations(): void {
  // New presentation
  document.getElementById('presNewBtn')?.addEventListener('click', () => {
    const pres: Presentation = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title: 'Neue Präsentation',
      slides: [createSlide()],
      updated_at: new Date().toISOString(),
    };
    presentations.unshift(pres);
    activePresId = pres.id;
    activeSlideIndex = 0;
    savePresentations();
    refreshPresSidebar();
    renderPresEditor();
  });

  // Sidebar delegation
  document.getElementById('presDocList')?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    // Delete
    const delBtn = target.closest('[data-pdel]') as HTMLElement;
    if (delBtn) {
      const id = delBtn.dataset.pdel!;
      if (confirm('Präsentation wirklich löschen?')) {
        presentations = presentations.filter(p => p.id !== id);
        if (activePresId === id) activePresId = null;
        savePresentations();
        refreshPresSidebar();
        if (!activePresId) {
          const area = document.getElementById('presEditorArea');
          if (area) area.innerHTML = '<div class="pres-empty-state"><div class="empty-icon">🎬</div><div>Präsentation auswählen oder neue erstellen</div></div>';
        }
      }
      return;
    }
    // Select
    const item = target.closest('[data-pid]') as HTMLElement;
    if (item) {
      activePresId = item.dataset.pid!;
      activeSlideIndex = 0;
      refreshPresSidebar();
      renderPresEditor();
    }
  });

  // Auto-open first
  if (presentations.length > 0 && !activePresId) {
    activePresId = presentations[0].id;
    refreshPresSidebar();
    renderPresEditor();
  }
}

export function cleanupPresentations(): void {
  clearTimeout(presAutoSaveTimeout);
  savePresentations();
  activePresId = null;
  activeSlideIndex = 0;
}
