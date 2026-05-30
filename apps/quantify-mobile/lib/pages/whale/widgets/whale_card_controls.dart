import 'package:flutter/material.dart';

import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';

/// 发现 tab 卡片复用控件（issue #1860）。
///
/// 设计真源：`design/project/mobile/m-screens-whale-discover.jsx` 的
/// `CopyBtn`（`:127`）、`TrendBtn`（`:141`）与地址按钮（hero `:332` / 列表 `:423`）。
/// hero 卡与列表卡共用，避免重复实现地址 chevron + 紫色虚线下划线 / 复制 / 趋势。

/// 地址按钮：地址文本 + chevron `>` + 紫色虚线下划线，点击触发 [onOpen]（进详情页）。
class WhaleAddressLink extends StatelessWidget {
  const WhaleAddressLink({
    required this.address,
    required this.onOpen,
    this.fontSize = 14,
    super.key,
  });

  final String address;
  final VoidCallback onOpen;
  final double fontSize;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return InkWell(
      onTap: onOpen,
      borderRadius: BorderRadius.circular(4),
      child: CustomPaint(
        painter: _DashedUnderlinePainter(c.accent.withValues(alpha: 0.4)),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(4, 2, 4, 3),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Flexible(
                child: Text(
                  address,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: c.accent,
                    fontSize: fontSize,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              const SizedBox(width: 3),
              Icon(
                Icons.chevron_right,
                size: fontSize + 2,
                color: c.accent.withValues(alpha: 0.7),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// 复制按钮：点击复制地址并提示「地址已复制」。
class WhaleCopyButton extends StatelessWidget {
  const WhaleCopyButton({required this.onCopy, super.key});

  final VoidCallback onCopy;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    return IconButton(
      onPressed: onCopy,
      icon: const Icon(Icons.copy_rounded),
      iconSize: 13,
      color: c.textDim,
      tooltip: l10n.whaleLeaderCopyTooltip,
      visualDensity: VisualDensity.compact,
      padding: EdgeInsets.zero,
      constraints: const BoxConstraints(minWidth: 24, minHeight: 24),
    );
  }
}

/// 趋势按钮：紫色描边方块图标，点击触发 [onStats]（打开交易统计弹窗）。
class WhaleTrendButton extends StatelessWidget {
  const WhaleTrendButton({required this.onStats, super.key});

  final VoidCallback onStats;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    return Tooltip(
      message: l10n.whaleLeaderTrendTooltip,
      child: InkWell(
        onTap: onStats,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          width: 32,
          height: 32,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: c.bgElev,
            border: Border.all(color: c.borderSoft),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(Icons.trending_up, size: 15, color: c.accent),
        ),
      ),
    );
  }
}

/// 单层紫色虚线下划线（对齐设计 `1px dashed violet66`）。
class _DashedUnderlinePainter extends CustomPainter {
  const _DashedUnderlinePainter(this.color);

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final Paint paint = Paint()
      ..color = color
      ..strokeWidth = 1;
    const double dash = 3;
    const double gap = 2;
    double x = 0;
    final double y = size.height - 0.5;
    while (x < size.width) {
      canvas.drawLine(Offset(x, y), Offset(x + dash, y), paint);
      x += dash + gap;
    }
  }

  @override
  bool shouldRepaint(_DashedUnderlinePainter oldDelegate) =>
      oldDelegate.color != color;
}
