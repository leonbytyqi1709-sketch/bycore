import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { open as shellOpen } from '@tauri-apps/plugin-shell';

// ===== TYPES =====
interface FavoriteFolder {
  id: string;
  name: string;
  path: string;
  addedAt: number;
}

// ===== STORAGE =====
const STORAGE_KEY = 'bycore_fav_folders';

function loadFavorites(): FavoriteFolder[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveFavorites(folders: FavoriteFolder[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(folders));
}

// ===== TOAST =====
function showToast(message: string, icon = '✅'): void {
  const existing = document.querySelector('.fm-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'fm-toast';
  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// ===== RENAME MODAL =====
function openRenameModal(currentName: string, onConfirm: (newName: string) => void): void {
  const overlay = document.createElement('div');
  overlay.className = 'fm-modal-overlay';
  overlay.innerHTML = `
    <div class="fm-modal">
      <h3>✏️ Ordner umbenennen</h3>
      <input class="fm-modal-input" type="text" value="${currentName}" placeholder="Name eingeben..." maxlength="40" />
      <div class="fm-modal-actions">
        <button class="fm-modal-cancel">Abbrechen</button>
        <button class="fm-modal-confirm">Speichern</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const input = overlay.querySelector('.fm-modal-input') as HTMLInputElement;
  input.focus();
  input.select();

  const confirm = () => {
    const val = input.value.trim();
    if (val) {
      onConfirm(val);
      overlay.remove();
    }
  };

  overlay.querySelector('.fm-modal-confirm')!.addEventListener('click', confirm);
  overlay.querySelector('.fm-modal-cancel')!.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirm();
    if (e.key === 'Escape') overlay.remove();
  });
}

// ===== RENDER =====
function renderFavorites(container: HTMLElement): void {
  const favorites = loadFavorites();

  if (favorites.length === 0) {
    container.innerHTML = `
      <div class="fm-empty" id="fmEmptyState">
        <div class="fm-empty-icon">📁</div>
        <h3>Noch keine Favoriten</h3>
        <p>Klicke auf "+ Favorit hinzufügen" um loszulegen</p>
      </div>
    `;
    container.querySelector('#fmEmptyState')?.addEventListener('click', addFavorite);
    return;
  }

  container.innerHTML = '';

  favorites.forEach((folder, index) => {
    const card = document.createElement('div');
    card.className = 'fm-folder-card';
    card.style.animationDelay = `${index * 0.07}s`;
    card.innerHTML = `
      <button class="fm-folder-remove" data-id="${folder.id}" title="Entfernen">✕</button>
      <div class="fm-folder-icon-wrap">📁</div>
      <div class="fm-folder-info">
        <div class="fm-folder-name" data-id="${folder.id}" title="${folder.name}">${folder.name}</div>
        <div class="fm-folder-path" title="${folder.path}">${folder.path}</div>
      </div>
    `;

    // Open folder on click (not on remove button)
    card.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.fm-folder-remove')) return;
      try {
        await shellOpen(folder.path);
        showToast(`"${folder.name}" wird geöffnet`, '📂');
      } catch (err) {
        showToast('Ordner konnte nicht geöffnet werden', '❌');
        console.error(err);
      }
    });

    // Remove button
    card.querySelector('.fm-folder-remove')!.addEventListener('click', (e) => {
      e.stopPropagation();
      removeFavorite(folder.id);
    });

    // Double-click to rename
    card.querySelector('.fm-folder-name')!.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      openRenameModal(folder.name, (newName) => {
        const favs = loadFavorites();
        const idx = favs.findIndex(f => f.id === folder.id);
        if (idx !== -1) {
          favs[idx].name = newName;
          saveFavorites(favs);
          renderFavorites(container);
          showToast(`Umbenannt zu "${newName}"`, '✏️');
        }
      });
    });

    container.appendChild(card);
  });
}

// ===== ADD FAVORITE =====
async function addFavorite(): Promise<void> {
  try {
    const selected = await openDialog({
      directory: true,
      multiple: false,
      title: 'Ordner als Favorit hinzufügen',
    });

    if (!selected || typeof selected !== 'string') return;

    const favorites = loadFavorites();

    // Check for duplicate path
    if (favorites.some(f => f.path === selected)) {
      showToast('Dieser Ordner ist bereits ein Favorit', '⚠️');
      return;
    }

    // Extract folder name from path
    const parts = selected.replace(/\\/g, '/').split('/');
    const name = parts[parts.length - 1] || selected;

    const newFolder: FavoriteFolder = {
      id: `fm_${Date.now()}`,
      name,
      path: selected,
      addedAt: Date.now(),
    };

    favorites.push(newFolder);
    saveFavorites(favorites);

    const container = document.getElementById('fmFavoritesGrid');
    if (container) renderFavorites(container);

    showToast(`"${name}" wurde hinzugefügt`, '📌');
  } catch (err) {
    // User cancelled dialog – no error needed
    console.log('Dialog cancelled', err);
  }
}

// ===== REMOVE FAVORITE =====
function removeFavorite(id: string): void {
  const favorites = loadFavorites().filter(f => f.id !== id);
  saveFavorites(favorites);

  const container = document.getElementById('fmFavoritesGrid');
  if (container) renderFavorites(container);

  showToast('Favorit entfernt', '🗑️');
}

// ===== OPEN QUICK ACCESS =====
async function openQuickPath(path: string, label: string): Promise<void> {
  try {
    await shellOpen(path);
    showToast(`"${label}" wird geöffnet`, '📂');
  } catch (err) {
    showToast('Konnte nicht geöffnet werden', '❌');
    console.error(err);
  }
}

// ===== QUICK ACCESS ITEMS (Windows) =====
const QUICK_ITEMS = [
  { icon: '🖥️', label: 'Desktop', path: '%USERPROFILE%\\Desktop' },
  { icon: '⬇️', label: 'Downloads', path: '%USERPROFILE%\\Downloads' },
  { icon: '📄', label: 'Dokumente', path: '%USERPROFILE%\\Documents' },
  { icon: '🖼️', label: 'Bilder', path: '%USERPROFILE%\\Pictures' },
  { icon: '🎵', label: 'Musik', path: '%USERPROFILE%\\Music' },
  { icon: '🎬', label: 'Videos', path: '%USERPROFILE%\\Videos' },
];

// ===== MAIN RENDER =====
export function renderFileManager(): string {
  return `
    <div class="filemanager">
      <div class="fm-header">
        <div class="fm-header-left">
          <h1>📁 File Manager</h1>
          <p>Pinne deine wichtigsten Ordner als Favoriten</p>
        </div>
        <div class="fm-header-actions">
          <button class="fm-btn-add" id="fmAddBtn">
            <span>＋</span> Favorit hinzufügen
          </button>
        </div>
      </div>

      <div class="fm-section-label">FAVORITEN</div>
      <div class="fm-favorites-grid" id="fmFavoritesGrid"></div>

      <div class="fm-section-label">SCHNELLZUGRIFF</div>
      <div class="fm-quick-grid" id="fmQuickGrid"></div>
    </div>
  `;
}

export function initFileManager(): void {
  // Render favorites
  const favGrid = document.getElementById('fmFavoritesGrid');
  if (favGrid) renderFavorites(favGrid);

  // Render quick access
  const quickGrid = document.getElementById('fmQuickGrid');
  if (quickGrid) {
    quickGrid.innerHTML = QUICK_ITEMS.map(item => `
      <div class="fm-quick-item" data-path="${item.path}" data-label="${item.label}">
        <span class="fm-quick-icon">${item.icon}</span>
        <span class="fm-quick-label">${item.label}</span>
      </div>
    `).join('');

    quickGrid.querySelectorAll('.fm-quick-item').forEach(el => {
      el.addEventListener('click', () => {
        const path = (el as HTMLElement).dataset.path!;
        const label = (el as HTMLElement).dataset.label!;
        openQuickPath(path, label);
      });
    });
  }

  // Add button
  document.getElementById('fmAddBtn')?.addEventListener('click', addFavorite);
}
