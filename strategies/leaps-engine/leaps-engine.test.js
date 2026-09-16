import test from 'node:test';
import assert from 'node:assert/strict';

import { leapsEngineStrategy as strategy } from './index.js';

const evaluate = (values = {}) => strategy.evaluate(values);
const lane = (result, id) => result.decision.lanes.find((item) => item.id === id);
const status = (result, laneId, ruleId) => lane(result, laneId).rules.find((rule) => rule.id === ruleId).status;

test('the setup splits the account 60 / 40', () => {
  const result = evaluate({ portfolioValue: 100000 });
  const [leaps, cash] = result.allocations;
  assert.equal(leaps.percent, 60);
  assert.equal(leaps.amount, 60000);
  assert.equal(cash.percent, 40);
  assert.equal(cash.amount, 40000);
  assert.equal(cash.rule.amount, 10000, 'the 10% floor is shown in dollars');
});

test('entry: open only when QQQ is down at least 1% (inclusive, per the document)', () => {
  assert.equal(evaluate({ hasPosition: false, qqqMove: -1 }).metrics.entrySignal, true);
  assert.equal(evaluate({ hasPosition: false, qqqMove: -0.9 }).metrics.entrySignal, false);
  assert.equal(evaluate({ hasPosition: false, qqqMove: 1.5 }).metrics.entrySignal, false);

  const waiting = evaluate({ hasPosition: false, qqqMove: 0.4 });
  assert.deepEqual(waiting.decision.lanes.map((item) => item.id), ['entry']);
  assert.equal(status(waiting, 'entry', 'wait'), 'active');
});

test('harvest needs delta strictly above 0.9 (the HTML used ≥)', () => {
  assert.equal(evaluate({ delta: 0.9 }).metrics.harvest, false);
  assert.equal(evaluate({ delta: 0.91 }).metrics.harvest, true);
  assert.equal(status(evaluate({ delta: 0.95 }), 'manage', 'harvest'), 'active');
});

test('renewal needs DTE strictly below 300', () => {
  assert.equal(evaluate({ dte: 300 }).metrics.renew, false);
  assert.equal(evaluate({ dte: 290 }).metrics.renew, true);
});

test('dip buy sizes by cash: 10% above 40% cash, otherwise 5%', () => {
  const heavy = evaluate({ delta: 0.45, cashPercent: 45 });
  assert.equal(heavy.metrics.dipActive, true);
  assert.equal(heavy.metrics.dipAddPercent, 10);
  assert.equal(heavy.metrics.dipAddAmount, 10000);
  assert.equal(heavy.metrics.cashAfterAddPercent, 35);

  const normal = evaluate({ delta: 0.45, cashPercent: 30 });
  assert.equal(normal.metrics.dipAddPercent, 5);

  // Exactly 40% is not "more than 40%".
  assert.equal(evaluate({ delta: 0.45, cashPercent: 40 }).metrics.dipAddPercent, 5);
});

test('dip buy is blocked when it would take cash to 10% or below (the HTML recommended it anyway)', () => {
  const result = evaluate({ delta: 0.45, cashPercent: 12 });
  assert.equal(result.metrics.dipTriggered, true);
  assert.equal(result.metrics.floorBreached, true);
  assert.equal(status(result, 'manage', 'dip'), 'blocked');
  assert.equal(status(result, 'manage', 'hold'), 'active');
  assert.match(lane(result, 'manage').rules.find((rule) => rule.id === 'dip').note.en, /10% floor/);

  // 15% cash − 5% add = 10%: still not *above* the floor.
  assert.equal(evaluate({ delta: 0.45, cashPercent: 15 }).metrics.dipBlocked, true);
  assert.equal(evaluate({ delta: 0.45, cashPercent: 16 }).metrics.dipBlocked, false);
});

test('dip buy is blocked inside the 30-day cooldown', () => {
  const cooling = evaluate({ delta: 0.45, cashPercent: 45, daysSinceLastAdd: 10 });
  assert.equal(cooling.metrics.dipBlocked, true);
  assert.match(lane(cooling, 'manage').rules.find((rule) => rule.id === 'dip').note.en, /wait 20 more/);
  assert.equal(evaluate({ delta: 0.45, cashPercent: 45, daysSinceLastAdd: 30 }).metrics.dipBlocked, false);
});

test('several rules can apply at once (the HTML showed only one)', () => {
  const result = evaluate({ delta: 0.45, dte: 250, cashPercent: 45 });
  assert.equal(status(result, 'manage', 'renew'), 'active');
  assert.equal(status(result, 'manage', 'dip'), 'active');
  assert.equal(status(result, 'manage', 'hold'), 'idle');
  assert.equal(lane(result, 'manage').verdict.actions.length, 2);
});

test('a harvest roll covers a renewal on the same position', () => {
  const result = evaluate({ delta: 0.95, dte: 250 });
  assert.equal(status(result, 'manage', 'harvest'), 'active');
  assert.equal(status(result, 'manage', 'renew'), 'covered');
  assert.equal(lane(result, 'manage').verdict.actions.length, 1);
});

test('the cash gauge states its condition in words', () => {
  assert.equal(evaluate({ cashPercent: 8 }).gauges[0].tone, 'critical');
  assert.equal(evaluate({ cashPercent: 14 }).gauges[0].tone, 'warning');
  assert.equal(evaluate({ cashPercent: 45 }).gauges[0].tone, 'ok');
  assert.match(evaluate({ cashPercent: 45 }).gauges[0].status.en, /Heavy mode/);
  assert.deepEqual(evaluate({ hasPosition: false }).gauges, [], 'no gauge before the position exists');
});

test('every preset lights the rule that names it', () => {
  for (const [name, preset] of Object.entries(strategy.presets)) {
    const result = evaluate(preset);
    const rule = result.decision.lanes.flatMap((item) => item.rules).find((item) => item.preset === name);
    assert.ok(rule, `no rule uses preset "${name}"`);
    assert.equal(rule.status, 'active', `preset "${name}" should activate its rule`);
  }
});

test('thresholds are config: flipping an operator or a size changes the decision', () => {
  const inclusive = strategy.withConfig({
    rules: { harvest: { delta: { op: '>=', value: 0.9 } }, dip: { heavyAddPercent: 15 } },
  });
  assert.equal(inclusive.evaluate({ delta: 0.9 }).metrics.harvest, true);
  assert.equal(inclusive.evaluate({ delta: 0.45, cashPercent: 50 }).metrics.dipAddPercent, 15);

  const bigger = strategy.withConfig({ rules: { allocation: { leapsPercent: 70, cashPercent: 30 } } });
  assert.equal(bigger.evaluate({ portfolioValue: 100000 }).allocations[0].amount, 70000);
});
