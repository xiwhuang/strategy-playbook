import test from 'node:test';
import assert from 'node:assert/strict';

import { mergeConfig } from './kit.js';
import { STRATEGIES, getStrategy, validateStrategy } from './registry.js';

/**
 * These run against every registered strategy, so a newly added one fails
 * here instead of rendering a half-empty page.
 */

test('the registry is not empty and ids are unique', () => {
  assert.ok(STRATEGIES.length > 0);
  const ids = STRATEGIES.map((strategy) => strategy.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('every strategy satisfies the descriptor contract, for its defaults and every preset', () => {
  for (const strategy of STRATEGIES) {
    const problems = validateStrategy(strategy);
    assert.deepEqual(problems, [], `${strategy.id}:\n  ${problems.join('\n  ')}`);
  }
});

test('every strategy decides from config: a patched config is a working strategy', () => {
  for (const strategy of STRATEGIES) {
    const variant = strategy.withConfig({ id: `${strategy.id}-variant` });
    assert.equal(variant.id, `${strategy.id}-variant`);
    assert.deepEqual(variant.config.rules, strategy.config.rules);
    assert.deepEqual(validateStrategy(variant), []);
  }
});

test('conditional inputs stay resolvable with the default values', () => {
  for (const strategy of STRATEGIES) {
    for (const input of strategy.inputs) {
      if (!input.visibleWhen) continue;
      assert.equal(typeof input.visibleWhen(strategy.defaults), 'boolean', `${strategy.id}.${input.id}`);
    }
  }
});

test('getStrategy falls back to the first strategy for unknown ids', () => {
  assert.equal(getStrategy('does-not-exist').id, STRATEGIES[0].id);
  for (const strategy of STRATEGIES) assert.equal(getStrategy(strategy.id).id, strategy.id);
});

test('mergeConfig merges objects deeply and replaces arrays whole', () => {
  const base = { a: { b: 1, c: 2 }, list: [1, 2, 3] };
  assert.deepEqual(mergeConfig(base, { a: { c: 9 }, list: [7] }), { a: { b: 1, c: 9 }, list: [7] });
  assert.deepEqual(base, { a: { b: 1, c: 2 }, list: [1, 2, 3] }, 'the base config is not mutated');
});
