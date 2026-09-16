import { t } from '../kit.js';

/**
 * QQQ LEAPS Engine — deep in-the-money LEAPS in place of shares, a large cash
 * reserve, and four mechanical management rules.
 *
 * Source: "The QQQ LEAPS Game Plan". Thresholds follow the document exactly,
 * including whether they are strict ("Delta > 0.9") or inclusive ("down by at
 * least 1%"). Change a rule here and the whole page follows.
 */
const rules = {
  underlying: 'QQQ',
  allocation: { leapsPercent: 60, cashPercent: 40 },
  contract: { delta: 0.8, dteMin: 650, dteMax: 800 },

  // Open the core setup only on a red day: QQQ down by at least 1%.
  entry: { drop: { op: '>=', value: 1 } },

  // "Infinite renewal": time is running out → roll out for a debit.
  renew: { dte: { op: '<', value: 300 }, rollToDteMin: 700 },

  // Harvest: super deep ITM → roll up & out for a credit that goes to cash.
  harvest: { delta: { op: '>', value: 0.9 }, rollToDelta: 0.7, rollToDteMin: 650 },

  // Buy the dip: delta has collapsed → average down from the cash reserve.
  dip: {
    delta: { op: '<', value: 0.5 },
    heavyMode: { op: '>', value: 40 }, // cash % that unlocks the larger add
    heavyAddPercent: 10,
    normalAddPercent: 5,
    cashAfterAdd: { op: '>', value: 10 }, // cash must stay above this afterwards
    cooldownDays: 30,
  },
};

const hasPosition = (values) => values.hasPosition !== false;

export default {
  id: 'leaps-engine',
  name: t('QQQ LEAPS Engine', 'QQQ LEAPS 引擎'),
  shortName: t('LEAPS Engine', 'LEAPS 引擎'),
  description: t(
    'Hold deep in-the-money QQQ LEAPS in place of shares, keep a large cash reserve, and manage each position with four mechanical rules.',
    '用深度价内的 QQQ LEAPS 替代正股，保留大量现金储备，并用四条机械规则管理每个仓位。',
  ),

  rules,

  groups: [
    {
      id: 'account',
      title: t('Your account', '你的账户'),
      description: (r) =>
        t(
          `The ${r.allocation.leapsPercent} / ${r.allocation.cashPercent} setup is applied to this amount.`,
          `${r.allocation.leapsPercent} / ${r.allocation.cashPercent} 的初始配置以此金额为基数。`,
        ),
      columns: 3,
    },
    {
      id: 'position',
      title: t('Where the position stands', '仓位现状'),
      description: t('Enter today’s numbers to see which rule applies.', '填入今天的数据，查看适用哪条规则。'),
      columns: 4,
    },
  ],

  layout: ['group:account', 'allocations', 'group:position', 'decision', 'risk', 'formulas'],

  inputs: [
    {
      id: 'portfolioValue',
      kind: 'currency',
      group: 'account',
      label: t('Account value', '账户总额'),
      helper: t('Total capital for this strategy', '用于本策略的总资金'),
      min: 10000,
      max: 10000000,
      step: 1000,
    },
    {
      id: 'hasPosition',
      kind: 'toggle',
      group: 'account',
      label: t('Already holding the LEAPS?', '已经持有 LEAPS？'),
      helper: t('No = deciding whether to open the setup today', '否 = 判断今天是否建仓'),
    },
    {
      id: 'qqqMove',
      kind: 'range',
      group: 'position',
      label: (r) => t(`${r.underlying} move today`, `${r.underlying} 今日涨跌`),
      helper: (r) =>
        t(
          `Open only when ${r.underlying} is down ${r.entry.drop.op === '>=' ? 'at least' : 'more than'} ${r.entry.drop.value}%`,
          `仅在 ${r.underlying} 下跌${r.entry.drop.op === '>=' ? '至少' : '超过'} ${r.entry.drop.value}% 时建仓`,
        ),
      min: -5,
      max: 5,
      step: 0.1,
      suffix: '%',
      visibleWhen: (values) => !hasPosition(values),
    },
    {
      id: 'delta',
      kind: 'range',
      group: 'position',
      label: t('Option delta', '期权 Delta'),
      helper: (r) =>
        t(
          `Harvest above ${r.harvest.delta.value}, buy the dip below ${r.dip.delta.value}`,
          `高于 ${r.harvest.delta.value} 收割，低于 ${r.dip.delta.value} 逢低加仓`,
        ),
      min: 0.1,
      max: 1,
      step: 0.01,
      visibleWhen: hasPosition,
    },
    {
      id: 'dte',
      kind: 'range',
      group: 'position',
      label: t('Days to expiration', '剩余到期天数'),
      helper: (r) => t(`Roll out below ${r.renew.dte.value} days`, `低于 ${r.renew.dte.value} 天时展期`),
      min: 0,
      max: 1000,
      step: 10,
      visibleWhen: hasPosition,
    },
    {
      id: 'cashPercent',
      kind: 'range',
      group: 'position',
      label: t('Cash held', '现金占比'),
      helper: t('As a share of the whole account', '占整个账户的比例'),
      min: 0,
      max: 100,
      step: 1,
      suffix: '%',
      visibleWhen: hasPosition,
    },
    {
      id: 'daysSinceLastAdd',
      kind: 'range',
      group: 'position',
      label: t('Days since the last dip buy', '距上次逢低加仓天数'),
      helper: (r) => t(`Dip buys need ${r.dip.cooldownDays} days between them`, `两次加仓需间隔 ${r.dip.cooldownDays} 天`),
      min: 0,
      max: 120,
      step: 1,
      visibleWhen: hasPosition,
    },
  ],

  defaults: {
    portfolioValue: 100000,
    hasPosition: true,
    qqqMove: 0,
    delta: 0.8,
    dte: 700,
    cashPercent: 40,
    daysSinceLastAdd: 60,
  },

  /** Loaded by the "Try this case" button on each rule. */
  presets: {
    enter: { hasPosition: false, qqqMove: -1.5 },
    wait: { hasPosition: false, qqqMove: 0.4 },
    harvest: { hasPosition: true, delta: 0.95, dte: 650, cashPercent: 40 },
    renew: { hasPosition: true, delta: 0.8, dte: 250, cashPercent: 40 },
    dip: { hasPosition: true, delta: 0.45, dte: 650, cashPercent: 45, daysSinceLastAdd: 60 },
    hold: { hasPosition: true, delta: 0.8, dte: 700, cashPercent: 40, daysSinceLastAdd: 60 },
  },

  notes: [
    {
      id: 'goals',
      title: t('What the plan is for', '计划的目标'),
      items: [
        {
          title: t('Work toward a zero cost basis', '逐步实现零成本持仓'),
          detail: t(
            'Harvest rolls take credits off the table and park them in cash instead of adding risk.',
            '收割展期拿回的权利金转入现金，而不是继续加大风险。',
          ),
        },
        {
          title: t('Let the LEAPS stand in for shares', '用 LEAPS 替代正股'),
          detail: t(
            'Deep in-the-money calls track QQQ closely for a fraction of the capital.',
            '深度价内看涨期权以较少资金紧密跟随 QQQ。',
          ),
        },
        {
          title: t('Keep cash for defence', '保留现金用于防守'),
          detail: t(
            'The reserve funds dip buys and rolls, so the position never has to be sold at the bottom.',
            '现金储备用于逢低加仓与展期，避免在低点被迫卖出。',
          ),
        },
      ],
    },
    {
      id: 'downside',
      title: t('Know the downside', '了解下行风险'),
      items: [
        {
          title: t('Leverage cuts both ways', '杠杆是双刃剑'),
          detail: t(
            'LEAPS lose value faster than shares in a sharp decline and can expire worthless.',
            '急跌时 LEAPS 的跌幅快于正股，且可能到期归零。',
          ),
        },
        {
          title: t('Every roll has a cost', '每次展期都有成本'),
          detail: t(
            'Renewal rolls are paid for in cash, and spreads and fees add up over years.',
            '续期展期需要支付现金，多年累积的价差与费用不可忽视。',
          ),
        },
      ],
    },
  ],
};
