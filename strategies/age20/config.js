import { t } from '../kit.js';

/**
 * Age + 20 allocation with a one-way options-to-core waterfall.
 *
 * `rules` holds every number the model decides with. Copy that quotes a rule
 * is written as a function of `rules`, so changing a number here changes the
 * page everywhere it appears.
 */
const rules = {
  core: {
    ageOffset: 20, // core % = age + ageOffset …
    capPercent: 70, // … never above this
    maxPerStockOfCore: 10, // one stock may hold at most this % of core
    holdings: [
      { id: 'qqqm', label: t('QQQM — growth', 'QQQM — 成长'), short: t('QQQM', 'QQQM'), percent: 30 },
      { id: 'voo', label: t('VOO — broad market', 'VOO — 大盘稳健'), short: t('VOO', 'VOO'), percent: 30 },
      { id: 'individual', label: t('Individual stocks', '优质个股'), short: t('Individual stocks', '优质个股'), percent: 40, stockSleeve: true },
    ],
  },
  cash: {
    stableIncomePercent: 5,
    otherwisePercent: 10,
  },
  options: {
    sleeves: [
      {
        id: 'wheel',
        label: t('Wheel — sell puts', '轮转策略 — 卖出看跌期权'),
        short: t('Wheel', '轮转'),
        percent: 80,
        premiumSource: true, // the waterfall's premium is a share of this sleeve
        note: t('Premium-oriented, with assignment and downside risk', '以权利金为目标，同时承担被行权与下跌风险'),
      },
      {
        id: 'leaps',
        label: t('LEAPS calls', '长期看涨期权'),
        short: t('LEAPS', 'LEAPS'),
        percent: 20,
        note: t('Leverage, time decay, volatility and total-loss risk', '含杠杆、时间价值损耗、波动率与全额亏损风险'),
      },
    ],
  },
  waterfall: {
    oversold: { op: '<', value: 35 }, // RSI level that opens the LEAPS path
  },
  margin: {
    max: 40,
    warning: { op: '>=', value: 20 },
    redLine: { op: '>=', value: 25 },
  },
  driftTolerance: 1, // percentage points that still count as "on target"
};

export default {
  id: 'age-20-waterfall',
  name: t('Age + 20 Cash Flow Waterfall', '年龄 + 20 现金流瀑布'),
  shortName: t('Age + 20', '年龄 + 20'),
  description: t(
    'Separate durable core holdings, options risk capital and a cash reserve — then route realised options proceeds toward long-term assets.',
    '把长期核心仓位、期权风险资金与现金储备分开，再把已实现的期权所得导向长期资产。',
  ),

  rules,

  groups: [
    {
      id: 'allocation',
      title: t('Your situation', '你的情况'),
      description: t('Three answers set the whole allocation.', '三个答案决定全部配置。'),
      columns: 3,
    },
    {
      id: 'simulation',
      title: t('Try a scenario', '试一个情景'),
      description: t('Play with a hypothetical path. Nothing here is a forecast.', '调整一条假设路径，所有数值都不代表预测。'),
      columns: 4,
    },
    {
      id: 'risk',
      title: t('Check what you hold', '对照你的持仓'),
      description: t(
        'Enter your real weights; cash is whatever is left. The scenario below uses them.',
        '填入真实占比，剩余部分即为现金。下方情景会用到这些数据。',
      ),
      columns: 3,
    },
  ],

  // Holdings come before the scenario because the waterfall's cash refill uses them.
  layout: ['group:allocation', 'allocations', 'formulas', 'group:risk', 'risk', 'group:simulation', 'flow'],

  inputs: [
    {
      id: 'portfolioValue',
      kind: 'currency',
      group: 'allocation',
      label: t('Portfolio value', '投资组合总额'),
      helper: t('The base every percentage is applied to', '所有比例都以此为基数'),
      min: 10000,
      max: 10000000,
      step: 1000,
    },
    {
      id: 'age',
      kind: 'range',
      group: 'allocation',
      label: t('Your age', '你的年龄'),
      helper: (r) =>
        t(
          `Core = age + ${r.core.ageOffset}, capped at ${r.core.capPercent}%`,
          `核心仓位 = 年龄 + ${r.core.ageOffset}%，上限 ${r.core.capPercent}%`,
        ),
      min: 18,
      max: 80,
      step: 1,
    },
    {
      id: 'stableIncome',
      kind: 'toggle',
      group: 'allocation',
      label: t('Stable income?', '有稳定收入？'),
      helper: (r) =>
        t(
          `Sets the cash target to ${r.cash.stableIncomePercent}% or ${r.cash.otherwisePercent}%`,
          `决定现金目标为 ${r.cash.stableIncomePercent}% 或 ${r.cash.otherwisePercent}%`,
        ),
    },
    {
      id: 'rsi',
      kind: 'range',
      group: 'simulation',
      label: t('Current RSI', '当前 RSI'),
      helper: (r) =>
        t(
          `The LEAPS path opens when RSI is ${r.waterfall.oversold.op === '<' ? 'below' : 'at or below'} ${r.waterfall.oversold.value}`,
          `RSI ${r.waterfall.oversold.op === '<' ? '低于' : '不高于'} ${r.waterfall.oversold.value} 时开启 LEAPS 路径`,
        ),
      min: 0,
      max: 100,
      step: 1,
    },
    {
      id: 'premiumMode',
      kind: 'choice',
      group: 'simulation',
      label: t('Premium scenario', '权利金情景'),
      helper: t('Model the monthly premium as a rate or an amount', '按比例或按金额设定月度权利金'),
      options: [
        { value: 'percent', label: t('% of wheel', '按轮转比例') },
        { value: 'dollar', label: t('$ amount', '按金额') },
      ],
    },
    {
      id: 'premiumRate',
      kind: 'range',
      group: 'simulation',
      label: t('Monthly premium rate', '月度权利金比例'),
      helper: t('An adjustable illustration, not an expected return', '仅为可调整的演示，不代表预期收益'),
      min: 0,
      max: 10,
      step: 0.25,
      suffix: '%',
      visibleWhen: (values) => values.premiumMode !== 'dollar',
    },
    {
      id: 'premiumDollar',
      kind: 'currency',
      group: 'simulation',
      label: t('Monthly premium amount', '月度权利金金额'),
      helper: t('An adjustable illustration, not an expected return', '仅为可调整的演示，不代表预期收益'),
      min: 0,
      max: 200000,
      step: 100,
      visibleWhen: (values) => values.premiumMode === 'dollar',
    },
    {
      id: 'leapsReturn',
      kind: 'range',
      group: 'simulation',
      label: t('LEAPS outcome', 'LEAPS 情景结果'),
      helper: (r) =>
        t(
          `Used once the LEAPS path opens (RSI ${r.waterfall.oversold.op === '<' ? 'below' : 'at or below'} ${r.waterfall.oversold.value}). −100% is a total loss`,
          `LEAPS 路径开启后（RSI ${r.waterfall.oversold.op === '<' ? '低于' : '不高于'} ${r.waterfall.oversold.value}）才会用到。−100% 表示全部亏损`,
        ),
      min: -100,
      max: 300,
      step: 5,
      suffix: '%',
    },
    {
      id: 'currentCorePercent',
      kind: 'range',
      group: 'risk',
      label: t('Core held now', '当前核心仓位'),
      helper: t('Your current core weight', '你当前的核心仓位占比'),
      min: 0,
      max: 100,
      step: 0.5,
      suffix: '%',
    },
    {
      id: 'currentOptionsPercent',
      kind: 'range',
      group: 'risk',
      label: t('Options held now', '当前期权仓位'),
      helper: t('Cash held is the rest: 100% − core − options', '现金占比 = 100% − 核心 − 期权'),
      min: 0,
      max: 100,
      step: 0.5,
      suffix: '%',
    },
    {
      id: 'marginUsage',
      kind: 'range',
      group: 'risk',
      label: t('Margin utilization', '保证金使用率'),
      helper: (r) =>
        t(
          `Warning at ${r.margin.warning.value}%, red line at ${r.margin.redLine.value}%`,
          `${r.margin.warning.value}% 进入预警，${r.margin.redLine.value}% 为风险红线`,
        ),
      min: 0,
      max: rules.margin.max,
      step: 1,
      suffix: '%',
    },
  ],

  defaults: {
    portfolioValue: 400000,
    age: 38,
    stableIncome: true,
    rsi: 45,
    premiumMode: 'percent',
    premiumRate: 2,
    premiumDollar: 2400,
    leapsReturn: 0,
    currentCorePercent: 55,
    currentOptionsPercent: 42,
    marginUsage: 0,
  },

  notes: [
    {
      id: 'principles',
      title: t('Rebalancing principles', '再平衡原则'),
      items: [
        {
          title: t('Preserve liquidity first', '优先保住流动性'),
          detail: t(
            'A funded cash reserve is what lets a plan survive a drawdown without forced selling.',
            '充足的现金储备，才能在回撤中避免被迫卖出。',
          ),
        },
        {
          title: t('Respect the cash target', '尊重现金目标'),
          detail: t(
            'Refill cash to its target before any proceeds move on to core holdings.',
            '在资金流向核心仓位之前，先把现金补回目标水平。',
          ),
        },
        {
          title: t('Never cross the margin red line', '不越过保证金红线'),
          detail: t(
            'Margin is optional in this framework. Nothing here suggests increasing it.',
            '本框架中保证金并非必需，也不建议提高保证金使用率。',
          ),
        },
        {
          title: t('In a bear market, do not let options grow by default', '熊市中不要让期权仓位被动放大'),
          detail: t(
            'When core falls, the options weight rises on its own. Rebalancing means bringing realised excess back toward core, not adding options exposure.',
            '核心仓位下跌时，期权占比会自动上升。再平衡是把已实现的超额资金导回核心仓位，而不是加大期权敞口。',
          ),
        },
      ],
    },
  ],
};
