import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/theme_data.dart';
import '../../theme/theme_notifier.dart';
import '../../theme/tokens.dart';
import '../../widgets/widgets.dart';

/// Dev-only preview page enumerating every qz_* atomic widget across the
/// 9 (bg × accent) theme combinations. Routed under `/_dev/components-preview`
/// in [kDebugMode] only — see `app_router.dart`.
class ComponentsPreviewPage extends StatefulWidget {
  const ComponentsPreviewPage({super.key});

  @override
  State<ComponentsPreviewPage> createState() => _ComponentsPreviewPageState();
}

class _ComponentsPreviewPageState extends State<ComponentsPreviewPage> {
  QzBg _bg = QzBg.light;
  QzAccent _accent = QzAccent.violet;

  static const Map<QzBg, String> _bgLabels = <QzBg, String>{
    QzBg.light: 'light',
    QzBg.pink: 'pink',
    QzBg.dark: 'dark',
  };

  static const Map<QzAccent, String> _accentLabels = <QzAccent, String>{
    QzAccent.violet: 'violet',
    QzAccent.cyan: 'cyan',
    QzAccent.amber: 'amber',
  };

  @override
  Widget build(BuildContext context) {
    // Build a theme override based on the locally selected (bg, accent)
    // so toggling tabs here does not require the app-level notifier.
    final ThemeData previewTheme =
        buildQzThemeData(QzTheme(bg: _bg, accent: _accent));

    return Theme(
      data: previewTheme,
      child: Builder(builder: (BuildContext ctx) {
        final QzColorScheme c = ctx.qzScheme;
        return Scaffold(
          backgroundColor: c.bg,
          appBar: QzTopBar(
            title: 'Components Preview',
            subtitle:
                '${_bgLabels[_bg]} × ${_accentLabels[_accent]} (debug)',
            // Use go_router's `pop` so the route observer stays in sync with
            // the underlying Navigator stack.
            onBack: ctx.canPop() ? ctx.pop : null,
          ),
          body: ListView(
            padding: const EdgeInsets.all(QzSpacing.lg),
            children: <Widget>[
              _ThemeSwitcher(
                bg: _bg,
                accent: _accent,
                onBgChanged: (QzBg v) => setState(() => _bg = v),
                onAccentChanged: (QzAccent v) =>
                    setState(() => _accent = v),
                bgLabels: _bgLabels,
                accentLabels: _accentLabels,
              ),
              const SizedBox(height: QzSpacing.lg),
              _Section(
                title: 'QzButton',
                child: Wrap(
                  spacing: QzSpacing.sm,
                  runSpacing: QzSpacing.sm,
                  children: <Widget>[
                    QzButton(label: 'Primary', onPressed: () {}),
                    QzButton(
                      label: 'Ghost',
                      variant: QzButtonVariant.ghost,
                      onPressed: () {},
                    ),
                    QzButton(
                      label: 'Accent',
                      variant: QzButtonVariant.accent,
                      onPressed: () {},
                    ),
                    const QzButton(label: 'Loading', loading: true),
                  ],
                ),
              ),
              _Section(
                title: 'QzCard / QzPanel',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: <Widget>[
                    QzCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Text(
                            'Card surface',
                            style: TextStyle(
                              color: c.text,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: QzSpacing.sm),
                          QzPanel(
                            child: Text(
                              'Nested panel',
                              style: TextStyle(color: c.textMid),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              _Section(
                title: 'QzPill / QzChip',
                child: Wrap(
                  spacing: QzSpacing.sm,
                  runSpacing: QzSpacing.sm,
                  children: const <Widget>[
                    QzPill(label: 'PILL'),
                    QzChip(label: 'neutral'),
                    QzChip(label: 'ok', tone: QzChipTone.ok),
                    QzChip(label: 'warn', tone: QzChipTone.warn),
                    QzChip(label: 'danger', tone: QzChipTone.danger),
                    QzChip(label: 'info', tone: QzChipTone.info),
                    QzChip(label: 'accent', tone: QzChipTone.accent),
                    QzChip(label: 'inverse', tone: QzChipTone.inverse),
                  ],
                ),
              ),
              _Section(
                title: 'QzSegmentedTabs',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    QzSegmentedTabs(
                      options: const <String>['1m', '5m', '15m', '1h'],
                      value: '5m',
                      onChanged: (_) {},
                    ),
                    const SizedBox(height: QzSpacing.sm),
                    QzSegmentedTabs(
                      options: const <String>['Buy', 'Sell'],
                      value: 'Buy',
                      onChanged: (_) {},
                      size: QzSegSize.md,
                    ),
                  ],
                ),
              ),
              _Section(
                title: 'QzSearchBar',
                child: const QzSearchBar(hint: 'Search coins'),
              ),
              _Section(
                title: 'QzAvatar / QzSpinner',
                child: Row(
                  children: const <Widget>[
                    QzAvatar(label: 'BTC', monospace: true, size: 40),
                    SizedBox(width: QzSpacing.md),
                    QzAvatar(label: 'EU'),
                    SizedBox(width: QzSpacing.md),
                    QzSpinner(size: 20),
                  ],
                ),
              ),
              _Section(
                title: 'QzStatChip',
                child: Wrap(
                  spacing: QzSpacing.sm,
                  runSpacing: QzSpacing.sm,
                  children: const <Widget>[
                    QzStatChip(value: 0.0123),
                    QzStatChip(value: -0.0421),
                    QzStatChip(value: 0),
                    QzStatChip(value: double.nan),
                  ],
                ),
              ),
              _Section(
                title: 'QzSheet',
                child: QzButton(
                  label: 'Open sheet',
                  variant: QzButtonVariant.ghost,
                  onPressed: () => QzSheet.show<void>(
                    context: ctx,
                    useRootNavigator: true,
                    builder: (_) => Padding(
                      padding: const EdgeInsets.all(QzSpacing.lg),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Text(
                            'Sheet preview',
                            style: TextStyle(
                              color: c.text,
                              fontWeight: FontWeight.w600,
                              fontSize: 16,
                            ),
                          ),
                          const SizedBox(height: QzSpacing.sm),
                          Text(
                            'A modal surface composed of qz_* primitives.',
                            style: TextStyle(color: c.textMid),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
              _Section(
                title: 'QzEmptyState',
                child: QzEmptyState(
                  title: 'No strategies yet',
                  subtitle: 'Create your first one to start trading.',
                  icon: Icons.dashboard_outlined,
                  action: QzButton(
                    label: 'Create',
                    variant: QzButtonVariant.accent,
                    onPressed: () {},
                  ),
                ),
              ),
              _Section(
                title: 'QzBottomTabBar',
                child: SizedBox(
                  height: 64,
                  child: QzBottomTabBar(
                    currentIndex: 0,
                    onTap: (_) {},
                  ),
                ),
              ),
              const SizedBox(height: QzSpacing.xxl),
            ],
          ),
        );
      }),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: QzSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            title,
            style: TextStyle(
              color: c.textMid,
              fontSize: 12,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.4,
            ),
          ),
          const SizedBox(height: QzSpacing.sm),
          child,
        ],
      ),
    );
  }
}

class _ThemeSwitcher extends StatelessWidget {
  const _ThemeSwitcher({
    required this.bg,
    required this.accent,
    required this.onBgChanged,
    required this.onAccentChanged,
    required this.bgLabels,
    required this.accentLabels,
  });

  final QzBg bg;
  final QzAccent accent;
  final ValueChanged<QzBg> onBgChanged;
  final ValueChanged<QzAccent> onAccentChanged;
  final Map<QzBg, String> bgLabels;
  final Map<QzAccent, String> accentLabels;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return QzCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            'Background',
            style: TextStyle(
              color: c.textMid,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: QzSpacing.sm),
          QzSegmentedTabs(
            options: bgLabels.values.toList(growable: false),
            value: bgLabels[bg]!,
            onChanged: (String label) {
              final QzBg picked = bgLabels.entries
                  .firstWhere((MapEntry<QzBg, String> e) => e.value == label)
                  .key;
              onBgChanged(picked);
            },
          ),
          const SizedBox(height: QzSpacing.md),
          Text(
            'Accent',
            style: TextStyle(
              color: c.textMid,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: QzSpacing.sm),
          QzSegmentedTabs(
            options: accentLabels.values.toList(growable: false),
            value: accentLabels[accent]!,
            onChanged: (String label) {
              final QzAccent picked = accentLabels.entries
                  .firstWhere(
                      (MapEntry<QzAccent, String> e) => e.value == label)
                  .key;
              onAccentChanged(picked);
            },
          ),
        ],
      ),
    );
  }
}
