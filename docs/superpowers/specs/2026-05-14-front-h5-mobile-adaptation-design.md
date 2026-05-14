# apps/front H5/mobile adaptation design

## Background

The project is an Nx monorepo. The H5/mobile adaptation scope for this design is `apps/front`, the user-facing Next.js App Router application. `apps/admin-front` is not included in this round because it is a separate admin workflow with different mobile priorities.

The current front application already has partial responsive behavior, but several user journeys are still desktop-first: trading views, data tables, AI Quant flows, dashboards, charts, account strategy pages, and modal-heavy operations. The design treats the work as a full user-reachable-flow audit, not only a top-level page audit.

## Goals

- Make all major `apps/front` user-facing flows usable at `375px` mobile width and `768px` tablet width.
- Preserve existing desktop behavior and layout unless a change is required to keep the responsive model consistent.
- Cover pages, navigation entries, account menu entries, CTA destinations, list actions, detail pages, return paths, modals, popovers, dropdowns, sheets, and toasts.
- Split delivery into an epic plus independent child issues and PRs.
- Keep implementation scoped to responsive layout and interaction changes. Do not change APIs, business state semantics, or backend contracts for this initiative.

## Non-goals

- `apps/admin-front` mobile adaptation.
- Backend, Quantify, API contract, or data model changes.
- Visual rebrand or broad desktop redesign.
- Rebuilding mobile-only versions of every page from scratch.
- Shipping hidden pages in the first implementation batch unless product explicitly includes them.

## Chosen approach

Use **Mobile Interaction Layer first, Progressive Responsive where sufficient**.

- Simple pages use progressive responsive fixes: spacing, wrapping, grids, widths, and overflow containment.
- Complex pages use mobile-specific interaction patterns: tabs, bottom sheets, sticky action bars, and card/table switch views.
- Desktop layouts remain the source of truth where they already work.
- Shared mobile primitives and conventions are introduced first so page PRs do not invent incompatible patterns.
- A mobile-first rewrite is avoided unless one specific page proves impossible to adapt safely.

## Scope model

The audit unit is:

1. Entry point.
2. Destination page or in-page state.
3. Primary actions.
4. Triggered overlays.
5. Return path and error/loading/empty states.

This prevents missing secondary pages such as strategy details, backtest reports, account tabs, and modal-only workflows.

## Covered flows

### Global navigation and shell

- `Navbar`
- `Footer`
- language switcher
- theme toggle
- notification bell popover
- account dropdown
- mobile navigation menu
- global modal/toast behavior

### Data navigation

Navigation-reachable data pages:

- `/market`
- `/long-short-ratio`
- `/aggregated-orderbook`
- `/prediction-market`
- `/public-companies`

Code-present but currently hidden pages are tracked separately:

- `/liquidation-map`
- `/liquidation-data`

These hidden pages should be listed in the epic audit and scheduled only if product decides to include them.

### Whale navigation

- `/whale-tracking/discover`
- `/whale-tracking/realtime`
- `/whale-tracking/holdings`
- `/whale-tracking/notifications`
- `/whale-tracking/profile`

The monitor flow includes create-monitor modals, rule operations, inbox cards, realtime whale tables, and notification dropdown behavior.

### AI Quant and account flows

- `/ai-quant`
- `/ai-quant/plaza`
- `/ai-quant/backtest/[id]`
- `/account?tab=settings`
- `/account?tab=ai-quant`
- `/account/ai-quant/strategy/[id]`
- API settings entry: `/account?tab=settings#exchange-api`

The AI Quant scope includes:

- chat flow
- parameter/configuration areas
- strategy creation and edit sessions
- backtest summaries and reports
- deployment flow
- strategy plaza cards
- account strategy list
- strategy detail page
- stop/delete/edit-guard dialogs
- deploy dialog
- deletion dialogs
- auth/publication/clarification gates

### Dashboard

- dashboard list
- dashboard view
- dashboard editor
- add widget modal
- rename/delete confirmations
- widget configuration

Dashboard editing is a separate child issue because `react-grid-layout` mobile editing behavior is high risk. The likely mobile strategy is to preserve view mode first and handle edit mode with constrained interactions, preset layouts, or list-like controls.

### Overlays and modals

All overlays are first-class audit items:

- global confirm dialog
- shared modal component
- toast
- dropdown menus
- notification popover
- account popover
- mobile menu
- AI Quant deploy, delete, stop, running-edit-guard dialogs
- whale monitor create modal
- dashboard add-widget/configuration/rename/delete overlays
- strategy and backtest action overlays

## Shared responsive conventions

Introduce or standardize these shared patterns before page-level work:

- Page shell/container rules for mobile padding, safe area, and max width.
- Responsive action bar: desktop inline actions, mobile sticky bottom actions where needed.
- Responsive tabs for complex pages with many panels.
- Mobile sheet for complex forms, filters, and action panels.
- Responsive data view convention: desktop table, mobile cards where practical.
- Horizontal scroll hint wrapper for data that must remain table-like.
- Chart container sizing rules with stable min heights and resize-safe widths.

These can be implemented as components or conventions depending on existing local patterns. The implementation plan should decide exact file paths after reviewing current shared UI components.

## Page behavior rules

- No `body` horizontal scrolling at `375px` or `768px`.
- Any necessary horizontal scroll must be contained inside the specific table/chart/metrics region.
- Navigation entries must remain reachable on mobile, including Data, Whales, account, notifications, strategy plaza, and create strategy actions.
- Mobile dialogs must fit within `calc(100vw - 32px)` or become bottom sheets for complex forms.
- Long modal content must scroll internally without losing the primary action.
- Toasts must not cover mobile sticky actions.
- Chart views need explicit dimensions and must render nonblank at target widths.
- Tablet (`768px`) should use compact two-column or desktop-like layouts where suitable instead of forcing every page into a phone-only sheet pattern.
- Chinese and English text must be checked because labels and buttons have different widths.
- Light and dark themes must both be checked.

## Data and state rules

- Do not change API contracts or backend data shape.
- Continue using existing `apps/front/src/lib/api*.ts`, hooks, and stores.
- Do not add ad hoc component-level `fetch` or `axios` calls for this adaptation.
- Mobile table-to-card conversion must preserve existing data fields, filtering, sorting, pagination, and action semantics.
- Loading, empty, and error states must be responsive and must not force horizontal overflow.
- Route changes should close mobile menus, sheets, and popovers.
- Escape key and overlay click behavior should remain consistent where currently supported.

## Issue and PR plan

### Epic

Title: `apps/front` H5/mobile adaptation audit and phased delivery

Epic responsibilities:

- Own full page, chain, and overlay inventory.
- Track acceptance criteria and risk decisions.
- Link child issues and PRs.
- Record hidden-page decisions.
- Not carry broad implementation changes directly.

### Child issues

1. Foundation and global navigation.
   - Shared mobile conventions or primitives.
   - Navbar, Footer, notification/account/language/theme/mobile menu behavior.
   - Acceptance: all global entries reachable on 375px and 768px.

2. AI Quant main chain.
   - `/ai-quant`, `/ai-quant/plaza`, `/ai-quant/backtest/[id]`, `/account?tab=ai-quant`, `/account/ai-quant/strategy/[id]`, relevant account settings entry.
   - Include deploy, delete, stop, edit guard, auth/publication/clarification overlays.

3. Data pages.
   - `/market`, `/long-short-ratio`, `/aggregated-orderbook`, `/prediction-market`, `/public-companies`.
   - Track hidden liquidation pages separately.

4. Whale pages.
   - Discover, realtime whales, holdings, monitor/notifications, profile.
   - Include monitor creation and rule/inbox operations.

5. Dashboard mobile experience.
   - Dashboard list, view, editor, widgets, and widget overlays.
   - Decide mobile editing behavior separately due to `react-grid-layout`.

6. Final audit and closure.
   - Full route/overlay checklist.
   - Screenshot/manual browser pass at 375px and 768px.
   - i18n and theme pass.
   - Residual issues documented or fixed.

### Dependencies

- Child issue 1 is first and should land before most page work.
- Child issues 2, 3, 4, and 5 can proceed in parallel after foundation lands.
- Child issue 6 is last.
- Each child issue should map to one independent PR.

## Acceptance criteria

For each child issue:

- No body-level horizontal overflow at `375px` and `768px`.
- Primary page actions are reachable and tappable.
- Text does not overflow buttons, cards, tabs, table headers, or action bars.
- Charts render nonblank and are correctly framed.
- Tables have either mobile card/list views or contained horizontal scrolling.
- Modals, dropdowns, popovers, sheets, and toasts can open, close, and scroll when needed.
- Loading, empty, and error states are usable on mobile.
- Chinese and English strings do not break layout.
- Light and dark themes remain usable.
- Desktop behavior is spot-checked for regressions.

## Verification plan

Run from repository root:

```bash
dx lint
dx test unit front
dx build front --dev
```

For implementation PRs, add focused front unit tests where behavior changes are testable. Use browser verification with `375px`, `768px`, and a desktop viewport for each affected page or overlay family.

## Risks

- AI Quant pages are stateful and large, so layout changes can accidentally alter behavior if not kept presentation-only.
- Trading/chart pages can initialize blank when container sizing changes.
- Table-heavy data pages may need careful mobile card designs to avoid losing scanability.
- Dashboard editor mobile behavior is not a simple responsive change because drag/resize interactions do not map cleanly to touch.
- Overlay changes can regress focus, close behavior, or scroll locking if each page implements its own pattern.

## Implementation planning inputs

- Shared component names and file paths should be chosen during the implementation plan after a focused review of existing `apps/front/src/components/ui`, layout, and feature-local component patterns.
- Hidden liquidation pages are deferred out of the first data-page PR by default and remain tracked in the epic audit.
- Dashboard mobile view mode should be adapted first. Phone edit mode should avoid freeform drag/resize and use preset layout controls or list-like widget management. Tablet edit mode can keep constrained grid behavior if browser verification shows it is usable.
- Action-oriented tables should become mobile cards. Dense numeric matrices can keep contained horizontal scrolling with an explicit scroll hint.
