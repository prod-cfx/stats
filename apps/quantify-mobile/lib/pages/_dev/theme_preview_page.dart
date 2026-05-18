import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../theme/colors.dart';
import '../../theme/theme_data.dart';
import '../../theme/tokens.dart';

/// Dev-only preview: 4 sample cards covering representative bg×accent pairs
/// + a button into the production theme picker.
class ThemePreviewPage extends StatelessWidget {
  const ThemePreviewPage({super.key});

  static const List<(QzBg, QzAccent, String)> _samples = <(QzBg, QzAccent, String)>[
    (QzBg.light, QzAccent.violet, 'Light · Violet'),
    (QzBg.pink, QzAccent.violet, 'Pink · Violet'),
    (QzBg.dark, QzAccent.cyan, 'Dark · Cyan'),
    (QzBg.light, QzAccent.amber, 'Light · Amber'),
  ];

  @override
  Widget build(BuildContext context) {
    final QzColorScheme outer =
        Theme.of(context).extension<QzColorSchemeExt>()!.scheme;
    return Scaffold(
      backgroundColor: outer.bg,
      appBar: AppBar(
        backgroundColor: outer.bgElev,
        foregroundColor: outer.text,
        elevation: 0,
        title: const Text('Theme Preview (dev)'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(QzSpacing.lg),
        children: <Widget>[
          for (final (QzBg, QzAccent, String) s in _samples) ...<Widget>[
            _SampleCard(bg: s.$1, accent: s.$2, label: s.$3),
            const SizedBox(height: QzSpacing.lg),
          ],
          SizedBox(
            height: 48,
            child: ElevatedButton(
              onPressed: () => context.go('/me/theme'),
              style: ElevatedButton.styleFrom(
                backgroundColor: outer.accent,
                foregroundColor: outer.accentOn,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(QzRadii.input),
                ),
              ),
              child: const Text('Open theme picker'),
            ),
          ),
        ],
      ),
    );
  }
}

class _SampleCard extends StatelessWidget {
  const _SampleCard({
    required this.bg,
    required this.accent,
    required this.label,
  });
  final QzBg bg;
  final QzAccent accent;
  final String label;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = qzColors(bg, accent);
    return Container(
      padding: const EdgeInsets.all(QzSpacing.lg),
      decoration: BoxDecoration(
        color: c.bgElev,
        borderRadius: BorderRadius.circular(QzRadii.card),
        border: Border.all(color: c.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            label,
            style: TextStyle(
              color: c.text,
              fontSize: 14,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: QzSpacing.md),
          Row(
            children: <Widget>[
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  gradient: c.accentGrad,
                  borderRadius: BorderRadius.circular(QzRadii.input),
                ),
                child: Text(
                  '主按钮',
                  style: TextStyle(color: c.accentOn, fontSize: 13),
                ),
              ),
              const SizedBox(width: QzSpacing.sm),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: c.accentSoft,
                  borderRadius: BorderRadius.circular(QzRadii.input),
                ),
                child: Text(
                  '软气泡',
                  style: TextStyle(color: c.accent, fontSize: 13),
                ),
              ),
            ],
          ),
          const SizedBox(height: QzSpacing.md),
          Wrap(
            spacing: QzSpacing.sm,
            runSpacing: QzSpacing.sm,
            children: <Widget>[
              _Chip(label: 'OK', color: c.statusOk),
              _Chip(label: 'Warn', color: c.statusWarn),
              _Chip(label: 'Danger', color: c.statusDanger),
              _Chip(label: 'Info', color: c.statusInfo),
            ],
          ),
          const SizedBox(height: QzSpacing.md),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: <Widget>[
              Text(
                '+2.34%',
                style: TextStyle(
                  color: c.marketUp,
                  fontFamilyFallback: QzFont.monoFallback,
                  fontWeight: FontWeight.w700,
                ),
              ),
              Text(
                '-1.20%',
                style: TextStyle(
                  color: c.marketDown,
                  fontFamilyFallback: QzFont.monoFallback,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.color});
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(QzRadii.pill),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
