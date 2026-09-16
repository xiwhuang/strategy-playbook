import test from 'node:test';
import assert from 'node:assert/strict';

import { goldenRatioStrategy as strategy } from './index.js';

const evaluate = (values = {}) => strategy.evaluate(values);
const lane = (result, id) => result.decision.lanes.find((item) => item.id === id);
const lit = (result, laneId) =>
  lane(result, laneId)
    .rules.filter((rule) => rule.status !== 'idle')
    .map((rule) => `${rule.id}:${rule.status}`);

test('the golden ratio is 70 / 25 / 5, and five 5% slots fill the options bucket exactly', () => {
  const result = evaluate({ portfolioValue: 200000 });
  assert.deepEqual(result.allocations.map((bucket) => bucket.percent), [70, 25, 5]);
  assert.equal(result.metrics.slotAmount, 10000, 'the document: a $200k account puts $10k in each trade');

  const { perTradePercent, maxPositions } = strategy.config.rules.sizing;
  assert.equal(perTradePercent * maxPositions, strategy.config.rules.allocation.optionsPercent);
});

test('core can be QQQ alone or a 50 / 50 QQQ + VOO split', () => {
  const single = evaluate({ portfolioValue: 200000, coreMix: 'qqq' }).allocations[0].items;
  assert.deepEqual(single.map((item) => [item.id, item.amount]), [['qqq', 140000]]);

  const split = evaluate({ portfolioValue: 200000, coreMix: 'split' }).allocations[0].items;
  assert.deepEqual(split.map((item) => [item.id, item.amount]), [['qqq', 70000], ['voo', 70000]]);
});

test('entry needs a drop of MORE than 1% (strict, unlike the LEAPS Engine; the HTML used ≥)', () => {
  assert.equal(evaluate({ qqqMove: -1 }).metrics.signal, false);
  assert.equal(evaluate({ qqqMove: -1.1 }).metrics.signal, true);
});

test('a signal buys while a slot is free, and rotates the oldest when all five are open', () => {
  assert.deepEqual(lit(evaluate({ qqqMove: 0.2, openPositions: 2 }), 'entry'), ['no-signal:active']);
  assert.deepEqual(lit(evaluate({ qqqMove: -1.5, openPositions: 4 }), 'entry'), ['buy:active']);
  assert.deepEqual(lit(evaluate({ qqqMove: -1.5, openPositions: 5 }), 'entry'), ['rotate:active']);
  assert.deepEqual(lit(evaluate({ qqqMove: -1.5, openPositions: 0 }), 'entry'), ['buy:active']);
});

test('the options card shows how many slots are open and how much is deployed', () => {
  const slots = evaluate({ portfolioValue: 200000, openPositions: 3 }).allocations[1].items[0];
  assert.equal(slots.segments, 5);
  assert.equal(slots.segmentsFilled, 3);
  assert.match(slots.note.en, /\$30,000 deployed, \$20,000 waiting/);
});

test('the exit ladder steps down with time: +50% → +30% → +10%', () => {
  assert.deepEqual(lit(evaluate({ monthsHeld: 4, pnlPercent: 50 }), 'exit'), ['tier-1:active']);
  assert.deepEqual(lit(evaluate({ monthsHeld: 4, pnlPercent: 45 }), 'exit'), ['tier-1:waiting']);
  assert.deepEqual(lit(evaluate({ monthsHeld: 4.5, pnlPercent: 30 }), 'exit'), ['tier-2:active']);
  assert.deepEqual(lit(evaluate({ monthsHeld: 9, pnlPercent: 10 }), 'exit'), ['tier-3:active']);
  assert.deepEqual(lit(evaluate({ monthsHeld: 8, pnlPercent: 5 }), 'exit'), ['tier-3:waiting']);
});

test('the document leaves months 6–7 undefined; the config assigns them to the +10% tier', () => {
  const result = evaluate({ monthsHeld: 6.5, pnlPercent: 12 });
  assert.equal(result.metrics.targetPercent, 10);
  assert.equal(result.metrics.exitAction, 'sell');
});

test('past nine months the hard stop applies regardless of P&L', () => {
  for (const pnlPercent of [-80, 0, 150]) {
    const result = evaluate({ monthsHeld: 9.5, pnlPercent });
    assert.deepEqual(lit(result, 'exit'), ['hard-stop:active']);
    assert.equal(result.metrics.exitAction, 'stop');
  }
});

test('entry and exit are decided separately, so both can act on the same day', () => {
  const result = evaluate({ qqqMove: -2, openPositions: 5, monthsHeld: 3, pnlPercent: 60 });
  assert.equal(result.metrics.entryAction, 'rotate');
  assert.equal(result.metrics.exitAction, 'sell');
});

test('with no contracts open, the ladder has nothing to act on', () => {
  const result = evaluate({ openPositions: 0, monthsHeld: 10 });
  assert.equal(result.metrics.exitAction, 'none');
  assert.deepEqual(lit(result, 'exit'), []);
  assert.match(lane(result, 'exit').verdict.actions[0].title.en, /Nothing to exit/);
});

test('every preset lights the rule that names it', () => {
  for (const [name, preset] of Object.entries(strategy.presets)) {
    const result = evaluate(preset);
    const rule = result.decision.lanes.flatMap((item) => item.rules).find((item) => item.preset === name);
    assert.ok(rule, `no rule uses preset "${name}"`);
    assert.equal(rule.status, 'active', `preset "${name}" should activate its rule`);
  }
});

test('the ladder, sizing and stop are config', () => {
  const variant = strategy.withConfig({
    rules: {
      exitLadder: [
        { id: 'tier-1', upToMonths: 3, targetPercent: 80, label: { en: 'Early', zh: '早期' } },
        { id: 'tier-2', upToMonths: 6, targetPercent: 20, label: { en: 'Late', zh: '后期' } },
      ],
      hardStop: { months: { op: '>', value: 6 } },
      sizing: { perTradePercent: 2.5, maxPositions: 10 },
      entry: { drop: { op: '>=', value: 1 } },
    },
  });
  assert.equal(variant.evaluate({ monthsHeld: 2, pnlPercent: 50 }).metrics.exitAction, 'hold');
  assert.equal(variant.evaluate({ monthsHeld: 4, pnlPercent: 25 }).metrics.exitAction, 'sell');
  assert.equal(variant.evaluate({ monthsHeld: 6.5 }).metrics.exitAction, 'stop');
  assert.equal(variant.evaluate({ qqqMove: -1 }).metrics.signal, true);
  assert.equal(variant.evaluate({ portfolioValue: 200000 }).metrics.slotAmount, 5000);
});
