# Strategy Playbook · 策略手册

A bilingual (EN / 中文) website for exploring portfolio and options strategy
rules interactively. No build step, no runtime dependencies — it is served as
plain files by GitHub Pages and works on a phone.

> Educational illustration only. Nothing here is investment advice.

## Strategies

| Strategy | What it shows |
| --- | --- |
| **Age + 20 Cash Flow Waterfall** | Core / options / cash split by age and income, and a one-way waterfall that turns options proceeds into cash and then core holdings. |
| **QQQ LEAPS Engine** | 60% deep-ITM LEAPS / 40% cash, and four management rules: harvest, renewal, buy-the-dip, hold. |
| **QQQ Golden Ratio** | 70% core / 25% in five 5% call slots / 5% cash, a strict entry signal with FIFO rotation, and a time-stepped exit ladder. |

### How the two LEAPS plans were encoded

Both come from written plans ("The QQQ LEAPS Game Plan" and "QQQ LEAP
Execution Plan: The Golden Ratio Strategy"). Where an earlier HTML dashboard
disagreed with the plan, the plan won:

- **Strict vs. inclusive thresholds follow the text.** LEAPS: Δ > 0.9, Δ < 0.5,
  DTE < 300, entry on a drop of *at least* 1%. Golden Ratio: entry on a drop of
  *more than* 1%.
- **The LEAPS dip buy enforces its safety checks.** Cash must stay above 10%
  after the add, and adds are 30 days apart. When either fails the rule shows
  as *On hold* with the reason, instead of recommending the buy.
- **Several LEAPS rules can apply at once** (e.g. a renewal roll and a dip buy)
  and are listed in order. A harvest roll also resets time, so it covers a
  renewal on the same position.
- **Golden Ratio's entry and exit are separate decisions** — one is about the
  portfolio today, the other about a single contract — so both are shown.
- **The ladder's gap is closed explicitly.** The plan lists 0–4, 4–6 and 7–9
  months; months 6–7 fall into the +10% tier (`upToMonths` in config).
- The Golden Ratio plan's headline backtest figures are not reproduced on the
  page; its stated drawdowns (30–50% in major crashes) are.

## Run it locally

```bash
python -m http.server 8777
```

Then open <http://localhost:8777>. (Opening `index.html` directly also works in
most browsers, but ES modules are happiest over http.)

## Test

```bash
npm test
```

Uses Node's built-in test runner — nothing to install. Each strategy has its
own suite pinning its rules (including every boundary above), and
`strategies/registry.test.js` checks the descriptor contract for every
registered strategy, its defaults and each of its presets.

## How it is put together

```
index.html               page shell, fonts, favicon, meta
app.js                   the shared UI — knows nothing about any one strategy
styles.css               the "Sketch" design system
fonts/                   xkcd Script (self-hosted) + its licence
strategies/
  kit.js                 t(), clamp(), thresholds, defineStrategy(), withConfig()
  registry.js            the list of strategies + the contract validator
  <strategy>/
    config.js            every rule, threshold, size and tier; inputs; layout; copy
    model.js             evaluate(values, config) — interprets the config
    index.js             binds the two
    <strategy>.test.js
  _template/             a working starting point for a new strategy
```

### Config drives everything

A strategy's `config.js` holds every number it decides with, under `rules`.
Thresholds are data — `{ op: '>' | '>=' | '<' | '<=', value }` — so whether a
rule is strict or inclusive is written down rather than buried in code. Copy
that quotes a rule is a function of `rules`, so changing one number updates the
rule cards, helper text, formulas and verdicts together.

Because of that, a variant is just a config patch:

```js
const conservative = leapsEngineStrategy.withConfig({
  id: 'leaps-engine-conservative',
  shortName: { en: 'LEAPS 50/50', zh: 'LEAPS 50/50' },
  rules: { allocation: { leapsPercent: 50, cashPercent: 50 } },
});
```

### Add a strategy

1. Copy `strategies/_template/` to `strategies/<your-strategy>/` and drop the
   `.example` suffixes.
2. Fill in `config.js` (rules, inputs, groups, layout, presets, notes) and
   `model.js`.
3. Import it in `strategies/registry.js` and add it to `STRATEGIES`.
4. Run `npm test` — the contract check says exactly what is missing.

The page builds itself from the descriptor:

- each entry in `groups` is a **numbered step** holding that group's controls;
- `layout` places outputs inside steps: `allocations`, `flow`, `decision`
  (or `decision:<laneId>`), `risk`, `formulas`;
- a **decision lane** is a set of rules, each with a status (*Triggered*,
  *On hold*, *Not yet*, *Covered*, *Not triggered*), plus a verdict; a rule
  with a `preset` gets a *Try this case* button that loads example inputs;
- **gauges** are scales with threshold marks and a status sentence, so state is
  never shown by colour alone;
- the strategy picker appears once there are two or more strategies.

## Behaviour worth knowing

- **Sharing.** The address bar always carries the current strategy, language
  and inputs, so *Share link* shares exactly what is on screen.
- **Privacy.** Values are stored only if you tick *Remember my values on this
  device*. Language and theme preferences are stored.
- **Copy summary** produces plain text of the scenario, verdicts and
  disclaimer. If the browser blocks the clipboard, the text is shown to copy by
  hand.
- **Accessibility.** Visible labels on every control, keyboard access to the
  chart through its legend, focus kept across updates, no colour-only states,
  and `prefers-reduced-motion` respected.

## Fonts and licensing

The handwritten display face is **xkcd Script**, from Randall Munroe's
handwriting, self-hosted in `fonts/` (see `fonts/README.md`). It is licensed
**CC BY-NC 3.0**:

- **NonCommercial** — this site must stay non-commercial. If that changes,
  swap `--font-hand` in `styles.css` for a differently licensed face.
- **Attribution** — the credit in the page footer satisfies the licence and
  must stay while the font is used.

It has no CJK glyphs, so Chinese headings fall back to Kaiti. Body text uses
Nunito and figures use JetBrains Mono (Google Fonts), with local fallbacks.

## Publishing

`.github/workflows/deploy.yml` runs the tests and publishes the site to GitHub
Pages on every push to `main`. Pages must be set to **Settings → Pages →
Source: GitHub Actions**.
