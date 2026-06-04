import 'package:flutter/material.dart';

import '../../../data/models/backtest_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';
import '../../../widgets/qz_card.dart';
import '../../../widgets/qz_chip.dart';
part 'qz_backtest_result_card.tabs.part.dart';
part 'qz_backtest_result_card.panels.part.dart';

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

