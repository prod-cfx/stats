import 'package:flutter/material.dart';

import '../../../data/models/ticker_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';

/// 交易详情顶部价格头，三行对齐设计稿 `m-screens-3.jsx`：
/// 1. 大价格 + 涨跌额(%)
/// 2. 4 格：指数价格 / 标记价格 / 资金费率 / 持仓量
/// 3. 3 格：24H 高 / 24H 低 / 24H 量
///
/// 数据来自 `Ticker` 单一来源；后端未返回的字段显示 `--`，不在 widget 内用
/// 最新价或成交量派生业务真值。
class MarketDetailStats extends StatelessWidget {
  const MarketDetailStats({
    super.key,
    required this.displaySymbol,
    required this.ticker,
  });

  final String displaySymbol;
  final Ticker ticker;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final bool up = ticker.changePercent >= 0;
    final Color priceColor = up ? c.marketUp : c.marketDown;

    final double changeAbs = ticker.price * ticker.changePercent / 100;
    final String changeAbsStr =
        '${up ? '+' : '-'}${changeAbs.abs().toStringAsFixed(2)}';
    final String changePctStr =
        '${up ? '+' : ''}${ticker.changePercent.toStringAsFixed(2)}%';

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        QzSpacing.lg,
        QzSpacing.md,
        QzSpacing.lg,
        QzSpacing.sm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          // 窄屏（420 - padding = 388px）放不下大价格 + 完整涨跌串时，
          // 由 FittedBox 等比缩放整行；价格与涨跌额作为整体出现/隐藏前的
          // 兜底，避免任何 RenderFlex overflow。
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Text(
                  ticker.price.toStringAsFixed(2),
                  style: TextStyle(
                    color: priceColor,
                    fontSize: 26,
                    fontWeight: FontWeight.w700,
                    letterSpacing: -0.5,
                    fontFamily: QzFont.mono,
                    fontFamilyFallback: QzFont.monoFallback,
                  ),
                ),
                const SizedBox(width: QzSpacing.md),
                Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Text(
                    '$changeAbsStr ($changePctStr)',
                    style: TextStyle(
                      color: priceColor,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      fontFamily: QzFont.mono,
                      fontFamilyFallback: QzFont.monoFallback,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: QzSpacing.sm),
          // row 2：指数 / 标记 / 资金费率 / 持仓量
          Row(
            children: <Widget>[
              _StatCell(
                label: l10n.marketDetailIndexPrice,
                value: _fmtNullablePrice(ticker.indexPrice),
              ),
              _StatCell(
                label: l10n.marketDetailMarkPrice,
                value: _fmtNullablePrice(ticker.markPrice),
              ),
              _StatCell(
                label: l10n.marketDetailFundingRate,
                value: _fmtNullablePercent(ticker.fundingRate),
              ),
              _StatCell(
                label: l10n.marketDetailOpenInterest,
                value: _fmtNullableCompact(ticker.openInterest),
              ),
            ],
          ),
          const SizedBox(height: QzSpacing.sm),
          // row 3：24H 高 / 低 / 量
          Row(
            children: <Widget>[
              _StatCell(
                label: l10n.marketDetail24hHigh,
                value: _fmtNullablePrice(ticker.high24h),
              ),
              _StatCell(
                label: l10n.marketDetail24hLow,
                value: _fmtNullablePrice(ticker.low24h),
              ),
              _StatCell(
                label: l10n.marketDetail24hVolume,
                value: _fmtCompact(ticker.volume24h),
              ),
              const Spacer(),
            ],
          ),
        ],
      ),
    );
  }

  static String _fmtPrice(double v) {
    return v.toStringAsFixed(2);
  }

  static String _fmtNullablePrice(double? v) {
    return v == null ? '--' : _fmtPrice(v);
  }

  static String _fmtPercent(double v) {
    final double percent = v * 100;
    return '${percent >= 0 ? '+' : ''}${percent.toStringAsFixed(2)}%';
  }

  static String _fmtNullablePercent(double? v) {
    return v == null ? '--' : _fmtPercent(v);
  }

  static String _fmtCompact(double v) {
    final double abs = v.abs();
    if (abs >= 1e9) return '${(v / 1e9).toStringAsFixed(2)}B';
    if (abs >= 1e6) return '${(v / 1e6).toStringAsFixed(2)}M';
    if (abs >= 1e3) return '${(v / 1e3).toStringAsFixed(2)}K';
    return v.toStringAsFixed(2);
  }

  static String _fmtNullableCompact(double? v) {
    return v == null ? '--' : _fmtCompact(v);
  }
}

class _StatCell extends StatelessWidget {
  const _StatCell({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(label, style: TextStyle(color: c.textDim, fontSize: 11)),
          const SizedBox(height: 2),
          Text(
            value,
            style: TextStyle(
              color: c.text,
              fontSize: 12,
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
