# qz_* atomic widget catalog

This document lists every `qz_*` atomic widget shipped under
`apps/quantify-mobile/lib/widgets/`. Every entry maps the Flutter API to its
mobile-prototype origin so designers and engineers can keep parity in mind.

- Live preview (debug builds only): route `/_dev/components-preview` (link
  from `/_dev/theme-preview` → "Components Preview"). Toggle background and
  accent at the top to see all 9 (bg × accent) combinations.
- Prototype reference: `design/project/mobile/m-shell.jsx` (shared primitives)
  and `design/project/mobile/Quantify Mobile App.html` (final compositions).

Goldens live in `apps/quantify-mobile/test/widgets/goldens/`. Baseline locked
to `QzBg.light + QzAccent.violet` — matches `QzTheme.fallback` so the running
app and the captured PNG line up visually. Smoke tests assert the widget
renders without exceptions under all 9 theme combinations
(`test/helpers/golden_harness.dart#verifyAllThemes`).

---

## Components

### QzButton — `lib/widgets/qz_button.dart`

Action button with three visual variants and a loading state.

Props: `label, variant (primary/ghost/accent), onPressed, loading, leading?, expanded`.

Prototype: `design/project/mobile/m-screens-4.jsx:298-304` (`primary = M.text bg / M.elev fg` — inverse "dark on light" by design).

```dart
QzButton(
  label: 'Submit',
  variant: QzButtonVariant.accent,
  expanded: true,
  onPressed: _submit,
)
```

### QzCard — `lib/widgets/qz_card.dart`

Elevated surface (`bgElev` + 1px `border` + 14px radius). Wraps in `InkWell` when `onTap` is supplied.

Prototype: `design/project/mobile/m-shell.jsx:246`.

```dart
QzCard(child: ListTile(title: Text(symbol)))
```

### QzPanel — `lib/widgets/qz_panel.dart`

Nested soft surface (`bgSoft`, no border). Designed to sit inside a `QzCard` to group related rows without visually competing.

Prototype: no standalone primitive; appears as nested `bg-soft` containers inside `m-shell.jsx` card compositions.

```dart
QzCard(
  child: Column(children: [
    Text('Holdings'),
    QzPanel(child: _balanceRow()),
  ]),
)
```

### QzPill — `lib/widgets/qz_pill.dart`

Pure-label pill, defaults to accent tint. Use [QzChip] when an icon or semantic tone is needed.

```dart
QzPill(label: 'NEW')
```

### QzChip — `lib/widgets/qz_chip.dart`

7-tone semantic chip with optional leading icon. Tones map to `QzColorScheme` status fields:

| tone | bg | fg |
|---|---|---|
| neutral | `bgSoft` | `textMid` |
| ok | `statusOk` @ 14% | `statusOk` |
| warn | `statusWarn` @ 14% | `statusWarn` |
| danger | `statusDanger` @ 14% | `statusDanger` |
| info | `statusInfo` @ 14% | `statusInfo` |
| accent | `accentSoft` | `accent` |
| inverse | `text` | `bgElev` |

Prototype: `design/project/mobile/m-shell.jsx:213-231`.

```dart
QzChip(label: 'Long', tone: QzChipTone.ok, leading: Icons.arrow_upward)
```

### QzSpinner — `lib/widgets/qz_spinner.dart`

Small circular loader. Defaults to the active `accent` color.

```dart
QzSpinner(size: 16)
```

### QzAvatar — `lib/widgets/qz_avatar.dart`

Initials avatar. `monospace: true` uses the mono font fallback for token symbols (`BTC`, `ETH`).

Prototype: `design/project/mobile/m-shell.jsx:234-243`.

```dart
QzAvatar(label: 'BTC', monospace: true, size: 40)
```

### QzTopBar — `lib/widgets/qz_top_bar.dart`

PreferredSize app bar. Drop into `Scaffold.appBar`; Scaffold handles the status-bar inset automatically. `onBack` and `leading` are mutually exclusive.

Prototype: `design/project/mobile/m-shell.jsx:144-169`.

```dart
Scaffold(
  appBar: QzTopBar(
    title: 'Market',
    subtitle: 'BTC · 1m',
    onBack: () => Navigator.pop(context),
    actions: <Widget>[IconButton(icon: Icon(Icons.star_border), onPressed: _star)],
  ),
  body: ...,
)
```

### QzBottomTabBar — `lib/widgets/qz_bottom_tab_bar.dart`

Fixed 5-tab bottom navigation. `currentIndex` is asserted in `[0, 5)`.

Canonical tab order (left → right) — single source of truth for designs,
router branches, and tests:

| index | key | label | route |
|---|---|---|---|
| 0 | `tab-strategy` | 策略 | `/strategy` |
| 1 | `tab-ai` | AI 量化 | `/ai` |
| 2 | `tab-market` | 行情 | `/market` |
| 3 | `tab-whale` | 巨鲸 | `/whale` |
| 4 | `tab-me` | 我的 | `/me` |

Guarded by `test/widgets/qz_bottom_tab_bar_test.dart` (visual order) and
`test/router/app_router_test.dart` (index → page mapping). Update both when
the order changes; the golden `goldens/qz_bottom_tab_bar.png` must be
re-generated via `flutter test --update-goldens`.

```dart
QzBottomTabBar(currentIndex: 0, onTap: shell.goBranch)
```

### QzSegmentedTabs — `lib/widgets/qz_segmented_tabs.dart`

Pill-chip segmented control with sm (28dp) and md (32dp) sizes. `value` must appear in `options` (asserted at build time).

Prototype: `design/project/mobile/m-shell.jsx:256-275`.

```dart
QzSegmentedTabs(
  options: const ['1m', '5m', '15m', '1h'],
  value: timeframe,
  onChanged: (v) => setState(() => timeframe = v),
)
```

### QzSearchBar — `lib/widgets/qz_search_bar.dart`

40dp search input. Default leading icon is a magnifier; emits `TextInputAction.search` so soft keyboards show a "search" affordance.

```dart
QzSearchBar(
  hint: 'Search coins',
  onChanged: _filter,
)
```

### QzSheet — `lib/widgets/qz_sheet.dart`

`QzSheet.show<T>` wraps `showModalBottomSheet` with the design-system chrome
(16dp top radius, `bgElev` surface, `scrim` barrier, 40×4 drag handle).
Bottom padding adapts to the soft keyboard via `viewInsets.bottom`.

Known limitation: chrome theme is captured at open time; if the app theme
changes while the sheet is open, only the caller-built content rebuilds.
Re-open the sheet after a theme change to refresh chrome.

```dart
await QzSheet.show<void>(
  context: context,
  builder: (ctx) => Padding(
    padding: const EdgeInsets.all(16),
    child: Text('Sheet body'),
  ),
);
```

### QzStatChip — `lib/widgets/qz_stat_chip.dart`

Market-quote delta chip. `value > 0` uses `marketUp`, `value < 0` uses `marketDown`, `value == 0` uses neutral. NaN / Infinity render `--` placeholder.

Color direction: **green up, red down** (Western convention) — see `marketUp = #16A36B` / `marketDown = #E5484D` in `lib/theme/tokens.dart`.

Prototype source: token table in `design/project/tokens.css` + spot-chip usages in `design/project/mobile/m-screens-4.jsx`.

```dart
QzStatChip(value: 0.0123)   // → +1.23%
QzStatChip(value: -0.0421)  // → -4.21%
QzStatChip(value: 0)        // → 0.00%  (neutral palette)
QzStatChip(value: double.nan) // → "--" placeholder
```

### QzEmptyState — `lib/widgets/qz_empty_state.dart`

Centered placeholder for "nothing here yet" surfaces. All but `title` are optional, so historical `QzEmptyState(title: '...')` calls keep working.

```dart
QzEmptyState(
  title: 'No strategies yet',
  subtitle: 'Create your first one to start trading.',
  icon: Icons.dashboard_outlined,
  action: QzButton(label: 'Create', onPressed: _create),
)
```

---

## Design tokens

Tokens live in `lib/theme/`:

- `colors.dart` — `QzColorScheme`, `qzColors(bg, accent)`
- `tokens.dart` — `QzSpacing`, `QzRadii`, `QzCurves`, `QzShadow`, `QzFont`, `QzStatus`

All widgets above read tokens via `context.qzScheme` (extension on `BuildContext` at `lib/theme/theme_context.dart`). Adding a new accent or background is a pure data change — widgets do not need to be touched.

## Adding a new widget

1. Create `lib/widgets/qz_<name>.dart`. Read tokens only via `context.qzScheme`; never hard-code colors.
2. Append the export to `lib/widgets/widgets.dart` (barrel).
3. Add a baseline golden + 9-theme smoke in `test/widgets/qz_<name>_test.dart` using `pumpQz` / `verifyAllThemes` from `test/helpers/golden_harness.dart`.
4. Generate the golden on Linux: `flutter test --update-goldens test/widgets/qz_<name>_test.dart`. Commit the PNG.
5. Add a section here in `components.md` with a usage snippet and a prototype link.
6. Add the component to `lib/pages/_dev/components_preview_page.dart` so reviewers can eyeball it under all 9 themes.
