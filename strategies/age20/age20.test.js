import test from 'node:test';
import assert from 'node:assert/strict';

import { age20Strategy } from './index.js';

const evaluate = (overrides = {}) => age20Strategy.evaluate({ ...age20Strategy.defaults, ...overrides });

test('the reference scenario ($400k, age 38, stable income) matches the framework', () => {
  const result = evaluate();
  const [core, options, cash] = result.allocations;

  assert.equal(core.percent, 58);
  assert.equal(core.amount, 232000);
  assert.equal(options.percent, 37);
  assert.equal(options.amount, 148000);
  assert.equal(cash.percent, 5);
  assert.equal(cash.amount, 20000);

  assert.equal(core.items[0].amount, 69600); // QQQM 30%
  assert.equal(core.items[1].amount, 69600); // VOO 30%
  assert.equal(core.items[2].amount, 92800); // individual stocks 40%
  assert.equal(result.metrics.maxSingleStock, 23200);

  assert.equal(options.items[0].amount, 118400); // wheel 80%
  assert.equal(options.items[1].amount, 29600); // LEAPS 20%
});

test('allocations always total 100% and core never exceeds 70%', () => {
  for (const age of [18, 38, 49, 50, 51, 65, 80]) {
    for (const stableIncome of [true, false]) {
      const result = evaluate({ age, stableIncome });
      const total = result.allocations.reduce((sum, bucket) => sum + bucket.percent, 0);
      assert.equal(total, 100);
      assert.ok(result.metrics.corePercent <= 70, `core ${result.metrics.corePercent}% at age ${age}`);
      assert.equal(result.metrics.cashPercent, stableIncome ? 5 : 10);
    }
  }
});

test('the single-stock cap is 10% of core, not 10% of the portfolio', () => {
  const result = evaluate();
  assert.equal(result.metrics.maxSingleStock, result.metrics.coreAmount * 0.1);
  assert.notEqual(result.metrics.maxSingleStock, result.metrics.total * 0.1);
});

test('sub-allocations always add back up to their bucket', () => {
  for (const age of [22, 38, 70]) {
    for (const bucket of evaluate({ age }).allocations) {
      if (bucket.items.length === 0) continue;
      const sum = bucket.items.reduce((total, item) => total + item.amount, 0);
      assert.ok(Math.abs(sum - bucket.amount) < 1e-9, `${bucket.id} items sum to ${sum}, expected ${bucket.amount}`);
    }
  }
});

test('the LEAPS path switches on at exactly RSI < 35', () => {
  assert.equal(evaluate({ rsi: 36 }).metrics.oversold, false);
  assert.equal(evaluate({ rsi: 35 }).metrics.oversold, false);
  assert.equal(evaluate({ rsi: 34.9 }).metrics.oversold, true);

  assert.equal(evaluate({ rsi: 35 }).metrics.leapsProceeds, 0);
  assert.ok(evaluate({ rsi: 34 }).metrics.leapsProceeds > 0);
});

test('a 0% LEAPS outcome returns the premium, −100% loses all of it', () => {
  const breakEven = evaluate({ rsi: 30, leapsReturn: 0 });
  assert.equal(breakEven.metrics.leapsProceeds, breakEven.metrics.premiumAmount);
  assert.equal(evaluate({ rsi: 30, leapsReturn: -100 }).metrics.leapsProceeds, 0);
});

test('the premium scenario accepts a rate or a dollar amount', () => {
  assert.equal(evaluate({ premiumRate: 2 }).metrics.premiumAmount, 118400 * 0.02);
  assert.equal(evaluate({ premiumMode: 'dollar', premiumDollar: 5000 }).metrics.premiumAmount, 5000);
});

test('proceeds fill the cash shortfall before anything reaches core', () => {
  const result = evaluate({ rsi: 30, currentCashPercent: 4.5, premiumRate: 10, leapsReturn: 100 });

  assert.equal(result.metrics.cashShortfall, 2000);
  assert.equal(result.metrics.cashRefill, 2000);
  assert.equal(result.metrics.coreSpillover, result.metrics.leapsProceeds - 2000);

  // With cash already funded there is no refill leg at all.
  const funded = evaluate({ rsi: 30, currentCashPercent: 8, premiumRate: 10, leapsReturn: 100 });
  assert.equal(funded.metrics.cashRefill, 0);
  assert.equal(funded.metrics.coreSpillover, funded.metrics.leapsProceeds);
});

test('core spillover keeps the 30 / 30 / 40 mix and lifts the concentration cap', () => {
  const result = evaluate({ rsi: 30, currentCashPercent: 5, premiumRate: 10, leapsReturn: 100 });
  const spillover = result.metrics.coreSpillover;
  const step = result.flow.find((item) => item.id === 'core');

  assert.ok(spillover > 0);
  assert.deepEqual(
    step.breakdown.map((row) => row.amount),
    [spillover * 0.3, spillover * 0.3, spillover * 0.4],
  );
  assert.equal(result.metrics.maxSingleStockAfter, (result.metrics.coreAmount + spillover) * 0.1);
});

test('options profits never enlarge the options pool', () => {
  const quiet = evaluate({ rsi: 60 });
  const realised = evaluate({ rsi: 20, premiumRate: 10, leapsReturn: 300 });

  assert.ok(realised.metrics.leapsProceeds > 0);
  assert.equal(realised.metrics.optionsAmount, quiet.metrics.optionsAmount);
  assert.equal(realised.allocations[1].percent, quiet.allocations[1].percent);

  // No flow step after the LEAPS scenario routes money back into options.
  const destinations = realised.flow.slice(4).map((step) => step.bucket);
  assert.ok(!destinations.includes('options'));
});

test('margin tone changes at exactly 20% and 25%', () => {
  assert.equal(evaluate({ marginUsage: 19 }).metrics.marginTone, 'ok');
  assert.equal(evaluate({ marginUsage: 20 }).metrics.marginTone, 'warning');
  assert.equal(evaluate({ marginUsage: 24 }).metrics.marginTone, 'warning');
  assert.equal(evaluate({ marginUsage: 25 }).metrics.marginTone, 'critical');
  assert.equal(evaluate({ marginUsage: 40 }).metrics.marginTone, 'critical');
});

test('drift compares current weights with the targets', () => {
  const result = evaluate({ currentCorePercent: 50, currentOptionsPercent: 45, currentCashPercent: 5 });
  const [core, options, cash] = result.drift.rows;

  assert.equal(core.status, 'under'); // 50% against a 58% target
  assert.equal(options.status, 'over'); // 45% against a 37% target
  assert.equal(cash.status, 'on'); // 5% against a 5% target
  assert.equal(core.deltaAmount, -8 * 4000);
  assert.equal(result.drift.sumPercent, 100);

  // Inside the tolerance band both directions read as "on target".
  const near = evaluate({ currentCorePercent: 58.5, currentOptionsPercent: 36.5, currentCashPercent: 5 });
  assert.equal(near.drift.rows[0].status, 'on');
  assert.equal(near.drift.rows[1].status, 'on');
});

test('inputs are clamped, so a hand-edited link can never break the model', () => {
  const result = evaluate({ portfolioValue: 99, age: 200, rsi: -40, marginUsage: 900 });
  assert.equal(result.metrics.total, 10000);
  assert.equal(result.metrics.corePercent, 70);
  assert.equal(result.metrics.rsi, 0);
  assert.equal(result.metrics.marginUsage, 40);
});

test('the drawer exposes a formula for every headline number', () => {
  const result = evaluate();
  const labels = result.formulas.map((row) => row.label.en);
  for (const expected of ['Core %', 'Cash %', 'Options %', 'Max per stock', 'Core spillover']) {
    assert.ok(labels.includes(expected), `missing formula row: ${expected}`);
  }
  assert.ok(result.notes[0].items.length >= 4);
});

test('the waterfall and margin state are also spelled out in words', () => {
  assert.match(evaluate({ rsi: 50 }).flowSummary.en, /builds up in the reserve/);
  assert.match(evaluate({ rsi: 30 }).flowSummary.en, /refill cash first/);
  assert.match(evaluate({ rsi: 30, leapsReturn: -100 }).flowSummary.en, /returns nothing/);
  assert.match(evaluate({ premiumRate: 0 }).flowSummary.en, /nothing flows/);

  assert.match(evaluate({ marginUsage: 19 }).metrics.marginStatus.en, /Below the 20%/);
  assert.match(evaluate({ marginUsage: 20 }).metrics.marginStatus.en, /warning range/);
  assert.match(evaluate({ marginUsage: 25 }).metrics.marginStatus.en, /red line/);
});

test('the core card carries its own concentration rule', () => {
  const result = evaluate();
  const core = result.allocations.find((bucket) => bucket.id === 'core');
  assert.equal(core.rule.amount, result.metrics.maxSingleStock);
});

test('changing a rule in config changes the model — no number is hard-coded', () => {
  const variant = age20Strategy.withConfig({
    rules: {
      core: { ageOffset: 10, capPercent: 60 },
      cash: { stableIncomePercent: 8 },
      waterfall: { oversold: { op: '<=', value: 30 } },
      margin: { redLine: { op: '>=', value: 30 } },
    },
  });
  const result = variant.evaluate({ age: 38 });
  assert.equal(result.metrics.corePercent, 48); // 38 + 10
  assert.equal(result.metrics.cashPercent, 8);
  assert.equal(variant.evaluate({ age: 70 }).metrics.corePercent, 60);
  assert.equal(variant.evaluate({ rsi: 30 }).metrics.oversold, true); // now inclusive
  assert.equal(variant.evaluate({ marginUsage: 27 }).metrics.marginTone, 'warning');
  assert.equal(result.gauges[0].marks[1].at, 30);

  // The original is untouched.
  assert.equal(age20Strategy.evaluate({ age: 38 }).metrics.corePercent, 58);
});
