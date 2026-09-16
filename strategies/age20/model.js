import { clamp, describe, fmt, passes, share, t } from '../kit.js';

/**
 * Age + 20 model. Reads every rule from `config.rules`:
 *   core %    = min(age + ageOffset, capPercent)
 *   cash %    = stableIncomePercent or otherwisePercent
 *   options % = 100 − core − cash
 * Realised options proceeds refill cash to its target, then spill into core
 * using the core mix. They never flow back into the options bucket.
 */

function driftStatus(deltaPercent, tolerance) {
  if (deltaPercent <= -tolerance) return 'under';
  if (deltaPercent >= tolerance) return 'over';
  return 'on';
}

export function evaluate(values, config) {
  const r = config.rules;

  /* -- 1. Clamp inputs so a hand-edited share link can never break the model */
  const total = clamp(values.portfolioValue, 10000, 10000000);
  const age = clamp(values.age, 18, 80);
  const stableIncome = values.stableIncome !== false;
  const rsi = clamp(values.rsi, 0, 100);
  const premiumMode = values.premiumMode === 'dollar' ? 'dollar' : 'percent';
  const premiumRate = clamp(values.premiumRate, 0, 10);
  const premiumDollar = clamp(values.premiumDollar, 0, 200000);
  const leapsReturn = clamp(values.leapsReturn, -100, 300);
  const currentCorePercent = clamp(values.currentCorePercent, 0, 100);
  const currentOptionsPercent = clamp(values.currentOptionsPercent, 0, 100);
  const currentCashPercent = clamp(values.currentCashPercent, 0, 100);
  const marginUsage = clamp(values.marginUsage, 0, r.margin.max);

  /* -- 2. Primary allocation ---------------------------------------------- */
  const corePercent = Math.min(age + r.core.ageOffset, r.core.capPercent);
  const cashPercent = stableIncome ? r.cash.stableIncomePercent : r.cash.otherwisePercent;
  const optionsPercent = 100 - corePercent - cashPercent;
  const coreAmount = share(total, corePercent);
  const optionsAmount = share(total, optionsPercent);
  const cashTarget = share(total, cashPercent);

  /* -- 3. Sub-allocations -------------------------------------------------- */
  const maxSingleStock = share(coreAmount, r.core.maxPerStockOfCore);
  const stockSlots = Math.round(
    (r.core.holdings.find((holding) => holding.stockSleeve)?.percent ?? 0) / r.core.maxPerStockOfCore,
  );
  const coreItems = r.core.holdings.map((holding) => ({
    id: holding.id,
    label: holding.label,
    percent: holding.percent,
    portfolioPercent: share(corePercent, holding.percent),
    amount: share(coreAmount, holding.percent),
    ...(holding.stockSleeve
      ? {
          segments: stockSlots,
          note: t(
            `At most ${r.core.maxPerStockOfCore}% of core per stock — the ${stockSlots} marks show that cap, not picks.`,
            `单只个股不超过核心仓位的 ${r.core.maxPerStockOfCore}%——${stockSlots} 个分段表示这一上限，并非选股建议。`,
          ),
        }
      : {}),
  }));
  const optionItems = r.options.sleeves.map((sleeve) => ({
    id: sleeve.id,
    label: sleeve.label,
    percent: sleeve.percent,
    portfolioPercent: share(optionsPercent, sleeve.percent),
    amount: share(optionsAmount, sleeve.percent),
    note: sleeve.note,
  }));
  const premiumSleeve = optionItems.find((item) =>
    r.options.sleeves.find((sleeve) => sleeve.id === item.id)?.premiumSource,
  );
  const wheelAmount = premiumSleeve?.amount ?? 0;
  const leapsAmount = optionItems.find((item) => item.id === 'leaps')?.amount ?? 0;

  /* -- 4. Waterfall scenario ---------------------------------------------- */
  const premiumAmount = premiumMode === 'dollar' ? premiumDollar : share(wheelAmount, premiumRate);
  const oversold = passes(rsi, r.waterfall.oversold);
  const leapsProceeds = oversold ? Math.max(0, premiumAmount * (1 + leapsReturn / 100)) : 0;
  const currentCash = share(total, currentCashPercent);
  const cashShortfall = Math.max(0, cashTarget - currentCash);
  const cashRefill = Math.min(leapsProceeds, cashShortfall);
  const coreSpillover = Math.max(0, leapsProceeds - cashRefill);
  const spillover = r.core.holdings.map((holding) => ({
    id: holding.id,
    label: holding.short,
    amount: share(coreSpillover, holding.percent),
  }));
  const maxSingleStockAfter = share(coreAmount + coreSpillover, r.core.maxPerStockOfCore);
  const oversoldText = describe('RSI', r.waterfall.oversold);

  /* -- 5. Drift ------------------------------------------------------------ */
  const currentSumPercent = currentCorePercent + currentOptionsPercent + currentCashPercent;
  const driftRows = [
    { id: 'core', label: t('Core holdings', '核心定投仓位'), tone: 'core', targetPercent: corePercent, currentPercent: currentCorePercent },
    { id: 'options', label: t('Options pool', '期权仓位'), tone: 'options', targetPercent: optionsPercent, currentPercent: currentOptionsPercent },
    { id: 'cash', label: t('Cash reserve', '现金储备'), tone: 'cash', targetPercent: cashPercent, currentPercent: currentCashPercent },
  ].map((row) => {
    const deltaPercent = row.currentPercent - row.targetPercent;
    return {
      ...row,
      deltaPercent,
      targetAmount: share(total, row.targetPercent),
      currentAmount: share(total, row.currentPercent),
      deltaAmount: share(total, deltaPercent),
      status: driftStatus(deltaPercent, r.driftTolerance),
    };
  });

  /* -- 6. Margin ----------------------------------------------------------- */
  const warn = r.margin.warning.value;
  const red = r.margin.redLine.value;
  const marginTone = passes(marginUsage, r.margin.redLine)
    ? 'critical'
    : passes(marginUsage, r.margin.warning)
      ? 'warning'
      : 'ok';
  const marginStatus = {
    critical: t(`At or above the ${red}% red line`, `已达到或超过 ${red}% 风险红线`),
    warning: t('Inside the warning range — approaching the red line', '处于预警区间——正在接近风险红线'),
    ok: t(`Below the ${warn}% warning line`, `低于 ${warn}% 预警线`),
  }[marginTone];

  /* -- 7. One sentence on what the waterfall is doing ---------------------- */
  let flowSummary;
  if (premiumAmount <= 0) {
    flowSummary = t('With no premium in this scenario, nothing flows.', '此情景下没有权利金，因此没有资金流动。');
  } else if (!oversold) {
    flowSummary = t(
      `Right now the premium just builds up in the reserve. The LEAPS path only opens when ${oversoldText}.`,
      `目前权利金只在储备中累积；只有当 ${oversoldText} 时，才会开启 LEAPS 路径。`,
    );
  } else if (leapsProceeds <= 0) {
    flowSummary = t(
      `${oversoldText}, so the reserve funds the LEAPS scenario — which, at this outcome, returns nothing.`,
      `${oversoldText}，储备资金投入 LEAPS 情景——但在此结果下没有任何回收。`,
    );
  } else {
    flowSummary = t(
      `${oversoldText}, so the reserve funds the LEAPS scenario. Proceeds refill cash first; anything left goes permanently to core.`,
      `${oversoldText}，储备资金投入 LEAPS 情景。所得先补足现金，剩余部分永久流入核心仓位。`,
    );
  }

  const signed = `${leapsReturn >= 0 ? '+' : '−'}${Math.abs(leapsReturn).toFixed(0)}%`;
  const coreMixText = r.core.holdings.map((holding) => holding.percent).join(' / ');

  return {
    metrics: {
      total,
      age,
      corePercent,
      optionsPercent,
      cashPercent,
      coreAmount,
      optionsAmount,
      cashTarget,
      wheelAmount,
      leapsAmount,
      premiumAmount,
      premiumMode,
      oversold,
      rsi,
      leapsReturn,
      leapsProceeds,
      currentCash,
      cashShortfall,
      cashRefill,
      coreSpillover,
      maxSingleStock,
      maxSingleStockAfter,
      marginUsage,
      marginTone,
      marginStatus,
      currentSumPercent,
    },

    flowSummary,

    allocations: [
      {
        id: 'core',
        label: t('Core holdings', '核心定投仓位'),
        description: t(
          `Age + ${r.core.ageOffset}, capped at ${r.core.capPercent}%`,
          `年龄 + ${r.core.ageOffset}%，上限 ${r.core.capPercent}%`,
        ),
        formula: `min(${age} + ${r.core.ageOffset}, ${r.core.capPercent}) = ${corePercent}%`,
        percent: corePercent,
        amount: coreAmount,
        tone: 'core',
        items: coreItems,
        rule: { label: t('Maximum per stock', '单只个股上限'), amount: maxSingleStock },
        risk: t(
          'Long-term holdings still fall with the market. The cap limits single-name damage, not market risk.',
          '长期持仓同样会随市场下跌；集中度上限只能限制单一个股风险，无法消除市场风险。',
        ),
      },
      {
        id: 'options',
        label: t('Options pool', '期权仓位'),
        description: t('Whatever is left after core and cash', '扣除核心与现金后的剩余部分'),
        formula: `100% − ${corePercent}% − ${cashPercent}% = ${optionsPercent}%`,
        percent: optionsPercent,
        amount: optionsAmount,
        tone: 'options',
        items: optionItems,
        risk: t(
          'Options and margin can lose more than the amount committed to this bucket.',
          '期权与保证金的损失可能超过投入该仓位的金额。',
        ),
      },
      {
        id: 'cash',
        label: t('Cash reserve', '现金储备'),
        description: stableIncome
          ? t(`${cashPercent}% target with stable income`, `有稳定收入时目标为 ${cashPercent}%`)
          : t(`${cashPercent}% target without stable income`, `无稳定收入时目标为 ${cashPercent}%`),
        formula: stableIncome ? `stable income → ${cashPercent}%` : `no stable income → ${cashPercent}%`,
        percent: cashPercent,
        amount: cashTarget,
        tone: 'cash',
        items: [],
        meter: {
          label: t('Held now vs. target', '当前现金 vs 目标'),
          current: currentCash,
          target: cashTarget,
          status: currentCash >= cashTarget ? t('Target funded', '现金目标已满足') : t('Short of target', '低于目标'),
          shortfall: cashShortfall,
          shortfallLabel: t('Shortfall', '缺口'),
        },
        callout: t(
          'A liquidity buffer for the whole portfolio — not idle options buying power.',
          '这是整个组合的流动性缓冲，而不是闲置的期权购买力。',
        ),
        risk: t('Cash held for liquidity loses purchasing power to inflation over time.', '为流动性而持有的现金会随通胀损失购买力。'),
      },
    ],

    flow: [
      {
        id: 'wheel',
        bucket: 'options',
        label: t('Wheel premium', '轮转策略权利金'),
        detail:
          premiumMode === 'dollar'
            ? t('Fixed monthly amount scenario', '按固定金额设定的月度情景')
            : t(`${premiumRate.toFixed(2)}% of the wheel sleeve, monthly`, `轮转仓位的 ${premiumRate.toFixed(2)}%，按月计算`),
        note: t('Hypothetical, and before losses, fees, taxes and assignment.', '为假设值，且未扣除亏损、费用、税负与被行权影响。'),
        amount: premiumAmount,
        status: premiumAmount > 0 ? 'active' : 'idle',
      },
      {
        id: 'reserve',
        bucket: 'cash',
        label: t('Premium reserve', '权利金储备'),
        detail: t('Held aside; it does not enlarge the options pool', '暂存于一旁，不会扩大期权仓位'),
        amount: premiumAmount,
        status: premiumAmount > 0 ? 'active' : 'idle',
      },
      {
        id: 'rsi',
        bucket: null,
        label: oversold ? t('Oversold condition', '超卖条件') : t('Wait', '等待'),
        detail: oversold
          ? t(`RSI ${rsi.toFixed(0)} — ${oversoldText}, so the LEAPS path opens`, `RSI ${rsi.toFixed(0)}——满足 ${oversoldText}，开启 LEAPS 路径`)
          : t(`RSI ${rsi.toFixed(0)} — the premium stays in reserve`, `RSI ${rsi.toFixed(0)}——权利金继续留在储备中`),
        note: t('RSI is one signal. It does not predict a rebound.', 'RSI 只是其中一个信号，并不能预测反弹。'),
        status: oversold ? 'active' : 'waiting',
      },
      {
        id: 'leaps',
        bucket: 'options',
        label: t('LEAPS scenario', 'LEAPS 情景'),
        detail: oversold
          ? t(`${signed} on the premium deployed`, `投入权利金的 ${signed} 情景`)
          : t('Inactive until the RSI condition is met', 'RSI 条件满足前不启用'),
        note: oversold ? t('A LEAPS call can also expire worthless.', 'LEAPS 看涨期权同样可能到期归零。') : null,
        amount: oversold ? leapsProceeds : null,
        status: oversold ? 'active' : 'idle',
      },
      {
        id: 'cash',
        bucket: 'cash',
        label: t('Refill cash', '补足现金仓位'),
        detail:
          cashShortfall > 0
            ? t('Close the gap to the cash target first', '先补足与现金目标之间的缺口')
            : t('No shortfall — proceeds skip straight to core', '没有缺口——资金直接流向核心仓位'),
        amount: oversold ? cashRefill : null,
        status: oversold && cashRefill > 0 ? 'ready' : oversold ? 'active' : 'idle',
      },
      {
        id: 'core',
        bucket: 'core',
        label: t('Permanent core spillover', '永久流入核心仓位'),
        detail: t(`Excess follows the ${coreMixText} core mix`, `超额资金按 ${coreMixText} 流入核心仓位`),
        amount: oversold ? coreSpillover : null,
        status: oversold && coreSpillover > 0 ? 'ready' : 'idle',
        breakdown: coreSpillover > 0 ? spillover : null,
        footnote: coreSpillover > 0 ? t('New cap per stock', '更新后的单只个股上限') : null,
        footnoteAmount: coreSpillover > 0 ? maxSingleStockAfter : null,
      },
    ],

    gauges: [
      {
        id: 'margin',
        label: t('Margin utilization', '保证金使用率'),
        value: marginUsage,
        min: 0,
        max: r.margin.max,
        suffix: '%',
        tone: marginTone,
        status: marginStatus,
        marks: [
          { at: warn, label: t(`${warn}% warning`, `${warn}% 预警`), tone: 'warning', align: 'end' },
          { at: red, label: t(`${red}% red line`, `${red}% 风险红线`), tone: 'critical', align: 'start' },
        ],
        note: t('This page never suggests increasing margin.', '本页不会建议提高保证金使用率。'),
      },
    ],

    drift: {
      sumPercent: currentSumPercent,
      tolerance: r.driftTolerance,
      rows: driftRows,
    },

    formulas: [
      {
        label: t('Core %', '核心仓位 %'),
        expression: `min(age + ${r.core.ageOffset}, ${r.core.capPercent}) = min(${age} + ${r.core.ageOffset}, ${r.core.capPercent})`,
        result: `${corePercent}%`,
      },
      {
        label: t('Cash %', '现金 %'),
        expression: stableIncome ? `stable income = yes → ${cashPercent}` : `stable income = no → ${cashPercent}`,
        result: `${cashPercent}%`,
      },
      { label: t('Options %', '期权 %'), expression: `100 − ${corePercent} − ${cashPercent}`, result: `${optionsPercent}%` },
      { label: t('Core amount', '核心金额'), expression: `total × ${corePercent}%`, result: coreAmount, kind: 'money' },
      { label: t('Options amount', '期权金额'), expression: `total × ${optionsPercent}%`, result: optionsAmount, kind: 'money' },
      { label: t('Cash amount', '现金金额'), expression: `total × ${cashPercent}%`, result: cashTarget, kind: 'money' },
      {
        label: t('Max per stock', '单只个股上限'),
        expression: `core × ${r.core.maxPerStockOfCore}%`,
        result: maxSingleStock,
        kind: 'money',
      },
      ...r.options.sleeves.map((sleeve) => ({
        label: t(`${sleeve.short.en} sleeve`, `${sleeve.short.zh} 仓位`),
        expression: `options × ${sleeve.percent}%`,
        result: share(optionsAmount, sleeve.percent),
        kind: 'money',
      })),
      {
        label: t('Monthly premium', '月度权利金'),
        expression: premiumMode === 'dollar' ? 'entered directly' : `wheel × ${fmt(premiumRate)}%`,
        result: premiumAmount,
        kind: 'money',
      },
      {
        label: t('LEAPS proceeds', 'LEAPS 所得'),
        expression: oversold ? `premium × (1 + ${leapsReturn}%)` : `${oversoldText} not met → path inactive`,
        result: leapsProceeds,
        kind: 'money',
      },
      { label: t('Cash refill', '现金补足'), expression: 'min(proceeds, cash target − cash held)', result: cashRefill, kind: 'money' },
      { label: t('Core spillover', '核心仓位流入'), expression: 'proceeds − cash refill', result: coreSpillover, kind: 'money' },
    ],

    notes: config.notes,
  };
}
