import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../l10n/app_localizations.dart';
import '../../theme/colors.dart';
import '../../theme/theme_data.dart';
import '../../theme/theme_notifier.dart';
import '../../theme/tokens.dart';

/// Theme picker (3 backgrounds × 3 accents). Mirrors the web prototype
/// `design/project/mobile/m-screens-5.jsx`.
class ThemeSettingsPage extends ConsumerWidget {
  const ThemeSettingsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzTheme theme = ref.watch(themeProvider);
    final QzColorScheme c =
        Theme.of(context).extension<QzColorSchemeExt>()!.scheme;

    final List<({QzBg key, String label})> bgOptions =
        <({QzBg key, String label})>[
      (key: QzBg.dark, label: l10n.themeBgDark),
      (key: QzBg.pink, label: l10n.themeBgPink),
      (key: QzBg.light, label: l10n.themeBgLight),
    ];

    final List<({QzAccent key, String label})> accentOptions =
        <({QzAccent key, String label})>[
      (key: QzAccent.violet, label: l10n.themeAccentViolet),
      (key: QzAccent.cyan, label: l10n.themeAccentCyan),
      (key: QzAccent.amber, label: l10n.themeAccentAmber),
    ];

    return Scaffold(
      backgroundColor: c.bg,
      appBar: AppBar(
        backgroundColor: c.bgElev,
        foregroundColor: c.text,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              l10n.themeSettingsTitle,
              style: TextStyle(
                color: c.text,
                fontSize: 16,
                fontWeight: FontWeight.w700,
              ),
            ),
            Text(
              l10n.themeSettingsDeviceOnly,
              style: TextStyle(color: c.textDim, fontSize: 11),
            ),
          ],
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
          QzSpacing.lg,
          QzSpacing.xl,
          QzSpacing.lg,
          100,
        ),
        children: <Widget>[
          _PreviewCard(theme: theme, scheme: c),
          const SizedBox(height: QzSpacing.xl),
          _SectionLabel(l10n.themeBgSection, color: c.textMid),
          const SizedBox(height: QzSpacing.sm),
          _BgGrid(
            current: theme.bg,
            options: bgOptions,
            scheme: c,
            onPick: (QzBg bg) =>
                ref.read(themeProvider.notifier).setBg(bg),
          ),
          const SizedBox(height: QzSpacing.xxl),
          _SectionLabel(l10n.themeAccentSection, color: c.textMid),
          const SizedBox(height: QzSpacing.sm),
          _AccentGrid(
            current: theme.accent,
            options: accentOptions,
            scheme: c,
            onPick: (QzAccent a) =>
                ref.read(themeProvider.notifier).setAccent(a),
          ),
          const SizedBox(height: QzSpacing.xxl),
          _PrefsTogglesCard(
            theme: theme,
            scheme: c,
            l10n: l10n,
            onAutoFollow: (bool v) =>
                ref.read(themeProvider.notifier).setAutoFollowSystem(v),
            onReduceMotion: (bool v) =>
                ref.read(themeProvider.notifier).setReduceMotion(v),
          ),
        ],
      ),
    );
  }
}

/// 「自动跟随系统」+「减少动画」开关卡（原型 `m-screens-5.jsx:105-118`）。
class _PrefsTogglesCard extends StatelessWidget {
  const _PrefsTogglesCard({
    required this.theme,
    required this.scheme,
    required this.l10n,
    required this.onAutoFollow,
    required this.onReduceMotion,
  });
  final QzTheme theme;
  final QzColorScheme scheme;
  final AppLocalizations l10n;
  final ValueChanged<bool> onAutoFollow;
  final ValueChanged<bool> onReduceMotion;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: scheme.bgElev,
        border: Border.all(color: scheme.border),
        borderRadius: BorderRadius.circular(QzRadii.card),
      ),
      child: Column(
        children: <Widget>[
          _TogglePrefRow(
            switchKey: const ValueKey<String>('themeToggleAutoFollowSystem'),
            label: l10n.themeToggleAutoFollowSystem,
            value: theme.autoFollowSystem,
            scheme: scheme,
            onChanged: onAutoFollow,
            last: false,
          ),
          _TogglePrefRow(
            switchKey: const ValueKey<String>('themeToggleReduceMotion'),
            label: l10n.themeToggleReduceMotion,
            value: theme.reduceMotion,
            scheme: scheme,
            onChanged: onReduceMotion,
            last: true,
          ),
        ],
      ),
    );
  }
}

class _TogglePrefRow extends StatelessWidget {
  const _TogglePrefRow({
    required this.switchKey,
    required this.label,
    required this.value,
    required this.scheme,
    required this.onChanged,
    required this.last,
  });
  final Key switchKey;
  final String label;
  final bool value;
  final QzColorScheme scheme;
  final ValueChanged<bool> onChanged;
  final bool last;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: QzSpacing.lg,
        vertical: 10,
      ),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(
            color: last ? Colors.transparent : scheme.borderSoft,
          ),
        ),
      ),
      child: Row(
        children: <Widget>[
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                color: scheme.text,
                fontSize: 14,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          Switch.adaptive(
            key: switchKey,
            value: value,
            onChanged: onChanged,
            // 同时指定 thumb + track 颜色：Android 端使用 thumb；iOS 端
            // CupertinoSwitch 不支持 thumbColor，但会读 trackColor 控制 on
            // 状态轨道色，从而保证两端 accent 视觉一致。activeColor 已 deprecated。
            activeThumbColor: scheme.accent,
            activeTrackColor: scheme.accent,
          ),
        ],
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text, {required this.color});
  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: TextStyle(color: color, fontSize: 13, fontWeight: FontWeight.w500),
    );
  }
}

class _PreviewCard extends StatelessWidget {
  const _PreviewCard({required this.theme, required this.scheme});
  final QzTheme theme;
  final QzColorScheme scheme;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return Container(
      decoration: BoxDecoration(
        color: scheme.bgElev,
        borderRadius: BorderRadius.circular(QzRadii.card),
        boxShadow: _shadowFor(theme.bg),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Container(
            padding: const EdgeInsets.fromLTRB(18, 18, 18, 14),
            decoration: BoxDecoration(
              color: scheme.bgSoft,
              border: Border(
                bottom: BorderSide(color: scheme.borderSoft),
              ),
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(QzRadii.card),
              ),
            ),
            child: Row(
              children: <Widget>[
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: scheme.accentSoft,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(Icons.smart_toy_outlined,
                      color: scheme.accent, size: 20),
                ),
                const SizedBox(width: QzSpacing.md),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      l10n.themePreviewTitle,
                      style: TextStyle(
                        color: scheme.text,
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${theme.bg.name} · ${theme.accent.name}',
                      style: TextStyle(
                        color: scheme.textDim,
                        fontSize: 11,
                        fontFamilyFallback: QzFont.monoFallback,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Align(
                  alignment: Alignment.centerLeft,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: scheme.accentSoft,
                      borderRadius: const BorderRadius.only(
                        topLeft: Radius.circular(4),
                        topRight: Radius.circular(12),
                        bottomLeft: Radius.circular(12),
                        bottomRight: Radius.circular(12),
                      ),
                    ),
                    child: Text(
                      l10n.themePreviewIdentified,
                      style: TextStyle(color: scheme.accent, fontSize: 13),
                    ),
                  ),
                ),
                const SizedBox(height: QzSpacing.sm),
                Align(
                  alignment: Alignment.centerRight,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      gradient: scheme.accentGrad,
                      borderRadius: const BorderRadius.only(
                        topLeft: Radius.circular(12),
                        topRight: Radius.circular(12),
                        bottomLeft: Radius.circular(12),
                        bottomRight: Radius.circular(4),
                      ),
                    ),
                    child: Text(
                      l10n.themePreviewStartBacktest,
                      style: TextStyle(color: scheme.accentOn, fontSize: 13),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  List<BoxShadow> _shadowFor(QzBg bg) {
    switch (bg) {
      case QzBg.light:
        return QzShadow.lightMd;
      case QzBg.pink:
        return QzShadow.pinkMd;
      case QzBg.dark:
        return QzShadow.darkMd;
    }
  }
}

class _BgGrid extends StatelessWidget {
  const _BgGrid({
    required this.current,
    required this.options,
    required this.scheme,
    required this.onPick,
  });

  final QzBg current;
  final List<({QzBg key, String label})> options;
  final QzColorScheme scheme;
  final ValueChanged<QzBg> onPick;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: <Widget>[
        for (int i = 0; i < options.length; i++) ...<Widget>[
          if (i > 0) const SizedBox(width: 10),
          Expanded(child: _bgSwatch(options[i])),
        ],
      ],
    );
  }

  Widget _bgSwatch(({QzBg key, String label}) o) {
    final bool on = o.key == current;
    final QzColorScheme preview = qzColors(o.key, QzAccent.violet);
    return GestureDetector(
      onTap: () => onPick(o.key),
      child: Container(
        height: 78,
        decoration: BoxDecoration(
          color: preview.bgElev,
          borderRadius: BorderRadius.circular(QzRadii.card),
          border: Border.all(
            color: on ? scheme.accent : Colors.transparent,
            width: 2,
          ),
          boxShadow: on
              ? <BoxShadow>[
                  BoxShadow(
                    color: scheme.accentRing,
                    blurRadius: 0,
                    spreadRadius: 4,
                  ),
                ]
              : (o.key == QzBg.light
                  ? <BoxShadow>[
                      const BoxShadow(
                        color: Color(0x0F000000),
                        offset: Offset(0, 1),
                        blurRadius: 2,
                      ),
                    ]
                  : const <BoxShadow>[]),
        ),
        alignment: Alignment.center,
        child: Text(
          o.label,
          style: TextStyle(
            color: preview.text,
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}

class _AccentGrid extends StatelessWidget {
  const _AccentGrid({
    required this.current,
    required this.options,
    required this.scheme,
    required this.onPick,
  });

  final QzAccent current;
  final List<({QzAccent key, String label})> options;
  final QzColorScheme scheme;
  final ValueChanged<QzAccent> onPick;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: <Widget>[
        for (int i = 0; i < options.length; i++) ...<Widget>[
          if (i > 0) const SizedBox(width: 10),
          Expanded(child: _accentSwatch(options[i])),
        ],
      ],
    );
  }

  Widget _accentSwatch(({QzAccent key, String label}) o) {
    final bool on = o.key == current;
    final QzColorScheme preview = qzColors(QzBg.light, o.key);
    return GestureDetector(
      onTap: () => onPick(o.key),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 18),
        decoration: BoxDecoration(
          color: scheme.bgElev,
          borderRadius: BorderRadius.circular(QzRadii.card),
          border: Border.all(
            color: on ? scheme.accent : scheme.border,
            width: 2,
          ),
          boxShadow: on
              ? <BoxShadow>[
                  BoxShadow(
                    color: scheme.accentRing,
                    blurRadius: 0,
                    spreadRadius: 3,
                  ),
                ]
              : const <BoxShadow>[],
        ),
        child: Column(
          children: <Widget>[
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                gradient: preview.accentGrad,
                borderRadius: BorderRadius.circular(16),
              ),
            ),
            const SizedBox(height: 10),
            Text(
              o.label,
              style: TextStyle(
                color: scheme.text,
                fontSize: 14,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
