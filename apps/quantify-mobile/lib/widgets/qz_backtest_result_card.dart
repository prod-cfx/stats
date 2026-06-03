import 'package:flutter/material.dart';

import '../data/models/backtest_models.dart';
import '../l10n/app_localizations.dart';
import '../theme/colors.dart';
import '../theme/theme_context.dart';
import '../theme/tokens.dart';
import 'qz_card.dart';
import 'qz_chip.dart';

/// 回测结果卡，内联渲染在 AI 对话流中，对齐设计稿 `ScreenBacktestResult`：
///
/// - 顶部状态行（回测完成 / 区间 / 可部署）
/// - Hero：累计净值大字 + CAGR + 下载按钮，下方带回撤红点的净值曲线
/// - 关键指标 8 格（CAGR / Sharpe / 最大回撤 / Calmar / 胜率 / 盈亏比 / 总交易 / 平均持仓）
/// - 3 Tab：月度回报热力图 / 交易记录 / 风险分析
/// - AI 评估条（accentSoft 底 + bot 图标）
///
/// 「一键部署」CTA 与「上一步」属导航向导（#1890）范畴，由 `ai_home_page`
/// 在卡片下方提供，本卡只负责结果展示。
class QzBacktestResultCard extends StatefulWidget {
  const QzBacktestResultCard({
    super.key,
    required this.result,
    this.onDownload,
  });

  final BacktestResult result;

  /// 下载回测报告回调。mock 场景为 null（按钮渲染但无副作用）。
  final VoidCallback? onDownload;

  @override
  State<QzBacktestResultCard> createState() => _QzBacktestResultCardState();
}

enum _ResultTab { monthly, trades, risk }

class _QzBacktestResultCardState extends State<QzBacktestResultCard> {
  _ResultTab _tab = _ResultTab.monthly;

  String _rangeLabel() {
    final DateTime s = widget.result.rangeStart;
    final DateTime e = widget.result.rangeEnd;
    String ym(DateTime d) => '${d.year}-${d.month.toString().padLeft(2, '0')}';
    return '${ym(s)} → ${ym(e)}';
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final BacktestResult r = widget.result;
    final bool up = r.totalReturnPercent >= 0;
    final Color heroColor = up ? c.marketUp : c.marketDown;

    return QzCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          // 状态行
          Row(
            children: <Widget>[
              QzChip(tone: QzChipTone.ok, label: l10n.backtestResultStatusDone),
              const SizedBox(width: QzSpacing.sm),
              Expanded(
                child: Text(
                  _rangeLabel(),
                  style: TextStyle(
                    color: c.textDim,
                    fontSize: 11,
                    fontFeatures: const <FontFeature>[
                      FontFeature.tabularFigures(),
                    ],
                  ),
                ),
              ),
              QzChip(
                tone: QzChipTone.accent,
                label: l10n.backtestResultStatusDeployable,
              ),
            ],
          ),
          const SizedBox(height: QzSpacing.md),
          // Hero：累计净值 + CAGR + 下载
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      l10n.backtestResultCumulativeNetValue,
                      style: TextStyle(color: c.textDim, fontSize: 11),
                    ),
                    const SizedBox(height: QzSpacing.xxs),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: <Widget>[
                        Flexible(
                          child: Text(
                            '${up ? '+' : ''}${r.totalReturnPercent.toStringAsFixed(1)}%',
                            style: TextStyle(
                              color: heroColor,
                              fontSize: 30,
                              fontWeight: FontWeight.w700,
                              letterSpacing: -0.5,
                            ),
                          ),
                        ),
                        const SizedBox(width: QzSpacing.sm),
                        Text(
                          '· ${l10n.backtestResultCagrInline} ${r.cagrPercent >= 0 ? '+' : ''}${r.cagrPercent.toStringAsFixed(1)}%',
                          style: TextStyle(color: c.textMid, fontSize: 12),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              _DownloadButton(
                onTap: widget.onDownload,
                tooltip: l10n.backtestResultDownloadLabel,
              ),
            ],
          ),
          const SizedBox(height: QzSpacing.md),
          SizedBox(
            height: 120,
            width: double.infinity,
            child: CustomPaint(
              painter: _EquityCurvePainter(
                points: r.equityCurve,
                markers: r.drawdownMarkers,
                lineColor: heroColor,
                fillColor: heroColor.withValues(alpha: 0.16),
                markerColor: c.marketDown,
                markerBorder: c.bgElev,
              ),
            ),
          ),
          const SizedBox(height: QzSpacing.md),
          // 关键指标 8 格
          _MetricsGrid(result: r),
          const SizedBox(height: QzSpacing.md),
          // Tab 切换
          _ResultSegmentedTabs(
            options: <String>[
              l10n.backtestResultTabMonthly,
              l10n.backtestResultTabTrades,
              l10n.backtestResultTabRisk,
            ],
            value: switch (_tab) {
              _ResultTab.monthly => l10n.backtestResultTabMonthly,
              _ResultTab.trades => l10n.backtestResultTabTrades,
              _ResultTab.risk => l10n.backtestResultTabRisk,
            },
            onChanged: (String v) {
              setState(() {
                if (v == l10n.backtestResultTabTrades) {
                  _tab = _ResultTab.trades;
                } else if (v == l10n.backtestResultTabRisk) {
                  _tab = _ResultTab.risk;
                } else {
                  _tab = _ResultTab.monthly;
                }
              });
            },
          ),
          const SizedBox(height: QzSpacing.md),
          switch (_tab) {
            _ResultTab.monthly => _MonthlyHeatmap(rows: r.monthlyRows),
            _ResultTab.trades => _TradeList(trades: r.trades),
            _ResultTab.risk => _RiskAnalysis(rows: r.riskRows),
          },
          const SizedBox(height: QzSpacing.md),
          // AI 评估条
          _AiAssessmentBar(text: r.aiAssessment),
        ],
      ),
    );
  }
}

class _ResultSegmentedTabs extends StatelessWidget {
  const _ResultSegmentedTabs({
    required this.options,
    required this.value,
    required this.onChanged,
  });

  final List<String> options;
  final String value;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      key: const Key('backtest-result-tabs'),
      width: double.infinity,
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: c.bgInput,
        border: Border.all(color: c.borderSoft),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: <Widget>[
          for (final String opt in options)
            Expanded(
              child: GestureDetector(
                key: Key('backtest-result-tab-$opt'),
                behavior: HitTestBehavior.opaque,
                onTap: () => onChanged(opt),
                child: Container(
                  height: 32,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: opt == value ? c.bgElev : Colors.transparent,
                    borderRadius: BorderRadius.circular(7),
                    boxShadow: opt == value
                        ? <BoxShadow>[
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.06),
                              blurRadius: 3,
                              offset: const Offset(0, 1),
                            ),
                          ]
                        : null,
                  ),
                  child: Text(
                    opt,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: opt == value ? c.accent : c.textMid,
                      fontSize: 12,
                      fontWeight: opt == value
                          ? FontWeight.w600
                          : FontWeight.w500,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _DownloadButton extends StatelessWidget {
  const _DownloadButton({required this.onTap, required this.tooltip});

  final VoidCallback? onTap;
  final String tooltip;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Tooltip(
      message: tooltip,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          customBorder: const CircleBorder(),
          child: Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: c.bgElev,
              border: Border.all(color: c.border),
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.file_download_outlined,
              size: 16,
              color: c.textMid,
            ),
          ),
        ),
      ),
    );
  }
}

class _MetricsGrid extends StatelessWidget {
  const _MetricsGrid({required this.result});

  final BacktestResult result;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final List<_Metric> metrics = <_Metric>[
      _Metric(
        label: l10n.backtestResultMetricCagr,
        value:
            '${result.cagrPercent >= 0 ? '+' : ''}${result.cagrPercent.toStringAsFixed(1)}%',
        sub: l10n.backtestResultMetricCagrSub,
        color: result.cagrPercent >= 0 ? c.marketUp : c.marketDown,
      ),
      _Metric(
        label: l10n.backtestResultSharpe,
        value: result.sharpe.toStringAsFixed(2),
        sub: l10n.backtestResultMetricSharpeSub,
        color: c.text,
      ),
      _Metric(
        label: l10n.backtestResultMaxDrawdown,
        value: '${result.maxDrawdownPercent.toStringAsFixed(1)}%',
        sub: l10n.backtestResultMetricMaxDrawdownSub,
        color: c.marketDown,
      ),
      _Metric(
        label: l10n.backtestResultMetricCalmar,
        value: result.calmar.toStringAsFixed(2),
        sub: l10n.backtestResultMetricCalmarSub,
        color: c.text,
      ),
      _Metric(
        label: l10n.backtestResultMetricWinRate,
        value: '${result.winRatePercent.toStringAsFixed(1)}%',
        sub: l10n.backtestResultMetricWinRateSub,
        color: c.text,
      ),
      _Metric(
        label: l10n.backtestResultMetricProfitLoss,
        value: result.profitLossRatio.toStringAsFixed(2),
        sub: l10n.backtestResultMetricProfitLossSub,
        color: c.text,
      ),
      _Metric(
        label: l10n.backtestResultMetricTotalTrades,
        value: '${result.totalTrades}${l10n.backtestResultTradesSuffix}',
        sub: l10n.backtestResultMetricTotalTradesSub,
        color: c.text,
      ),
      _Metric(
        label: l10n.backtestResultMetricAvgHold,
        value: result.avgHoldDuration,
        sub: l10n.backtestResultMetricAvgHoldSub,
        color: c.text,
      ),
    ];

    return Container(
      decoration: BoxDecoration(
        color: c.borderSoft,
        border: Border.all(color: c.border),
        borderRadius: BorderRadius.circular(QzRadii.card),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: <Widget>[
          for (int row = 0; row < metrics.length; row += 2)
            IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  Expanded(child: _MetricCell(metric: metrics[row])),
                  Container(width: 1, color: c.borderSoft),
                  Expanded(child: _MetricCell(metric: metrics[row + 1])),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _Metric {
  const _Metric({
    required this.label,
    required this.value,
    required this.sub,
    required this.color,
  });

  final String label;
  final String value;
  final String sub;
  final Color color;
}

class _MetricCell extends StatelessWidget {
  const _MetricCell({required this.metric});

  final _Metric metric;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      color: c.bgElev,
      padding: const EdgeInsets.symmetric(
        horizontal: QzSpacing.md,
        vertical: QzSpacing.md,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(metric.label, style: TextStyle(color: c.textDim, fontSize: 11)),
          const SizedBox(height: QzSpacing.xxs),
          Text(
            metric.value,
            style: TextStyle(
              color: metric.color,
              fontSize: 17,
              fontWeight: FontWeight.w700,
              fontFeatures: const <FontFeature>[FontFeature.tabularFigures()],
            ),
          ),
          const SizedBox(height: 2),
          Text(metric.sub, style: TextStyle(color: c.textDim, fontSize: 10)),
        ],
      ),
    );
  }
}

/// 月度回报热力图：年×12 网格，正绿负红按幅度调透明度。
class _MonthlyHeatmap extends StatelessWidget {
  const _MonthlyHeatmap({required this.rows});

  final List<BacktestMonthlyRow> rows;

  Color _cellColor(double? v, QzColorScheme c) {
    if (v == null) return c.bgSoft;
    if (v > 0) {
      final double a = (v / 16).clamp(0.0, 1.0) * 0.75 + 0.12;
      return c.marketUp.withValues(alpha: a);
    }
    final double a = (v.abs() / 12).clamp(0.0, 1.0) * 0.75 + 0.12;
    return c.marketDown.withValues(alpha: a);
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    return QzCard(
      padding: const EdgeInsets.all(QzSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          // 月份表头
          Row(
            children: <Widget>[
              const SizedBox(width: 26),
              for (int m = 1; m <= 12; m++)
                Expanded(
                  child: Center(
                    child: Text(
                      '$m',
                      style: TextStyle(color: c.textDim, fontSize: 9),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 3),
          for (final BacktestMonthlyRow row in rows) ...<Widget>[
            Row(
              children: <Widget>[
                SizedBox(
                  width: 26,
                  child: Text(
                    '${row.year}',
                    style: TextStyle(color: c.textMid, fontSize: 9),
                  ),
                ),
                for (final double? v in row.values)
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.all(1.5),
                      child: Container(
                        height: 20,
                        decoration: BoxDecoration(
                          color: _cellColor(v, c),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          v == null
                              ? ''
                              : '${v > 0 ? '+' : ''}${v.toStringAsFixed(0)}',
                          style: TextStyle(
                            color: v == null
                                ? c.textFaint
                                : (v > 0 ? c.marketUp : c.marketDown),
                            fontSize: 8,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 3),
          ],
          const SizedBox(height: QzSpacing.xs),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: <Widget>[
              Text(
                l10n.backtestResultMonthlyLegendLabel,
                style: TextStyle(color: c.textDim, fontSize: 10),
              ),
              Row(
                children: <Widget>[
                  Text(
                    '-15%',
                    style: TextStyle(color: c.marketDown, fontSize: 10),
                  ),
                  const SizedBox(width: QzSpacing.xs),
                  Container(
                    width: 64,
                    height: 8,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(4),
                      gradient: LinearGradient(
                        colors: <Color>[
                          c.marketDown,
                          c.marketDown.withValues(alpha: 0.2),
                          c.marketUp.withValues(alpha: 0.2),
                          c.marketUp,
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: QzSpacing.xs),
                  Text(
                    '+20%',
                    style: TextStyle(color: c.marketUp, fontSize: 10),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// 交易记录列表。
class _TradeList extends StatelessWidget {
  const _TradeList({required this.trades});

  final List<BacktestTrade> trades;

  String _fmtPrice(double v) {
    final String s = v.toStringAsFixed(2);
    final List<String> parts = s.split('.');
    final String intPart = parts[0].replaceAllMapped(
      RegExp(r'(\d)(?=(\d{3})+$)'),
      (Match m) => '${m[1]},',
    );
    return '$intPart.${parts[1]}';
  }

  String _fmtTime(DateTime t) =>
      '${t.year}-${t.month.toString().padLeft(2, '0')}-${t.day.toString().padLeft(2, '0')} '
      '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    return QzCard(
      padding: EdgeInsets.zero,
      child: Column(
        children: <Widget>[
          for (int i = 0; i < trades.length; i++)
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: QzSpacing.md,
                vertical: QzSpacing.md,
              ),
              decoration: BoxDecoration(
                border: i == 0
                    ? null
                    : Border(top: BorderSide(color: c.borderSoft)),
              ),
              child: Row(
                children: <Widget>[
                  Container(
                    width: 24,
                    height: 24,
                    decoration: BoxDecoration(
                      color: (trades[i].win ? c.marketUp : c.marketDown)
                          .withValues(alpha: 0.14),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      trades[i].side == 'long'
                          ? l10n.backtestResultTradeSideLong
                          : l10n.backtestResultTradeSideShort,
                      style: TextStyle(
                        color: trades[i].win ? c.marketUp : c.marketDown,
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const SizedBox(width: QzSpacing.sm),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Row(
                          children: <Widget>[
                            Text(
                              _fmtPrice(trades[i].entry),
                              style: TextStyle(color: c.text, fontSize: 12),
                            ),
                            Text(
                              ' → ',
                              style: TextStyle(color: c.textDim, fontSize: 12),
                            ),
                            Text(
                              _fmtPrice(trades[i].exit),
                              style: TextStyle(color: c.text, fontSize: 12),
                            ),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${_fmtTime(trades[i].time)} · ${l10n.backtestResultTradeHoldPrefix} ${trades[i].duration}',
                          style: TextStyle(color: c.textDim, fontSize: 10),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: QzSpacing.sm),
                  Text(
                    '${trades[i].pnlPercent > 0 ? '+' : ''}${trades[i].pnlPercent.toStringAsFixed(2)}%',
                    style: TextStyle(
                      color: trades[i].win ? c.marketUp : c.marketDown,
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// 风险分析：每行 label/value + 进度条 + 说明。
class _RiskAnalysis extends StatelessWidget {
  const _RiskAnalysis({required this.rows});

  final List<BacktestRiskRow> rows;

  Color _toneColor(BacktestRiskTone tone, QzColorScheme c) {
    switch (tone) {
      case BacktestRiskTone.danger:
        return c.statusDanger;
      case BacktestRiskTone.warn:
        return c.statusWarn;
      case BacktestRiskTone.neutral:
        return c.textMid;
    }
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return QzCard(
      padding: const EdgeInsets.all(QzSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          for (int i = 0; i < rows.length; i++)
            Padding(
              padding: EdgeInsets.only(top: i == 0 ? 0 : QzSpacing.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: <Widget>[
                      Text(
                        rows[i].label,
                        style: TextStyle(
                          color: c.text,
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      Text(
                        rows[i].value,
                        style: TextStyle(
                          color: _toneColor(rows[i].tone, c),
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: QzSpacing.xxs),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(2),
                    child: LinearProgressIndicator(
                      value: rows[i].barFraction.clamp(0.0, 1.0),
                      minHeight: 4,
                      backgroundColor: c.bgSoft,
                      valueColor: AlwaysStoppedAnimation<Color>(
                        _toneColor(rows[i].tone, c),
                      ),
                    ),
                  ),
                  const SizedBox(height: 5),
                  Text(
                    rows[i].note,
                    style: TextStyle(color: c.textDim, fontSize: 11),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _AiAssessmentBar extends StatelessWidget {
  const _AiAssessmentBar({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: QzSpacing.md,
        vertical: QzSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: c.accentSoft,
        borderRadius: BorderRadius.circular(QzRadii.input),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Icon(Icons.smart_toy_outlined, size: 14, color: c.accent),
          const SizedBox(width: QzSpacing.sm),
          Expanded(
            child: RichText(
              text: TextSpan(
                style: TextStyle(color: c.accent, fontSize: 12, height: 1.5),
                children: <InlineSpan>[
                  TextSpan(
                    text: l10n.backtestResultAiPrefix,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  TextSpan(text: text),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// 净值曲线：归一化描边 + 渐变填充 + 回撤红点 markers。空/单点画平基线。
class _EquityCurvePainter extends CustomPainter {
  _EquityCurvePainter({
    required this.points,
    required this.markers,
    required this.lineColor,
    required this.fillColor,
    required this.markerColor,
    required this.markerBorder,
  });

  final List<double> points;
  final List<int> markers;
  final Color lineColor;
  final Color fillColor;
  final Color markerColor;
  final Color markerBorder;

  @override
  void paint(Canvas canvas, Size size) {
    if (points.isEmpty) return;

    double minV = points.first;
    double maxV = points.first;
    for (final double v in points) {
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
    final double span = (maxV - minV).abs();
    final double dx = points.length > 1
        ? size.width / (points.length - 1)
        : size.width;

    double xAt(int i) => dx * i;
    double yAt(double v) {
      final double normY = span == 0 ? 0.5 : (v - minV) / span;
      return size.height - normY * size.height;
    }

    // baseline grid
    final Paint grid = Paint()
      ..color = lineColor.withValues(alpha: 0.12)
      ..strokeWidth = 1;
    for (final double f in <double>[0.25, 0.5, 0.75]) {
      canvas.drawLine(
        Offset(0, size.height * f),
        Offset(size.width, size.height * f),
        grid,
      );
    }

    final Path line = Path();
    for (int i = 0; i < points.length; i++) {
      final double x = xAt(i);
      final double y = yAt(points[i]);
      if (i == 0) {
        line.moveTo(x, y);
      } else {
        line.lineTo(x, y);
      }
    }

    // fill under the curve
    final Path fill = Path.from(line)
      ..lineTo(xAt(points.length - 1), size.height)
      ..lineTo(0, size.height)
      ..close();
    canvas.drawPath(fill, Paint()..color = fillColor);

    canvas.drawPath(
      line,
      Paint()
        ..color = lineColor
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.8
        ..strokeJoin = StrokeJoin.round,
    );

    // drawdown markers
    for (final int i in markers) {
      if (i < 0 || i >= points.length) continue;
      final Offset o = Offset(xAt(i), yAt(points[i]));
      canvas.drawCircle(o, 3.5, Paint()..color = markerBorder);
      canvas.drawCircle(o, 2.5, Paint()..color = markerColor);
    }
  }

  @override
  bool shouldRepaint(covariant _EquityCurvePainter old) {
    return old.points != points ||
        old.markers != markers ||
        old.lineColor != lineColor ||
        old.fillColor != fillColor ||
        old.markerColor != markerColor;
  }
}
