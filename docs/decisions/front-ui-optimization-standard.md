# Front UI Optimization Standard

This standard is the source of truth for the current Coinflux page optimization pass.

## Typography

- Page title: `16px / 600 / 24px`
- Section title: `15px / 600 / 22px`
- Body text: `14px / 400 / 22px`
- Labels, buttons, tabs, dropdown items, table headers: `12px / 600 / 20px`
- Secondary captions: `12px / 400 / 20px`
- Use Tailwind important utilities when global styles override local intent, for example `!text-sm !font-normal !leading-[22px]`.
- Do not use viewport-scaled font sizes or negative letter spacing.

## Spacing And Shape

- Page shell: `p-4 md:px-6 md:py-5`.
- Page content gap: `gap-5 md:gap-6`.
- Title/subtitle stack: `gap-1.5`.
- Panels and cards: `rounded-lg` (8px), `border border-[color:var(--cf-border)]`, `shadow-sm` at most.
- Tables should be compact and data-dense: header/cell vertical padding around `py-3`, not `py-6`.
- Avoid nested cards and decorative page-section cards.

## Brand Color

- Primary: `#396bff` via `--color-primary` and Tailwind `primary`.
- Secondary: `#8b5cff` via `--color-secondary` and Tailwind `secondary`.
- Main brand treatment: `bg-gradient-to-r from-primary to-secondary`.
- Direction variants are allowed for icon buttons or compact controls: `bg-gradient-to-br from-primary to-secondary`.
- Selected state for primary controls: gradient background + white text.
- Active dropdown item: full-row gradient background + white text.
- Active tab indicator: gradient underline `bg-gradient-to-r from-primary to-secondary`; optional subtle overlay `bg-gradient-to-b from-primary/10 to-transparent`.
- Focus ring/border for inputs: gradient border wrapper using `focus-within:from-primary focus-within:to-secondary focus-within:bg-gradient-to-r`.
- Do not replace primary selected states with flat `bg-primary/10` unless the control is a quiet secondary affordance.

## Interaction

- Use lucide icons.
- All clickable cards/buttons need `cursor-pointer`.
- Hover should use color, background, border, or opacity transitions.
- Avoid `active:scale-*` and hover scale because it can make dense UIs feel unstable.
- Transitions should be short: `transition-colors`, `transition-opacity`, or `duration-150/200/300`.

## Data Pages

- Preserve horizontal scroll affordances for wide tables.
- No page-level horizontal overflow on 375px, 768px, 1024px, and 1440px.
- Sticky table columns must keep readable widths and avoid text overlap.
- Table text should align with the typography scale above; avoid `md:text-sm` on dense table bodies unless the row has enough height.

## Modal Standard

- Modal title/content headings: `15px / 600 / 22px`.
- Modal body: `14px / 400 / 22px`.
- Modal meta/labels: `12px / 400-600 / 20px`.
- Modal icon/logo blocks: usually `32-36px`, `rounded-lg`.

## Verification

- Run focused `eslint` for touched files.
- Run focused `dx test unit front <file>` for affected tests.
- Browser-check desktop and mobile:
  - no horizontal overflow;
  - title/subtitle computed sizes match standard;
  - active states use Coinflux blue-purple gradient;
  - table/modal text does not look larger or darker than peer sections.
