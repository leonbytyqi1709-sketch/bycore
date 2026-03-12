// ============================================================
// BYCORE — Wissenschaftlicher Taschenrechner
// Standard + Wissenschaftlich, History-Log
// ============================================================

interface CalcEntry {
  expression: string;
  result: string;
  timestamp: string;
}

const CALC_HISTORY_KEY = 'bycore-calc-history';
let calcHistory: CalcEntry[] = [];
let calcDisplay = '0';
let calcExpression = '';
let calcNewNumber = true;

function loadCalcHistory(): void {
  try {
    calcHistory = JSON.parse(localStorage.getItem(CALC_HISTORY_KEY) || '[]');
  } catch {
    calcHistory = [];
  }
}

function saveCalcHistory(): void {
  localStorage.setItem(CALC_HISTORY_KEY, JSON.stringify(calcHistory.slice(0, 50)));
}

export function renderCalculator(): string {
  loadCalcHistory();

  const historyItems = calcHistory.slice(0, 20).map(h => `
    <div class="calc-history-item" data-expr="${h.result}">
      <span class="calc-history-expr">${h.expression}</span>
      <span class="calc-history-result">= ${h.result}</span>
    </div>
  `).join('');

  return `
  <div class="calc-container">
    <div class="calc-main">
      <div class="calc-screen">
        <div class="calc-expression" id="calcExpr"></div>
        <div class="calc-display" id="calcDisplay">0</div>
      </div>
      <div class="calc-buttons">
        <!-- Row 1: Scientific -->
        <button class="calc-btn calc-fn" data-fn="sin">sin</button>
        <button class="calc-btn calc-fn" data-fn="cos">cos</button>
        <button class="calc-btn calc-fn" data-fn="tan">tan</button>
        <button class="calc-btn calc-fn" data-fn="sqrt">√</button>
        <button class="calc-btn calc-fn" data-fn="pow">x²</button>
        <button class="calc-btn calc-fn" data-fn="log">log</button>

        <!-- Row 2: Scientific -->
        <button class="calc-btn calc-fn" data-fn="ln">ln</button>
        <button class="calc-btn calc-fn" data-fn="pi">π</button>
        <button class="calc-btn calc-fn" data-fn="e">e</button>
        <button class="calc-btn calc-fn" data-fn="abs">|x|</button>
        <button class="calc-btn calc-fn" data-fn="fact">n!</button>
        <button class="calc-btn calc-fn" data-fn="pct">%</button>

        <!-- Row 3 -->
        <button class="calc-btn calc-clear" data-action="clear">C</button>
        <button class="calc-btn calc-clear" data-action="backspace">⌫</button>
        <button class="calc-btn calc-op" data-action="(">(</button>
        <button class="calc-btn calc-op" data-action=")">)</button>
        <button class="calc-btn calc-op" data-op="/">÷</button>
        <button class="calc-btn calc-op" data-op="**">^</button>

        <!-- Row 4 -->
        <button class="calc-btn calc-num" data-num="7">7</button>
        <button class="calc-btn calc-num" data-num="8">8</button>
        <button class="calc-btn calc-num" data-num="9">9</button>
        <button class="calc-btn calc-op" data-op="*">×</button>
        <span class="calc-btn-spacer"></span>
        <span class="calc-btn-spacer"></span>

        <!-- Row 5 -->
        <button class="calc-btn calc-num" data-num="4">4</button>
        <button class="calc-btn calc-num" data-num="5">5</button>
        <button class="calc-btn calc-num" data-num="6">6</button>
        <button class="calc-btn calc-op" data-op="-">−</button>
        <span class="calc-btn-spacer"></span>
        <span class="calc-btn-spacer"></span>

        <!-- Row 6 -->
        <button class="calc-btn calc-num" data-num="1">1</button>
        <button class="calc-btn calc-num" data-num="2">2</button>
        <button class="calc-btn calc-num" data-num="3">3</button>
        <button class="calc-btn calc-op" data-op="+">+</button>
        <span class="calc-btn-spacer"></span>
        <span class="calc-btn-spacer"></span>

        <!-- Row 7 -->
        <button class="calc-btn calc-num calc-zero" data-num="0">0</button>
        <button class="calc-btn calc-num" data-num=".">.</button>
        <button class="calc-btn calc-equals" data-action="equals">=</button>
        <span class="calc-btn-spacer"></span>
        <span class="calc-btn-spacer"></span>
        <span class="calc-btn-spacer"></span>
      </div>
    </div>
    <div class="calc-history-panel">
      <div class="calc-history-header">
        <h3>Verlauf</h3>
        <button class="calc-history-clear" id="calcClearHistory">Löschen</button>
      </div>
      <div class="calc-history-list" id="calcHistoryList">
        ${historyItems || '<div class="calc-history-empty">Kein Verlauf</div>'}
      </div>
    </div>
  </div>`;
}

function factorial(n: number): number {
  if (n < 0) return NaN;
  if (n === 0 || n === 1) return 1;
  if (n > 170) return Infinity;
  let r = 1;
  for (let i = 2; i <= Math.floor(n); i++) r *= i;
  return r;
}

function updateCalcDisplay(): void {
  const dispEl = document.getElementById('calcDisplay');
  const exprEl = document.getElementById('calcExpr');
  if (dispEl) dispEl.textContent = calcDisplay;
  if (exprEl) exprEl.textContent = calcExpression;
}

function safeEval(expr: string): string {
  try {
    // Replace display operators
    let sanitized = expr
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/−/g, '-')
      .replace(/π/g, String(Math.PI))
      .replace(/\be\b/g, String(Math.E));

    // Validate: only allow numbers, operators, parens, dots
    if (!/^[\d\s+\-*/().eE]+$/.test(sanitized)) return 'ERR';

    const result = Function('"use strict"; return (' + sanitized + ')')();
    if (typeof result !== 'number' || !isFinite(result)) return 'ERR';
    return String(Math.round(result * 1e12) / 1e12);
  } catch {
    return 'ERR';
  }
}

function renderCalcHistory(): void {
  const listEl = document.getElementById('calcHistoryList');
  if (!listEl) return;
  if (calcHistory.length === 0) {
    listEl.innerHTML = '<div class="calc-history-empty">Kein Verlauf</div>';
    return;
  }
  listEl.innerHTML = calcHistory.slice(0, 20).map(h => `
    <div class="calc-history-item" data-expr="${h.result}">
      <span class="calc-history-expr">${h.expression}</span>
      <span class="calc-history-result">= ${h.result}</span>
    </div>
  `).join('');
}

export function initCalculator(): void {
  calcDisplay = '0';
  calcExpression = '';
  calcNewNumber = true;

  const btnContainer = document.querySelector('.calc-buttons');
  if (!btnContainer) return;

  btnContainer.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.calc-btn') as HTMLElement;
    if (!btn) return;

    // Number
    if (btn.dataset.num !== undefined) {
      const num = btn.dataset.num;
      if (calcNewNumber) {
        calcDisplay = num === '.' ? '0.' : num;
        calcNewNumber = false;
      } else {
        if (num === '.' && calcDisplay.includes('.')) return;
        calcDisplay += num;
      }
      updateCalcDisplay();
      return;
    }

    // Operator
    if (btn.dataset.op !== undefined) {
      calcExpression += calcDisplay + ' ' + btn.dataset.op + ' ';
      calcNewNumber = true;
      updateCalcDisplay();
      return;
    }

    // Parentheses
    if (btn.dataset.action === '(' || btn.dataset.action === ')') {
      calcExpression += btn.dataset.action;
      updateCalcDisplay();
      return;
    }

    // Scientific functions
    if (btn.dataset.fn) {
      const fn = btn.dataset.fn;
      const val = parseFloat(calcDisplay) || 0;
      let result: number;
      switch (fn) {
        case 'sin': result = Math.sin(val * Math.PI / 180); break;
        case 'cos': result = Math.cos(val * Math.PI / 180); break;
        case 'tan': result = Math.tan(val * Math.PI / 180); break;
        case 'sqrt': result = Math.sqrt(val); break;
        case 'pow': result = val * val; break;
        case 'log': result = Math.log10(val); break;
        case 'ln': result = Math.log(val); break;
        case 'pi': result = Math.PI; break;
        case 'e': result = Math.E; break;
        case 'abs': result = Math.abs(val); break;
        case 'fact': result = factorial(val); break;
        case 'pct': result = val / 100; break;
        default: return;
      }
      calcDisplay = String(Math.round(result * 1e12) / 1e12);
      calcNewNumber = true;
      updateCalcDisplay();
      return;
    }

    // Clear
    if (btn.dataset.action === 'clear') {
      calcDisplay = '0';
      calcExpression = '';
      calcNewNumber = true;
      updateCalcDisplay();
      return;
    }

    // Backspace
    if (btn.dataset.action === 'backspace') {
      if (calcDisplay.length > 1) {
        calcDisplay = calcDisplay.slice(0, -1);
      } else {
        calcDisplay = '0';
        calcNewNumber = true;
      }
      updateCalcDisplay();
      return;
    }

    // Equals
    if (btn.dataset.action === 'equals') {
      const fullExpr = calcExpression + calcDisplay;
      const result = safeEval(fullExpr);
      calcHistory.unshift({
        expression: fullExpr,
        result,
        timestamp: new Date().toISOString(),
      });
      saveCalcHistory();
      calcDisplay = result;
      calcExpression = '';
      calcNewNumber = true;
      updateCalcDisplay();
      renderCalcHistory();
      return;
    }
  });

  // History click — reuse result
  document.getElementById('calcHistoryList')?.addEventListener('click', (e) => {
    const item = (e.target as HTMLElement).closest('.calc-history-item') as HTMLElement;
    if (item?.dataset.expr) {
      calcDisplay = item.dataset.expr;
      calcNewNumber = true;
      updateCalcDisplay();
    }
  });

  // Clear history
  document.getElementById('calcClearHistory')?.addEventListener('click', () => {
    calcHistory = [];
    saveCalcHistory();
    renderCalcHistory();
  });

  // Keyboard support
  const keyHandler = (e: KeyboardEvent) => {
    if (!document.querySelector('.calc-container')) {
      document.removeEventListener('keydown', keyHandler);
      return;
    }
    if (e.key >= '0' && e.key <= '9' || e.key === '.') {
      (document.querySelector(`[data-num="${e.key}"]`) as HTMLElement)?.click();
    } else if (e.key === '+') {
      (document.querySelector('[data-op="+"]') as HTMLElement)?.click();
    } else if (e.key === '-') {
      (document.querySelector('[data-op="-"]') as HTMLElement)?.click();
    } else if (e.key === '*') {
      (document.querySelector('[data-op="*"]') as HTMLElement)?.click();
    } else if (e.key === '/') {
      e.preventDefault();
      (document.querySelector('[data-op="/"]') as HTMLElement)?.click();
    } else if (e.key === 'Enter' || e.key === '=') {
      (document.querySelector('[data-action="equals"]') as HTMLElement)?.click();
    } else if (e.key === 'Escape') {
      (document.querySelector('[data-action="clear"]') as HTMLElement)?.click();
    } else if (e.key === 'Backspace') {
      (document.querySelector('[data-action="backspace"]') as HTMLElement)?.click();
    }
  };
  document.addEventListener('keydown', keyHandler);
}

export function cleanupCalculator(): void {
  // Keyboard handler auto-removes via DOM check
}
