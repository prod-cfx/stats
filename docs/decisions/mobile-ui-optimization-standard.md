# Mobile UI Optimization Standard

This standard is the source of truth for mobile-first pages that should follow the attached dark purple profile / drawer references.

## Visual Direction

- Overall mood: immersive mobile app, dark purple, soft layered panels, compact but not dense.
- Primary surface should feel like an app screen, not a desktop data table squeezed into mobile.
- Use real content first: profile, actions, account settings, messages, and navigation should be immediately usable.
- Avoid landing-page composition, giant headers, marketing cards, and empty decorative space.

## Color System

- Page background: near-black purple, e.g. `#070315` or existing dark app background token.
- Primary panel: deep purple, e.g. `#171039` to `#1d1545`.
- Elevated panel: slightly brighter purple, e.g. `#21164d`.
- Highlight panel / profile card: muted purple radial or linear gradient, e.g. `from-[#5b2f68] via-[#3a1f59] to-[#231447]`.
- Border: soft purple border, e.g. `border-white/10` or tokenized equivalent.
- Primary accent: pink-purple, e.g. `#f472d0`, used for active outlines, selected nav, small badges.
- Secondary accent: blue-cyan only for status/icon highlights, not broad backgrounds.
- Danger: red outline/text only for destructive actions.
- Do not use beige/brown/orange or flat gray desktop palettes on these mobile pages.

## Typography

- Mobile page title: `20px / 700 / 28px`.
- Section title: `17px / 700 / 24px`.
- Card title / user name: `18px / 700 / 26px`.
- Body text: `14px / 400 / 22px`.
- Labels, nav items, badges, buttons: `12px / 600 / 20px`.
- Helper text and captions: `12px / 400 / 18-20px`.
- Numeric stats can use `18-20px / 700`, but only for true stats.
- Do not use viewport-scaled font sizes or negative letter spacing.

## Mobile Shell

- Safe width target: design and test at `390px`, also verify `375px`.
- Page padding: `px-4 py-4`; content gap: `gap-4`.
- Top bar height: `56px`; fixed or sticky only when needed.
- Top search should be pill-shaped, height `36px`, dark purple surface, icon left, placeholder muted.
- Header avatar: `36px`; inside drawer/profile hero avatar can be `72-88px`.
- Bottom navigation height: `72px` including safe-area padding; use 3-5 items max.
- Bottom nav must not cover primary content; add bottom padding such as `pb-24`.

## Drawer Standard

- Drawer width: `260px` on `390px` viewport, max `72vw`.
- Drawer background: deep purple `#130b31` style surface.
- Drawer border: right `1px` soft purple border.
- Drawer top spacing: `pt-4`, internal padding `px-3`.
- User block:
  - Avatar `40-44px`.
  - Name `16px / 700 / 24px`.
  - Points or ID `12px / 600 / 18px`.
  - Membership badge `12px / 600 / 18px`, pink outline.
- Nav item:
  - Height `44px`.
  - Icon `18px`.
  - Radius `10-12px`.
  - Gap `12px`.
  - Active state: pink outline + subtle transparent fill, not a large solid block.
  - Inactive state: muted text, hover/press only changes background or text color.
- Drawer footer:
  - Utility icon buttons `32px`, circular, border `white/10`.
  - Copyright/caption `11-12px`, muted.
- Avoid huge drawer items, nested cards, and desktop dropdown patterns inside drawer.

## Profile Header Card

- Card radius: `18-20px`; use larger radius here only, because it is a hero/profile surface.
- Card padding: `20px`.
- Card background: soft purple gradient, with no harsh glow blobs.
- Avatar: `76-88px`, circular, clear border ring `2px`.
- User name and join date should sit in same row when possible.
- ID pill:
  - Height `24px`.
  - Monospace ID text `12px / 600`.
  - Copy icon `12-14px`.
- Badges:
  - Height `24px`.
  - Radius full.
  - Use subtle translucent fill and soft border.
  - Keep badge text `12px / 600`.
- Stats row:
  - Number `18-20px / 700`.
  - Label `12px / 400`.
- Edit/action button:
  - Height `36px`.
  - Rounded full or `12px`.
  - Muted translucent fill.

## Cards And Sections

- Standard card radius: `14-16px`.
- Standard card padding: `16px`.
- Border: `1px solid white/10`.
- Background: `#171039` / token equivalent.
- Section gap: `16px`.
- Card internal row gap: `12px`.
- Do not put cards inside cards unless the inner card is a repeated account row or input group.
- For account binding rows:
  - Row height: `76px` minimum.
  - Icon block: `44px`, rounded `12px`.
  - Title `15-16px / 600`.
  - Subtitle `13-14px / 400`.
  - Action button height `32-36px`.

## Forms

- Input height: `40px`.
- Input background: darker nested surface.
- Border: soft purple `white/10`.
- Radius: `8-10px`.
- Label: `13-14px / 600`.
- Placeholder: muted, not brighter than body text.
- Password visibility uses lucide icon button `32px`, no text.
- Primary form button height: `40px`, radius `10px`.
- Warning/info blocks:
  - Background: muted purple fill.
  - Border optional, soft.
  - Icon `14-16px`.
  - Body text `13px / 400 / 20px`.

## Navigation

- Top-left menu button: `36px` circle, border `white/10`, icon `18px`.
- Top-right avatar: `36px` circle.
- Bottom nav:
  - Fixed bottom.
  - Background matches page but slightly elevated.
  - Top border `white/8`.
  - Icon `18-20px`.
  - Label `11-12px`.
  - Active item uses text/icon accent, not a large filled tab.
- Avoid desktop top nav/dropdown patterns on mobile screens.

## Interaction

- Use lucide icons or app-provided icon system. No emoji as icons.
- All tappable controls need minimum hit target `36px`, preferred `40-44px`.
- Use `transition-colors` / `transition-opacity`; no `active:scale-*` or hover scale.
- Press states should not shift layout.
- Drawer close/back button should be obvious and reachable with thumb.
- Destructive actions require red styling and clear copy.

## Mobile Data Pages

- Tables should become cards on mobile whenever possible.
- If a table must remain, wrap in horizontal scroll and preserve header readability.
- Avoid desktop-style large empty table containers on mobile.
- Keep mobile card rows scannable: label above value, two-column grid only when labels fit.
- Add `pb-24` when fixed bottom navigation exists.

## Accessibility

- Text contrast must meet WCAG AA on dark purple surfaces.
- Do not rely only on color for status; pair with label or icon.
- Inputs need labels or accessible names.
- Icon-only buttons need `aria-label`.
- Respect `prefers-reduced-motion`.

## Anti-Patterns

- Huge desktop avatars in the nav bar.
- Desktop dropdown menus on mobile.
- Giant solid selected blocks in drawer navigation.
- Nested decorative cards with no functional purpose.
- Over-bright gradients or glow blobs that obscure content.
- Tiny tap targets below `36px`.
- Text larger than the card hierarchy allows.

## Verification

- Browser-check at `375px`, `390px`, and one tall mobile viewport.
- Confirm no horizontal overflow.
- Confirm bottom nav does not cover content.
- Confirm drawer width and selected item match the reference proportions.
- Confirm avatar sizes: top bar `36px`, drawer `40-44px`, profile hero `76-88px`.
- Run focused `eslint` for touched files.
- Run focused `dx test unit front <file>` when layout tests or shared components change.
