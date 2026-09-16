import { clamp, describe, fmt, moveToday, passes, share, t, usd } from '../kit.js';

/**
 * Golden Ratio model. Every allocation, size, threshold and ladder tier comes
 * from `config.rules`.
 *
 * Two independent decisions are reported separately, because they can happen
 * on the same day and concern different things:
 *   entry — does today open (or rotate) a contract?   (portfolio level)
 *   exit  — where does one open contract sit on the ladder? (position level)
 */

const yesNo = (value) => (value ? t('yes', '是') : t('no', '否'));
const signedPercent = (value) => `${value >= 0 ? '+' : '−'}${fmt(Math.abs(value), 1)}%`;

export function evaluate(values, config) {
  const r = config.rules;
  const U = r.underlying;
  const ladder = r.exitLadder;
  const stopMonths = r.hardStop.months.value;

  /* -- inputs --------------------------------------------------------------- */
  const total = clamp(values.portfolioValue, 10000, 10000000);
  const coreMixId = r.coreMixes[values.coreMix] ? values.coreMix : Object.keys(r.coreMixes)[0];
  const move = clamp(values.qqqMove, -20, 20);
  const openPositions = Math.round(clamp(values.openPositions, 0, r.sizing.maxPositions));
  const monthsHeld = clamp(values.monthsHeld, 0, 120);
  const pnlPercent = clamp(values.pnlPercent, -100, 1000);

  /* -- allocation ----------------------------------------------------------- */
  const coreAmount = share(total, r.allocation.corePercent);
  const optionsAmount = share(total, r.allocation.optionsPercent);
  const cashAmount = share(total, r.allocation.cashPercent);
  const slotAmount = share(total, r.sizing.perTradePercent);
  const deployedAmount = openPositions * slotAmount;
  const waitingAmount = Math.max(0, optionsAmount - deployedAmount);
  const spec = t(
    `~Δ ${fmt(r.contract.delta)} ${U} calls, ~${r.contract.dte} days out`,
    `约 Δ ${fmt(r.contract.delta)}、约 ${r.contract.dte} 天到期的 ${U} 看涨期权`,
  );

  /* -- entry decision ------------------------------------------------------- */
  const drop = -move;
  const signal = passes(drop, r.entry.drop);
  const atLimit = openPositions >= r.sizing.maxPositions;
  const entryAction = !signal ? 'wait' : atLimit ? 'rotate' : 'buy';
  const entryText = describe(`${U} drop`, r.entry.drop, '%');
  const moveText = moveToday(U, move);
  const slotsAfter = entryAction === 'buy' ? openPositions + 1 : openPositions;

  const entryVerdict = {
    wait: {
      tone: 'hold',
      actions: [
        {
          title: t('No new contract today', '今天不开新仓'),
          body: t(`${moveText.en}. A new contract needs ${entryText}.`, `${moveText.zh}。开新仓需要 ${entryText}。`),
        },
      ],
    },
    buy: {
      tone: 'dip',
      actions: [
        {
          title: t('Buy one contract', '买入一张合约'),
          body: t(
            `Buy 1 of ${spec.en}, sized at ${r.sizing.perTradePercent}% of the account.`,
            `买入 1 张${spec.zh}，规模为账户的 ${r.sizing.perTradePercent}%。`,
          ),
          facts: [
            { label: t('Size', '规模'), value: slotAmount, kind: 'money' },
            {
              label: t('Slots after', '之后持仓'),
              value: t(`${slotsAfter} of ${r.sizing.maxPositions}`, `${slotsAfter} / ${r.sizing.maxPositions}`),
              kind: 'text',
            },
          ],
        },
      ],
    },
    rotate: {
      tone: 'time',
      actions: [
        {
          title: t('Rotate the oldest (FIFO)', '轮换最旧合约（先进先出）'),
          body: t(
            `All ${r.sizing.maxPositions} slots are full. Sell the oldest contract, then buy 1 of ${spec.en}.`,
            `${r.sizing.maxPositions} 个仓位已满。先卖出最旧的合约，再买入 1 张${spec.zh}。`,
          ),
          facts: [
            { label: t('Size', '规模'), value: slotAmount, kind: 'money' },
            {
              label: t('Slots after', '之后持仓'),
              value: t(`${slotsAfter} of ${r.sizing.maxPositions}`, `${slotsAfter} / ${r.sizing.maxPositions}`),
              kind: 'text',
            },
          ],
        },
      ],
    },
  }[entryAction];

  const entryLane = {
    id: 'entry',
    title: t('New contracts', '开新仓'),
    summary: signal
      ? t(`${moveText.en} — the entry signal is on.`, `${moveText.zh}——入场信号已出现。`)
      : t(`${moveText.en} — no entry signal.`, `${moveText.zh}——没有入场信号。`),
    rules: [
      {
        id: 'no-signal',
        title: t('Wait', '等待'),
        when: t(`No ${entryText}`, `未出现 ${entryText}`),
        then: t('No trade', '不交易'),
        status: entryAction === 'wait' ? 'active' : 'idle',
        tone: 'hold',
        preset: 'no-signal',
      },
      {
        id: 'buy',
        title: t('Buy new', '买入新仓'),
        when: t(`${entryText}, a slot is free`, `${entryText}，且有空余仓位`),
        then: t(`Buy 1 contract (${r.sizing.perTradePercent}% of account)`, `买入 1 张（账户的 ${r.sizing.perTradePercent}%）`),
        status: entryAction === 'buy' ? 'active' : 'idle',
        tone: 'dip',
        preset: 'buy',
      },
      {
        id: 'rotate',
        title: t('FIFO rotation', '先进先出轮换'),
        when: t(`${entryText}, ${r.sizing.maxPositions} open`, `${entryText}，已持有 ${r.sizing.maxPositions} 张`),
        then: t('Sell the oldest, buy the new one', '卖出最旧，买入新仓'),
        status: entryAction === 'rotate' ? 'active' : 'idle',
        tone: 'time',
        preset: 'rotate',
      },
    ],
    verdict: entryVerdict,
  };

  /* -- exit decision -------------------------------------------------------- */
  const noContracts = openPositions === 0;
  const hardStop = passes(monthsHeld, r.hardStop.months);
  const tierIndex = hardStop ? -1 : ladder.findIndex((tier) => monthsHeld <= tier.upToMonths);
  // A holding period past the last tier but short of the stop is a config gap;
  // treat it as the stop rather than inventing a target.
  const stopped = hardStop || tierIndex === -1;
  const tier = stopped ? null : ladder[tierIndex];
  const targetHit = tier ? pnlPercent >= tier.targetPercent : false;
  const exitAction = noContracts ? 'none' : stopped ? 'stop' : targetHit ? 'sell' : 'hold';
  const nextTier = tier ? ladder[tierIndex + 1] : null;
  const range = (index) => `${index === 0 ? 0 : ladder[index - 1].upToMonths}–${ladder[index].upToMonths}`;

  const ladderRules = ladder.map((step, index) => {
    const current = !noContracts && index === tierIndex;
    let status = 'idle';
    let note = null;
    if (current && targetHit) status = 'active';
    if (current && !targetHit) {
      status = 'waiting';
      note = t(
        `At ${signedPercent(pnlPercent)} — ${fmt(step.targetPercent - pnlPercent, 1)} points to go.`,
        `当前 ${signedPercent(pnlPercent)}——还差 ${fmt(step.targetPercent - pnlPercent, 1)} 个百分点。`,
      );
    }
    return {
      id: step.id,
      title: step.label,
      when: t(`${range(index)} months`, `${range(index)} 个月`),
      then: t(`Sell at +${step.targetPercent}%`, `盈利 +${step.targetPercent}% 时卖出`),
      status,
      note,
      tone: 'profit',
      preset: step.id,
    };
  });

  const exitVerdict = {
    none: {
      tone: 'hold',
      actions: [
        {
          title: t('Nothing to exit', '没有需要平仓的合约'),
          body: t('No contracts are open, so the ladder does not apply.', '当前没有持仓合约，阶梯规则不适用。'),
        },
      ],
    },
    stop: {
      tone: 'stop',
      actions: [
        {
          title: t('Force sell', '强制卖出'),
          body: t(
            `Held ${fmt(monthsHeld, 1)} months — past the ${stopMonths}-month stop. Sell now, whatever the result (${signedPercent(pnlPercent)}).`,
            `已持有 ${fmt(monthsHeld, 1)} 个月——超过 ${stopMonths} 个月硬止损。无论盈亏（${signedPercent(pnlPercent)}）立即卖出。`,
          ),
        },
      ],
    },
    sell: tier && {
      tone: 'profit',
      actions: [
        {
          title: t('Sell to close', '平仓止盈'),
          body: t(
            `${fmt(monthsHeld, 1)} months in, the target is +${tier.targetPercent}% and this contract is at ${signedPercent(pnlPercent)}. Close it.`,
            `已持有 ${fmt(monthsHeld, 1)} 个月，目标为 +${tier.targetPercent}%，当前 ${signedPercent(pnlPercent)}。平仓。`,
          ),
        },
      ],
    },
    hold: tier && {
      tone: 'hold',
      actions: [
        {
          title: t('Hold', '继续持有'),
          body: t(
            `${fmt(monthsHeld, 1)} months in, the target is +${tier.targetPercent}%; this contract is at ${signedPercent(pnlPercent)}. ${
              nextTier
                ? `After month ${tier.upToMonths} the target drops to +${nextTier.targetPercent}%.`
                : `After month ${stopMonths} it is sold regardless.`
            }`,
            `已持有 ${fmt(monthsHeld, 1)} 个月，目标为 +${tier.targetPercent}%，当前 ${signedPercent(pnlPercent)}。${
              nextTier
                ? `第 ${tier.upToMonths} 个月后目标降至 +${nextTier.targetPercent}%。`
                : `超过第 ${stopMonths} 个月后无论盈亏都将卖出。`
            }`,
          ),
        },
      ],
    },
  }[exitAction];

  const exitLane = {
    id: 'exit',
    title: t('The exit ladder', '阶梯式止盈'),
    summary: noContracts
      ? t('No contracts open.', '当前没有持仓合约。')
      : stopped
        ? t(`Past ${stopMonths} months — the hard stop applies.`, `已超过 ${stopMonths} 个月——适用硬止损。`)
        : t(
            `${fmt(monthsHeld, 1)} months in: the ${tier.label.en.toLowerCase()} tier applies.`,
            `已持有 ${fmt(monthsHeld, 1)} 个月：适用「${tier.label.zh}」目标。`,
          ),
    rules: [
      ...ladderRules,
      {
        id: 'hard-stop',
        title: t('Hard stop', '硬止损'),
        when: t(`> ${stopMonths} months`, `超过 ${stopMonths} 个月`),
        then: t('Force sell, whatever the P&L', '无论盈亏强制卖出'),
        status: !noContracts && stopped ? 'active' : 'idle',
        tone: 'stop',
        preset: 'hard-stop',
      },
    ],
    verdict: exitVerdict,
  };

  const currentTarget = tier
    ? t(`months ≤ ${tier.upToMonths} → +${tier.targetPercent}%`, `月数 ≤ ${tier.upToMonths} → +${tier.targetPercent}%`)
    : t('hard stop', '硬止损');

  return {
    metrics: {
      total,
      coreAmount,
      optionsAmount,
      cashAmount,
      slotAmount,
      deployedAmount,
      waitingAmount,
      openPositions,
      signal,
      entryAction,
      monthsHeld,
      pnlPercent,
      hardStop: stopped,
      tierIndex,
      targetPercent: tier?.targetPercent ?? null,
      targetHit,
      exitAction,
    },

    allocations: [
      {
        id: 'core',
        label: t('Core holdings', '核心持仓'),
        description: t('Dollar-cost averaged into shares', '定期定额买入正股'),
        formula: `total × ${r.allocation.corePercent}%`,
        percent: r.allocation.corePercent,
        amount: coreAmount,
        tone: 'core',
        items: r.coreMixes[coreMixId].map((holding) => ({
          id: holding.id,
          label: holding.label,
          percent: holding.percent,
          portfolioPercent: share(r.allocation.corePercent, holding.percent),
          amount: share(coreAmount, holding.percent),
        })),
        risk: t('Shares still fall with the market; this bucket is the stable part, not a safe one.', '正股同样随市场下跌；这部分是稳定仓位，而非无风险仓位。'),
      },
      {
        id: 'options',
        label: t('Option slots', '期权仓位'),
        description: spec,
        formula: `total × ${r.allocation.optionsPercent}%`,
        percent: r.allocation.optionsPercent,
        amount: optionsAmount,
        tone: 'options',
        items: [
          {
            id: 'slots',
            label: t(`${r.sizing.maxPositions} contract slots`, `${r.sizing.maxPositions} 个合约仓位`),
            percent: 100,
            portfolioPercent: r.allocation.optionsPercent,
            amount: optionsAmount,
            segments: r.sizing.maxPositions,
            segmentsFilled: openPositions,
            note: t(
              `${openPositions} open · ${usd(deployedAmount)} deployed, ${usd(waitingAmount)} waiting`,
              `已开 ${openPositions} 张 · 已投入 ${usd(deployedAmount)}，待用 ${usd(waitingAmount)}`,
            ),
          },
        ],
        rule: { label: t(`Per contract (${r.sizing.perTradePercent}%)`, `每张合约（${r.sizing.perTradePercent}%）`), amount: slotAmount },
        risk: t(
          'Each call can lose its whole premium; the ladder limits time risk, not price risk.',
          '每张看涨期权都可能损失全部权利金；阶梯规则限制的是时间风险，而非价格风险。',
        ),
      },
      {
        id: 'cash',
        label: t('Cash buffer', '现金缓冲'),
        description: t('Liquidity and risk management', '流动性与风险管理'),
        formula: `total × ${r.allocation.cashPercent}%`,
        percent: r.allocation.cashPercent,
        amount: cashAmount,
        tone: 'cash',
        items: [],
        callout: t('Kept separate from unused option slots.', '与未使用的期权仓位分开管理。'),
      },
    ],

    decision: { lanes: [entryLane, exitLane] },

    formulas: [
      { label: t('Core', '核心'), expression: `total × ${r.allocation.corePercent}%`, result: coreAmount, kind: 'money' },
      { label: t('Option slots', '期权仓位'), expression: `total × ${r.allocation.optionsPercent}%`, result: optionsAmount, kind: 'money' },
      { label: t('Cash', '现金'), expression: `total × ${r.allocation.cashPercent}%`, result: cashAmount, kind: 'money' },
      { label: t('Per contract', '每张合约'), expression: `total × ${r.sizing.perTradePercent}%`, result: slotAmount, kind: 'money' },
      { label: t('Deployed', '已投入'), expression: `${openPositions} × per contract`, result: deployedAmount, kind: 'money' },
      { label: t('Entry signal', '入场信号'), expression: entryText, result: yesNo(signal) },
      { label: t('Current target', '当前目标'), expression: `months = ${fmt(monthsHeld, 1)}`, result: currentTarget },
      { label: t('Hard stop', '硬止损'), expression: describe('months', r.hardStop.months), result: yesNo(stopped) },
    ],

    notes: config.notes,
  };
}
