// ============================================================
// BYCORE — Spreadsheet (Office Suite)
// Excel-ähnliche Tabellenkalkulation mit Formeln, localStorage
// ============================================================

interface SpreadsheetDoc {
  id: string;
  title: string;
  rows: number;
  cols: number;
  data: Record<string, string>;       // "A1" -> raw input
  updated_at: string;
}

const SHEET_STORAGE_KEY = 'bycore-spreadsheets';
let sheets: SpreadsheetDoc[] = [];
let activeSheetId: string | null = null;
let sheetAutoSaveTimeout: any = null;
const DEFAULT_ROWS = 50;
const DEFAULT_COLS = 26; // A-Z

function colLetter(index: number): string {
  let s = '';
  let i = index;
  while (i >= 0) {
    s = String.fromCharCode(65 + (i % 26)) + s;
    i = Math.floor(i / 26) - 1;
  }
  return s;
}

function colIndex(letter: string): number {
  let idx = 0;
  for (let i = 0; i < letter.length; i++) {
    idx = idx * 26 + (letter.charCodeAt(i) - 64);
  }
  return idx - 1;
}

function loadSheets(): SpreadsheetDoc[] {
  try {
    sheets = JSON.parse(localStorage.getItem(SHEET_STORAGE_KEY) || '[]');
  } catch {
    sheets = [];
  }
  return sheets;
}

function saveSheets(): void {
  localStorage.setItem(SHEET_STORAGE_KEY, JSON.stringify(sheets));
}

function scheduleSheetAutoSave(): void {
  clearTimeout(sheetAutoSaveTimeout);
  sheetAutoSaveTimeout = setTimeout(() => {
    saveSheets();
    const el = document.getElementById('sheetAutoSaveStatus');
    if (el) { el.textContent = 'Gespeichert'; setTimeout(() => { if (el) el.textContent = ''; }, 1500); }
  }, 500);
}

// ── Formula Engine ──────────────────────────────────────────
function getCellRef(ref: string, data: Record<string, string>): number {
  const raw = data[ref.toUpperCase()] || '';
  if (raw.startsWith('=')) return evaluateFormula(raw, data);
  const num = parseFloat(raw);
  return isNaN(num) ? 0 : num;
}

function parseRange(range: string): string[] {
  const parts = range.split(':');
  if (parts.length !== 2) return [range.toUpperCase()];
  const matchStart = parts[0].match(/^([A-Z]+)(\d+)$/i);
  const matchEnd = parts[1].match(/^([A-Z]+)(\d+)$/i);
  if (!matchStart || !matchEnd) return [];
  const c1 = colIndex(matchStart[1].toUpperCase());
  const c2 = colIndex(matchEnd[1].toUpperCase());
  const r1 = parseInt(matchStart[2]);
  const r2 = parseInt(matchEnd[2]);
  const cells: string[] = [];
  for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) {
    for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) {
      cells.push(colLetter(c) + r);
    }
  }
  return cells;
}

function evaluateFormula(raw: string, data: Record<string, string>): number {
  const formula = raw.substring(1).toUpperCase().trim();

  // SUM(A1:A10)
  const sumMatch = formula.match(/^SUM\((.+)\)$/);
  if (sumMatch) {
    const cells = parseRange(sumMatch[1]);
    return cells.reduce((acc, c) => acc + getCellRef(c, data), 0);
  }

  // AVERAGE(A1:A10)
  const avgMatch = formula.match(/^AVERAGE\((.+)\)$/);
  if (avgMatch) {
    const cells = parseRange(avgMatch[1]);
    if (cells.length === 0) return 0;
    return cells.reduce((acc, c) => acc + getCellRef(c, data), 0) / cells.length;
  }

  // MIN(A1:A10)
  const minMatch = formula.match(/^MIN\((.+)\)$/);
  if (minMatch) {
    const cells = parseRange(minMatch[1]);
    const vals = cells.map(c => getCellRef(c, data));
    return vals.length ? Math.min(...vals) : 0;
  }

  // MAX(A1:A10)
  const maxMatch = formula.match(/^MAX\((.+)\)$/);
  if (maxMatch) {
    const cells = parseRange(maxMatch[1]);
    const vals = cells.map(c => getCellRef(c, data));
    return vals.length ? Math.max(...vals) : 0;
  }

  // COUNT(A1:A10)
  const countMatch = formula.match(/^COUNT\((.+)\)$/);
  if (countMatch) {
    const cells = parseRange(countMatch[1]);
    return cells.filter(c => {
      const v = data[c] || '';
      return v !== '' && !isNaN(parseFloat(v));
    }).length;
  }

  // IF(condition, true, false) - simple A1>5
  const ifMatch = formula.match(/^IF\((.+),(.+),(.+)\)$/);
  if (ifMatch) {
    const cond = ifMatch[1].trim();
    const trueVal = parseFloat(ifMatch[2].trim()) || 0;
    const falseVal = parseFloat(ifMatch[3].trim()) || 0;
    // Simple comparison: CELL>NUM, CELL<NUM, CELL=NUM
    const cmpMatch = cond.match(/^([A-Z]+\d+)\s*([><=!]+)\s*(.+)$/);
    if (cmpMatch) {
      const left = getCellRef(cmpMatch[1], data);
      const op = cmpMatch[2];
      const right = parseFloat(cmpMatch[3]) || 0;
      if (op === '>' && left > right) return trueVal;
      if (op === '<' && left < right) return trueVal;
      if (op === '=' && left === right) return trueVal;
      if (op === '>=' && left >= right) return trueVal;
      if (op === '<=' && left <= right) return trueVal;
      if ((op === '!=' || op === '<>') && left !== right) return trueVal;
      return falseVal;
    }
  }

  // Basic arithmetic: replace cell refs with values, then eval
  try {
    const expr = formula.replace(/[A-Z]+\d+/g, (match) => {
      return String(getCellRef(match, data));
    });
    // Safe eval - only numbers and operators
    if (/^[\d\s+\-*/().]+$/.test(expr)) {
      return Function('"use strict"; return (' + expr + ')')();
    }
  } catch {}

  return 0;
}

function computeCell(ref: string, data: Record<string, string>): string {
  const raw = data[ref] || '';
  if (!raw.startsWith('=')) return raw;
  try {
    const result = evaluateFormula(raw, data);
    return isNaN(result) ? 'ERR' : String(Math.round(result * 1000000) / 1000000);
  } catch {
    return 'ERR';
  }
}

// ── Render ───────────────────────────────────────────────────
export function renderSpreadsheet(): string {
  loadSheets();
  const listItems = sheets.map(s => `
    <div class="sheet-doc-item ${s.id === activeSheetId ? 'active' : ''}" data-id="${s.id}">
      <div class="sheet-doc-title">${s.title}</div>
      <div class="sheet-doc-date">${new Date(s.updated_at).toLocaleDateString('de-DE')}</div>
      <button class="sheet-doc-delete" data-del="${s.id}" title="Löschen">✕</button>
    </div>
  `).join('');

  return `
  <div class="sheet-container">
    <div class="sheet-sidebar">
      <div class="sheet-sidebar-header">
        <h2>Tabellen</h2>
        <button class="sheet-btn-new" id="sheetNewBtn">+ Neu</button>
      </div>
      <div class="sheet-doc-list" id="sheetDocList">
        ${listItems || '<div class="sheet-doc-empty">Keine Tabellen</div>'}
      </div>
    </div>
    <div class="sheet-editor-area" id="sheetEditorArea">
      <div class="sheet-empty-state">
        <div class="empty-icon">📊</div>
        <div>Tabelle auswählen oder neue erstellen</div>
      </div>
    </div>
  </div>`;
}

function renderSheetEditor(): void {
  const area = document.getElementById('sheetEditorArea');
  if (!area || !activeSheetId) return;
  const doc = sheets.find(s => s.id === activeSheetId);
  if (!doc) return;

  const rows = doc.rows;
  const cols = doc.cols;

  // Build header row
  let headerCells = '<th class="sheet-row-header"></th>';
  for (let c = 0; c < cols; c++) {
    headerCells += `<th class="sheet-col-header">${colLetter(c)}</th>`;
  }

  // Build data rows
  let bodyRows = '';
  for (let r = 1; r <= rows; r++) {
    let cells = `<td class="sheet-row-header">${r}</td>`;
    for (let c = 0; c < cols; c++) {
      const ref = colLetter(c) + r;
      const rawVal = doc.data[ref] || '';
      const displayVal = computeCell(ref, doc.data);
      cells += `<td class="sheet-cell" data-ref="${ref}" data-raw="${rawVal.replace(/"/g, '&quot;')}">${displayVal}</td>`;
    }
    bodyRows += `<tr>${cells}</tr>`;
  }

  area.innerHTML = `
    <div class="sheet-toolbar">
      <input type="text" class="sheet-title-input" id="sheetTitleInput" value="${doc.title}" placeholder="Tabellen-Name">
      <div class="sheet-toolbar-group">
        <span class="sheet-cell-ref" id="sheetCellRef">—</span>
        <input type="text" class="sheet-formula-input" id="sheetFormulaInput" placeholder="Wert oder Formel (z.B. =SUM(A1:A10))">
      </div>
      <div class="sheet-toolbar-right">
        <button class="sheet-tool-btn" id="sheetAddRow" title="Zeile hinzufügen">+ Zeile</button>
        <button class="sheet-tool-btn" id="sheetAddCol" title="Spalte hinzufügen">+ Spalte</button>
        <button class="sheet-tool-btn sheet-tool-export" id="sheetExportCSV" title="CSV Export">CSV</button>
        <span class="sheet-autosave-status" id="sheetAutoSaveStatus"></span>
      </div>
    </div>
    <div class="sheet-grid-wrapper" id="sheetGridWrapper">
      <table class="sheet-grid" id="sheetGrid">
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>
  `;

  setupSheetEditor(doc);
}

function setupSheetEditor(doc: SpreadsheetDoc): void {
  const titleInput = document.getElementById('sheetTitleInput') as HTMLInputElement;
  const formulaInput = document.getElementById('sheetFormulaInput') as HTMLInputElement;
  const cellRefEl = document.getElementById('sheetCellRef');
  const grid = document.getElementById('sheetGrid');

  let selectedCell: string | null = null;

  // Title change
  titleInput?.addEventListener('input', () => {
    doc.title = titleInput.value || 'Unbenannt';
    doc.updated_at = new Date().toISOString();
    scheduleSheetAutoSave();
    refreshSheetSidebar();
  });

  // Cell click
  grid?.addEventListener('click', (e) => {
    const td = (e.target as HTMLElement).closest('.sheet-cell') as HTMLElement;
    if (!td) return;
    const ref = td.dataset.ref!;
    selectCell(ref);
  });

  // Cell double-click to edit inline
  grid?.addEventListener('dblclick', (e) => {
    const td = (e.target as HTMLElement).closest('.sheet-cell') as HTMLElement;
    if (!td) return;
    const ref = td.dataset.ref!;
    startInlineEdit(td, ref);
  });

  // Formula input
  formulaInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && selectedCell) {
      doc.data[selectedCell] = formulaInput.value;
      doc.updated_at = new Date().toISOString();
      scheduleSheetAutoSave();
      refreshAllCells(doc);
      selectCell(selectedCell);
    }
  });

  // Add row
  document.getElementById('sheetAddRow')?.addEventListener('click', () => {
    doc.rows += 5;
    doc.updated_at = new Date().toISOString();
    scheduleSheetAutoSave();
    renderSheetEditor();
  });

  // Add col
  document.getElementById('sheetAddCol')?.addEventListener('click', () => {
    doc.cols = Math.min(doc.cols + 3, 52);
    doc.updated_at = new Date().toISOString();
    scheduleSheetAutoSave();
    renderSheetEditor();
  });

  // CSV Export
  document.getElementById('sheetExportCSV')?.addEventListener('click', () => {
    exportCSV(doc);
  });

  function selectCell(ref: string) {
    selectedCell = ref;
    // Highlight
    grid?.querySelectorAll('.sheet-cell').forEach(c => c.classList.remove('selected'));
    const td = grid?.querySelector(`[data-ref="${ref}"]`) as HTMLElement;
    td?.classList.add('selected');
    // Update formula bar
    if (cellRefEl) cellRefEl.textContent = ref;
    if (formulaInput) {
      formulaInput.value = doc.data[ref] || '';
      formulaInput.focus();
    }
  }

  function startInlineEdit(td: HTMLElement, ref: string) {
    const raw = doc.data[ref] || '';
    td.textContent = raw;
    td.contentEditable = 'true';
    td.focus();

    // Select all text
    const range = document.createRange();
    range.selectNodeContents(td);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    function finishEdit() {
      td.contentEditable = 'false';
      const newVal = td.textContent?.trim() || '';
      doc.data[ref] = newVal;
      doc.updated_at = new Date().toISOString();
      td.textContent = computeCell(ref, doc.data);
      scheduleSheetAutoSave();
      refreshDependentCells(doc);
      if (formulaInput) formulaInput.value = newVal;
      td.removeEventListener('blur', finishEdit);
      td.removeEventListener('keydown', handleKey);
    }

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Enter') { e.preventDefault(); finishEdit(); }
      if (e.key === 'Escape') {
        td.contentEditable = 'false';
        td.textContent = computeCell(ref, doc.data);
        td.removeEventListener('blur', finishEdit);
        td.removeEventListener('keydown', handleKey);
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        finishEdit();
        // Move to next cell
        const match = ref.match(/^([A-Z]+)(\d+)$/);
        if (match) {
          const nextCol = colLetter(colIndex(match[1]) + (e.shiftKey ? -1 : 1));
          const nextRef = nextCol + match[2];
          const nextTd = grid?.querySelector(`[data-ref="${nextRef}"]`) as HTMLElement;
          if (nextTd) {
            selectCell(nextRef);
            startInlineEdit(nextTd, nextRef);
          }
        }
      }
    }

    td.addEventListener('blur', finishEdit);
    td.addEventListener('keydown', handleKey);
  }

  function refreshAllCells(d: SpreadsheetDoc) {
    grid?.querySelectorAll('.sheet-cell').forEach(td => {
      const el = td as HTMLElement;
      const ref = el.dataset.ref!;
      el.textContent = computeCell(ref, d.data);
    });
  }

  function refreshDependentCells(d: SpreadsheetDoc) {
    // Simple: refresh all cells that contain formulas
    grid?.querySelectorAll('.sheet-cell').forEach(td => {
      const el = td as HTMLElement;
      const ref = el.dataset.ref!;
      const raw = d.data[ref] || '';
      if (raw.startsWith('=')) {
        el.textContent = computeCell(ref, d.data);
      }
    });
  }
}

function refreshSheetSidebar(): void {
  const listEl = document.getElementById('sheetDocList');
  if (!listEl) return;
  if (sheets.length === 0) {
    listEl.innerHTML = '<div class="sheet-doc-empty">Keine Tabellen</div>';
    return;
  }
  listEl.innerHTML = sheets.map(s => `
    <div class="sheet-doc-item ${s.id === activeSheetId ? 'active' : ''}" data-id="${s.id}">
      <div class="sheet-doc-title">${s.title}</div>
      <div class="sheet-doc-date">${new Date(s.updated_at).toLocaleDateString('de-DE')}</div>
      <button class="sheet-doc-delete" data-del="${s.id}" title="Löschen">✕</button>
    </div>
  `).join('');
}

function exportCSV(doc: SpreadsheetDoc): void {
  let csv = '';
  for (let r = 1; r <= doc.rows; r++) {
    const rowCells: string[] = [];
    let hasData = false;
    for (let c = 0; c < doc.cols; c++) {
      const ref = colLetter(c) + r;
      const val = computeCell(ref, doc.data);
      if (val) hasData = true;
      // Escape CSV
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        rowCells.push('"' + val.replace(/"/g, '""') + '"');
      } else {
        rowCells.push(val);
      }
    }
    if (hasData || r <= 20) csv += rowCells.join(',') + '\n';
  }
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (doc.title || 'tabelle') + '.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ── Init ─────────────────────────────────────────────────────
export function initSpreadsheet(): void {
  loadSheets();

  // New sheet
  document.getElementById('sheetNewBtn')?.addEventListener('click', () => {
    const newSheet: SpreadsheetDoc = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title: 'Neue Tabelle',
      rows: DEFAULT_ROWS,
      cols: DEFAULT_COLS,
      data: {},
      updated_at: new Date().toISOString(),
    };
    sheets.unshift(newSheet);
    activeSheetId = newSheet.id;
    saveSheets();
    refreshSheetSidebar();
    renderSheetEditor();
  });

  // Sidebar click delegation
  document.getElementById('sheetDocList')?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    // Delete
    const delBtn = target.closest('[data-del]') as HTMLElement;
    if (delBtn) {
      const id = delBtn.dataset.del!;
      if (confirm('Tabelle wirklich löschen?')) {
        sheets = sheets.filter(s => s.id !== id);
        if (activeSheetId === id) activeSheetId = null;
        saveSheets();
        refreshSheetSidebar();
        if (!activeSheetId) {
          const area = document.getElementById('sheetEditorArea');
          if (area) area.innerHTML = '<div class="sheet-empty-state"><div class="empty-icon">📊</div><div>Tabelle auswählen oder neue erstellen</div></div>';
        }
      }
      return;
    }
    // Select
    const item = target.closest('.sheet-doc-item') as HTMLElement;
    if (item) {
      activeSheetId = item.dataset.id!;
      refreshSheetSidebar();
      renderSheetEditor();
    }
  });

  // Auto-open first sheet
  if (sheets.length > 0 && !activeSheetId) {
    activeSheetId = sheets[0].id;
    refreshSheetSidebar();
    renderSheetEditor();
  }
}

export function cleanupSpreadsheet(): void {
  clearTimeout(sheetAutoSaveTimeout);
  if (activeSheetId) saveSheets();
  activeSheetId = null;
}
