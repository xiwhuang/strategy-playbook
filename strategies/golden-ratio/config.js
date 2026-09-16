import { t } from '../kit.js';

/**
 * QQQ Golden Ratio — 70% core, 25% in up to five short-dated LEAPS slots,
 * 5% cash, with a time-stepped profit ladder and a hard stop.
 *
 * Source: "QQQ LEAP Execution Plan: The Golden Ratio Strategy". Note the
 * document's entry rule is strict ("drops by MORE than 1%"), unlike the LEAPS
 * Engine's inclusive one. Its ladder is written "0–4, 4–6, 7–9 months", which
 * leaves months 6–7 undefined; `upToMonths` closes that gap by assigning them
 * to the next tier.
 */
const rules = {
  underlying: 'QQQ',
  allocation: { corePercent: 70, optionsPercent: 25, cashPercent: 5 },

  // Core is DCA'd into shares. The document allows QQQ alone or a 50/50 split.
  coreMixes: {
    qqq: [{ id: 'qqq', label: t('QQQ', 'QQQ'), percent: 100 }],
    split: [
      { id: 'qqq', label: t('QQQ', 'QQQ'), percent: 50 },
      { id: 'voo', label: t('VOO', 'VOO'), percent: 50 },
    ],
  },

  entry: { drop: { op: '>', value: 1 } },
  contract: { delta: 0.6, dte: 385 },
  sizing: { perTradePercent: 5, maxPositions: 5 }, // 5 × 5% fills the 25% bucket

  // Time-stepped profit targets; the first tier whose upToMonths covers the
  // holding period applies.
  exitLadder: [
    { id: 'tier-1', upToMonths: 4, targetPercent: 50, label: t('Honeymoon phase', '蜜月期') },
    { id: 'tier-2', upToMonths: 6, targetPercent: 30, label: t('Decay picking up', '衰减加速') },
    { id: 'tier-3', upToMonths: 9, targetPercent: 10, label: t('Late stage', '后期') },
  ],
  hardStop: { months: { op: '>', value: 9 } },
};

export default {
  id: 'golden-ratio',
  name: t('QQQ Golden Ratio', 'QQQ 黄金比例'),
  shortName: t('Golden Ratio', '黄金比例'),
  description: t(
    'Keep 70% in core shares, run up to five one-year QQQ calls with the next 25%, hold 5% cash — and exit each call on a profit ladder that steps down with time.',
    '70% 定投核心正股，25% 最多同时持有五张约一年期的 QQQ 看涨期权，保留 5% 现金——并按随时间递减的阶梯目标逐一止盈。',
  ),

  rules,

  groups: [
    {
      id: 'account',
      title: t('Your account', '你的账户'),
      description: t('The golden ratio is applied to this amount.', '黄金比例以此金额为基数。'),
      columns: 3,
    },
    {
      id: 'market',
      title: t('Today’s market', '今日行情'),
      description: t('Decide whether today opens a new contract.', '判断今天是否开新仓。'),
      columns: 3,
    },
    {
      id: 'contract',
      title: t('One of your contracts', '你的某一张合约'),
      description: t('Check it against the exit ladder.', '对照阶梯式止盈规则检查。'),
      columns: 3,
    },
  ],

  layout: [
    'group:account',
    'allocations',
    'group:market',
    'decision:entry',
    'group:contract',
    'decision:exit',
    'risk',
    'formulas',
  ],

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
      id: 'coreMix',
      kind: 'choice',
      group: 'account',
      label: t('Core holdings', '核心持仓'),
      helper: t('Dollar-cost average into shares', '定期定额买入正股'),
      options: [
        { value: 'qqq', label: t('QQQ only', '仅 QQQ') },
        { value: 'split', label: t('QQQ + VOO', 'QQQ + VOO') },
      ],
    },
    {
      id: 'qqqMove',
      kind: 'range',
      group: 'market',
      label: (r) => t(`${r.underlying} move today`, `${r.underlying} 今日涨跌`),
      helper: (r) =>
        t(
          `A new contract needs a drop of ${r.entry.drop.op === '>' ? 'more than' : 'at least'} ${r.entry.drop.value}%`,
          `开新仓需要跌幅${r.entry.drop.op === '>' ? '超过' : '至少'} ${r.entry.drop.value}%`,
        ),
      min: -5,
      max: 5,
      step: 0.1,
      suffix: '%',
    },
    {
      id: 'openPositions',
      kind: 'range',
      group: 'market',
      label: t('Contracts open', '当前持仓合约数'),
      helper: (r) =>
        t(
          `At most ${r.sizing.maxPositions}, each ${r.sizing.perTradePercent}% of the account`,
          `最多 ${r.sizing.maxPositions} 张，每张占账户 ${r.sizing.perTradePercent}%`,
        ),
      min: 0,
      max: rules.sizing.maxPositions,
      step: 1,
    },
    {
      id: 'monthsHeld',
      kind: 'range',
      group: 'contract',
      label: t('Months held', '已持有月数'),
      helper: (r) => t(`Force sell after ${r.hardStop.months.value} months`, `超过 ${r.hardStop.months.value} 个月强制卖出`),
      min: 0,
      max: 12,
      step: 0.5,
    },
    {
      id: 'pnlPercent',
      kind: 'range',
      group: 'contract',
      label: t('Profit or loss', '当前盈亏'),
      helper: t('On what you paid for this contract', '相对该合约的买入成本'),
      min: -100,
      max: 200,
      step: 5,
      suffix: '%',
    },
  ],

  defaults: {
    portfolioValue: 200000,
    coreMix: 'qqq',
    qqqMove: 0,
    openPositions: 3,
    monthsHeld: 2,
    pnlPercent: 20,
  },

  /** Loaded by the "Try this case" button on each rule. */
  presets: {
    'no-signal': { qqqMove: 0.3 },
    buy: { qqqMove: -1.5, openPositions: 3 },
    rotate: { qqqMove: -1.5, openPositions: 5 },
    'tier-1': { openPositions: 3, monthsHeld: 2, pnlPercent: 55 },
    'tier-2': { openPositions: 3, monthsHeld: 5, pnlPercent: 30 },
    'tier-3': { openPositions: 3, monthsHeld: 8, pnlPercent: 12 },
    'hard-stop': { openPositions: 3, monthsHeld: 10, pnlPercent: -20 },
  },

  notes: [
    {
      id: 'discipline',
      title: t('Rules to respect', '需要遵守的规则'),
      items: [
        {
          title: t('Only buy into fear', '只在恐慌中买入'),
          detail: t(
            'A new contract needs a red day. No signal, no trade — however long that takes.',
            '开新仓必须等到下跌日。没有信号就不交易，无论要等多久。',
          ),
        },
        {
          title: t('Let FIFO do the rolling', '让先进先出自动轮换'),
          detail: t(
            'At the position limit, a new signal replaces the oldest contract, keeping the book fresh.',
            '持仓已满时，新信号会替换最旧的合约，让持仓保持“新鲜”。',
          ),
        },
        {
          title: t('Never hold into the last months', '绝不持有到最后几个月'),
          detail: t(
            'The hard stop exists because time decay is most destructive near expiry.',
            '设置硬止损，是因为临近到期时时间价值衰减最具破坏性。',
          ),
        },
      ],
    },
    {
      id: 'downside',
      title: t('Know the downside', '了解下行风险'),
      items: [
        {
          title: t('Deep drawdowns still happen', '仍会出现深度回撤'),
          detail: t(
            'The source’s own backtest shows 30–50% drawdowns in major crashes such as 2008 and 2022.',
            '原文自己的回测显示，在 2008、2022 等重大崩盘中仍有 30–50% 的回撤。',
          ),
        },
        {
          title: t('Frequent exits are taxable', '频繁止盈会产生税负'),
          detail: t(
            'Short holding periods turn most gains into short-term taxable events.',
            '持有期短，多数收益会成为短期应税事件。',
          ),
        },
      ],
    },
  ],
};
