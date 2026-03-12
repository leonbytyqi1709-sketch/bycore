// ============================================================
// BYCORE — Web Launcher & Lesezeichen-Manager
// Öffnet Webseiten im System-Browser via Tauri Opener
// Quick-Links, Favoriten, Suchleiste, Verlauf
// ============================================================

const BROWSER_FAVS_KEY = 'bycore-browser-favs';
const BROWSER_HISTORY_KEY = 'bycore-browser-history';

interface BrowserFav {
  title: string;
  url: string;
  icon: string;
}

interface HistoryEntry {
  url: string;
  title: string;
  timestamp: string;
}

let browserFavs: BrowserFav[] = [];
let browserHistoryList: HistoryEntry[] = [];

const DEFAULT_QUICK_LINKS: BrowserFav[] = [
  { title: 'Google', url: 'https://www.google.com', icon: '🔍' },
  { title: 'YouTube', url: 'https://www.youtube.com', icon: '▶️' },
  { title: 'GitHub', url: 'https://github.com', icon: '💻' },
  { title: 'Wikipedia', url: 'https://de.wikipedia.org', icon: '📖' },
  { title: 'ChatGPT', url: 'https://chat.openai.com', icon: '🤖' },
  { title: 'Stack Overflow', url: 'https://stackoverflow.com', icon: '📚' },
  { title: 'Reddit', url: 'https://www.reddit.com', icon: '💬' },
  { title: 'Twitter / X', url: 'https://x.com', icon: '🐦' },
];

function loadBrowserFavs(): void {
  try {
    browserFavs = JSON.parse(localStorage.getItem(BROWSER_FAVS_KEY) || '[]');
  } catch {
    browserFavs = [];
  }
}

function saveBrowserFavs(): void {
  localStorage.setItem(BROWSER_FAVS_KEY, JSON.stringify(browserFavs));
}

function loadBrowserHistory(): void {
  try {
    browserHistoryList = JSON.parse(localStorage.getItem(BROWSER_HISTORY_KEY) || '[]');
  } catch {
    browserHistoryList = [];
  }
}

function saveBrowserHistory(): void {
  localStorage.setItem(BROWSER_HISTORY_KEY, JSON.stringify(browserHistoryList.slice(0, 100)));
}

function normalizeUrl(input: string): string {
  let url = input.trim();
  if (!url) return '';
  if (!url.includes('.') && !url.startsWith('http')) {
    return 'https://www.google.com/search?q=' + encodeURIComponent(url);
  }
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  return url;
}

async function openExternal(url: string): Promise<void> {
  const normalized = normalizeUrl(url);
  if (!normalized) return;

  // Add to history
  let title: string;
  try {
    title = new URL(normalized).hostname;
  } catch {
    title = normalized;
  }
  browserHistoryList.unshift({ url: normalized, title, timestamp: new Date().toISOString() });
  saveBrowserHistory();
  renderHistoryList();

  try {
    const { open } = await import('@tauri-apps/plugin-opener');
    await open(normalized);
  } catch {
    window.open(normalized, '_blank');
  }
}

function renderHistoryList(): void {
  const listEl = document.getElementById('browserHistoryList');
  if (!listEl) return;
  if (browserHistoryList.length === 0) {
    listEl.innerHTML = '<div class="browser-empty-msg">Kein Verlauf</div>';
    return;
  }
  listEl.innerHTML = browserHistoryList.slice(0, 30).map(h => `
    <div class="browser-history-item" data-hurl="${h.url}">
      <span class="browser-history-title">${h.title}</span>
      <span class="browser-history-time">${new Date(h.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
    </div>
  `).join('');
}

function renderFavsList(): void {
  const container = document.getElementById('browserFavsList');
  if (!container) return;
  if (browserFavs.length === 0) {
    container.innerHTML = '<div class="browser-empty-msg">Noch keine Lesezeichen gespeichert</div>';
    return;
  }
  container.innerHTML = browserFavs.map((f, i) => `
    <div class="browser-fav-card" data-favurl="${f.url}">
      <span class="browser-fav-icon">${f.icon}</span>
      <span class="browser-fav-title">${f.title}</span>
      <button class="browser-fav-remove" data-favdel="${i}" title="Entfernen">✕</button>
    </div>
  `).join('');
}

export function renderMiniBrowser(): string {
  loadBrowserFavs();
  loadBrowserHistory();

  const quickLinks = DEFAULT_QUICK_LINKS.map(l => `
    <div class="browser-quick-card" data-qurl="${l.url}">
      <span class="browser-quick-icon">${l.icon}</span>
      <span class="browser-quick-title">${l.title}</span>
    </div>
  `).join('');

  return `
  <div class="browser-container">
    <!-- Search Bar -->
    <div class="browser-toolbar">
      <div class="browser-search-wrapper">
        <span class="browser-search-icon">🔍</span>
        <input type="text" class="browser-url-input" id="browserUrl"
          placeholder="URL eingeben oder im Web suchen...">
        <button class="browser-go-btn" id="browserGo">Öffnen →</button>
      </div>
    </div>

    <div class="browser-content">
      <div class="browser-main-col">
        <!-- Quick Links -->
        <div class="browser-section">
          <div class="browser-section-header">
            <h3>Schnellzugriff</h3>
          </div>
          <div class="browser-quick-grid">
            ${quickLinks}
          </div>
        </div>

        <!-- Bookmarks -->
        <div class="browser-section">
          <div class="browser-section-header">
            <h3>Lesezeichen</h3>
            <button class="browser-add-fav-btn" id="browserAddFav">+ Hinzufügen</button>
          </div>
          <div class="browser-favs-grid" id="browserFavsList"></div>
        </div>
      </div>

      <!-- History Sidebar -->
      <div class="browser-history-panel">
        <div class="browser-history-header">
          <h3>Verlauf</h3>
          <button class="browser-history-clear" id="browserClearHistory">Löschen</button>
        </div>
        <div class="browser-history-list" id="browserHistoryList"></div>
      </div>
    </div>
  </div>`;
}

export function initMiniBrowser(): void {
  const urlInput = document.getElementById('browserUrl') as HTMLInputElement;

  renderFavsList();
  renderHistoryList();

  // Go / Enter
  document.getElementById('browserGo')?.addEventListener('click', () => {
    openExternal(urlInput?.value || '');
    if (urlInput) urlInput.value = '';
  });

  urlInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      openExternal(urlInput.value);
      urlInput.value = '';
    }
  });

  // Quick links
  document.querySelector('.browser-quick-grid')?.addEventListener('click', (e) => {
    const card = (e.target as HTMLElement).closest('[data-qurl]') as HTMLElement;
    if (card) openExternal(card.dataset.qurl!);
  });

  // Favs click & delete
  document.getElementById('browserFavsList')?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const delBtn = target.closest('[data-favdel]') as HTMLElement;
    if (delBtn) {
      const idx = parseInt(delBtn.dataset.favdel!);
      browserFavs.splice(idx, 1);
      saveBrowserFavs();
      renderFavsList();
      return;
    }
    const card = target.closest('[data-favurl]') as HTMLElement;
    if (card) openExternal(card.dataset.favurl!);
  });

  // Add favorite
  document.getElementById('browserAddFav')?.addEventListener('click', () => {
    const url = prompt('URL:', 'https://');
    if (!url || url === 'https://') return;
    const title = prompt('Name:', (() => { try { return new URL(url).hostname; } catch { return url; } })()) || 'Link';
    const icon = prompt('Emoji-Icon:', '🌐') || '🌐';
    browserFavs.push({ title, url: normalizeUrl(url), icon });
    saveBrowserFavs();
    renderFavsList();
  });

  // History click
  document.getElementById('browserHistoryList')?.addEventListener('click', (e) => {
    const item = (e.target as HTMLElement).closest('[data-hurl]') as HTMLElement;
    if (item) openExternal(item.dataset.hurl!);
  });

  // Clear history
  document.getElementById('browserClearHistory')?.addEventListener('click', () => {
    browserHistoryList = [];
    saveBrowserHistory();
    renderHistoryList();
  });

  // Focus input on load
  urlInput?.focus();
}

export function cleanupMiniBrowser(): void {
  // Nothing to clean up anymore (no iframe)
}
