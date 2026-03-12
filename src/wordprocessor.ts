// ============================================================
// BYCORE — Word Processor (Office Suite)
// Rich-Text Editor mit Formatierung, Dokumentenverwaltung, PDF-Export
// ============================================================

interface WordDocument {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

const WORD_STORAGE_KEY = 'bycore-word-docs';
let wordDocs: WordDocument[] = [];
let activeDocId: string | null = null;
let wordAutoSaveTimeout: any = null;

function loadWordDocs(): WordDocument[] {
  try {
    wordDocs = JSON.parse(localStorage.getItem(WORD_STORAGE_KEY) || '[]');
  } catch {
    wordDocs = [];
  }
  return wordDocs;
}

function saveWordDocs(): void {
  localStorage.setItem(WORD_STORAGE_KEY, JSON.stringify(wordDocs));
}

function generateWordId(): string {
  return 'wd_' + crypto.randomUUID();
}

// ===== RENDER =====
export function renderWordProcessor(): string {
  return `
    <div class="word-container">
      <div class="word-sidebar">
        <div class="word-sidebar-header">
          <h2>📄 Dokumente</h2>
          <button class="word-btn-new" id="wordBtnNew">+ Neu</button>
        </div>
        <div class="word-doc-list" id="wordDocList"></div>
      </div>
      <div class="word-editor-area" id="wordEditorArea">
        <div class="word-empty-state">
          <span class="empty-icon">📄</span>
          <p>Wähle ein Dokument oder erstelle ein neues</p>
        </div>
      </div>
    </div>
  `;
}

export function initWordProcessor(): void {
  loadWordDocs();
  document.getElementById('wordBtnNew')?.addEventListener('click', createNewDoc);
  renderDocList();
  if (wordDocs.length > 0 && !activeDocId) {
    activeDocId = wordDocs[0].id;
    openDoc(activeDocId);
  }
}

function createNewDoc(): void {
  const now = new Date().toISOString();
  const doc: WordDocument = {
    id: generateWordId(),
    title: 'Unbenanntes Dokument',
    content: '',
    created_at: now,
    updated_at: now,
  };
  wordDocs.unshift(doc);
  saveWordDocs();
  activeDocId = doc.id;
  renderDocList();
  openDoc(doc.id);
}

function deleteDoc(id: string): void {
  wordDocs = wordDocs.filter(d => d.id !== id);
  saveWordDocs();
  if (activeDocId === id) {
    activeDocId = wordDocs.length > 0 ? wordDocs[0].id : null;
    if (activeDocId) openDoc(activeDocId);
    else renderEmptyEditor();
  }
  renderDocList();
}

function renderDocList(): void {
  const list = document.getElementById('wordDocList');
  if (!list) return;

  if (wordDocs.length === 0) {
    list.innerHTML = '<div class="word-doc-empty">Noch keine Dokumente</div>';
    return;
  }

  list.innerHTML = wordDocs.map(doc => `
    <div class="word-doc-item ${doc.id === activeDocId ? 'active' : ''}" data-doc-id="${doc.id}">
      <div class="word-doc-item-title">${doc.title || 'Unbenannt'}</div>
      <div class="word-doc-item-date">${new Date(doc.updated_at).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
      <button class="word-doc-delete" data-delete-id="${doc.id}" title="Löschen">✕</button>
    </div>
  `).join('');

  list.querySelectorAll('.word-doc-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.word-doc-delete')) return;
      const id = item.getAttribute('data-doc-id');
      if (id) { saveCurrentDoc(); activeDocId = id; openDoc(id); renderDocList(); }
    });
  });

  list.querySelectorAll('.word-doc-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-delete-id');
      if (id && confirm('Dokument löschen?')) deleteDoc(id);
    });
  });
}

function renderEmptyEditor(): void {
  const area = document.getElementById('wordEditorArea');
  if (area) area.innerHTML = `<div class="word-empty-state"><span class="empty-icon">📄</span><p>Wähle ein Dokument oder erstelle ein neues</p></div>`;
}

function openDoc(id: string): void {
  const doc = wordDocs.find(d => d.id === id);
  if (!doc) return;
  activeDocId = id;

  const area = document.getElementById('wordEditorArea');
  if (!area) return;

  area.innerHTML = `
    <div class="word-toolbar">
      <div class="word-toolbar-group">
        <input type="text" class="word-title-input" id="wordTitleInput" value="${doc.title.replace(/"/g, '&quot;')}" placeholder="Dokumenttitel..." />
      </div>
      <div class="word-toolbar-group">
        <select class="word-tool-select" id="wordFontFamily">
          <option value="Inter">Inter</option>
          <option value="Arial">Arial</option>
          <option value="Georgia">Georgia</option>
          <option value="Times New Roman">Times New Roman</option>
          <option value="Courier New">Courier New</option>
          <option value="JetBrains Mono">JetBrains Mono</option>
        </select>
        <select class="word-tool-select word-tool-size" id="wordFontSize">
          <option value="1">8</option>
          <option value="2">10</option>
          <option value="3" selected>12</option>
          <option value="4">14</option>
          <option value="5">18</option>
          <option value="6">24</option>
          <option value="7">36</option>
        </select>
      </div>
      <div class="word-toolbar-group">
        <button class="word-tool-btn" data-cmd="bold" title="Fett (Ctrl+B)"><b>B</b></button>
        <button class="word-tool-btn" data-cmd="italic" title="Kursiv (Ctrl+I)"><i>I</i></button>
        <button class="word-tool-btn" data-cmd="underline" title="Unterstrichen (Ctrl+U)"><u>U</u></button>
        <button class="word-tool-btn" data-cmd="strikeThrough" title="Durchgestrichen"><s>S</s></button>
      </div>
      <div class="word-toolbar-group">
        <input type="color" class="word-tool-color" id="wordFontColor" value="#f5f0eb" title="Textfarbe" />
        <input type="color" class="word-tool-color" id="wordHighlight" value="#e87b35" title="Hervorheben" />
      </div>
      <div class="word-toolbar-group">
        <button class="word-tool-btn" data-cmd="justifyLeft" title="Links">≡</button>
        <button class="word-tool-btn" data-cmd="justifyCenter" title="Zentriert">≡</button>
        <button class="word-tool-btn" data-cmd="justifyRight" title="Rechts">≡</button>
      </div>
      <div class="word-toolbar-group">
        <button class="word-tool-btn" data-cmd="insertUnorderedList" title="Aufzählung">•≡</button>
        <button class="word-tool-btn" data-cmd="insertOrderedList" title="Nummerierung">1≡</button>
      </div>
      <div class="word-toolbar-group">
        <select class="word-tool-select" id="wordHeading">
          <option value="">Normal</option>
          <option value="H1">Überschrift 1</option>
          <option value="H2">Überschrift 2</option>
          <option value="H3">Überschrift 3</option>
        </select>
      </div>
      <div class="word-toolbar-group">
        <button class="word-tool-btn" data-cmd="insertHorizontalRule" title="Trennlinie">―</button>
        <button class="word-tool-btn" id="wordInsertTable" title="Tabelle einfügen">⊞</button>
        <button class="word-tool-btn" data-cmd="removeFormat" title="Formatierung entfernen">✕</button>
      </div>
      <div class="word-toolbar-group word-toolbar-right">
        <button class="word-tool-btn word-tool-export" id="wordExportPdf" title="Als PDF exportieren">📥 PDF</button>
        <span class="word-autosave-status" id="wordAutoSave">Gespeichert</span>
      </div>
    </div>
    <div class="word-page-wrapper">
      <div class="word-page" contenteditable="true" id="wordEditor" spellcheck="true">${doc.content}</div>
    </div>
  `;

  setupEditorEvents();
}

function setupEditorEvents(): void {
  const editor = document.getElementById('wordEditor');
  const titleInput = document.getElementById('wordTitleInput') as HTMLInputElement;

  // Toolbar buttons
  document.querySelectorAll('.word-tool-btn[data-cmd]').forEach(btn => {
    btn.addEventListener('click', () => {
      const cmd = btn.getAttribute('data-cmd')!;
      document.execCommand(cmd, false);
      editor?.focus();
    });
  });

  // Font family
  document.getElementById('wordFontFamily')?.addEventListener('change', (e) => {
    document.execCommand('fontName', false, (e.target as HTMLSelectElement).value);
    editor?.focus();
  });

  // Font size
  document.getElementById('wordFontSize')?.addEventListener('change', (e) => {
    document.execCommand('fontSize', false, (e.target as HTMLSelectElement).value);
    editor?.focus();
  });

  // Font color
  document.getElementById('wordFontColor')?.addEventListener('input', (e) => {
    document.execCommand('foreColor', false, (e.target as HTMLInputElement).value);
    editor?.focus();
  });

  // Highlight
  document.getElementById('wordHighlight')?.addEventListener('input', (e) => {
    document.execCommand('hiliteColor', false, (e.target as HTMLInputElement).value);
    editor?.focus();
  });

  // Heading
  document.getElementById('wordHeading')?.addEventListener('change', (e) => {
    const val = (e.target as HTMLSelectElement).value;
    if (val) {
      document.execCommand('formatBlock', false, val);
    } else {
      document.execCommand('formatBlock', false, 'P');
    }
    editor?.focus();
  });

  // Insert table
  document.getElementById('wordInsertTable')?.addEventListener('click', () => {
    const rows = prompt('Zeilen:', '3');
    const cols = prompt('Spalten:', '3');
    if (rows && cols) {
      const r = parseInt(rows), c = parseInt(cols);
      if (r > 0 && c > 0 && r <= 50 && c <= 20) {
        let html = '<table class="word-table"><tbody>';
        for (let i = 0; i < r; i++) {
          html += '<tr>';
          for (let j = 0; j < c; j++) html += '<td>&nbsp;</td>';
          html += '</tr>';
        }
        html += '</tbody></table><p><br></p>';
        document.execCommand('insertHTML', false, html);
        editor?.focus();
      }
    }
  });

  // PDF Export
  document.getElementById('wordExportPdf')?.addEventListener('click', exportAsPdf);

  // Auto-save on input
  editor?.addEventListener('input', triggerWordAutoSave);
  titleInput?.addEventListener('input', triggerWordAutoSave);

  // Keyboard shortcuts
  editor?.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'b') { e.preventDefault(); document.execCommand('bold'); }
      if (e.key === 'i') { e.preventDefault(); document.execCommand('italic'); }
      if (e.key === 'u') { e.preventDefault(); document.execCommand('underline'); }
    }
  });
}

function triggerWordAutoSave(): void {
  const statusEl = document.getElementById('wordAutoSave');
  if (statusEl) statusEl.textContent = 'Speichert...';
  clearTimeout(wordAutoSaveTimeout);
  wordAutoSaveTimeout = setTimeout(() => {
    saveCurrentDoc();
    if (statusEl) statusEl.textContent = 'Gespeichert';
    // Update sidebar title
    renderDocList();
  }, 500);
}

function saveCurrentDoc(): void {
  if (!activeDocId) return;
  const editor = document.getElementById('wordEditor');
  const titleInput = document.getElementById('wordTitleInput') as HTMLInputElement;
  const doc = wordDocs.find(d => d.id === activeDocId);
  if (doc && editor) {
    doc.content = editor.innerHTML;
    if (titleInput) doc.title = titleInput.value;
    doc.updated_at = new Date().toISOString();
    saveWordDocs();
  }
}

function exportAsPdf(): void {
  const doc = wordDocs.find(d => d.id === activeDocId);
  if (!doc) return;

  const printWindow = window.open('', '_blank');
  if (!printWindow) { alert('Popup-Blocker verhindert den PDF-Export.'); return; }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${doc.title || 'Dokument'}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        body { font-family: 'Inter', Arial, sans-serif; padding: 40px; color: #1a1a1a; line-height: 1.6; max-width: 800px; margin: 0 auto; }
        h1 { font-size: 28px; margin-bottom: 8px; }
        h2 { font-size: 22px; }
        h3 { font-size: 18px; }
        table { border-collapse: collapse; width: 100%; margin: 16px 0; }
        td, th { border: 1px solid #ccc; padding: 8px; }
        hr { border: none; border-top: 1px solid #ddd; margin: 20px 0; }
        ul, ol { padding-left: 24px; }
      </style>
    </head>
    <body>
      <h1>${doc.title || 'Dokument'}</h1>
      ${doc.content}
    </body>
    </html>
  `);
  printWindow.document.close();
  setTimeout(() => { printWindow.print(); }, 500);
}

// Cleanup on module switch
export function cleanupWordProcessor(): void {
  saveCurrentDoc();
  clearTimeout(wordAutoSaveTimeout);
  activeDocId = null;
}
