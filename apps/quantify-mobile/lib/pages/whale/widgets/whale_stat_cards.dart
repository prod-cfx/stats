import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../data/models/whale_profile_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';

/// 基本信息 tab 的 2×2 stat 卡（设计稿 `WhaleProfileDetail` `:816`）。
///
/// 前 3 张消费 [WhaleProfileStatCards]（账户总价值 / 可用保证金 / 总持仓价值，
/// 含 donut + extras 行）；第 4 张交易表现卡渲染 4 指标（设计稿 `PerfCard` `:1050`）：
/// 胜率 [WhaleTradeStats.winRatePct] / 最大回撤 [WhaleTradeStats.maxDrawdownDisplay]
/// / 已成交订单 [WhaleTradeStats.filledOrders] / 平仓次数 [WhaleTradeStats.closedCount]。
/// 后 3 项当前由 fixtures 占位，真值依赖读路径 #1682。
class WhaleStatCards extends StatelessWidget {
  const WhaleStatCards({super.key, required this.cards, required this.stats});

  final WhaleProfileStatCards cards;
  final WhaleTradeStats stats;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: QzSpacing.sm,
      crossAxisSpacing: QzSpacing.sm,
      childAspectRatio: 1.12,
      children: <Widget>[
        _StatCard(
          label: l10n.whaleProfileStatAccountValue,
          value: cards.accountValueDisplay,
          extras: cards.accountExtras,
          donut: cards.accountDonut,
        ),
        _StatCard(
          label: l10n.whaleProfileStatAvailMargin,
          value: cards.availableMarginDisplay,
          extras: cards.marginExtras,
          donut: cards.marginDonut,
        ),
        _StatCard(
          label: l10n.whaleProfileStatPositionValue,
          value: cards.positionValueDisplay,
          extras: cards.positionExtras,
          donut: cards.positionDonut,
        ),
        _PerfCard(stats: stats),
      ],
    );
  }
}

class _CardShell extends StatelessWidget {
  const _CardShell({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      padding: const EdgeInsets.all(QzSpacing.md),
      decoration: BoxDecoration(
        color: c.bgElev,
        border: Border.all(color: c.borderSoft),
        borderRadius: BorderRadius.circular(12),
      ),
      child: child,
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.label,
    required this.value,
    required this.extras,
    required this.donut,
  });

  final String label;
  final String value;
  final List<WhaleStatCardExtra> extras;
  final WhaleStatCardDonut donut;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return _CardShell(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(label, style: TextStyle(fontSize: 11, color: c.textMid)),
          const SizedBox(height: QzSpacing.xxs),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: <Widget>[
              Expanded(
                child: Text(
                  value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: c.text,
                    letterSpacing: -0.3,
                    fontFamily: QzFont.mono,
                    fontFamilyFallback: QzFont.monoFallback,
                  ),
                ),
              ),
              const SizedBox(width: QzSpacing.sm),
              _DonutMini(donut: donut),
            ],
          ),
          const SizedBox(height: QzSpacing.sm),
          for (final WhaleStatCardExtra e in extras) _ExtraRow(extra: e),
        ],
      ),
    );
  }
}

class _ExtraRow extends StatelessWidget {
  const _ExtraRow({required this.extra});
  final WhaleStatCardExtra extra;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Padding(
      padding: const EdgeInsets.only(top: 5),
      child: Row(
        children: <Widget>[
          Container(
            width: 5,
            height: 5,
            decoration: BoxDecoration(
              color: Color(extra.dotHex),
              borderRadius: BorderRadius.circular(3),
            ),
          ),
          const SizedBox(width: 5),
          Flexible(
            child: Text(
              extra.label,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 10.5, color: c.textMid),
            ),
          ),
          if (extra.info) ...<Widget>[
            const SizedBox(width: 3),
            Icon(Icons.info_outline, size: 9, color: c.textFaint),
          ],
          const Spacer(),
          Text(
            extra.valueDisplay,
            style: TextStyle(
              fontSize: 11,
              color: c.text,
              fontWeight: FontWeight.w500,
              fontFamily: QzFont.mono,
              fontFamilyFallback: QzFont.monoFallback,
            ),
          ),
        ],
      ),
    );
  }
}

/// 第 4 张交易表现卡——4 指标（设计稿 `PerfCard` `:1050`）：
/// 胜率 + 最大回撤为主组，已成交订单 + 平仓次数为 extras 行。
/// 最大回撤 / 已成交订单 / 平仓次数当前由 fixtures 占位，真值依赖 #1682。
class _PerfCard extends StatelessWidget {
  const _PerfCard({required this.stats});
  final WhaleTradeStats stats;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    return _CardShell(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            l10n.whaleProfilePerfTitle,
            style: TextStyle(fontSize: 11, color: c.textMid),
          ),
          const SizedBox(height: QzSpacing.sm),
          _Metric(
            label: l10n.whaleProfileStatWinRate,
            value: '${stats.winRatePct.toStringAsFixed(2)}%',
          ),
          const SizedBox(height: QzSpacing.xs),
          _Metric(
            label: l10n.whaleProfileMaxDrawdown,
            value: stats.maxDrawdownDisplay ?? '-',
          ),
          const SizedBox(height: QzSpacing.xs),
          _Metric(
            label: l10n.whaleProfileFilledOrders,
            value: '${stats.filledOrders ?? 0}',
          ),
          const SizedBox(height: QzSpacing.xs),
          _Metric(
            label: l10n.whaleProfileClosedCount,
            value: '${stats.closedCount ?? 0}',
          ),
        ],
      ),
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: <Widget>[
        Text(label, style: TextStyle(fontSize: 10.5, color: c.textDim)),
        Text(
          value,
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: c.text,
            letterSpacing: -0.3,
            fontFamily: QzFont.mono,
            fontFamilyFallback: QzFont.monoFallback,
          ),
        ),
      ],
    );
  }
}

class _DonutMini extends StatelessWidget {
  const _DonutMini({required this.donut});
  final WhaleStatCardDonut donut;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return SizedBox(
      width: 38,
      height: 38,
      child: CustomPaint(
        painter: _DonutMiniPainter(donut: donut, track: c.bgSoft),
      ),
    );
  }
}

class _DonutMiniPainter extends CustomPainter {
  _DonutMiniPainter({required this.donut, required this.track});
  final WhaleStatCardDonut donut;
  final Color track;

  @override
  void paint(Canvas canvas, Size size) {
    const double stroke = 6;
    final double r = size.width / 2 - stroke / 2;
    final Offset center = Offset(size.width / 2, size.height / 2);
    final Rect rect = Rect.fromCircle(center: center, radius: r);
    const double start = -math.pi / 2;

    final Paint p = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke;

    p.color = track;
    canvas.drawCircle(center, r, p);

    p.color = Color(donut.colorAHex);
    canvas.drawArc(rect, start, 2 * math.pi * donut.a, false, p);
    p.color = Color(donut.colorBHex);
    canvas.drawArc(
      rect,
      start + 2 * math.pi * donut.a,
      2 * math.pi * donut.b,
      false,
      p,
    );
  }

  @override
  bool shouldRepaint(_DonutMiniPainter old) =>
      old.donut != donut || old.track != track;
}
