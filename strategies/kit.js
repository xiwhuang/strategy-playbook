/**
 * Shared helpers for strategy modules.
 *
 * A strategy is two files:
 *   config.js — every number the strategy decides with (allocations,
 *               thresholds, sizes, tiers), plus its inputs, layout and copy.
 *   model.js  — `evaluate(values, config)`, which interprets that config.
 *
 * `defineStrategy` binds the two into the descriptor the page renders. Because
 * the rules live in config, a variant of a strategy is a config patch:
 *   goldenRatioStrategy.withConfig({ id: 'golden-60', rules: { ... } })
 */

/** Build a bilingual string. The shell resolves it with the active locale. */
export const t = (en, zh) => ({ en, zh });

/** Clamp a user-supplied value into the range the strategy accepts. */
export const clamp = (value, min, max) => Math.min(Math.max(Number(value) || 0, min), max);

/** Percentage of a base amount, kept in full precision. */
export const share = (base, percent) => (base * percent) / 100;

/** Round only for comparisons/tests; display rounding happens in the shell. */
export const round = (value, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

/** Whole-dollar amount for model-generated copy ("$30,000"). */
export const usd = (value) => `$${Math.round(Number(value)).toLocaleString('en-US')}`;

/** Format a number for model-generated copy without trailing zeros. */
export const fmt = (value, digits = 2) => String(Number(Number(value).toFixed(digits)));

/** "QQQ is down 1.5% today" / "QQQ is flat today", in both languages. */
export function moveToday(ticker, move) {
  if (Math.abs(move) < 0.05) return t(`${ticker} is flat today`, `${ticker} 今日持平`);
  const size = fmt(Math.abs(move), 1);
  return move > 0
    ? t(`${ticker} is up ${size}% today`, `${ticker} 今日上涨 ${size}%`)
    : t(`${ticker} is down ${size}% today`, `${ticker} 今日下跌 ${size}%`);
}

/* ------------------------------------------------------------ thresholds --
 * A threshold is data: { op: '>' | '>=' | '<' | '<=', value }. Whether a rule
 * is strict or inclusive is a decision the source document makes, so it lives
 * in config next to the number rather than being baked into an `if`.
 */
const OPS = {
  '>': (a, b) => a > b,
  '>=': (a, b) => a >= b,
  '<': (a, b) => a < b,
  '<=': (a, b) => a <= b,
};

const OP_SYMBOL = { '>': '>', '>=': '≥', '<': '<', '<=': '≤' };

/** Does `x` satisfy the configured threshold? */
export function passes(x, threshold) {
  const test = OPS[threshold?.op];
  if (!test) throw new Error(`Unknown threshold operator: ${threshold?.op}`);
  return test(x, threshold.value);
}

/** "Delta > 0.9" — readable form of a threshold, for copy and formulas. */
export function describe(name, threshold, suffix = '') {
  return `${name} ${OP_SYMBOL[threshold.op]} ${fmt(threshold.value)}${suffix}`;
}

/* ---------------------------------------------------------------- config -- */

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;

/** Deep-merge plain objects. Arrays and every other value are replaced whole. */
export function mergeConfig(base, patch) {
  if (patch === undefined) return base;
  if (!isPlainObject(base) || !isPlainObject(patch)) return patch;
  const merged = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    merged[key] = mergeConfig(base[key], value);
  }
  return merged;
}

/**
 * Bind a config to its model. The returned descriptor carries the config's
 * metadata, inputs and layout for the page, and an `evaluate` that always
 * reads its rules from that same config.
 */
export function defineStrategy(config, model) {
  return Object.freeze({
    ...config,
    config,
    evaluate: (values = {}) => model({ ...config.defaults, ...values }, config),
    withConfig: (patch) => defineStrategy(mergeConfig(config, patch), model),
  });
}
