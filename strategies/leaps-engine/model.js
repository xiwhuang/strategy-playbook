import { clamp, describe, dropPhrase, fmt, moveToday, passes, share, t } from '../kit.js';

/**
 * LEAPS Engine model. Every threshold and size comes from `config.rules`.
 *
 * Unlike a single if/else chain, rules are evaluated independently, because
 * more than one can apply: a position deep underwater near expiry needs a
 * renewal roll *and* may qualify for a dip buy. A harvest roll also resets
 * time, so it covers a renewal on the same position.
 */
const yesNo = (value) => (value ? t('yes', '是') : t('no', '否'));

export function evaluate(values, config) {
  const r = config.rules;
  const U = r.underlying;

  /* -- inputs --------------------------------------------------------------- */
  const total = clamp(values.portfolioValue, 10000, 10000000);
  const hasPosition = values.hasPosition !== false;
  const move = clamp(values.qqqMove, -20, 20);
  const delta = clamp(values.delta, 0, 1);
  const dte = clamp(values.dte, 0, 3650);
  const cashPercent = clamp(values.cashPercent, 0, 100);
  const daysSinceLastAdd = clamp(values.daysSinceLastAdd, 0, 3650);

  /* -- setup allocation ----------------------------------------------------- */
  const leapsAmount = share(total, r.allocation.leapsPercent);
  const cashSetupAmount = share(total, r.allocation.cashPercent);
  const floorPercent = r.dip.cashAfterAdd.value;
  const floorAmount = share(total, floorPercent);
  const spec = t(
    `${fmt(r.contract.delta)}-delta calls with ${r.contract.dteMin}–${r.contract.dteMax} days to expiry`,
    `${fmt(r.contract.delta)} Delta、剩余 ${r.contract.dteMin}–${r.contract.dteMax} 天的看涨期权`,
  );

  /* -- entry ---------------------------------------------------------------- */
  const drop = -move;
  const entrySignal = passes(drop, r.entry.drop);
  const entryText = describe(`${U} drop`, r.entry.drop, '%'); // formula form, for the drawer
  const entryPhrase = dropPhrase(U, r.entry.drop);

  /* -- management rules ----------------------------------------------------- */
  const harvest = passes(delta, r.harvest.delta);
  const renew = passes(dte, r.renew.dte);
  const dipTriggered = passes(delta, r.dip.delta);
  const heavy = passes(cashPercent, r.dip.heavyMode);
  const dipAddPercent = heavy ? r.dip.heavyAddPercent : r.dip.normalAddPercent;
  const dipAddAmount = share(total, dipAddPercent);
  const cashAfterAddPercent = cashPercent - dipAddPercent;
  const cooling = daysSinceLastAdd < r.dip.cooldownDays;
  const floorBreached = !passes(cashAfterAddPercent, r.dip.cashAfterAdd);
  const dipBlocked = dipTriggered && (cooling || floorBreached);
  const dipActive = dipTriggered && !dipBlocked;
  const renewCovered = renew && harvest;

  const harvestText = describe('Delta', r.harvest.delta);
  const renewText = describe('DTE', r.renew.dte);
  const dipText = describe('Delta', r.dip.delta);
  const heavyText = describe('cash', r.dip.heavyMode, '%');

  const blockReasons = [];
  if (dipTriggered && cooling) {
    const wait = r.dip.cooldownDays - daysSinceLastAdd;
    blockReasons.push(
      t(
        `Only ${fmt(daysSinceLastAdd, 0)} days since the last dip buy — wait ${fmt(wait, 0)} more.`,
        `距上次加仓仅 ${fmt(daysSinceLastAdd, 0)} 天——还需等待 ${fmt(wait, 0)} 天。`,
      ),
    );
  }
  if (dipTriggered && floorBreached) {
    blockReasons.push(
      t(
        `Adding ${dipAddPercent}% would leave ${fmt(cashAfterAddPercent, 1)}% cash, not above the ${floorPercent}% floor.`,
        `加仓 ${dipAddPercent}% 后现金仅剩 ${fmt(cashAfterAddPercent, 1)}%，未高于 ${floorPercent}% 的底线。`,
      ),
    );
  }
  const joinReasons = (lang) => blockReasons.map((reason) => reason[lang]).join(' ');

  /* -- decision lanes ------------------------------------------------------- */
  const lanes = [];

  if (!hasPosition) {
    const moveText = moveToday(U, move);
    lanes.push({
      id: 'entry',
      title: t('Opening the setup', '建立初始仓位'),
      summary: entrySignal
        ? t(`${moveText.en}, which meets the entry rule.`, `${moveText.zh}，满足建仓规则。`)
        : t(
            `${moveText.en}. The setup waits for a day with ${entryPhrase.en}.`,
            `${moveText.zh}。建仓需等待${entryPhrase.zh}的交易日。`,
          ),
      rules: [
        {
          id: 'enter',
          title: t('Open the setup', '建仓'),
          when: entryPhrase,
          then: t(
            `Put ${r.allocation.leapsPercent}% into LEAPS, keep ${r.allocation.cashPercent}% in cash`,
            `${r.allocation.leapsPercent}% 买入 LEAPS，保留 ${r.allocation.cashPercent}% 现金`,
          ),
          status: entrySignal ? 'active' : 'idle',
          tone: 'dip',
          preset: 'enter',
        },
        {
          id: 'wait',
          title: t('Wait for a red day', '等待下跌日'),
          when: dropPhrase(U, r.entry.drop, { negate: true }),
          then: t('Stay in cash', '保持现金'),
          status: entrySignal ? 'idle' : 'active',
          tone: 'hold',
          preset: 'wait',
        },
      ],
      verdict: entrySignal
        ? {
            tone: 'dip',
            actions: [
              {
                title: t('Open the core setup', '建立核心仓位'),
                body: t(`Buy ${spec.en}. Keep the rest in cash as the reserve.`, `买入${spec.zh}，其余资金作为现金储备。`),
                facts: [
                  { label: t('Into LEAPS', '投入 LEAPS'), value: leapsAmount, kind: 'money' },
                  { label: t('Cash reserve', '现金储备'), value: cashSetupAmount, kind: 'money' },
                ],
              },
            ],
          }
        : {
            tone: 'hold',
            actions: [
              {
                title: t('Wait', '等待'),
                body: t(
                  `No entry today. The plan only opens on a day with ${entryPhrase.en}.`,
                  `今天不建仓。计划只在${entryPhrase.zh}的交易日建仓。`,
                ),
              },
            ],
          },
    });
  } else {
    const actions = [];
    if (harvest) {
      actions.push({
        title: t('Roll up and out', '向上并向后展期'),
        body: t(
          `Sell the ${fmt(delta)}-delta call and buy a ${fmt(r.harvest.rollToDelta)}-delta call with more than ${r.harvest.rollToDteMin} days left. The net credit goes to the cash reserve.`,
          `卖出 Delta ${fmt(delta)} 的看涨期权，买入 Delta ${fmt(r.harvest.rollToDelta)}、剩余超过 ${r.harvest.rollToDteMin} 天的新合约。净权利金转入现金储备。`,
        ),
      });
    }
    if (renew && !renewCovered) {
      actions.push({
        title: t('Roll out for more time', '向后展期'),
        body: t(
          `${fmt(dte, 0)} days left. Sell the call and buy the same strike with more than ${r.renew.rollToDteMin} days left — expect to pay a debit from cash.`,
          `仅剩 ${fmt(dte, 0)} 天。卖出当前合约，买入相同行权价、剩余超过 ${r.renew.rollToDteMin} 天的新合约——预计需从现金中支付差价。`,
        ),
      });
    }
    if (dipActive) {
      actions.push({
        title: heavy ? t('Buy the dip — heavy mode', '逢低加仓——重炮模式') : t('Buy the dip', '逢低加仓'),
        body: t(
          `Add ${dipAddPercent}% of the account in ${spec.en}.`,
          `用账户 ${dipAddPercent}% 的资金加仓${spec.zh}。`,
        ),
        facts: [
          { label: t('Add size', '加仓金额'), value: dipAddAmount, kind: 'money' },
          { label: t('Cash after', '加仓后现金'), value: cashAfterAddPercent, kind: 'percent' },
        ],
      });
    }
    if (actions.length === 0) {
      actions.push({
        title: t('Hold', '持有'),
        body: t(
          'No rule has triggered. Let the position work and keep the reserve.',
          '没有触发任何规则。继续持有，保留现金储备。',
        ),
      });
    }
    if (dipBlocked) {
      actions.push({
        title: t('Dip buy on hold', '逢低加仓暂缓'),
        body: t(`Delta is below ${fmt(r.dip.delta.value)}, but: ${joinReasons('en')}`, `Delta 已低于 ${fmt(r.dip.delta.value)}，但：${joinReasons('zh')}`),
        tone: 'blocked',
      });
    }

    const primaryTone = harvest ? 'profit' : dipActive ? 'dip' : renew ? 'time' : 'hold';
    const activeCount = [harvest, renew && !renewCovered, dipActive].filter(Boolean).length;

    lanes.push({
      id: 'manage',
      title: t('Managing the position', '管理仓位'),
      // Several LEAPS? Check each one: any contract can trigger a rule.
      summary:
        activeCount === 0
          ? t('Nothing has triggered — the plan says hold.', '没有触发任何规则——计划要求继续持有。')
          : activeCount === 1
            ? t('One rule applies today.', '今天适用一条规则。')
            : t(`${activeCount} rules apply today; do them in the order shown.`, `今天适用 ${activeCount} 条规则，按顺序执行。`),
      rules: [
        {
          id: 'harvest',
          title: t('Harvest profit', '止盈收割'),
          when: harvestText,
          then: t(
            `Roll up & out to ${fmt(r.harvest.rollToDelta)} delta and ${r.harvest.rollToDteMin}+ days — you collect a credit`,
            `展期至 Delta ${fmt(r.harvest.rollToDelta)}、${r.harvest.rollToDteMin} 天以上——收取权利金`,
          ),
          status: harvest ? 'active' : 'idle',
          tone: 'profit',
          preset: 'harvest',
        },
        {
          id: 'renew',
          title: t('Infinite renewal', '无限续杯'),
          when: renewText,
          then: t(
            `Roll out to ${r.renew.rollToDteMin}+ days — you pay a debit`,
            `展期至 ${r.renew.rollToDteMin} 天以上——需支付差价`,
          ),
          status: renewCovered ? 'covered' : renew ? 'active' : 'idle',
          note: renewCovered ? t('The harvest roll already resets time.', '收割展期已同时延长了时间。') : null,
          tone: 'time',
          preset: 'renew',
        },
        {
          id: 'dip',
          title: t('Buy the dip', '逆势狙击'),
          when: dipText,
          then: t(
            `Add ${r.dip.heavyAddPercent}% if ${heavyText}, else ${r.dip.normalAddPercent}%`,
            `若 ${heavyText} 加仓 ${r.dip.heavyAddPercent}%，否则 ${r.dip.normalAddPercent}%`,
          ),
          status: dipActive ? 'active' : dipBlocked ? 'blocked' : 'idle',
          note: dipBlocked ? t(joinReasons('en'), joinReasons('zh')) : null,
          tone: 'dip',
          preset: 'dip',
        },
        {
          id: 'hold',
          title: t('Hold', '持有观望'),
          when: t('No other rule applies', '没有其他规则适用'),
          then: t('Keep the position and the reserve', '保持仓位与现金储备'),
          status: activeCount === 0 ? 'active' : 'idle',
          tone: 'hold',
          preset: 'hold',
        },
      ],
      verdict: { tone: primaryTone, actions },
    });
  }

  /* -- cash gauge ------------------------------------------------------------ */
  const gauges = [];
  if (hasPosition) {
    const cashTone = !passes(cashPercent, r.dip.cashAfterAdd)
      ? 'critical'
      : !passes(cashPercent - r.dip.normalAddPercent, r.dip.cashAfterAdd)
        ? 'warning'
        : 'ok';
    const cashStatus = {
      critical: t(`At or below the ${floorPercent}% floor — no dip buys`, `已达到或低于 ${floorPercent}% 底线——不可加仓`),
      warning: t(
        `A ${r.dip.normalAddPercent}% dip buy would take cash to the floor`,
        `一次 ${r.dip.normalAddPercent}% 的加仓就会触及底线`,
      ),
      ok: heavy
        ? t(`Heavy mode — a dip buy would add ${r.dip.heavyAddPercent}%`, `重炮模式——加仓将投入 ${r.dip.heavyAddPercent}%`)
        : t(`Room for a ${r.dip.normalAddPercent}% dip buy`, `可进行一次 ${r.dip.normalAddPercent}% 的加仓`),
    }[cashTone];

    gauges.push({
      id: 'cash',
      label: t('Cash reserve', '现金储备'),
      value: cashPercent,
      min: 0,
      max: 100,
      suffix: '%',
      tone: cashTone,
      status: cashStatus,
      marks: [
        { at: floorPercent, label: t(`${floorPercent}% floor`, `${floorPercent}% 底线`), tone: 'critical', align: 'start' },
        {
          at: r.dip.heavyMode.value,
          label: t(`${r.dip.heavyMode.value}% heavy mode`, `${r.dip.heavyMode.value}% 重炮模式`),
          tone: 'ok',
          align: 'start',
        },
      ],
      note: t('Cash is the defence: it funds dip buys and renewal rolls.', '现金是防线：用于逢低加仓与续期展期。'),
    });
  }

  return {
    metrics: {
      total,
      hasPosition,
      move,
      delta,
      dte,
      cashPercent,
      daysSinceLastAdd,
      leapsAmount,
      cashSetupAmount,
      entrySignal,
      harvest,
      renew,
      renewCovered,
      dipTriggered,
      dipActive,
      dipBlocked,
      heavy,
      dipAddPercent,
      dipAddAmount,
      cashAfterAddPercent,
      cooling,
      floorBreached,
    },

    allocationTitle: t('Starting setup', '初始配置'),

    allocations: [
      {
        id: 'leaps',
        label: t(`${U} LEAPS`, `${U} LEAPS`),
        description: spec,
        formula: `total × ${r.allocation.leapsPercent}%`,
        percent: r.allocation.leapsPercent,
        amount: leapsAmount,
        tone: 'options',
        items: [],
        callout: t(
          'Stands in for owning the shares, with leverage.',
          '以杠杆方式替代持有正股。',
        ),
        risk: t(
          'LEAPS can lose most of their value in a sharp decline and can expire worthless.',
          'LEAPS 在急跌中可能损失大部分价值，也可能到期归零。',
        ),
      },
      {
        id: 'cash',
        label: t('Cash reserve', '现金储备'),
        description: t('Funds dip buys and renewal rolls; harvest credits land here', '用于逢低加仓与续期展期；收割所得也转入这里'),
        formula: `total × ${r.allocation.cashPercent}%`,
        percent: r.allocation.cashPercent,
        amount: cashSetupAmount,
        tone: 'cash',
        items: [],
        rule: { label: t(`Floor after any dip buy (${floorPercent}%)`, `加仓后的现金底线（${floorPercent}%）`), amount: floorAmount },
        risk: t('Cash held in reserve earns little and loses purchasing power to inflation.', '现金储备收益有限，并会随通胀损失购买力。'),
      },
    ],

    decision: { lanes },
    gauges,

    formulas: [
      { label: t('LEAPS at setup', '初始 LEAPS'), expression: `total × ${r.allocation.leapsPercent}%`, result: leapsAmount, kind: 'money' },
      { label: t('Cash at setup', '初始现金'), expression: `total × ${r.allocation.cashPercent}%`, result: cashSetupAmount, kind: 'money' },
      { label: t('Entry signal', '建仓信号'), expression: entryText, result: yesNo(entrySignal) },
      { label: t('Harvest', '收割'), expression: harvestText, result: yesNo(harvest) },
      { label: t('Renewal', '续期'), expression: renewText, result: yesNo(renew) },
      { label: t('Dip trigger', '加仓触发'), expression: dipText, result: yesNo(dipTriggered) },
      {
        label: t('Dip add size', '加仓规模'),
        expression: `total × (${heavyText} ? ${r.dip.heavyAddPercent}% : ${r.dip.normalAddPercent}%)`,
        result: dipAddAmount,
        kind: 'money',
      },
      {
        label: t('Cash after add', '加仓后现金'),
        expression: `${fmt(cashPercent, 1)}% − ${dipAddPercent}% (must stay ${describe('', r.dip.cashAfterAdd, '%').trim()})`,
        result: `${fmt(cashAfterAddPercent, 1)}%`,
      },
      {
        label: t('Cooldown', '冷却期'),
        expression: `days since last add ≥ ${r.dip.cooldownDays}`,
        result: yesNo(!cooling),
      },
    ],

    notes: config.notes,
  };
}
