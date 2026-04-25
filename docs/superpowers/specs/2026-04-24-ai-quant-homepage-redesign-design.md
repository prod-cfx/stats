# AI Quant Homepage Screenshot-Faithful Redesign Spec

## Goal

Redesign the public AI Quant homepage to closely match the supplied reference screenshots: a premium dark, blue-purple, beginner-friendly landing page with centered hero typography, restrained section rhythm, glass UI illustrations, and subtle motion. The redesign must apply to both Chinese and English content and support both dark and light themes.

## Scope

In scope:

- Rework the public homepage rendered by `AiQuantMarketingHome`.
- Preserve the existing route and CTA target: `/{lng}/ai-quant`.
- Update Chinese and English homepage copy to share the same information architecture.
- Build the screenshot-like visuals as code-driven UI/SVG mockups instead of static image files.
- Add subtle animations for ambient light, particles, UI reveal, chart growth, deployment rings, and floating cards.
- Verify desktop and mobile layouts in dark and light themes.

Out of scope:

- Changing AI Quant product flow pages after the CTA.
- Adding new backend APIs or data dependencies.
- Introducing a design-system-wide refactor.
- Using external image assets for the homepage illustrations.

## Visual Direction

Use approach A from the visual review: high-fidelity reconstruction of the screenshots.

Dark theme should be the primary, reference-matching experience:

- Near-black backgrounds with section bands.
- Blue and violet radial glows.
- Thin diagonal lines and sparse particle dots in the hero.
- Low-contrast glass panels with fine borders.
- Strong white headings and muted gray body text.
- Blue/violet gradient CTA buttons.

Light theme should preserve the same composition and hierarchy without becoming a simple inverted dark page:

- Soft off-white backgrounds with light gray section bands.
- Deep slate text.
- Pale blue/violet glows.
- Frosted white panels with subtle blue-gray borders.
- Same CTA gradient and interaction behavior.

## Page Structure

The page becomes a single-column landing narrative matching the screenshot order:

1. Hero
   - Centered pill label.
   - Large centered headline.
   - Gradient emphasis on `AI 量化` / the English AI phrase.
   - Short description and primary CTA.
   - Ambient background with glow, particles, and fine lines.

2. Four-step workflow
   - Title: "4 步完成自动交易" and localized English equivalent.
   - Four equal cards on desktop.
   - Two columns or one column on smaller screens.
   - Card content: idea, AI strategy generation, backtest decision, deployment.

3. Conversation strategy creation
   - Text block plus code-built visual.
   - Visual includes AI prompt, user prompt, processing state, and three generated strategy rows.

4. Backtest validation
   - Text block plus code-built chart visual.
   - Visual includes bars, equity curve, return, and win-rate metrics.

5. One-click deployment
   - Text block plus code-built deployment visual.
   - Visual includes concentric rings, glowing center control, and deploy label.

6. Strategy plaza
   - Text block plus floating strategy cards.
   - Visual includes a highlighted strategy card with performance value and smaller background cards.

7. Beginner advantages
   - Two-by-two desktop grid.
   - Large low-opacity numbers.
   - Four benefits: low barrier, understandable logic, validation before live trading, controllable process.

8. Final CTA
   - Centered glass panel.
   - Short headline, description, and primary CTA.

## Component Design

Keep implementation focused in `apps/front/src/components/ai-quant/AiQuantMarketingHome.tsx`.

Recommended internal component boundaries:

- `HeroSection`
- `WorkflowSection`
- `FeatureSection`
- `ConversationStrategyVisual`
- `BacktestResultVisual`
- `DeployOrbitVisual`
- `StrategyPlazaVisual`
- `AdvantageSection`
- `FinalCtaSection`
- Small local helpers for theme-aware panel classes and animation variants if they reduce repetition.

These components should stay local to the homepage unless another page needs them later.

## Motion Design

Use the existing `framer-motion` dependency already used by the current homepage.

Motion should be subtle and professional:

- Hero background glows breathe slowly.
- Particles drift lightly.
- Sections fade and rise on first viewport entry.
- Workflow cards lift slightly on hover.
- Conversation strategy rows stagger into view.
- Backtest bars grow upward and the equity curve draws in.
- Deploy rings pulse or rotate slowly.
- Strategy plaza cards float gently.

Respect usability:

- Avoid fast flashing or aggressive looping.
- Keep text stable and readable.
- Do not make layout dimensions depend on animation state.

## Content And Localization

Update both locale files:

- `apps/front/public/locales/zh/common.json`
- `apps/front/public/locales/en/common.json`

Chinese copy should stay close to the screenshots, including the beginner-oriented "小白" positioning.

English copy should communicate the same value proposition without becoming literal or awkward:

- AI strategy creation from natural language.
- Backtesting before deployment.
- One-click deployment after confirmation.
- Beginner-friendly, understandable, controllable automation.

## Theme Strategy

The component must support both light and dark mode using Tailwind theme variants and existing theme behavior.

Implementation guidance:

- Avoid hardcoding only dark backgrounds on the root.
- Use paired light/dark classes for page background, section bands, text, panel backgrounds, borders, and glows.
- Keep brand CTA colors consistent across themes.
- Verify no low-contrast text appears in either mode.

## Responsiveness

Desktop should prioritize screenshot fidelity with wide spacing and large visual compositions.

Mobile should prioritize readability:

- Hero headline scales down without wrapping awkwardly.
- Four workflow cards collapse cleanly.
- Feature sections stack text and visuals.
- Visual mockups keep stable aspect ratios and do not overflow horizontally.
- Buttons and cards keep touch-friendly sizing.

## Testing And Verification

Minimum verification:

- Run the relevant frontend type/lint or unit check available for the changed surface.
- Start the frontend with the project `dx` command if visual verification is needed.
- Inspect the homepage in dark and light themes.
- Inspect Chinese and English pages.
- Inspect desktop and mobile viewport widths.
- Confirm CTA links still navigate to `/{lng}/ai-quant`.

Visual acceptance criteria:

- Dark theme clearly resembles the provided screenshots in layout, color, spacing, and UI illustration style.
- Light theme is polished and intentionally designed, not a broken inversion.
- Animated visuals render from code and do not appear blank.
- No text overlaps, clips, or overflows in common desktop/mobile sizes.

## Risks

- Exact pixel-perfect reconstruction is not possible from screenshots alone because original design tokens, source layers, and animation specs are unavailable.
- The current component is single-file; the redesign must keep local boundaries clear to avoid turning it into an unmaintainable blob.
- English strings may be longer than Chinese strings and need responsive constraints.

## Open Decisions

All key decisions are resolved:

- Use the high-fidelity screenshot reconstruction direction.
- Support Chinese and English.
- Support dark and light modes.
- Build visuals in code with subtle animations.
