import 'package:flutter/material.dart';

import '../theme/colors.dart';
import '../theme/theme_context.dart';
import '../theme/tokens.dart';

/// Two sizing variants matching the prototype `Seg({size: 'sm' | 'md'})`.
enum QzSegSize { sm, md }

/// Pill-shaped segmented control (string options). Direct port of the
/// prototype `Seg({options, value, size})` primitive.
class QzSegmentedTabs extends StatelessWidget {
  const QzSegmentedTabs({
    super.key,
    required this.options,
    required this.value,
    required this.onChanged,
    this.size = QzSegSize.sm,
  }) : assert(options.length > 0, 'QzSegmentedTabs.options must not be empty');

  final List<String> options;
  final String value;
  final ValueChanged<String> onChanged;
  final QzSegSize size;

  @override
  Widget build(BuildContext context) {
    assert(
      options.contains(value),
      'QzSegmentedTabs: value "$value" must be one of options $options',
    );
    final QzColorScheme c = context.qzScheme;
    final double height = size == QzSegSize.md ? 32 : 28;
    final double hPad = size == QzSegSize.md ? 14 : 10;
    return Wrap(
      spacing: QzSpacing.xs,
      runSpacing: QzSpacing.xs,
      children: <Widget>[
        for (final String opt in options)
          _Segment(
            label: opt,
            selected: opt == value,
            height: height,
            horizontalPadding: hPad,
            scheme: c,
            onTap: () => onChanged(opt),
          ),
      ],
    );
  }
}

class _Segment extends StatelessWidget {
  const _Segment({
    required this.label,
    required this.selected,
    required this.height,
    required this.horizontalPadding,
    required this.scheme,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final double height;
  final double horizontalPadding;
  final QzColorScheme scheme;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final BorderRadius radius = BorderRadius.circular(QzRadii.pill);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: radius,
        child: Container(
          height: height,
          padding: EdgeInsets.symmetric(horizontal: horizontalPadding),
          decoration: BoxDecoration(
            color: selected ? scheme.accentSoft : scheme.bgElev,
            border: Border.all(
              color: selected ? scheme.accentRing : scheme.border,
            ),
            borderRadius: radius,
          ),
          child: Align(
            widthFactor: 1,
            alignment: Alignment.center,
            child: Text(
              label,
              style: TextStyle(
                color: selected ? scheme.accent : scheme.textMid,
                fontSize: 12,
                fontWeight: FontWeight.w500,
                height: 1.0,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
