import { STRATEGIES, getStrategy } from './strategies/registry.js';

/**
 * Strategy Playbook — shared application shell.
 *
 * The shell knows nothing about any particular strategy. Controls, sections,
 * numbers and copy are all derived from a strategy descriptor in `strategies/`,
 * so adding a strategy is a registry entry rather than a UI change.
 *
 * Rendering happens in two tiers so typing and dragging never lose focus:
 *   renderAll()     rebuilds the page (language, theme, strategy, visibility)
 *   renderOutputs() rewrites only the derived regions (values changed)
 */

/* ------------------------------------------------------------------ i18n --
 * Every shell string lives here; strategy strings live in the descriptor.
 * Both use the same `{ en, zh }` shape.
 */
const UI = {
  appName: { en: 'Strategy Playbook', zh: '策略手册' },
  strategy: { en: 'Strategy', zh: '策略' },
  reset: { en: 'Reset', zh: '重置' },
  share: { en: 'Share link', zh: '分享链接' },
  copySummary: { en: 'Copy summary', zh: '复制摘要' },
  linkCopied: { en: 'Link copied', zh: '链接已复制' },
  summaryCopied: { en: 'Summary copied', zh: '摘要已复制' },
  copyFailed: { en: 'Copy is blocked in this browser', zh: '此浏览器阻止了复制' },
  copyManual: { en: 'Copy this text', zh: '请手动复制以下内容' },
  copyManualHint: {
    en: 'Your browser blocked the clipboard, so here is the text to copy by hand.',
    zh: '浏览器阻止了剪贴板访问，请手动复制下面的文字。',
  },
  close: { en: 'Close', zh: '关闭' },
  remember: { en: 'Remember my values on this device', zh: '在本设备记住我的数值' },
  toDark: { en: 'Switch to the night theme', zh: '切换到夜间主题' },
  toLight: { en: 'Switch to the paper theme', zh: '切换到纸面主题' },
  toOtherLanguage: { en: '切换到中文', zh: 'Switch to English' },
  viewSource: { en: 'Watch the source video', zh: '观看来源视频' },
  yes: { en: 'Yes', zh: '有' },
  no: { en: 'No', zh: '无' },

  allocationHint: {
    en: 'Tap a slice or a name to focus on that bucket.',
    zh: '点击扇区或名称，聚焦对应仓位。',
  },
  allocationTitle: { en: 'Your allocation', zh: '你的配置' },
  total: { en: 'Total', zh: '总额' },
  ofPortfolio: { en: 'of portfolio', zh: '占总组合' },
  riskNote: { en: 'Risk note', zh: '风险提示' },
  showAll: { en: 'Show all buckets', zh: '显示全部仓位' },

  calcTitle: { en: 'Calculation details', zh: '计算明细' },
  calcHint: {
    en: 'Every number on this page comes from these formulas.',
    zh: '页面上的所有数值都来自下列公式。',
  },
  formula: { en: 'Formula', zh: '公式' },
  result: { en: 'Result', zh: '结果' },

  waterfall: { en: 'Cash flow waterfall', zh: '现金流瀑布' },
  waterfallSubtitle: {
    en: 'How realised options proceeds turn into long-term holdings.',
    zh: '已实现的期权所得如何转化为长期持仓。',
  },
  oneWayRule: {
    en: 'Options profits never replenish or enlarge the options pool.',
    zh: '期权利润不回流、不扩大期权仓位。',
  },
  flowActive: { en: 'Active', zh: '进行中' },
  flowWaiting: { en: 'Wait', zh: '等待' },
  flowReady: { en: 'Next', zh: '下一步' },
  flowIdle: { en: 'Inactive', zh: '未启用' },

  riskTitle: { en: 'Risk check', zh: '风险检查' },

  planSays: { en: 'What the plan says', zh: '计划的做法' },
  when: { en: 'When', zh: '条件' },
  then: { en: 'Then', zh: '操作' },
  ruleActive: { en: 'Triggered', zh: '已触发' },
  ruleBlocked: { en: 'On hold', zh: '暂缓' },
  ruleWaiting: { en: 'Not yet', zh: '未达到' },
  ruleCovered: { en: 'Covered', zh: '已涵盖' },
  ruleIdle: { en: 'Not triggered', zh: '未触发' },
  tryCase: { en: 'Try this case', zh: '试试这个情景' },
  presetLoaded: { en: 'Example loaded into the inputs', zh: '示例数值已填入' },
  driftTitle: { en: 'Allocation drift', zh: '配置偏离' },
  driftHint: {
    en: 'Your weights against the targets. Observations only — no trade instructions.',
    zh: '你的占比与目标的比较。仅为观察，不构成交易指令。',
  },
  driftBucket: { en: 'Bucket', zh: '仓位' },
  driftTarget: { en: 'Target', zh: '目标' },
  driftCurrent: { en: 'Now', zh: '当前' },
  driftGap: { en: 'Gap', zh: '差额' },
  driftUnder: { en: 'Underweight', zh: '低配' },
  driftOn: { en: 'On target', zh: '符合目标' },
  driftOver: { en: 'Overweight', zh: '超配' },
  driftSum: { en: 'Your three weights add up to', zh: '你填写的三项合计为' },
  driftSumHint: { en: 'Adjust them until they total 100%.', zh: '请调整至合计 100%。' },

  disclaimerTitle: { en: 'Educational use only', zh: '仅供教育使用' },
  disclaimer: {
    en: 'This dashboard is an educational visualization of a portfolio-management framework. It does not provide investment, tax, legal, or brokerage advice. Options and margin can produce losses exceeding the initial amount committed. Illustrative returns are not forecasts or guarantees.',
    zh: '本仪表板仅用于展示一种仓位管理框架，不构成投资、税务、法律或券商建议。期权与保证金交易可能造成重大损失，部分情况下损失可能超过初始投入。所有收益情景仅为演示，不代表预测或保证。',
  },
  inspiredBy: {
    en: 'Unofficial educational visualization of a publicly presented strategy framework.',
    zh: '非官方教育可视化，基于一套公开讲解的策略框架。',
  },
  // Required by the font's CC BY-NC licence — see fonts/README.md.
  fontCredit: {
    en: 'Handwriting font: xkcd Script, from the handwriting of Randall Munroe',
    zh: '手写字体：xkcd Script，来自 Randall Munroe 的手写字体',
  },
  srSummary: { en: 'Allocation summary', zh: '配置摘要' },
  skipLink: { en: 'Skip to the strategy workspace', zh: '跳到策略工作区' },
};

/* ----------------------------------------------------------------- state -- */

const STORAGE = {
  locale: 'strategy-playbook.locale',
  theme: 'strategy-playbook.theme',
  strategy: 'strategy-playbook.strategy',
  remember: 'strategy-playbook.remember',
  values: 'strategy-playbook.values',
};

function readStorage(key, fallback = null) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback; // storage can be disabled; the page still works
  }
}

function writeStorage(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

const prefersZh = navigator.language?.toLowerCase().startsWith('zh');
const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');

const state = {
  locale: readStorage(STORAGE.locale, prefersZh ? 'zh' : 'en') === 'zh' ? 'zh' : 'en',
  theme: readStorage(STORAGE.theme, prefersDark ? 'dark' : 'light') === 'dark' ? 'dark' : 'light',
  strategyId: getStrategy(readStorage(STORAGE.strategy)).id,
  values: {},
  focusBucket: null, // clicked bucket, highlighted until cleared
  previewBucket: null, // hovered/focused bucket, shown in the donut centre
  remember: readStorage(STORAGE.remember) === 'true',
  toast: null,
};

const app = document.querySelector('#app');
let toastTimer = 0;

/* ------------------------------------------------------------ formatting -- */

function localize(value) {
  if (value == null) return '';
  // Copy that quotes a rule is written as a function of the strategy's rules.
  if (typeof value === 'function') return localize(value(currentStrategy().config.rules));
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return number(value, 2);
  return value[state.locale] ?? value.en ?? '';
}

const ui = (key) => localize(UI[key]);

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

const text = (value) => escapeHtml(localize(value));

const locale = () => (state.locale === 'zh' ? 'zh-CN' : 'en-US');

function money(value, compact = false) {
  return new Intl.NumberFormat(locale(), {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
    notation: compact && Math.abs(value) >= 1_000_000 ? 'compact' : 'standard',
  }).format(value);
}

function number(value, digits = 0) {
  return new Intl.NumberFormat(locale(), {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatCount(value, kind) {
  if (kind === 'money') return money(value);
  if (kind === 'moneyCompact') return money(value, true);
  if (kind === 'percent1') return `${number(value, 1)}%`;
  if (kind === 'percent') return `${number(value, 0)}%`;
  return number(value, 0);
}

/* --------------------------------------------------- animated number cells --
 * Values are written into the markup already formatted, so the page is correct
 * before any script runs. After each render we tween from the previously shown
 * value to the new one, unless the visitor prefers reduced motion.
 */
const shownCounts = new Map();
const activeTweens = new Map();

function count(id, value, kind = 'money', className = '') {
  return `<span class="num ${className}" data-count="${escapeHtml(id)}" data-count-value="${value}" data-count-kind="${kind}">${escapeHtml(
    formatCount(value, kind),
  )}</span>`;
}

function runCounts(animate) {
  for (const node of document.querySelectorAll('[data-count]')) {
    const id = node.dataset.count;
    const target = Number(node.dataset.countValue);
    const kind = node.dataset.countKind;
    const previous = shownCounts.get(id);

    const frame = activeTweens.get(id);
    if (frame) {
      cancelAnimationFrame(frame);
      activeTweens.delete(id);
    }

    if (!animate || previous === undefined || previous === target || reduceMotion?.matches) {
      shownCounts.set(id, target);
      continue;
    }

    const from = previous;
    const started = performance.now();
    const duration = 380;
    const step = (now) => {
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - (1 - progress) ** 3;
      const current = from + (target - from) * eased;
      node.textContent = formatCount(current, kind);
      shownCounts.set(id, current);
      if (progress < 1) {
        activeTweens.set(id, requestAnimationFrame(step));
      } else {
        activeTweens.delete(id);
        shownCounts.set(id, target);
      }
    };
    activeTweens.set(id, requestAnimationFrame(step));
  }
}

/* ------------------------------------------------------------- input state -- */

function currentStrategy() {
  return getStrategy(state.strategyId);
}

/** Inputs whose `visibleWhen` predicate passes for the current values. */
function visibleInputs(strategy = currentStrategy()) {
  return strategy.inputs.filter((input) => !input.visibleWhen || input.visibleWhen(state.values));
}

/** Signature used to detect when the set of visible controls changes. */
function visibilitySignature() {
  return visibleInputs().map((input) => input.id).join('|');
}

function defaultsFor(strategy) {
  return { ...strategy.defaults };
}

function clampInput(input, value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const min = input.min ?? parsed;
  const max = input.max ?? parsed;
  return Math.min(Math.max(parsed, min), max);
}

/* --------------------------------------------------------------- URL state --
 * The address bar always carries the current scenario, so "share" shares what
 * the visitor is actually looking at. Values are never written to storage
 * unless the visitor opts in with "Remember my values".
 */
function scenarioUrl() {
  const strategy = currentStrategy();
  const params = new URLSearchParams();
  params.set('s', strategy.id);
  params.set('lang', state.locale);
  for (const input of strategy.inputs) params.set(input.id, String(state.values[input.id]));
  return `${location.origin}${location.pathname}${location.search}#${params.toString()}`;
}

let urlTimer = 0;
function syncUrl() {
  window.clearTimeout(urlTimer);
  urlTimer = window.setTimeout(() => {
    history.replaceState(null, '', scenarioUrl());
  }, 250);
}

/**
 * Apply a shared link. Returns true when it changed anything the page shows —
 * the strategy, the language or any input — so the caller knows to redraw.
 */
function applyHash() {
  const raw = location.hash.replace(/^#/, '');
  if (!raw) return false;
  const params = new URLSearchParams(raw);
  const before = `${state.strategyId}|${state.locale}|${JSON.stringify(state.values)}`;
  const requested = params.get('s');
  if (requested) state.strategyId = getStrategy(requested).id;
  const lang = params.get('lang');
  if (lang === 'zh' || lang === 'en') state.locale = lang;

  // A link describes a whole scenario: anything it leaves out is a default.
  const strategy = currentStrategy();
  state.values = defaultsFor(strategy);
  for (const input of strategy.inputs) {
    if (!params.has(input.id)) continue;
    const value = params.get(input.id);
    if (input.kind === 'toggle') {
      state.values[input.id] = value === 'true';
    } else if (input.kind === 'choice') {
      if (input.options.some((option) => option.value === value)) state.values[input.id] = value;
    } else {
      const parsed = clampInput(input, value);
      if (parsed !== null) state.values[input.id] = parsed;
    }
  }
  return `${state.strategyId}|${state.locale}|${JSON.stringify(state.values)}` !== before;
}

function loadRememberedValues() {
  if (!state.remember) return false;
  try {
    const stored = JSON.parse(readStorage(STORAGE.values, '{}') || '{}');
    const saved = stored[state.strategyId];
    if (!saved) return false;
    state.values = { ...defaultsFor(currentStrategy()), ...saved };
    return true;
  } catch {
    return false;
  }
}

function persistValues() {
  if (!state.remember) {
    writeStorage(STORAGE.values, null);
    return;
  }
  try {
    const stored = JSON.parse(readStorage(STORAGE.values, '{}') || '{}');
    stored[state.strategyId] = state.values;
    writeStorage(STORAGE.values, JSON.stringify(stored));
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------- sketch bits -- */

/** Hand-drawn underline used beneath headings. */
function underline(className = 'ink-underline') {
  return `<svg class="${className}" viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <path d="M3 8 C 40 2, 78 10, 116 5 S 176 3, 197 7" />
  </svg>`;
}

/** One-off SVG defs: the pencil wobble filter used by sketch strokes. */
function sketchDefs() {
  return `<svg class="sketch-defs" aria-hidden="true" focusable="false" width="0" height="0">
    <defs>
      <filter id="pencil" x="-25%" y="-25%" width="150%" height="150%">
        <feTurbulence type="fractalNoise" baseFrequency="0.025" numOctaves="2" seed="7" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.2" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </defs>
  </svg>`;
}

/* ---------------------------------------------------------------- controls -- */

function controlHelper(input) {
  return input.helper ? `<span class="control-helper">${text(input.helper)}</span>` : '';
}

function renderControl(input) {
  const id = `field-${input.id}`;
  const value = state.values[input.id];

  if (input.kind === 'toggle') {
    return `
      <div class="control" data-control="${input.id}">
        <span class="control-label" id="${id}-label">${text(input.label)}</span>
        ${controlHelper(input)}
        <div class="segmented" role="group" aria-labelledby="${id}-label">
          <button type="button" class="segmented-option${value === true ? ' is-on' : ''}"
            data-toggle="${input.id}" data-toggle-value="true" aria-pressed="${value === true}"
            data-focus-key="toggle:${input.id}:true">${ui('yes')}</button>
          <button type="button" class="segmented-option${value === false ? ' is-on' : ''}"
            data-toggle="${input.id}" data-toggle-value="false" aria-pressed="${value === false}"
            data-focus-key="toggle:${input.id}:false">${ui('no')}</button>
        </div>
      </div>`;
  }

  if (input.kind === 'choice') {
    return `
      <div class="control" data-control="${input.id}">
        <span class="control-label" id="${id}-label">${text(input.label)}</span>
        ${controlHelper(input)}
        <div class="segmented" role="group" aria-labelledby="${id}-label">
          ${input.options
            .map(
              (option) => `<button type="button" class="segmented-option${value === option.value ? ' is-on' : ''}"
                data-choice="${input.id}" data-choice-value="${escapeHtml(option.value)}"
                aria-pressed="${value === option.value}"
                data-focus-key="choice:${input.id}:${escapeHtml(option.value)}">${text(option.label)}</button>`,
            )
            .join('')}
        </div>
      </div>`;
  }

  if (input.kind === 'currency') {
    return `
      <div class="control" data-control="${input.id}">
        <label class="control-label" for="${id}">${text(input.label)}</label>
        ${controlHelper(input)}
        <div class="money-field">
          <span class="money-prefix" aria-hidden="true">$</span>
          <input id="${id}" type="text" inputmode="decimal" autocomplete="off" spellcheck="false"
            data-field="${input.id}" data-focus-key="input:${input.id}"
            value="${escapeHtml(number(value, 0))}"
            aria-describedby="${id}-range" />
        </div>
        <p class="control-range" id="${id}-range">${escapeHtml(money(input.min))} – ${escapeHtml(money(input.max))}</p>
      </div>`;
  }

  // range
  const digits = input.step < 1 ? 2 : 0;
  const progress = ((Number(value) - input.min) / (input.max - input.min)) * 100;
  return `
    <div class="control control--range" data-control="${input.id}">
      <label class="control-label" for="${id}">${text(input.label)}</label>
      <output class="control-value" for="${id}">${escapeHtml(`${number(value, digits)}${input.suffix ?? ''}`)}</output>
      ${controlHelper(input)}
      <input id="${id}" type="range" data-field="${input.id}" data-focus-key="input:${input.id}"
        min="${input.min}" max="${input.max}" step="${input.step}" value="${value}"
        style="--range-progress:${progress}%" />
      <div class="range-scale" aria-hidden="true">
        <span>${escapeHtml(`${number(input.min, 0)}${input.suffix ?? ''}`)}</span>
        <span>${escapeHtml(`${number(input.max, 0)}${input.suffix ?? ''}`)}</span>
      </div>
    </div>`;
}

/** All of a group's controls share one card; whitespace separates them. */
function renderControlsCard(group) {
  const inputs = visibleInputs().filter((input) => input.group === group.id);
  if (inputs.length === 0) return '';
  return `
    <div class="note-card controls-card" data-columns="${group.columns ?? 3}">
      ${inputs.map(renderControl).join('')}
    </div>`;
}

/* ------------------------------------------------------------- allocations -- */

function donutGeometry(allocations) {
  const gap = 1.6; // pathLength units left blank between slices
  let start = 0;
  return allocations.map((bucket) => {
    const length = Math.max(bucket.percent - gap, 0.4);
    const segment = { bucket, dash: `${length} ${100 - length}`, offset: -start };
    start += bucket.percent;
    return segment;
  });
}

function renderDonut(evaluation) {
  const segments = donutGeometry(evaluation.allocations);
  const label = evaluation.allocations
    .map((bucket) => `${localize(bucket.label)} ${number(bucket.percent, 1)}%`)
    .join(', ');

  return `
    <div class="donut" data-focus="${state.focusBucket ?? ''}">
      <svg class="donut-svg" viewBox="0 0 200 200" role="img" aria-label="${escapeHtml(label)}">
        <g transform="rotate(-90 100 100)" filter="url(#pencil)">
          <circle class="donut-track" cx="100" cy="100" r="74" pathLength="100" />
          ${segments
            .map(
              (segment) => `<circle class="donut-slice donut-slice--${segment.bucket.tone}"
                data-bucket="${segment.bucket.id}"
                cx="100" cy="100" r="74" pathLength="100"
                stroke-dasharray="${segment.dash}" stroke-dashoffset="${segment.offset}" />`,
            )
            .join('')}
        </g>
      </svg>
      <div class="donut-center" data-region="donut-center">${renderDonutCenter(evaluation)}</div>
    </div>`;
}

function renderDonutCenter(evaluation) {
  const id = state.previewBucket ?? state.focusBucket;
  const bucket = id ? evaluation.allocations.find((item) => item.id === id) : null;
  if (!bucket) {
    return `
      <span class="donut-kicker">${ui('total')}</span>
      ${count('donut.total', evaluation.metrics.total, 'moneyCompact', 'donut-value')}`;
  }
  return `
    <span class="donut-kicker donut-kicker--${bucket.tone}">${text(bucket.label)}</span>
    <span class="num donut-value">${escapeHtml(`${number(bucket.percent, 1)}%`)}</span>
    <span class="donut-foot num">${escapeHtml(money(bucket.amount, true))}</span>
    ${bucket.formula ? `<span class="donut-formula">${escapeHtml(bucket.formula)}</span>` : ''}`;
}

function renderLegend(evaluation) {
  return `
    <ul class="legend">
      ${evaluation.allocations
        .map(
          (bucket) => `<li>
            <button type="button" class="legend-row legend-row--${bucket.tone}${state.focusBucket === bucket.id ? ' is-on' : ''}"
              data-bucket="${bucket.id}" aria-pressed="${state.focusBucket === bucket.id}"
              data-focus-key="bucket:${bucket.id}">
              <span class="legend-mark" aria-hidden="true"></span>
              <span class="legend-name">${text(bucket.label)}</span>
              <span class="legend-percent num">${escapeHtml(`${number(bucket.percent, 1)}%`)}</span>
              <span class="legend-amount num">${escapeHtml(money(bucket.amount))}</span>
            </button>
          </li>`,
        )
        .join('')}
    </ul>`;
}

function renderAllocationItem(item) {
  const marks = item.segments
    ? `<div class="cap-marks" aria-hidden="true">${Array.from({ length: item.segments }, (_, index) =>
        index < (item.segmentsFilled ?? item.segments) ? '<span></span>' : '<span class="is-empty"></span>',
      ).join('')}</div>`
    : `<div class="item-bar" aria-hidden="true"><span style="width:${item.percent}%"></span></div>`;
  return `
    <li class="alloc-item">
      <div class="alloc-item-head">
        <span class="alloc-item-name">${text(item.label)} <span class="alloc-item-share num">${escapeHtml(
          `${number(item.percent, 0)}%`,
        )}</span></span>
        <span class="alloc-item-amount num">${escapeHtml(money(item.amount))}</span>
      </div>
      ${marks}
      <p class="alloc-item-note">${escapeHtml(`${number(item.portfolioPercent, 1)}% ${localize(UI.ofPortfolio)}`)}${
        item.note ? ` · ${text(item.note)}` : ''
      }</p>
    </li>`;
}

/** "Held now vs. target" bar for buckets that track a funding level. */
function renderBucketMeter(bucket) {
  const meter = bucket.meter;
  const filled = meter.target > 0 ? Math.min(100, (meter.current / meter.target) * 100) : 100;
  const funded = meter.current >= meter.target;
  return `
    <div class="bucket-meter">
      <div class="bucket-meter-head">
        <span>${text(meter.label)}</span>
        <span class="num">${escapeHtml(`${money(meter.current)} / ${money(meter.target)}`)}</span>
      </div>
      <div class="bucket-meter-track" role="img"
        aria-label="${escapeHtml(`${localize(meter.label)}: ${money(meter.current)} / ${money(meter.target)}`)}">
        <span style="width:${filled}%"></span>
      </div>
      <p class="bucket-meter-foot">
        <span class="status-pill ${funded ? 'status-pill--ready' : 'status-pill--waiting'}">
          <span aria-hidden="true">${funded ? '✓' : '↓'}</span>${text(meter.status)}
        </span>
        ${
          !funded && meter.shortfall
            ? `<span class="num">${text(meter.shortfallLabel)} ${escapeHtml(money(meter.shortfall))}</span>`
            : ''
        }
      </p>
    </div>`;
}

function renderAllocationCard(bucket) {
  const dimmed = state.focusBucket && state.focusBucket !== bucket.id;
  return `
    <article class="note-card alloc-card alloc-card--${bucket.tone}${dimmed ? ' is-dimmed' : ''}${
      state.focusBucket === bucket.id ? ' is-focused' : ''
    }">
      <header class="alloc-card-head">
        <h4 class="hand alloc-card-title">${text(bucket.label)}</h4>
        <p class="alloc-card-figures">
          ${count(`alloc.${bucket.id}.percent`, bucket.percent, 'percent', 'alloc-percent-num')}
          ${count(`alloc.${bucket.id}.amount`, bucket.amount, 'money', 'alloc-amount-num')}
        </p>
        <p class="alloc-card-desc">${text(bucket.description)}</p>
      </header>
      ${bucket.items.length ? `<ul class="alloc-items">${bucket.items.map(renderAllocationItem).join('')}</ul>` : ''}
      ${
        bucket.rule
          ? `<p class="card-rule"><span>${text(bucket.rule.label)}</span>${count(
              `alloc.${bucket.id}.rule`,
              bucket.rule.amount,
              'money',
              'card-rule-value',
            )}</p>`
          : ''
      }
      ${bucket.meter ? renderBucketMeter(bucket) : ''}
      ${bucket.callout ? `<p class="card-callout">${text(bucket.callout)}</p>` : ''}
      ${bucket.risk ? `<p class="card-risk"><strong>${ui('riskNote')}:</strong> ${text(bucket.risk)}</p>` : ''}
    </article>`;
}

function screenReaderSummary(evaluation) {
  const parts = evaluation.allocations.map((bucket) => {
    const items = bucket.items.map((item) => `${localize(item.label)} ${money(item.amount)}`).join('; ');
    return `${localize(bucket.label)}: ${number(bucket.percent, 1)}%, ${money(bucket.amount)}${items ? `. ${items}` : ''}`;
  });
  return `${ui('srSummary')}: ${money(evaluation.metrics.total)}. ${parts.join('. ')}.`;
}

/** Small heading for an output block inside a step. */
function outputHead(title, note, aside = '') {
  return `
    <div class="output-head">
      <div>
        <h3 class="hand">${title}</h3>
        ${note ? `<p class="muted">${note}</p>` : ''}
      </div>
      ${aside}
    </div>`;
}

function renderAllocations(evaluation) {
  const clear = state.focusBucket
    ? `<button type="button" class="pill-btn pill-btn--ghost" data-action="clear-focus" data-focus-key="action:clear-focus">${ui('showAll')}</button>`
    : '';
  return `
    ${outputHead(ui('allocationTitle'), ui('allocationHint'), clear)}
    <p class="sr-only">${escapeHtml(screenReaderSummary(evaluation))}</p>
    <div class="allocation-top">
      ${renderDonut(evaluation)}
      ${renderLegend(evaluation)}
    </div>
    <div class="alloc-grid">
      ${evaluation.allocations.map(renderAllocationCard).join('')}
    </div>`;
}

/* ----------------------------------------------------------------- drawer -- */

function renderFormulas(evaluation) {
  const rows = evaluation.formulas ?? [];
  if (rows.length === 0) return '';
  return `
    <details class="note-card calc-drawer">
      <summary data-focus-key="calc">
        <span class="hand">${ui('calcTitle')}</span>
        <span class="calc-hint">${ui('calcHint')}</span>
      </summary>
      <div class="calc-body" data-region="formulas">${renderFormulaRows(rows)}</div>
    </details>`;
}

/** Format a model value by kind: money, percent, or (bilingual) text. */
function formatValue(value, kind) {
  if (kind === 'money') return money(value);
  if (kind === 'percent') return `${number(value, 1)}%`;
  return localize(value);
}

function renderFormulaRows(rows) {
  return `
    <table class="calc-table">
      <thead>
        <tr><th scope="col">${ui('formula')}</th><th scope="col"></th><th scope="col">${ui('result')}</th></tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row) => `<tr>
              <th scope="row">${text(row.label)}</th>
              <td class="mono" data-label="${ui('formula')}">${escapeHtml(row.expression)}</td>
              <td class="mono calc-result" data-label="${ui('result')}">${escapeHtml(formatValue(row.result, row.kind))}</td>
            </tr>`,
          )
          .join('')}
      </tbody>
    </table>`;
}

/* -------------------------------------------------------------- waterfall -- */

const FLOW_STATUS_LABEL = {
  active: 'flowActive',
  waiting: 'flowWaiting',
  ready: 'flowReady',
  idle: 'flowIdle',
};

/* The waterfall is laid out as a serpentine: rows alternate direction so the
 * step after a row break always sits directly below its predecessor. Column
 * count comes from matchMedia rather than CSS so the arrows can point the
 * right way. */
const FLOW_BREAKPOINTS = [
  { columns: 3, query: window.matchMedia('(min-width: 901px)') },
  { columns: 2, query: window.matchMedia('(min-width: 721px)') },
];

function flowColumns() {
  for (const entry of FLOW_BREAKPOINTS) {
    if (entry.query.matches) return entry.columns;
  }
  return 1;
}

/** Grid position and outgoing arrow direction for a step. */
function flowPlacement(index, columns) {
  const row = Math.floor(index / columns);
  const column = index % columns;
  const rightToLeft = row % 2 === 1;
  return {
    gridColumn: rightToLeft ? columns - column : column + 1,
    gridRow: row + 1,
    direction: column === columns - 1 ? 'down' : rightToLeft ? 'left' : 'right',
  };
}

const FLOWING = new Set(['active', 'ready']);

/** A connector only flows when both of the steps it joins are live. */
function connectorStatus(step, next) {
  if (step.status === 'waiting') return 'waiting';
  return FLOWING.has(step.status) && FLOWING.has(next.status) ? 'active' : 'idle';
}

function flowArrow(status, direction, amount) {
  const flowing = status === 'active';
  return `
    <div class="flow-arrow flow-arrow--${status} flow-arrow--${direction}" aria-hidden="true">
      ${
        flowing && amount !== null && amount !== undefined
          ? `<span class="flow-arrow-amount num">${escapeHtml(money(amount))}</span>`
          : ''
      }
      <svg viewBox="0 0 64 24" class="${flowing ? 'is-flowing' : ''}">
        <path class="flow-arrow-line" d="M2 12 C 18 7, 32 17, 48 12" />
        <path class="flow-arrow-head" d="M42 6 L 52 12 L 42 18" />
      </svg>
    </div>`;
}

function renderFlow(evaluation) {
  const steps = evaluation.flow ?? [];
  if (steps.length === 0) return '';
  const columns = flowColumns();

  return `
    ${outputHead(ui('waterfall'), evaluation.flowSummary ? text(evaluation.flowSummary) : ui('waterfallSubtitle'))}
    <p class="rule-note"><span aria-hidden="true">→</span>${ui('oneWayRule')}</p>
    <ol class="flow-track" data-columns="${columns}">
      ${steps
        .map((step, index) => {
          const next = steps[index + 1];
          const placement = flowPlacement(index, columns);
          const dimmed = state.focusBucket && step.bucket && step.bucket !== state.focusBucket;
          return `
            <li class="flow-unit${dimmed ? ' is-dimmed' : ''}"
              style="grid-column:${placement.gridColumn};grid-row:${placement.gridRow}">
              <article class="note-card flow-step flow-step--${step.status}">
                <p class="flow-step-top">
                  <span class="flow-index mono">${String(index + 1).padStart(2, '0')}</span>
                  <span class="status-pill status-pill--${step.status}">${ui(FLOW_STATUS_LABEL[step.status] ?? 'flowIdle')}</span>
                </p>
                <h4 class="hand flow-step-title">${text(step.label)}</h4>
                <p class="flow-step-detail">${text(step.detail)}</p>
                ${
                  typeof step.amount === 'number'
                    ? `<p class="flow-step-amount">${count(`flow.${step.id}`, step.amount, 'money')}</p>`
                    : ''
                }
                ${
                  step.breakdown
                    ? `<ul class="flow-breakdown">${step.breakdown
                        .map(
                          (row) => `<li><span>${text(row.label)}</span><span class="num">${escapeHtml(money(row.amount))}</span></li>`,
                        )
                        .join('')}</ul>`
                    : ''
                }
                ${
                  step.footnote
                    ? `<p class="flow-footnote"><span>${text(step.footnote)}</span><span class="num">${escapeHtml(
                        money(step.footnoteAmount ?? 0),
                      )}</span></p>`
                    : ''
                }
                ${step.note ? `<p class="flow-step-note">${text(step.note)}</p>` : ''}
              </article>
              ${next ? flowArrow(connectorStatus(step, next), placement.direction, next.amount ?? null) : ''}
            </li>`;
        })
        .join('')}
    </ol>`;
}

/* ------------------------------------------------------------- risk panel -- */

const DRIFT_LABEL = { under: 'driftUnder', on: 'driftOn', over: 'driftOver' };
const DRIFT_MARK = { under: '↓', on: '✓', over: '↑' };

/**
 * A labelled scale with threshold marks. Everything about it — range, marks,
 * which side each label sits on, and the status sentence — comes from the
 * strategy, so the shell holds no thresholds of its own.
 */
function renderGauge(gauge) {
  const min = gauge.min ?? 0;
  const span = gauge.max - min;
  const at = (value) => `${Math.max(0, Math.min(100, ((value - min) / span) * 100))}%`;
  const suffix = gauge.suffix ?? '';
  const marks = gauge.marks ?? [];
  return `
    <div class="risk-block gauge gauge--${gauge.tone ?? 'ok'}">
      <div class="gauge-head">
        <h4 class="hand">${text(gauge.label)}</h4>
        <p class="gauge-value">${count(`gauge.${gauge.id}`, gauge.value, suffix === '%' ? 'percent' : 'number')}</p>
      </div>
      <div class="gauge-track" role="meter" aria-valuemin="${min}" aria-valuemax="${gauge.max}" aria-valuenow="${gauge.value}"
        aria-label="${escapeHtml(localize(gauge.label))}"
        aria-valuetext="${escapeHtml(`${number(gauge.value, 1)}${suffix} — ${localize(gauge.status)}`)}">
        <span class="gauge-fill" style="width:${at(gauge.value)}"></span>
        ${marks.map((mark) => `<span class="gauge-mark gauge-mark--${mark.tone}" style="left:${at(mark.at)}"></span>`).join('')}
      </div>
      <div class="gauge-labels" aria-hidden="true">
        ${marks
          .map((mark) =>
            mark.align === 'end'
              ? `<span class="gauge-label gauge-label--end gauge-label--${mark.tone}" style="right:calc(100% - ${at(mark.at)})">${text(mark.label)}</span>`
              : `<span class="gauge-label gauge-label--start gauge-label--${mark.tone}" style="left:${at(mark.at)}">${text(mark.label)}</span>`,
          )
          .join('')}
      </div>
      ${gauge.status ? `<p class="gauge-status">${text(gauge.status)}</p>` : ''}
      ${gauge.note ? `<p class="muted small">${text(gauge.note)}</p>` : ''}
    </div>`;
}

function renderDrift(drift) {
  if (!drift) return '';
  const offBy = Math.abs(drift.sumPercent - 100) > 0.01;
  return `
    <div class="risk-block">
      <h4 class="hand">${ui('driftTitle')}</h4>
      <p class="muted small">${ui('driftHint')}</p>
      <table class="drift-table">
        <thead>
          <tr>
            <th scope="col">${ui('driftBucket')}</th>
            <th scope="col">${ui('driftTarget')}</th>
            <th scope="col">${ui('driftCurrent')}</th>
            <th scope="col">${ui('driftGap')}</th>
            <th scope="col"><span class="sr-only">${ui('driftTitle')}</span></th>
          </tr>
        </thead>
        <tbody>
          ${drift.rows
            .map(
              (row) => `<tr>
                <th scope="row"><span class="legend-mark legend-mark--${row.tone}" aria-hidden="true"></span>${text(row.label)}</th>
                <td class="num" data-label="${ui('driftTarget')}">${escapeHtml(`${number(row.targetPercent, 1)}%`)}</td>
                <td class="num" data-label="${ui('driftCurrent')}">${escapeHtml(`${number(row.currentPercent, 1)}%`)}</td>
                <td class="num" data-label="${ui('driftGap')}">${escapeHtml(
                  `${row.deltaPercent > 0 ? '+' : ''}${number(row.deltaPercent, 1)}% · ${row.deltaPercent > 0 ? '+' : '−'}${money(
                    Math.abs(row.deltaAmount),
                  )}`,
                )}</td>
                <td><span class="status-pill status-pill--drift-${row.status}"><span aria-hidden="true">${
                  DRIFT_MARK[row.status]
                }</span>${ui(DRIFT_LABEL[row.status])}</span></td>
              </tr>`,
            )
            .join('')}
        </tbody>
      </table>
      ${
        offBy
          ? `<p class="drift-warning">${ui('driftSum')} ${escapeHtml(`${number(drift.sumPercent, 1)}%`)}. ${ui('driftSumHint')}</p>`
          : ''
      }
    </div>`;
}

/** Optional status cards, for strategies whose risk story isn't told elsewhere. */
function renderRiskItems(risks) {
  if (!risks?.length) return '';
  return `
    <ul class="risk-block risk-grid">
      ${risks
        .map(
          (risk) => `<li class="risk-item risk-item--${risk.tone}">
            <span class="risk-item-label">${text(risk.label)}</span>
            <strong class="risk-item-value">${text(risk.value)}</strong>
            <p>${text(risk.detail)}</p>
          </li>`,
        )
        .join('')}
    </ul>`;
}

/** Titled lists of discipline notes — each strategy names its own. */
function renderNotes(notes) {
  return (notes ?? [])
    .map(
      (note) => `
        <div class="risk-block">
          <h4 class="hand">${text(note.title)}</h4>
          <ul class="principles">
            ${note.items.map((item) => `<li><strong>${text(item.title)}.</strong> ${text(item.detail)}</li>`).join('')}
          </ul>
        </div>`,
    )
    .join('');
}

const hasRiskContent = (evaluation) =>
  Boolean(evaluation.gauges?.length || evaluation.risks?.length || evaluation.drift || evaluation.notes?.length);

function renderRisk(evaluation) {
  return `
    ${outputHead(ui('riskTitle'))}
    ${(evaluation.gauges ?? []).map(renderGauge).join('')}
    ${renderRiskItems(evaluation.risks)}
    ${renderDrift(evaluation.drift)}
    ${renderNotes(evaluation.notes)}`;
}

/* --------------------------------------------------------------- decision --
 * Rule-based strategies report one or more lanes: a set of rules, each with a
 * status, and a verdict saying what the plan does next.
 */

const RULE_STATUS_LABEL = {
  active: 'ruleActive',
  blocked: 'ruleBlocked',
  waiting: 'ruleWaiting',
  covered: 'ruleCovered',
  idle: 'ruleIdle',
};

function renderRule(rule) {
  return `
    <li class="note-card rule rule--${rule.status} tone--${rule.tone ?? 'hold'}">
      <p class="rule-top">
        <span class="rule-tone" aria-hidden="true"></span>
        <span class="status-pill status-pill--${rule.status}">${ui(RULE_STATUS_LABEL[rule.status] ?? 'ruleIdle')}</span>
      </p>
      <h4 class="hand rule-title">${text(rule.title)}</h4>
      <dl class="rule-logic">
        <div><dt>${ui('when')}</dt><dd${typeof rule.when === 'string' ? ' class="mono"' : ''}>${text(rule.when)}</dd></div>
        <div><dt>${ui('then')}</dt><dd>${text(rule.then)}</dd></div>
      </dl>
      ${rule.note ? `<p class="rule-note-text">${text(rule.note)}</p>` : ''}
      ${
        rule.preset
          ? `<button type="button" class="link-btn" data-preset="${escapeHtml(rule.preset)}"
              data-focus-key="preset:${escapeHtml(rule.preset)}">${ui('tryCase')}</button>`
          : ''
      }
    </li>`;
}

function renderVerdict(verdict) {
  if (!verdict?.actions?.length) return '';
  const numbered = verdict.actions.filter((action) => action.tone !== 'blocked').length > 1;
  let step = 0;
  return `
    <div class="verdict tone--${verdict.tone ?? 'hold'}">
      <p class="verdict-kicker">${ui('planSays')}</p>
      ${verdict.actions
        .map((action) => {
          const blocked = action.tone === 'blocked';
          if (!blocked) step += 1;
          return `
            <div class="verdict-action${blocked ? ' verdict-action--blocked' : ''}">
              <h4 class="hand">${numbered && !blocked ? `${step}. ` : ''}${text(action.title)}</h4>
              <p>${text(action.body)}</p>
              ${
                action.facts?.length
                  ? `<dl class="verdict-facts">${action.facts
                      .map(
                        (fact) =>
                          `<div><dt>${text(fact.label)}</dt><dd class="num">${escapeHtml(formatValue(fact.value, fact.kind))}</dd></div>`,
                      )
                      .join('')}</dl>`
                  : ''
              }
            </div>`;
        })
        .join('')}
    </div>`;
}

function renderDecision(evaluation, laneId) {
  return (evaluation.decision?.lanes ?? [])
    .filter((lane) => !laneId || lane.id === laneId)
    .map(
      (lane) => `
        <div class="lane">
          ${outputHead(text(lane.title), lane.summary ? text(lane.summary) : '')}
          <ul class="rule-grid">${lane.rules.map(renderRule).join('')}</ul>
          ${renderVerdict(lane.verdict)}
        </div>`,
    )
    .join('');
}

/* ------------------------------------------------------------------ shell -- */

/**
 * Output sections a strategy can place in its layout, as `name` or
 * `name:argument`. Each renders into a `data-region` so value changes can
 * refresh it without touching the controls.
 */
const OUTPUTS = {
  allocations: (evaluation) => `<div class="step-output" data-region="allocations">${renderAllocations(evaluation)}</div>`,
  formulas: (evaluation) => renderFormulas(evaluation),
  flow: (evaluation) =>
    evaluation.flow?.length ? `<div class="step-output" data-region="flow">${renderFlow(evaluation)}</div>` : '',
  decision: (evaluation, laneId = '') =>
    evaluation.decision?.lanes?.length
      ? `<div class="decision" data-region="decision" data-arg="${escapeHtml(laneId)}">${renderDecision(evaluation, laneId)}</div>`
      : '',
  risk: (evaluation) =>
    hasRiskContent(evaluation) ? `<div class="risk-panel" data-region="risk">${renderRisk(evaluation)}</div>` : '',
};

/** How each region refreshes in place. */
const REGIONS = {
  allocations: (evaluation) => renderAllocations(evaluation),
  flow: (evaluation) => renderFlow(evaluation),
  risk: (evaluation) => renderRisk(evaluation),
  formulas: (evaluation) => renderFormulaRows(evaluation.formulas ?? []),
  decision: (evaluation, node) => renderDecision(evaluation, node.dataset.arg || ''),
};

/**
 * Turn the flat layout into numbered steps: each `group:` token opens a step,
 * and the output tokens after it belong to that step.
 */
function buildSteps(strategy) {
  const layout = strategy.layout ?? defaultLayout(strategy);
  const steps = [];
  for (const token of layout) {
    if (token.startsWith('group:')) {
      const group = (strategy.groups ?? []).find((item) => item.id === token.slice(6));
      steps.push({ group, outputs: [] });
    } else {
      if (steps.length === 0) steps.push({ group: null, outputs: [] });
      steps[steps.length - 1].outputs.push(token);
    }
  }
  return steps;
}

function renderSteps(strategy, evaluation) {
  let number = 0;
  return buildSteps(strategy)
    .map((step) => {
      const outputs = step.outputs
        .map((token) => {
          const [name, argument] = token.split(':');
          return OUTPUTS[name]?.(evaluation, argument) ?? '';
        })
        .join('');
      if (!step.group) return outputs;
      number += 1;
      const id = `step-${number}-title`;
      return `
        <section class="step" aria-labelledby="${id}">
          <header class="step-head">
            <span class="step-num hand" aria-hidden="true">${number}</span>
            <div>
              <h2 class="hand" id="${id}">${text(step.group.title)}</h2>
              ${step.group.description ? `<p class="muted">${text(step.group.description)}</p>` : ''}
            </div>
          </header>
          ${renderControlsCard(step.group)}
          ${outputs}
        </section>`;
    })
    .join('');
}

function defaultLayout(strategy) {
  return [...(strategy.groups ?? []).map((group) => `group:${group.id}`), 'allocations', 'flow', 'risk'];
}

/** Hand-drawn sun / moon for the single theme toggle. */
function themeIcon(theme) {
  return theme === 'dark'
    ? `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4.2" />
        <path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" /></svg>`
    : `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M19.5 14.6A8 8 0 0 1 9.4 4.5a8 8 0 1 0 10.1 10.1Z" /></svg>`;
}

function renderShell() {
  const strategy = currentStrategy();
  const evaluation = strategy.evaluate(state.values);
  const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
  const nextLocale = state.locale === 'zh' ? 'en' : 'zh';

  document.documentElement.dataset.theme = state.theme;
  document.documentElement.lang = state.locale === 'zh' ? 'zh-CN' : 'en';
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.content = state.theme === 'dark' ? '#1b1815' : '#f4ede0';

  // The picker only earns its space once there is something to pick.
  const picker = STRATEGIES.length > 1
    ? `<label class="sr-only" for="strategy-select">${ui('strategy')}</label>
       <select id="strategy-select" class="pill-select" data-action="strategy" data-focus-key="strategy">
         ${STRATEGIES.map(
           (item) => `<option value="${escapeHtml(item.id)}"${item.id === strategy.id ? ' selected' : ''}>${text(
             item.shortName,
           )}</option>`,
         ).join('')}
       </select>`
    : '';

  return `
    ${sketchDefs()}
    <a class="skip-link" href="#workspace">${ui('skipLink')}</a>
    <header class="masthead">
      <div class="masthead-brand">
        <span class="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 48 48" filter="url(#pencil)">
            <path d="M8 34 C 14 18, 22 30, 28 16 S 38 10, 42 14" />
            <circle cx="28" cy="16" r="3.4" />
            <path d="M6 41 C 18 38, 32 44, 43 39" class="brand-mark-underline" />
          </svg>
        </span>
        <span class="hand brand-name">${ui('appName')}</span>
      </div>
      <div class="masthead-tools">
        <button type="button" class="pill-btn" data-action="share" data-focus-key="action:share">${ui('share')}</button>
        <button type="button" class="pill-btn" data-action="copy" data-focus-key="action:copy">${ui('copySummary')}</button>
        <button type="button" class="icon-btn" data-theme="${nextTheme}" data-focus-key="toggle:theme"
          aria-label="${ui(nextTheme === 'dark' ? 'toDark' : 'toLight')}" title="${ui(nextTheme === 'dark' ? 'toDark' : 'toLight')}">
          ${themeIcon(nextTheme === 'dark' ? 'light' : 'dark')}
        </button>
        <button type="button" class="pill-btn pill-btn--lang" data-locale="${nextLocale}" data-focus-key="toggle:lang"
          lang="${nextLocale === 'zh' ? 'zh-CN' : 'en'}" aria-label="${ui('toOtherLanguage')}">${nextLocale === 'zh' ? '中文' : 'EN'}</button>
      </div>
    </header>

    <main id="workspace">
      <section class="intro">
        <h1 class="hand intro-title">${text(strategy.name)}${underline('ink-underline ink-underline--title')}</h1>
        <p class="intro-lede">${text(strategy.description)}</p>
        ${
          strategy.source
            ? `<p class="intro-source"><a class="link-sketch" href="${escapeHtml(strategy.source.url)}" target="_blank" rel="noreferrer noopener">${ui(
                'viewSource',
              )}<span aria-hidden="true"> ↗</span></a></p>`
            : ''
        }
        <div class="intro-tools">
          ${picker}
          <button type="button" class="pill-btn pill-btn--ghost" data-action="reset" data-focus-key="action:reset">${ui('reset')}</button>
          <label class="checkbox">
            <input type="checkbox" data-action="remember" data-focus-key="action:remember"${state.remember ? ' checked' : ''} />
            <span>${ui('remember')}</span>
          </label>
        </div>
      </section>

      ${renderSteps(strategy, evaluation)}

      <section class="disclaimer" aria-labelledby="disclaimer-title">
        <h2 class="hand" id="disclaimer-title">${ui('disclaimerTitle')}</h2>
        <p>${ui('disclaimer')}</p>
      </section>
    </main>

    <footer class="site-footer">
      <p>${ui('inspiredBy')}${
        strategy.source
          ? ` <a class="link-sketch" href="${escapeHtml(strategy.source.url)}" target="_blank" rel="noreferrer noopener">${text(
              strategy.source.label,
            )}<span aria-hidden="true"> ↗</span></a>`
          : ''
      }</p>
      <p class="footer-credit">${ui('fontCredit')} ·
        <a class="link-plain" href="https://github.com/ipython/xkcd-font" target="_blank" rel="noreferrer noopener">xkcd-font</a> ·
        <a class="link-plain" href="https://creativecommons.org/licenses/by-nc/3.0/" target="_blank" rel="noreferrer noopener">CC BY-NC 3.0</a>
      </p>
    </footer>

    <div class="toast-slot" aria-live="polite">${
      state.toast ? `<p class="toast">${escapeHtml(state.toast)}</p>` : ''
    }</div>`;
}

/* --------------------------------------------------------------- rendering -- */

/** Keep keyboard focus (and caret position) across an innerHTML swap. */
function withFocusRestore(update) {
  const active = document.activeElement;
  const key = active instanceof HTMLElement ? active.dataset.focusKey : null;
  const selection =
    active instanceof HTMLInputElement && active.type === 'text'
      ? { start: active.selectionStart, end: active.selectionEnd }
      : null;

  update();

  if (!key) return;
  const restored = document.querySelector(`[data-focus-key="${CSS.escape(key)}"]`);
  if (!(restored instanceof HTMLElement)) return;
  restored.focus({ preventScroll: true });
  if (selection && restored instanceof HTMLInputElement) {
    try {
      restored.setSelectionRange(selection.start, selection.end);
    } catch {
      /* not all input types support selection */
    }
  }
}

let lastSignature = '';

function renderAll({ animate = true } = {}) {
  withFocusRestore(() => {
    app.innerHTML = renderShell();
  });
  lastSignature = visibilitySignature();
  runCounts(animate);
  syncUrl();
}

/** Re-render only the derived regions, leaving every control untouched. */
function renderOutputs() {
  if (visibilitySignature() !== lastSignature) {
    renderAll();
    return;
  }

  const strategy = currentStrategy();
  const evaluation = strategy.evaluate(state.values);

  withFocusRestore(() => {
    for (const node of document.querySelectorAll('[data-region]')) {
      const build = REGIONS[node.dataset.region];
      if (build) node.innerHTML = build(evaluation, node);
    }
  });

  runCounts(true);
  syncUrl();
  persistValues();
}

/** Update only the donut centre while hovering or focusing a bucket. */
function renderDonutCenterOnly() {
  const node = document.querySelector('[data-region="donut-center"]');
  if (!node) return;
  const evaluation = currentStrategy().evaluate(state.values);
  node.innerHTML = renderDonutCenter(evaluation);
  runCounts(false);
  const donut = document.querySelector('.donut');
  if (donut) donut.dataset.preview = state.previewBucket ?? '';
}

function showToast(message) {
  state.toast = message;
  const slot = document.querySelector('.toast-slot');
  if (slot) slot.innerHTML = `<p class="toast">${escapeHtml(message)}</p>`;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    state.toast = null;
    const node = document.querySelector('.toast-slot');
    if (node) node.innerHTML = '';
  }, 2200);
}

/* ------------------------------------------------------------- clipboard -- */

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    // Older browsers, or a page served over plain http.
    const area = document.createElement('textarea');
    area.value = value;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

/**
 * Last resort when the clipboard is unavailable (embedded browsers, plain
 * http, a blocked permission): show the text so it can be copied by hand.
 * <dialog> gives us the focus trap and Escape handling for free.
 */
function showCopyFallback(value) {
  const dialog = document.createElement('dialog');
  dialog.className = 'copy-dialog';
  dialog.innerHTML = `
    <form method="dialog">
      <h2 class="hand">${ui('copyManual')}</h2>
      <p class="muted">${ui('copyManualHint')}</p>
      <textarea readonly rows="12" aria-label="${ui('copyManual')}"></textarea>
      <button type="submit" class="pill-btn pill-btn--primary">${ui('close')}</button>
    </form>`;
  dialog.querySelector('textarea').value = value;
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
  const area = dialog.querySelector('textarea');
  area.focus();
  area.select();
}

/** Copy, and fall back to a manual-copy dialog when that is not allowed. */
function copyOrShow(value, successMessage) {
  copyText(value).then((ok) => {
    showToast(ok ? successMessage : ui('copyFailed'));
    if (!ok) showCopyFallback(value);
  });
}

/** Plain-text scenario summary, disclaimer included. */
function buildSummary() {
  const strategy = currentStrategy();
  const evaluation = strategy.evaluate(state.values);
  const lines = [];

  lines.push(`${localize(UI.appName)} — ${localize(strategy.name)}`);
  lines.push('');
  for (const input of visibleInputs(strategy)) {
    const value = state.values[input.id];
    let printed;
    if (input.kind === 'toggle') printed = value ? localize(UI.yes) : localize(UI.no);
    else if (input.kind === 'choice') {
      printed = localize(input.options.find((option) => option.value === value)?.label ?? value);
    } else if (input.kind === 'currency') printed = money(value);
    else printed = `${number(value, input.step < 1 ? 2 : 0)}${input.suffix ?? ''}`;
    lines.push(`${localize(input.label)}: ${printed}`);
  }

  lines.push('');
  for (const bucket of evaluation.allocations) {
    lines.push(`${localize(bucket.label)}: ${number(bucket.percent, 1)}% = ${money(bucket.amount)}`);
    for (const item of bucket.items) {
      lines.push(`  · ${localize(item.label)}: ${number(item.percent, 0)}% = ${money(item.amount)}`);
    }
  }
  if (evaluation.metrics.maxSingleStock) {
    lines.push(`${localize(UI.maxPerStock)}: ${money(evaluation.metrics.maxSingleStock)}`);
  }

  if (evaluation.flow?.length) {
    lines.push('');
    lines.push(`${localize(UI.waterfall)}:`);
    for (const step of evaluation.flow) {
      const amount = typeof step.amount === 'number' ? ` — ${money(step.amount)}` : '';
      lines.push(`  ${localize(step.label)} [${localize(UI[FLOW_STATUS_LABEL[step.status] ?? 'flowIdle'])}]${amount}`);
    }
    lines.push(`  ${localize(UI.oneWayRule)}`);
  }

  for (const lane of evaluation.decision?.lanes ?? []) {
    lines.push('');
    lines.push(`${localize(lane.title)}:`);
    for (const action of lane.verdict?.actions ?? []) {
      lines.push(`  ${localize(action.title)} — ${localize(action.body)}`);
    }
  }

  for (const gauge of evaluation.gauges ?? []) {
    lines.push('');
    lines.push(`${localize(gauge.label)}: ${number(gauge.value, 1)}${gauge.suffix ?? ''} — ${localize(gauge.status)}`);
  }

  if (evaluation.drift) {
    lines.push('');
    lines.push(`${localize(UI.driftTitle)}:`);
    for (const row of evaluation.drift.rows) {
      lines.push(
        `  ${localize(row.label)}: ${localize(UI.driftTarget)} ${number(row.targetPercent, 1)}% / ${localize(
          UI.driftCurrent,
        )} ${number(row.currentPercent, 1)}% — ${localize(UI[DRIFT_LABEL[row.status]])}`,
      );
    }
  }

  lines.push('');
  lines.push(localize(UI.disclaimer));
  lines.push(scenarioUrl());
  return lines.join('\n');
}

/* ---------------------------------------------------------------- events -- */

/** Live-update a range control's own readout without re-rendering it. */
function updateRangeReadout(input, node, value) {
  const digits = input.step < 1 ? 2 : 0;
  const readout = node.closest('.control')?.querySelector('.control-value');
  if (readout) readout.textContent = `${number(value, digits)}${input.suffix ?? ''}`;
  node.style.setProperty('--range-progress', `${((value - input.min) / (input.max - input.min)) * 100}%`);
}

app.addEventListener('input', (event) => {
  const node = event.target;
  if (!(node instanceof HTMLInputElement) || !node.dataset.field) return;
  const input = currentStrategy().inputs.find((item) => item.id === node.dataset.field);
  if (!input) return;

  if (input.kind === 'currency') {
    // Parse digits only, so the caret never jumps while typing. The model
    // clamps out-of-range numbers; the field is reformatted on blur.
    const parsed = Number(node.value.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(parsed)) return;
    state.values[input.id] = parsed;
    const hint = node.closest('.control')?.querySelector('.control-range');
    const outOfRange = parsed < input.min || parsed > input.max;
    if (hint) hint.classList.toggle('is-warning', outOfRange);
    renderOutputs();
    return;
  }

  const parsed = Number(node.value);
  if (!Number.isFinite(parsed)) return;
  state.values[input.id] = parsed;
  updateRangeReadout(input, node, parsed);
  renderOutputs();
});

app.addEventListener('change', (event) => {
  const node = event.target;

  if (node instanceof HTMLInputElement && node.dataset.field) {
    const input = currentStrategy().inputs.find((item) => item.id === node.dataset.field);
    if (!input) return;
    const clamped = clampInput(input, String(node.value).replace(/[^0-9.\-]/g, ''));
    if (clamped === null) return;
    state.values[input.id] = clamped;
    if (input.kind === 'currency') {
      node.value = number(clamped, 0);
      node.closest('.control')?.querySelector('.control-range')?.classList.remove('is-warning');
    } else {
      updateRangeReadout(input, node, clamped);
    }
    renderOutputs();
    return;
  }

  if (node instanceof HTMLInputElement && node.dataset.action === 'remember') {
    state.remember = node.checked;
    writeStorage(STORAGE.remember, String(state.remember));
    persistValues();
    return;
  }

  if (node instanceof HTMLSelectElement && node.dataset.action === 'strategy') {
    const strategy = getStrategy(node.value);
    state.strategyId = strategy.id;
    state.values = defaultsFor(strategy);
    state.focusBucket = null;
    writeStorage(STORAGE.strategy, strategy.id);
    loadRememberedValues();
    shownCounts.clear();
    renderAll({ animate: false });
  }
});

app.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target.closest('button, [data-bucket]') : null;
  if (!(target instanceof HTMLElement)) return;

  if (target.dataset.locale) {
    state.locale = target.dataset.locale === 'zh' ? 'zh' : 'en';
    writeStorage(STORAGE.locale, state.locale);
    shownCounts.clear(); // number formatting changes with the locale
    renderAll({ animate: false });
    return;
  }

  if (target.dataset.theme) {
    state.theme = target.dataset.theme === 'dark' ? 'dark' : 'light';
    writeStorage(STORAGE.theme, state.theme);
    renderAll({ animate: false });
    return;
  }

  if (target.dataset.toggle) {
    state.values[target.dataset.toggle] = target.dataset.toggleValue === 'true';
    renderAll();
    persistValues();
    return;
  }

  if (target.dataset.choice) {
    state.values[target.dataset.choice] = target.dataset.choiceValue;
    renderAll();
    persistValues();
    return;
  }

  if (target.dataset.preset) {
    const preset = currentStrategy().presets?.[target.dataset.preset];
    if (!preset) return;
    state.values = { ...state.values, ...preset };
    state.focusBucket = null;
    persistValues();
    renderAll();
    showToast(ui('presetLoaded'));
    return;
  }

  if (target.dataset.bucket) {
    state.focusBucket = state.focusBucket === target.dataset.bucket ? null : target.dataset.bucket;
    renderOutputs();
    return;
  }

  const action = target.dataset.action;
  if (action === 'clear-focus') {
    state.focusBucket = null;
    renderOutputs();
    return;
  }

  if (action === 'reset') {
    state.values = defaultsFor(currentStrategy());
    state.focusBucket = null;
    persistValues();
    renderAll();
    return;
  }

  if (action === 'share') {
    copyOrShow(scenarioUrl(), ui('linkCopied'));
    return;
  }

  if (action === 'copy') {
    copyOrShow(buildSummary(), ui('summaryCopied'));
  }
});

/* Hovering or focusing a bucket previews it in the donut centre. Clicking is
 * always available too, so nothing here is hover-only. */
function previewFrom(node) {
  const holder = node instanceof Element ? node.closest('[data-bucket]') : null;
  return holder instanceof HTMLElement ? holder.dataset.bucket ?? null : null;
}

app.addEventListener('pointerover', (event) => {
  const bucket = previewFrom(event.target);
  if (bucket === state.previewBucket) return;
  state.previewBucket = bucket;
  renderDonutCenterOnly();
});

app.addEventListener('pointerleave', () => {
  if (state.previewBucket === null) return;
  state.previewBucket = null;
  renderDonutCenterOnly();
});

app.addEventListener('focusin', (event) => {
  const bucket = previewFrom(event.target);
  if (bucket === state.previewBucket) return;
  state.previewBucket = bucket;
  renderDonutCenterOnly();
});

app.addEventListener('focusout', (event) => {
  if (!previewFrom(event.target)) return;
  state.previewBucket = null;
  renderDonutCenterOnly();
});

window.addEventListener('hashchange', () => {
  if (!applyHash()) return;
  state.focusBucket = null;
  shownCounts.clear();
  renderAll({ animate: false });
});

reduceMotion?.addEventListener?.('change', () => renderAll({ animate: false }));

// The waterfall picks its own column count, so it has to be redrawn when the
// viewport crosses a breakpoint.
for (const entry of FLOW_BREAKPOINTS) {
  entry.query.addEventListener?.('change', () => {
    const node = document.querySelector('[data-region="flow"]');
    if (node) node.innerHTML = renderFlow(currentStrategy().evaluate(state.values));
  });
}

/* ------------------------------------------------------------------- boot -- */

state.values = defaultsFor(currentStrategy());
loadRememberedValues();
applyHash();
renderAll({ animate: false });
