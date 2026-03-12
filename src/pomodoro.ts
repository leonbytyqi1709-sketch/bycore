// ============================================================
// BYCORE — Pomodoro Timer & Habit Tracker
// Timer mit Sessions-Log, Habit-Tracking mit Streaks
// Supabase für Habits, localStorage für Timer-State
// ============================================================

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://rnltzcoexyyusvzgavjw.supabase.co',
  'sb_publishable__QKkjH4XVaoxK-mEe-aaEQ_QZFTQl6z'
);

// ── Types ────────────────────────────────────────────────────
interface PomodoroState {
  mode: 'work' | 'break' | 'longbreak';
  timeLeft: number;      // seconds
  running: boolean;
  sessions: number;       // completed work sessions
  totalToday: number;     // total focus minutes today
  date: string;           // YYYY-MM-DD
}

interface Habit {
  id: string;
  name: string;
  icon: string;
  completions: string[];  // array of date strings YYYY-MM-DD
  created_at: string;
}

// ── Constants ────────────────────────────────────────────────
const WORK_MINUTES = 25;
const BREAK_MINUTES = 5;
const LONG_BREAK_MINUTES = 15;
const SESSIONS_BEFORE_LONG = 4;

const POMO_STATE_KEY = 'bycore-pomodoro-state';
const HABITS_KEY = 'bycore-habits';

let pomoState: PomodoroState;
let pomoInterval: any = null;
let habits: Habit[] = [];

function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadPomoState(): PomodoroState {
  try {
    const saved = JSON.parse(localStorage.getItem(POMO_STATE_KEY) || '{}');
    if (saved.date !== getTodayStr()) {
      // New day — reset daily stats
      return { mode: 'work', timeLeft: WORK_MINUTES * 60, running: false, sessions: 0, totalToday: 0, date: getTodayStr() };
    }
    return { ...saved, running: false }; // Never auto-resume on load
  } catch {
    return { mode: 'work', timeLeft: WORK_MINUTES * 60, running: false, sessions: 0, totalToday: 0, date: getTodayStr() };
  }
}

function savePomoState(): void {
  localStorage.setItem(POMO_STATE_KEY, JSON.stringify(pomoState));
}

function loadHabits(): Habit[] {
  try {
    habits = JSON.parse(localStorage.getItem(HABITS_KEY) || '[]');
  } catch {
    habits = [];
  }
  return habits;
}

function saveHabits(): void {
  localStorage.setItem(HABITS_KEY, JSON.stringify(habits));
}

// ── Timer Logic ──────────────────────────────────────────────
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function getModeDuration(mode: string): number {
  if (mode === 'break') return BREAK_MINUTES * 60;
  if (mode === 'longbreak') return LONG_BREAK_MINUTES * 60;
  return WORK_MINUTES * 60;
}

function getModeLabel(mode: string): string {
  if (mode === 'break') return 'Pause';
  if (mode === 'longbreak') return 'Lange Pause';
  return 'Fokus';
}

function getModeColor(mode: string): string {
  if (mode === 'break') return 'var(--success, #2ECC71)';
  if (mode === 'longbreak') return 'var(--info, #3B9EFF)';
  return 'var(--accent)';
}

function tickTimer(): void {
  if (!pomoState.running) return;
  pomoState.timeLeft--;

  if (pomoState.timeLeft <= 0) {
    // Session complete
    if (pomoState.mode === 'work') {
      pomoState.sessions++;
      pomoState.totalToday += WORK_MINUTES;
      // Notify
      tryNotify('Pomodoro fertig!', `${pomoState.sessions} Session(s) heute abgeschlossen.`);
      // Next mode
      if (pomoState.sessions % SESSIONS_BEFORE_LONG === 0) {
        pomoState.mode = 'longbreak';
        pomoState.timeLeft = LONG_BREAK_MINUTES * 60;
      } else {
        pomoState.mode = 'break';
        pomoState.timeLeft = BREAK_MINUTES * 60;
      }
    } else {
      // Break/long break over
      tryNotify('Pause vorbei!', 'Zeit für die nächste Fokus-Session!');
      pomoState.mode = 'work';
      pomoState.timeLeft = WORK_MINUTES * 60;
    }
    pomoState.running = false;
    clearInterval(pomoInterval);
    pomoInterval = null;
    savePomoState();
    updateTimerUI();
    return;
  }

  savePomoState();
  updateTimerDisplay();
}

async function tryNotify(title: string, body: string): Promise<void> {
  try {
    const { sendNotification } = await import('@tauri-apps/plugin-notification');
    sendNotification({ title, body });
  } catch {
    // Browser mode — no native notifications
  }
}

function updateTimerDisplay(): void {
  const timeEl = document.getElementById('pomoTime');
  const progressEl = document.getElementById('pomoProgress') as HTMLElement;
  if (timeEl) timeEl.textContent = formatTime(pomoState.timeLeft);
  if (progressEl) {
    const total = getModeDuration(pomoState.mode);
    const pct = ((total - pomoState.timeLeft) / total) * 100;
    progressEl.style.background = `conic-gradient(${getModeColor(pomoState.mode)} ${pct}%, transparent ${pct}%)`;
  }
}

function updateTimerUI(): void {
  updateTimerDisplay();
  const modeEl = document.getElementById('pomoModeLabel');
  const btnStart = document.getElementById('pomoBtnStart');
  const btnPause = document.getElementById('pomoBtnPause');
  const sessionsEl = document.getElementById('pomoSessions');
  const totalEl = document.getElementById('pomoTotal');

  if (modeEl) modeEl.textContent = getModeLabel(pomoState.mode);
  if (btnStart) btnStart.style.display = pomoState.running ? 'none' : '';
  if (btnPause) btnPause.style.display = pomoState.running ? '' : 'none';
  if (sessionsEl) sessionsEl.textContent = String(pomoState.sessions);
  if (totalEl) totalEl.textContent = `${pomoState.totalToday} Min`;
}

// ── Habits Logic ─────────────────────────────────────────────
function getStreak(habit: Habit): number {
  const today = getTodayStr();
  let streak = 0;
  let d = new Date(today);
  while (true) {
    const ds = d.toISOString().slice(0, 10);
    if (habit.completions.includes(ds)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else if (ds === today) {
      // Today not yet done — check yesterday
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function isHabitDoneToday(habit: Habit): boolean {
  return habit.completions.includes(getTodayStr());
}

function renderHabitsList(): void {
  const container = document.getElementById('habitsList');
  if (!container) return;
  if (habits.length === 0) {
    container.innerHTML = '<div class="pomo-habit-empty">Keine Habits — erstelle deinen ersten!</div>';
    return;
  }
  const today = getTodayStr();
  container.innerHTML = habits.map(h => {
    const done = h.completions.includes(today);
    const streak = getStreak(h);
    // Last 7 days dots
    const dots: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      dots.push(`<span class="pomo-habit-dot ${h.completions.includes(ds) ? 'done' : ''}"></span>`);
    }
    return `
      <div class="pomo-habit-item ${done ? 'completed' : ''}" data-habit="${h.id}">
        <button class="pomo-habit-check" data-toggle="${h.id}">${done ? '✓' : ''}</button>
        <span class="pomo-habit-icon">${h.icon}</span>
        <span class="pomo-habit-name">${h.name}</span>
        <div class="pomo-habit-dots">${dots.join('')}</div>
        <span class="pomo-habit-streak" title="Streak">${streak > 0 ? '🔥 ' + streak : ''}</span>
        <button class="pomo-habit-delete" data-delhab="${h.id}" title="Löschen">✕</button>
      </div>
    `;
  }).join('');
}

// ── Render ───────────────────────────────────────────────────
export function renderPomodoro(): string {
  pomoState = loadPomoState();
  loadHabits();

  return `
  <div class="pomo-container">
    <!-- Timer Section -->
    <div class="pomo-timer-section">
      <div class="pomo-timer-card">
        <div class="pomo-mode-label" id="pomoModeLabel">${getModeLabel(pomoState.mode)}</div>
        <div class="pomo-timer-ring">
          <div class="pomo-timer-progress" id="pomoProgress"></div>
          <div class="pomo-timer-inner">
            <div class="pomo-time" id="pomoTime">${formatTime(pomoState.timeLeft)}</div>
          </div>
        </div>
        <div class="pomo-controls">
          <button class="pomo-btn pomo-btn-start" id="pomoBtnStart" ${pomoState.running ? 'style="display:none"' : ''}>▶ Start</button>
          <button class="pomo-btn pomo-btn-pause" id="pomoBtnPause" ${!pomoState.running ? 'style="display:none"' : ''}>⏸ Pause</button>
          <button class="pomo-btn pomo-btn-reset" id="pomoBtnReset">↺ Reset</button>
          <button class="pomo-btn pomo-btn-skip" id="pomoBtnSkip">⏭ Skip</button>
        </div>
        <div class="pomo-mode-tabs">
          <button class="pomo-mode-tab ${pomoState.mode === 'work' ? 'active' : ''}" data-pmode="work">Fokus</button>
          <button class="pomo-mode-tab ${pomoState.mode === 'break' ? 'active' : ''}" data-pmode="break">Pause</button>
          <button class="pomo-mode-tab ${pomoState.mode === 'longbreak' ? 'active' : ''}" data-pmode="longbreak">Lange Pause</button>
        </div>
        <div class="pomo-stats">
          <div class="pomo-stat">
            <span class="pomo-stat-value" id="pomoSessions">${pomoState.sessions}</span>
            <span class="pomo-stat-label">Sessions</span>
          </div>
          <div class="pomo-stat">
            <span class="pomo-stat-value" id="pomoTotal">${pomoState.totalToday} Min</span>
            <span class="pomo-stat-label">Fokus heute</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Habits Section -->
    <div class="pomo-habits-section">
      <div class="pomo-habits-header">
        <h2>Habits</h2>
        <button class="pomo-btn-new" id="habitsNewBtn">+ Neuer Habit</button>
      </div>
      <div class="pomo-habits-list" id="habitsList"></div>
    </div>
  </div>`;
}

// ── Init ─────────────────────────────────────────────────────
export function initPomodoro(): void {
  renderHabitsList();
  updateTimerUI();

  // Start
  document.getElementById('pomoBtnStart')?.addEventListener('click', () => {
    pomoState.running = true;
    savePomoState();
    updateTimerUI();
    pomoInterval = setInterval(tickTimer, 1000);
  });

  // Pause
  document.getElementById('pomoBtnPause')?.addEventListener('click', () => {
    pomoState.running = false;
    clearInterval(pomoInterval);
    pomoInterval = null;
    savePomoState();
    updateTimerUI();
  });

  // Reset
  document.getElementById('pomoBtnReset')?.addEventListener('click', () => {
    pomoState.running = false;
    clearInterval(pomoInterval);
    pomoInterval = null;
    pomoState.timeLeft = getModeDuration(pomoState.mode);
    savePomoState();
    updateTimerUI();
  });

  // Skip
  document.getElementById('pomoBtnSkip')?.addEventListener('click', () => {
    pomoState.running = false;
    clearInterval(pomoInterval);
    pomoInterval = null;
    if (pomoState.mode === 'work') {
      pomoState.mode = 'break';
    } else {
      pomoState.mode = 'work';
    }
    pomoState.timeLeft = getModeDuration(pomoState.mode);
    savePomoState();
    updateTimerUI();
  });

  // Mode tabs
  document.querySelectorAll('.pomo-mode-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const mode = (tab as HTMLElement).dataset.pmode as 'work' | 'break' | 'longbreak';
      pomoState.running = false;
      clearInterval(pomoInterval);
      pomoInterval = null;
      pomoState.mode = mode;
      pomoState.timeLeft = getModeDuration(mode);
      savePomoState();
      updateTimerUI();
      document.querySelectorAll('.pomo-mode-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
    });
  });

  // New habit
  document.getElementById('habitsNewBtn')?.addEventListener('click', () => {
    const name = prompt('Habit-Name (z.B. Sport, Lesen, Meditation):');
    if (!name) return;
    const icon = prompt('Emoji-Icon:', '💪') || '💪';
    habits.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name,
      icon,
      completions: [],
      created_at: new Date().toISOString(),
    });
    saveHabits();
    renderHabitsList();
  });

  // Habit list delegation
  document.getElementById('habitsList')?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // Toggle habit
    const toggleBtn = target.closest('[data-toggle]') as HTMLElement;
    if (toggleBtn) {
      const id = toggleBtn.dataset.toggle!;
      const habit = habits.find(h => h.id === id);
      if (!habit) return;
      const today = getTodayStr();
      if (habit.completions.includes(today)) {
        habit.completions = habit.completions.filter(d => d !== today);
      } else {
        habit.completions.push(today);
      }
      saveHabits();
      renderHabitsList();
      return;
    }

    // Delete habit
    const delBtn = target.closest('[data-delhab]') as HTMLElement;
    if (delBtn) {
      const id = delBtn.dataset.delhab!;
      if (confirm('Habit wirklich löschen?')) {
        habits = habits.filter(h => h.id !== id);
        saveHabits();
        renderHabitsList();
      }
    }
  });
}

export function cleanupPomodoro(): void {
  clearInterval(pomoInterval);
  pomoInterval = null;
  if (pomoState) {
    pomoState.running = false;
    savePomoState();
  }
}
