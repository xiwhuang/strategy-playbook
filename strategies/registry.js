import { age20Strategy } from './age20/index.js';
import { goldenRatioStrategy } from './golden-ratio/index.js';
import { leapsEngineStrategy } from './leaps-engine/index.js';

/**
 * Every strategy the site offers, in picker order. Adding one is:
 *   1. a folder with config.js + model.js + index.js (copy the template),
 *   2. one import and one entry here.
 * The page renders it from its descriptor; `npm test` checks the contract.
 */
export const STRATEGIES = [age20Strategy, leapsEngineStrategy, goldenRatioStrategy];

/** Look a strategy up by id, falling back to the first one. */
export function getStrategy(id) {
  return STRATEGIES.find((strategy) => strategy.id === id) ?? STRATEGIES[0];
}

/* ------------------------------------------------------ contract checks -- */

const OUTPUT_SECTIONS = new Set(['allocations', 'flow', 'decision', 'risk', 'formulas']);
const RULE_STATUSES = new Set(['active', 'blocked', 'waiting', 'covered', 'idle']);
const INPUT_KINDS = new Set(['currency', 'range', 'toggle', 'choice']);

/** Copy may be a bilingual string or a function of the strategy's rules. */
const resolve = (value, rules) => (typeof value === 'function' ? value(rules) : value);

const isBilingual = (value) => Boolean(value) && typeof value.en === 'string' && typeof value.zh === 'string';

/** Structural checks on one evaluation result. */
function checkEvaluation(result, label, strategy) {
  const problems = [];

  if (!Array.isArray(result.allocations) || result.allocations.length === 0) {
    problems.push(`${label}: evaluate() must return allocations`);
  } else {
    const totalPercent = result.allocations.reduce((sum, bucket) => sum + bucket.percent, 0);
    if (Math.abs(totalPercent - 100) > 1e-9) {
      problems.push(`${label}: allocations total ${totalPercent}%, expected 100%`);
    }
    for (const bucket of result.allocations) {
      if (!isBilingual(bucket.label)) problems.push(`${label}: bucket "${bucket.id}" needs a bilingual label`);
      const items = bucket.items ?? [];
      if (items.length === 0) continue;
      const itemTotal = items.reduce((sum, item) => sum + item.amount, 0);
      if (Math.abs(itemTotal - bucket.amount) > 1e-6) {
        problems.push(`${label}: "${bucket.id}" items total ${itemTotal}, expected ${bucket.amount}`);
      }
    }
  }

  for (const lane of result.decision?.lanes ?? []) {
    if (!isBilingual(lane.title)) problems.push(`${label}: lane "${lane.id}" needs a bilingual title`);
    if (!lane.rules?.length) problems.push(`${label}: lane "${lane.id}" has no rules`);
    if (!lane.verdict?.actions?.length) problems.push(`${label}: lane "${lane.id}" has no verdict`);
    const lit = (lane.rules ?? []).filter((rule) => rule.status !== 'idle');
    if (lit.length === 0) problems.push(`${label}: lane "${lane.id}" lights no rule — the reader sees no state`);
    for (const rule of lane.rules ?? []) {
      if (!RULE_STATUSES.has(rule.status)) problems.push(`${label}: rule "${rule.id}" has status "${rule.status}"`);
      if (rule.preset && !strategy.presets?.[rule.preset]) {
        problems.push(`${label}: rule "${rule.id}" points at missing preset "${rule.preset}"`);
      }
    }
  }

  for (const gauge of result.gauges ?? []) {
    if (!(gauge.max > (gauge.min ?? 0))) problems.push(`${label}: gauge "${gauge.id}" needs max > min`);
    if (!isBilingual(gauge.status)) problems.push(`${label}: gauge "${gauge.id}" must state its status in words`);
  }

  return problems;
}

/**
 * Contract check used by the test suite. Returns human-readable problems so a
 * newly added strategy fails loudly instead of rendering a half-empty page.
 */
export function validateStrategy(strategy) {
  const problems = [];
  const rules = strategy.config?.rules;

  if (!strategy.id) problems.push('missing id');
  if (!rules || typeof rules !== 'object') problems.push('config.rules is missing — decisions must come from config');
  for (const field of ['name', 'shortName', 'description']) {
    if (!isBilingual(resolve(strategy[field], rules))) problems.push(`${field} must be a bilingual { en, zh } string`);
  }

  if (!Array.isArray(strategy.inputs) || strategy.inputs.length === 0) {
    problems.push('needs at least one input');
    return problems;
  }

  const inputIds = new Set(strategy.inputs.map((input) => input.id));
  const groupIds = new Set((strategy.groups ?? []).map((group) => group.id));

  for (const group of strategy.groups ?? []) {
    if (!isBilingual(resolve(group.title, rules))) problems.push(`group "${group.id}" needs a bilingual title`);
  }

  for (const input of strategy.inputs) {
    if (!INPUT_KINDS.has(input.kind)) problems.push(`input "${input.id}" has unknown kind "${input.kind}"`);
    if (!isBilingual(resolve(input.label, rules))) problems.push(`input "${input.id}" label must be bilingual`);
    if (input.helper && !isBilingual(resolve(input.helper, rules))) problems.push(`input "${input.id}" helper must be bilingual`);
    if (!(input.id in (strategy.defaults ?? {}))) problems.push(`input "${input.id}" has no default value`);
    if (groupIds.size > 0 && !groupIds.has(input.group)) {
      problems.push(`input "${input.id}" references unknown group "${input.group}"`);
    }
    if ((input.kind === 'range' || input.kind === 'currency') && !(input.min < input.max)) {
      problems.push(`input "${input.id}" needs min < max`);
    }
    if (input.kind === 'choice' && !Array.isArray(input.options)) {
      problems.push(`input "${input.id}" needs an options array`);
    }
  }

  for (const [name, preset] of Object.entries(strategy.presets ?? {})) {
    for (const key of Object.keys(preset)) {
      if (!inputIds.has(key)) problems.push(`preset "${name}" sets unknown input "${key}"`);
    }
  }

  if (typeof strategy.evaluate !== 'function') {
    problems.push('missing evaluate(values)');
    return problems;
  }

  const baseline = strategy.evaluate(strategy.defaults);
  problems.push(...checkEvaluation(baseline, 'defaults', strategy));
  for (const [name, preset] of Object.entries(strategy.presets ?? {})) {
    problems.push(...checkEvaluation(strategy.evaluate(preset), `preset "${name}"`, strategy));
  }

  for (const token of strategy.layout ?? []) {
    const [section, target] = token.split(':');
    if (section === 'group') {
      if (!groupIds.has(target)) problems.push(`layout names unknown group "${target}"`);
    } else if (!OUTPUT_SECTIONS.has(section)) {
      problems.push(`layout names unknown section "${token}"`);
    } else if (section === 'decision' && target) {
      const laneIds = new Set((baseline.decision?.lanes ?? []).map((lane) => lane.id));
      if (!laneIds.has(target)) problems.push(`layout names unknown decision lane "${target}"`);
    }
  }

  return problems;
}
