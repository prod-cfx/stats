# apps/front H5 Mobile Adaptation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver an `apps/front` H5/mobile adaptation program through one umbrella epic and six independent child issues/PRs, covering all user-reachable pages, chains, and overlays at `375px` and `768px`.

**Architecture:** Treat the work as a phased responsive program. First land shared mobile conventions and global navigation changes, then adapt AI Quant, data pages, whale pages, and dashboard flows in separate PRs, followed by a final route/overlay audit. Keep changes presentation-only unless a child issue explicitly proves a local state boundary needs adjustment.

**Tech Stack:** Nx 19, Next.js App Router, React 19, TypeScript 5.9, Tailwind CSS 4, Jest/ts-jest, existing `dx` command system.

---

## Source Documents

- Design spec: `docs/superpowers/specs/2026-05-14-front-h5-mobile-adaptation-design.md`
- Global workflow: `/Users/mac/.codex/AGENTS.md`
- Project rules:
  - `ruler/development.md`
  - `ruler/architecture.md`
  - `ruler/conventions.md`
  - `ruler/git-workflow.md`
  - `ruler/parallel-execution.md`

## Scope Boundary

This is an umbrella implementation plan. The design covers multiple independent page families, so implementation must be split into child issues and child PRs. Do not implement all mobile adaptation in one branch or one PR.

Main epic:

- `apps/front` H5/mobile adaptation audit and phased delivery

Child issues:

1. Foundation and global navigation.
2. AI Quant main chain.
3. Data pages.
4. Whale pages.
5. Dashboard mobile experience.
6. Final audit and closure.

## Repository State Rules

- Run commands from repository root: `/Users/mac/.codex/worktrees/4db6/stats`.
- Use `dx`, not direct `pnpm`, for build/test/start tasks.
- Do not change `apps/admin-front` in this program.
- Do not change backend, Quantify, Prisma, API contracts, or generated contracts unless a separate approved issue explicitly changes scope.
- Keep `.superpowers/` companion artifacts uncommitted.
- `docs/superpowers/` is ignored by `.gitignore`; force-add only approved spec/plan files when committing documentation.

## File Map

### Existing files likely touched by child issue 1

- `apps/front/src/components/layout/Navbar.tsx`
  - Owns desktop navigation, mobile navigation menu, data/whale/account/notification entry visibility.
- `apps/front/src/components/layout/Footer.tsx`
  - Owns footer wrapping and mobile spacing.
- `apps/front/src/app/globals.css`
  - Owns global body behavior, typography tokens, scroll utilities, and responsive helper classes.
- `apps/front/src/components/ui/Modal.tsx`
  - Shared modal shell, candidate for mobile width/height/scroll behavior.
- `apps/front/src/components/ui/ConfirmDialog.tsx`
  - Shared confirmation overlay, candidate for mobile sizing.
- `apps/front/src/components/ui/toast.tsx`
  - Toast placement, candidate for mobile sticky action avoidance.
- `apps/front/src/components/layout/LanguageSwitcher.tsx`
  - Language dropdown behavior.
- `apps/front/src/components/layout/ThemeToggle.tsx`
  - Theme toggle sizing and touch target.

### New shared files candidates for child issue 1

The implementation worker must inspect existing UI patterns before finalizing names. If no equivalent already exists, create these focused files:

- `apps/front/src/components/ui/MobileSheet.tsx`
  - Responsive sheet/dialog shell for complex mobile overlays.
- `apps/front/src/components/ui/ResponsiveActionBar.tsx`
  - Desktop inline action wrapper plus mobile sticky bottom action wrapper.
- `apps/front/src/components/ui/HorizontalScrollHint.tsx`
  - Wrapper for contained horizontal table/metrics scroll with visible mobile hint.
- `apps/front/src/components/ui/ResponsiveTabs.tsx`
  - Thin wrapper only if existing Radix/Tabs usage is inconsistent.

### Existing files likely touched by child issue 2

- `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx`
- `apps/front/src/components/ai-quant/QuantChatPanel.tsx`
- `apps/front/src/components/ai-quant/ConversationSidebar.tsx`
- `apps/front/src/components/ai-quant/DeployDialog.tsx`
- `apps/front/src/components/ai-quant/AiQuantDeletionDialog.tsx`
- `apps/front/src/components/ai-quant/StopRunningStrategyDialog.tsx`
- `apps/front/src/components/ai-quant/RunningStrategyEditGuardDialog.tsx`
- `apps/front/src/app/[lng]/ai-quant/plaza/PlazaPageClient.tsx`
- `apps/front/src/components/ai-quant/StrategyPlaza.tsx`
- `apps/front/src/app/[lng]/ai-quant/backtest/[id]/BacktestReportClient.tsx`
- `apps/front/src/app/[lng]/ai-quant/backtest/[id]/BacktestEquityChart.tsx`
- `apps/front/src/app/[lng]/account/AccountPageClient.tsx`
- `apps/front/src/components/account/AiQuantSection.tsx`
- `apps/front/src/components/account/AiQuantStrategyList.tsx`
- `apps/front/src/components/account/AiQuantStrategyDetail.tsx`
- `apps/front/src/app/[lng]/account/ai-quant/strategy/[id]/StrategyDetailPageClient.tsx`

### Existing files likely touched by child issue 3

- `apps/front/src/app/[lng]/MarketPageClient.tsx`
- `apps/front/src/components/trading/top-bar/TopBar.tsx`
- `apps/front/src/components/trading/center-chart-panel/CenterChartPanel.tsx`
- `apps/front/src/components/trading/center-chart-panel/TradingViewLightweightChart.tsx`
- `apps/front/src/components/trading/right-panel/RightPanel.tsx`
- `apps/front/src/app/[lng]/long-short-ratio/LongShortRatioClient.tsx`
- `apps/front/src/app/[lng]/aggregated-orderbook/AggregatedOrderBookClient.tsx`
- `apps/front/src/components/aggregated-orderbook/AggregatedOrderbookView.tsx`
- `apps/front/src/components/aggregated-orderbook/AggregatedOI.tsx`
- `apps/front/src/components/aggregated-orderbook/AggregatedVolume.tsx`
- `apps/front/src/components/aggregated-orderbook/OrderbookTable.tsx`
- `apps/front/src/app/[lng]/prediction-market/PredictionMarketGridClient.tsx`
- `apps/front/src/components/prediction-market/PredictionMarketGrid.tsx`
- `apps/front/src/components/prediction-market/PredictionCard.tsx`
- `apps/front/src/app/[lng]/public-companies/page.tsx`
- `apps/front/src/components/public-companies/PublicCompaniesTable.tsx`

Hidden/deferred files:

- `apps/front/src/app/[lng]/liquidation-map/LiquidationMapClient.tsx`
- `apps/front/src/app/[lng]/liquidation-data/LiquidationDataClient.tsx`

### Existing files likely touched by child issue 4

- `apps/front/src/app/[lng]/whale-tracking/discover/page.tsx`
- `apps/front/src/components/whale-tracking/discover/DiscoverGrid.tsx`
- `apps/front/src/components/whale-tracking/discover/TraderCard.tsx`
- `apps/front/src/app/[lng]/whale-tracking/realtime/RealtimeWhalesClient.tsx`
- `apps/front/src/components/whale-tracking/realtime/RealtimeWhalesTable.tsx`
- `apps/front/src/app/[lng]/whale-tracking/holdings/page.tsx`
- `apps/front/src/components/whale-tracking/holdings/WhalePositionsTable.tsx`
- `apps/front/src/app/[lng]/whale-tracking/notifications/page.tsx`
- `apps/front/src/components/whale-tracking/notifications/NotificationsClient.tsx`
- `apps/front/src/components/whale-tracking/notifications/RealtimeWhaleMonitorSection.tsx`
- `apps/front/src/components/whale-tracking/notifications/AddressMonitorSection.tsx`
- `apps/front/src/components/whale-tracking/notifications/MonitorSection.tsx`
- `apps/front/src/components/whale-tracking/notifications/InboxTab.tsx`
- `apps/front/src/app/[lng]/whale-tracking/profile/ProfileClient.tsx`
- `apps/front/src/app/[lng]/whale-tracking/profile/WhaleProfileClientPage.tsx`
- `apps/front/src/components/whale-tracking/profile/ProfileHeader.tsx`
- `apps/front/src/components/whale-tracking/profile/ProfileSummary.tsx`
- `apps/front/src/components/whale-tracking/profile/ProfileDataTabs.tsx`
- `apps/front/src/components/whale-tracking/profile/CompletedTradesTable.tsx`
- `apps/front/src/components/whale-tracking/profile/PositionProfile.tsx`

### Existing files likely touched by child issue 5

- `apps/front/src/app/[lng]/dashboard/DashboardClient.tsx`
- `apps/front/src/app/[lng]/dashboard/view/DashboardViewClient.tsx`
- `apps/front/src/app/[lng]/dashboard/editor/DashboardEditorClient.tsx`
- `apps/front/src/components/dashboard/DashboardSidebar.tsx`
- `apps/front/src/components/dashboard/DashboardCard.tsx`
- `apps/front/src/components/dashboard/DashboardListItem.tsx`
- `apps/front/src/components/dashboard/AddWidgetModal.tsx`
- `apps/front/src/components/dashboard/DashboardEditorSidebar.tsx`
- `apps/front/src/components/dashboard/EditorCanvas.tsx`
- `apps/front/src/features/dashboards/components/DashboardCanvas.tsx`
- `apps/front/src/features/dashboards/components/DashboardHeader.tsx`
- `apps/front/src/features/dashboards/components/DashboardReadOnlyCanvas.tsx`
- `apps/front/src/features/dashboards/components/DashboardWidget.tsx`
- `apps/front/src/features/dashboards/components/WidgetConfigurator.tsx`
- `apps/front/src/features/dashboards/widgets/WidgetRenderer.tsx`
- `apps/front/src/features/dashboards/widgets/WidgetShell.tsx`

## Task 1: Create umbrella epic and child issue definitions

**Files:**
- Read: `docs/superpowers/specs/2026-05-14-front-h5-mobile-adaptation-design.md`
- Read: this plan file
- External: GitHub issues or the repository issue tracker

- [ ] **Step 1: Create epic issue**

Create issue title:

```text
apps/front H5/mobile adaptation audit and phased delivery
```

Use this body:

```markdown
## Goal

Deliver complete H5/mobile adaptation for apps/front user-facing flows at 375px and 768px.

## Scope

- Global navigation and shell
- Data navigation pages
- Whale navigation pages
- AI Quant and account flows
- Dashboard list/view/editor
- All triggered overlays: modals, dropdowns, popovers, sheets, toasts

## Out of scope

- apps/admin-front
- Backend/Quantify/API contract/data model changes
- Visual rebrand
- Hidden liquidation pages in the first data-page PR unless explicitly approved

## Acceptance

- No body-level horizontal overflow at 375px or 768px
- Primary actions reachable and tappable
- Text does not overflow buttons/cards/tabs/table headers/action bars
- Charts render nonblank
- Tables use mobile cards or contained horizontal scrolling
- Overlays open, close, and scroll correctly
- Loading/empty/error states usable on mobile
- Chinese and English strings do not break layout
- Light and dark themes remain usable
- Desktop behavior spot-checked

## Child issues

- Foundation and global navigation
- AI Quant main chain
- Data pages
- Whale pages
- Dashboard mobile experience
- Final audit and closure

## Source spec

docs/superpowers/specs/2026-05-14-front-h5-mobile-adaptation-design.md
```

- [ ] **Step 2: Create child issue 1**

Create issue title:

```text
apps/front mobile foundation and global navigation
```

Use this body:

```markdown
## Scope

- Shared mobile conventions or primitives
- Navbar
- Footer
- Language switcher
- Theme toggle
- Notification bell popover
- Account dropdown
- Mobile navigation menu
- Shared modal/confirm/toast mobile behavior where needed

## Key files

- apps/front/src/components/layout/Navbar.tsx
- apps/front/src/components/layout/Footer.tsx
- apps/front/src/app/globals.css
- apps/front/src/components/ui/Modal.tsx
- apps/front/src/components/ui/ConfirmDialog.tsx
- apps/front/src/components/ui/toast.tsx
- apps/front/src/components/layout/LanguageSwitcher.tsx
- apps/front/src/components/layout/ThemeToggle.tsx

## Acceptance

- Data, Whales, account, notifications, strategy plaza, and create strategy actions are reachable on 375px and 768px
- Mobile menu closes on route navigation
- Shared overlays fit mobile viewport
- Toasts do not cover sticky mobile actions
- No body-level horizontal overflow

## Verification

- dx test unit front
- dx build front --dev
- Browser pass at 375px and 768px for global navigation and overlays
```

- [ ] **Step 3: Create child issue 2**

Create issue title:

```text
apps/front mobile adaptation for AI Quant main chain
```

Use this body:

```markdown
## Scope

- /ai-quant
- /ai-quant/plaza
- /ai-quant/backtest/[id]
- /account?tab=ai-quant
- /account/ai-quant/strategy/[id]
- /account?tab=settings#exchange-api entry behavior
- AI Quant dialogs and gates

## Key files

- apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx
- apps/front/src/components/ai-quant/QuantChatPanel.tsx
- apps/front/src/components/ai-quant/ConversationSidebar.tsx
- apps/front/src/components/ai-quant/DeployDialog.tsx
- apps/front/src/components/ai-quant/AiQuantDeletionDialog.tsx
- apps/front/src/components/ai-quant/StopRunningStrategyDialog.tsx
- apps/front/src/components/ai-quant/RunningStrategyEditGuardDialog.tsx
- apps/front/src/app/[lng]/ai-quant/plaza/PlazaPageClient.tsx
- apps/front/src/components/ai-quant/StrategyPlaza.tsx
- apps/front/src/app/[lng]/ai-quant/backtest/[id]/BacktestReportClient.tsx
- apps/front/src/app/[lng]/account/AccountPageClient.tsx
- apps/front/src/components/account/AiQuantStrategyList.tsx
- apps/front/src/app/[lng]/account/ai-quant/strategy/[id]/StrategyDetailPageClient.tsx

## Acceptance

- Chat, parameters, backtest, deploy, and strategy list/detail flows are usable at 375px and 768px
- Backtest report metrics and chart are readable and nonblank
- Strategy action buttons wrap or move into mobile action areas without overlap
- Deploy/delete/stop/edit guard dialogs fit and scroll on mobile
- Existing strategy/account state behavior remains unchanged

## Verification

- dx test unit front
- dx build front --dev
- Browser pass for /ai-quant, /ai-quant/plaza, /ai-quant/backtest/[id], /account?tab=ai-quant, strategy detail
```

- [ ] **Step 4: Create child issue 3**

Create issue title:

```text
apps/front mobile adaptation for data pages
```

Use this body:

```markdown
## Scope

- /market
- /long-short-ratio
- /aggregated-orderbook
- /prediction-market
- /public-companies

Hidden pages are tracked in the epic but deferred by default:

- /liquidation-map
- /liquidation-data

## Key files

- apps/front/src/app/[lng]/MarketPageClient.tsx
- apps/front/src/components/trading/top-bar/TopBar.tsx
- apps/front/src/components/trading/center-chart-panel/CenterChartPanel.tsx
- apps/front/src/components/trading/right-panel/RightPanel.tsx
- apps/front/src/app/[lng]/long-short-ratio/LongShortRatioClient.tsx
- apps/front/src/app/[lng]/aggregated-orderbook/AggregatedOrderBookClient.tsx
- apps/front/src/components/aggregated-orderbook/AggregatedOrderbookView.tsx
- apps/front/src/components/aggregated-orderbook/AggregatedOI.tsx
- apps/front/src/components/aggregated-orderbook/AggregatedVolume.tsx
- apps/front/src/app/[lng]/prediction-market/PredictionMarketGridClient.tsx
- apps/front/src/components/prediction-market/PredictionMarketGrid.tsx
- apps/front/src/components/public-companies/PublicCompaniesTable.tsx

## Acceptance

- Trading chart renders nonblank and remains primary on mobile
- TopBar stats use contained horizontal scrolling or compact grouping
- RightPanel/market panels do not force body overflow
- Data tables use cards or contained horizontal scrolling with hint
- Prediction and public-company cards/tables remain readable

## Verification

- dx test unit front
- dx build front --dev
- Browser pass for each scope route at 375px and 768px
```

- [ ] **Step 5: Create child issue 4**

Create issue title:

```text
apps/front mobile adaptation for whale pages
```

Use this body:

```markdown
## Scope

- /whale-tracking/discover
- /whale-tracking/realtime
- /whale-tracking/holdings
- /whale-tracking/notifications
- /whale-tracking/profile
- Create monitor modal and rule/inbox operations

## Key files

- apps/front/src/components/whale-tracking/discover/DiscoverGrid.tsx
- apps/front/src/components/whale-tracking/discover/TraderCard.tsx
- apps/front/src/components/whale-tracking/realtime/RealtimeWhalesTable.tsx
- apps/front/src/components/whale-tracking/holdings/WhalePositionsTable.tsx
- apps/front/src/components/whale-tracking/notifications/NotificationsClient.tsx
- apps/front/src/components/whale-tracking/notifications/RealtimeWhaleMonitorSection.tsx
- apps/front/src/components/whale-tracking/notifications/AddressMonitorSection.tsx
- apps/front/src/components/whale-tracking/notifications/MonitorSection.tsx
- apps/front/src/components/whale-tracking/notifications/InboxTab.tsx
- apps/front/src/components/whale-tracking/profile/ProfileHeader.tsx
- apps/front/src/components/whale-tracking/profile/ProfileDataTabs.tsx
- apps/front/src/components/whale-tracking/profile/CompletedTradesTable.tsx
- apps/front/src/components/whale-tracking/profile/PositionProfile.tsx

## Acceptance

- Discover/realtime/holdings/profile grids and tables are usable at 375px and 768px
- Monitor creation and rule controls fit mobile viewports
- Inbox cards do not overflow
- Copy/read/delete actions remain tappable

## Verification

- dx test unit front
- dx build front --dev
- Browser pass for each whale route and monitor overlay
```

- [ ] **Step 6: Create child issue 5**

Create issue title:

```text
apps/front mobile adaptation for dashboards
```

Use this body:

```markdown
## Scope

- Dashboard list
- Dashboard view
- Dashboard editor
- Widget cards
- Add widget modal
- Rename/delete confirmations
- Widget configuration

## Key files

- apps/front/src/app/[lng]/dashboard/DashboardClient.tsx
- apps/front/src/app/[lng]/dashboard/view/DashboardViewClient.tsx
- apps/front/src/app/[lng]/dashboard/editor/DashboardEditorClient.tsx
- apps/front/src/components/dashboard/AddWidgetModal.tsx
- apps/front/src/components/dashboard/DashboardEditorSidebar.tsx
- apps/front/src/features/dashboards/components/DashboardCanvas.tsx
- apps/front/src/features/dashboards/components/DashboardReadOnlyCanvas.tsx
- apps/front/src/features/dashboards/components/DashboardWidget.tsx
- apps/front/src/features/dashboards/components/WidgetConfigurator.tsx
- apps/front/src/features/dashboards/widgets/WidgetShell.tsx

## Acceptance

- Dashboard list and view are usable on 375px and 768px
- Phone edit mode avoids freeform drag/resize and uses preset or list-like management
- Tablet edit mode is verified before keeping grid editing enabled
- Widget overlays fit and scroll
- Dashboard widgets do not force body overflow

## Verification

- dx test unit front
- dx build front --dev
- Browser pass for list, view, editor, add widget, and widget configuration
```

- [ ] **Step 7: Create child issue 6**

Create issue title:

```text
apps/front mobile adaptation final audit and closure
```

Use this body:

```markdown
## Scope

- Full route/overlay checklist
- 375px screenshot/manual pass
- 768px screenshot/manual pass
- Desktop spot-check
- Chinese and English pass
- Light and dark theme pass
- Residual issue documentation or fix PRs

## Acceptance

- Every child issue acceptance criterion is rechecked
- No body-level horizontal overflow on covered routes
- All navigation and CTA destinations are reachable
- All tracked overlays open, close, and scroll correctly
- Remaining issues are either fixed or linked as follow-up issues with severity

## Verification

- dx lint
- dx test unit front
- dx build front --dev
- Browser route/overlay checklist at 375px, 768px, and desktop
```

- [ ] **Step 8: Link issues**

In the epic issue, add links to all six child issues under the `Child issues` section.

- [ ] **Step 9: Stop for user confirmation**

Ask the user to confirm the issue set before creating branches/worktrees or writing code.

## Task 2: Prepare child issue 1 implementation plan after issue confirmation

**Files:**
- Create: `docs/superpowers/plans/2026-05-14-front-mobile-foundation-navigation.md`
- Read: `apps/front/src/components/layout/Navbar.tsx`
- Read: `apps/front/src/components/layout/Footer.tsx`
- Read: `apps/front/src/app/globals.css`
- Read: `apps/front/src/components/ui/Modal.tsx`
- Read: `apps/front/src/components/ui/ConfirmDialog.tsx`
- Read: `apps/front/src/components/ui/toast.tsx`

- [ ] **Step 1: Inspect current UI boundaries**

Run:

```bash
sed -n '1,760p' apps/front/src/components/layout/Navbar.tsx
sed -n '1,220p' apps/front/src/components/layout/Footer.tsx
sed -n '1,420p' apps/front/src/app/globals.css
sed -n '1,220p' apps/front/src/components/ui/Modal.tsx
sed -n '1,220p' apps/front/src/components/ui/ConfirmDialog.tsx
sed -n '1,260p' apps/front/src/components/ui/toast.tsx
```

Expected:

```text
Commands print current component implementations. No files changed.
```

- [ ] **Step 2: Decide exact shared primitives**

Record in the child plan whether each primitive is implemented as a component or a CSS convention:

```markdown
| Primitive | Decision | File |
| --- | --- | --- |
| Mobile sheet | component | apps/front/src/components/ui/MobileSheet.tsx |
| Responsive action bar | component | apps/front/src/components/ui/ResponsiveActionBar.tsx |
| Horizontal scroll hint | component | apps/front/src/components/ui/HorizontalScrollHint.tsx |
| Responsive tabs | reuse existing tabs or create wrapper | apps/front/src/components/ui/ResponsiveTabs.tsx if needed |
```

- [ ] **Step 3: Write child plan**

Create `docs/superpowers/plans/2026-05-14-front-mobile-foundation-navigation.md` with tasks that:

```markdown
- Add tests for global mobile navigation reachability.
- Add or standardize shared mobile primitives.
- Adapt Navbar mobile menu to include Data, Whales, account, notifications, strategy plaza, and create strategy entries.
- Adapt shared modal/confirm/toast behavior.
- Verify 375px, 768px, and desktop.
```

- [ ] **Step 4: Stop for review**

Ask user to approve child issue 1 plan before implementation.

## Task 3: Prepare child issue 2 implementation plan after foundation branch exists

**Files:**
- Create: `docs/superpowers/plans/2026-05-14-front-mobile-ai-quant-chain.md`
- Read AI Quant and account files listed in the File Map.

- [ ] **Step 1: Inspect AI Quant entry chain**

Run:

```bash
rg -n "StrategyPlaza|DeployDialog|StopRunningStrategyDialog|AiQuantDeletionDialog|RunningStrategyEditGuardDialog|BacktestReportClient|AiQuantStrategyList|StrategyDetailPageClient" apps/front/src/app apps/front/src/components apps/front/src/features
```

Expected:

```text
Command lists all AI Quant chain files and tests that need plan coverage.
```

- [ ] **Step 2: Write child plan**

Create `docs/superpowers/plans/2026-05-14-front-mobile-ai-quant-chain.md` with tasks that:

```markdown
- Add tests for account strategy action wrapping and critical dialog sizing when practical in jsdom.
- Convert AI Quant main layout into mobile sections/tabs without changing conversation state.
- Adapt strategy plaza cards and actions.
- Adapt backtest report header, metrics, chart, risk cards, trade/open-position tables.
- Adapt account strategy list and strategy detail actions.
- Adapt deploy/delete/stop/edit guard dialogs using shared modal/sheet rules.
- Verify target routes and overlays in browser.
```

- [ ] **Step 3: Stop for review**

Ask user to approve child issue 2 plan before implementation.

## Task 4: Prepare child issue 3 implementation plan after foundation branch exists

**Files:**
- Create: `docs/superpowers/plans/2026-05-14-front-mobile-data-pages.md`
- Read data page files listed in the File Map.

- [ ] **Step 1: Inspect data tables and chart containers**

Run:

```bash
rg -n "min-w-|overflow-x|table|TradingView|ECharts|grid-cols|RightPanel|TopBar" apps/front/src/app/[lng] apps/front/src/components/trading apps/front/src/components/aggregated-orderbook apps/front/src/components/public-companies apps/front/src/components/prediction-market
```

Expected:

```text
Command lists width, table, overflow, and chart hotspots for data pages.
```

- [ ] **Step 2: Write child plan**

Create `docs/superpowers/plans/2026-05-14-front-mobile-data-pages.md` with tasks that:

```markdown
- Add or update tests for table/card display helpers where pure helpers exist.
- Adapt /market chart/topbar/right panel layout.
- Adapt aggregated orderbook, OI, volume, and orderbook tables.
- Adapt long-short-ratio page.
- Adapt prediction market cards.
- Adapt public companies table with card or contained horizontal scroll.
- Keep liquidation map/data deferred and recorded.
- Verify target routes in browser.
```

- [ ] **Step 3: Stop for review**

Ask user to approve child issue 3 plan before implementation.

## Task 5: Prepare child issue 4 implementation plan after foundation branch exists

**Files:**
- Create: `docs/superpowers/plans/2026-05-14-front-mobile-whale-pages.md`
- Read whale files listed in the File Map.

- [ ] **Step 1: Inspect whale route components**

Run:

```bash
rg -n "table|min-w-|overflow-x|CreateMonitorModal|RulesTab|InboxTab|RealtimeWhaleMonitorSection|WhalePositionsTable|CompletedTradesTable" apps/front/src/app/[lng]/whale-tracking apps/front/src/components/whale-tracking apps/front/src/features/whale-notification
```

Expected:

```text
Command lists whale table, modal, and action hotspots.
```

- [ ] **Step 2: Write child plan**

Create `docs/superpowers/plans/2026-05-14-front-mobile-whale-pages.md` with tasks that:

```markdown
- Adapt discover/realtime/holdings/profile grids and tables.
- Adapt monitor creation and rule controls.
- Adapt inbox cards and delivery badges.
- Ensure copy/read/delete actions are tappable.
- Verify target routes and monitor overlay in browser.
```

- [ ] **Step 3: Stop for review**

Ask user to approve child issue 4 plan before implementation.

## Task 6: Prepare child issue 5 implementation plan after foundation branch exists

**Files:**
- Create: `docs/superpowers/plans/2026-05-14-front-mobile-dashboard.md`
- Read dashboard files listed in the File Map.

- [ ] **Step 1: Inspect dashboard grid behavior**

Run:

```bash
rg -n "react-grid-layout|GridLayout|isDraggable|isResizable|resizeHandles|DashboardCanvas|WidgetConfigurator|AddWidgetModal" apps/front/src/app/[lng]/dashboard apps/front/src/components/dashboard apps/front/src/features/dashboards
```

Expected:

```text
Command lists dashboard drag/resize and overlay hotspots.
```

- [ ] **Step 2: Write child plan**

Create `docs/superpowers/plans/2026-05-14-front-mobile-dashboard.md` with tasks that:

```markdown
- Adapt dashboard list and view first.
- Define phone editor behavior: no freeform drag/resize; use preset or list-like widget management.
- Verify tablet editor before keeping constrained grid editing enabled.
- Adapt add-widget/configuration/rename/delete overlays.
- Verify widgets do not force body overflow.
```

- [ ] **Step 3: Stop for review**

Ask user to approve child issue 5 plan before implementation.

## Task 7: Prepare final audit plan after child PRs land

**Files:**
- Create: `docs/superpowers/plans/2026-05-14-front-mobile-final-audit.md`

- [ ] **Step 1: Write route checklist**

Include this route checklist:

```markdown
## Routes

- /zh
- /zh/market
- /zh/long-short-ratio
- /zh/aggregated-orderbook
- /zh/prediction-market
- /zh/public-companies
- /zh/whale-tracking/discover
- /zh/whale-tracking/realtime
- /zh/whale-tracking/holdings
- /zh/whale-tracking/notifications
- /zh/whale-tracking/profile
- /zh/ai-quant
- /zh/ai-quant/plaza
- /zh/ai-quant/backtest/[id]
- /zh/account?tab=settings
- /zh/account?tab=ai-quant
- /zh/account/ai-quant/strategy/[id]
- /zh/dashboard
- /zh/dashboard/view
- /zh/dashboard/editor
```

- [ ] **Step 2: Write overlay checklist**

Include this overlay checklist:

```markdown
## Overlays

- Mobile navigation menu
- Data menu
- Whales menu
- Account dropdown/sheet
- Notification popover
- Language switcher
- Theme toggle
- Confirm dialog
- Shared modal
- Toast
- AI Quant deploy dialog
- AI Quant delete dialog
- AI Quant stop dialog
- Running strategy edit guard dialog
- Whale create monitor modal
- Dashboard add widget modal
- Dashboard widget configuration
- Dashboard rename/delete confirmations
```

- [ ] **Step 3: Write verification commands**

Include:

```bash
dx lint
dx test unit front
dx build front --dev
```

- [ ] **Step 4: Stop for review**

Ask user to approve final audit plan after child implementation PRs are ready.

## Task 8: Full-program verification gates

**Files:**
- None directly. Run commands from repository root.

- [ ] **Step 1: Lint**

Run:

```bash
dx lint
```

Expected:

```text
Command exits 0.
```

- [ ] **Step 2: Front unit tests**

Run:

```bash
dx test unit front
```

Expected:

```text
Command exits 0.
```

- [ ] **Step 3: Front build**

Run:

```bash
dx build front --dev
```

Expected:

```text
Command exits 0.
```

- [ ] **Step 4: Browser verification**

Open the front app through the normal `dx start front --dev` route and verify:

```text
375px: no body horizontal scroll, primary actions reachable, overlays usable.
768px: no body horizontal scroll, tablet layout usable, overlays usable.
Desktop: major pages still match current behavior.
```

## Self-Review

- Spec coverage: This umbrella plan maps each spec scope area to one child issue and one child plan.
- Placeholder scan: No unresolved marker or unspecified child issue remains.
- Type consistency: This plan does not introduce runtime types; route and file names match the design spec and current repository structure.
- Scope check: The plan intentionally avoids one mega-PR and requires child issue plans before code.
