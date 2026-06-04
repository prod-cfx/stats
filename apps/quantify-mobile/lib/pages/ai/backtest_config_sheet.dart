import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import '../../widgets/qz_step_bar.dart';
import '../../widgets/qz_top_bar.dart';
import '../../widgets/qz_top_cancel_button.dart';
import 'backtest_config_sheet_controller.dart';
import 'backtest_config_sheet_state.dart';
part 'backtest_config_sheet.form.part.dart';
part 'backtest_config_sheet.matching.part.dart';

/// Backtest configuration sheet — route `/ai/backtest-config`.
///
/// 视觉基准：`design/project/mobile/m-screens-btconfig.jsx` + 设计稿截图。
class BacktestConfigSheet extends ConsumerStatefulWidget {
  const BacktestConfigSheet({super.key});

  @override
  ConsumerState<BacktestConfigSheet> createState() =>
      _BacktestConfigSheetState();
}

class _BacktestConfigSheetState extends ConsumerState<BacktestConfigSheet> {
  static const List<({String key, int days})> _ranges =
      <({String key, int days})>[
        (key: '7D', days: 7),
        (key: '30D', days: 30),
        (key: '90D', days: 90),
        (key: '1Y', days: 365),
        (key: 'custom', days: 0),
      ];

  static const List<({String label, int value})> _capitalPresets =
      <({String label, int value})>[
        (label: '1k', value: 1000),
        (label: '5k', value: 5000),
        (label: '10k', value: 10000),
        (label: '50k', value: 50000),
        (label: '100k', value: 100000),
      ];

  static const Map<String, String> _rangeText = <String, String>{
    '7D': '2026-05-19 → 2026-05-26',
    '30D': '2026-04-26 → 2026-05-26',
    '90D': '2026-02-26 → 2026-05-26',
    '1Y': '2025-05-26 → 2026-05-26',
    'custom': '选择起止日期',
  };

  static final List<TextInputFormatter> _integerFormatters =
      <TextInputFormatter>[
        FilteringTextInputFormatter.digitsOnly,
        TextInputFormatter.withFunction((
          TextEditingValue oldV,
          TextEditingValue newV,
        ) {
          if (newV.text.isEmpty) return newV;
          final int value = int.tryParse(newV.text) ?? 0;
          if (value > 100) {
            return TextEditingValue(
              text: '100',
              selection: TextSelection.collapsed(offset: 3),
            );
          }
          return newV;
        }),
      ];

  // 6 个输入框控制器保留在 widget（输入框瞬时态属表单局部）。流程/校验态
  // （rangeKey/fillSource/partialData/futures/error）已迁入 controller。
  final TextEditingController _capital = TextEditingController(text: '10000');
  final TextEditingController _leverage = TextEditingController(text: '5');
  final TextEditingController _slippage = TextEditingController(text: '5');
  final TextEditingController _fee = TextEditingController(text: '2');
  final TextEditingController _start = TextEditingController(
    text: '2025-12-01',
  );
  final TextEditingController _end = TextEditingController(text: '2026-05-26');

  BacktestConfigSheetController get _ctrl =>
      ref.read(backtestConfigSheetControllerProvider.notifier);

  @override
  void initState() {
    super.initState();
    // summary 卡需随资金/滑点/手续费输入实时回显 → 监听重建。
    _capital.addListener(_onInputChanged);
    _leverage.addListener(_onInputChanged);
    _slippage.addListener(_onInputChanged);
    _fee.addListener(_onInputChanged);
    _start.addListener(_onInputChanged);
    _end.addListener(_onInputChanged);
  }

  void _onInputChanged() {
    // 6 个保留控制器的文本驱动 summary 实时回显 → 触发 widget 重建。
    // 这是输入框局部态重建，非页面级流程态，按 issue 边界保留在 widget。
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _capital.removeListener(_onInputChanged);
    _leverage.removeListener(_onInputChanged);
    _slippage.removeListener(_onInputChanged);
    _fee.removeListener(_onInputChanged);
    _start.removeListener(_onInputChanged);
    _end.removeListener(_onInputChanged);
    _capital.dispose();
    _leverage.dispose();
    _slippage.dispose();
    _fee.dispose();
    _start.dispose();
    _end.dispose();
    super.dispose();
  }

  /// 数值字段白名单：仅允许 0-9 + 单个小数点（拦截负号 / 字母 / 多余点）。
  static final List<TextInputFormatter> _numericFormatters =
      <TextInputFormatter>[
        FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')),
        TextInputFormatter.withFunction((
          TextEditingValue oldV,
          TextEditingValue newV,
        ) {
          final int dots = '.'.allMatches(newV.text).length;
          return dots > 1 ? oldV : newV;
        }),
      ];

  void _clearError() => _ctrl.clearError();

  /// 成交价来源 i18n 标签（用于 segmented + summary 回显）。
  String _fillSourceLabel(AppLocalizations l10n, String fillSource) {
    switch (fillSource) {
      case 'open':
        return l10n.backtestFillOpen;
      case 'mid':
        return l10n.backtestFillMid;
      default:
        return l10n.backtestFillClose;
    }
  }

  String _rangeEchoText(AppLocalizations l10n, String rangeKey) {
    if (rangeKey == 'custom') {
      final DateTime? s = DateTime.tryParse(_start.text.trim());
      final DateTime? e = DateTime.tryParse(_end.text.trim());
      final int days = (s == null || e == null)
          ? 0
          : e.difference(s).inDays.clamp(0, 1 << 30);
      return l10n.backtestRangeCustomSummary(
        days.toString(),
        (days * 96).toString(),
      );
    }
    return '数据范围:${_rangeText[rangeKey] ?? _rangeText['30D']!}';
  }

  String _summaryRangeValue(String rangeKey) => rangeKey == 'custom'
      ? '${_start.text.trim()} → ${_end.text.trim()}'
      : rangeKey;

  String _summaryCapitalValue() {
    final double v = double.tryParse(_capital.text.trim()) ?? 0;
    // 千分位，去掉无意义小数（10000 → 10,000）。
    final int intPart = v.truncate();
    final String digits = intPart.toString();
    final StringBuffer b = StringBuffer();
    for (int i = 0; i < digits.length; i++) {
      if (i > 0 && (digits.length - i) % 3 == 0) b.write(',');
      b.write(digits[i]);
    }
    return '\$$b';
  }

  String _leverageLabel() =>
      '${_leverage.text.trim().isEmpty ? '5' : _leverage.text.trim()}x';

  String _summaryMarketValue(AppLocalizations l10n, bool futures) => futures
      ? l10n.backtestSummaryMarketFutures(_leverageLabel())
      : l10n.backtestSummaryMarketSpot;

  String _summaryMatchingValue(AppLocalizations l10n, String fillSource) =>
      l10n.backtestSummaryMatchingValue(
        _slippage.text.trim().isEmpty ? '0' : _slippage.text.trim(),
        _fee.text.trim().isEmpty ? '0' : _fee.text.trim(),
        _fillSourceLabel(l10n, fillSource),
      );

  /// 校验取值依赖留在 widget 的输入框控制器，故解析在此完成；结果（错误/通过）
  /// 经 controller 推进流程态。
  Future<void> _submit() async {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final BacktestConfigSheetState st = ref.read(
      backtestConfigSheetControllerProvider,
    );
    if (st.rangeKey == 'custom') {
      final DateTime? s = DateTime.tryParse(_start.text.trim());
      final DateTime? e = DateTime.tryParse(_end.text.trim());
      if (s == null || e == null) {
        _ctrl.setError(l10n.backtestErrorInvalidDate);
        return;
      }
      if (!e.isAfter(s)) {
        _ctrl.setError(l10n.backtestErrorEndBeforeStart);
        return;
      }
    }
    final double? capital = double.tryParse(_capital.text.trim());
    if (capital == null || capital <= 0) {
      _ctrl.setError(l10n.backtestErrorInvalidCapital);
      return;
    }
    final double? slippageBps = double.tryParse(_slippage.text.trim());
    if (slippageBps == null || slippageBps < 0) {
      _ctrl.setError(l10n.backtestErrorInvalidSlippage);
      return;
    }
    final double? feeBps = double.tryParse(_fee.text.trim());
    if (feeBps == null || feeBps < 0) {
      _ctrl.setError(l10n.backtestErrorInvalidFee);
      return;
    }
    final int? leverage = int.tryParse(_leverage.text.trim());
    if (st.futures && (leverage == null || leverage <= 0 || leverage > 100)) {
      _ctrl.setError(l10n.backtestErrorInvalidCapital);
      return;
    }

    if (!mounted) return;
    _ctrl.clearError();
    context.push('/ai/backtest-run');
  }

  void _cancel() {
    context.pop();
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final BacktestConfigSheetState st = ref.watch(
      backtestConfigSheetControllerProvider,
    );
    final double bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    return Scaffold(
      backgroundColor: c.bg,
      resizeToAvoidBottomInset: false,
      appBar: QzTopBar(
        title: '回测设置',
        subtitle: '设置如何回测这条策略',
        onBack: () => context.pop(),
        actions: <Widget>[
          QzTopCancelButton(
            label: l10n.commonCancel,
            onTap: () => context.go('/ai'),
          ),
        ],
      ),
      body: SafeArea(
        top: false,
        child: Column(
          children: <Widget>[
            QzStepBar(
              steps: <String>[
                l10n.aiStepConfirm,
                l10n.aiStepScript,
                l10n.aiStepBacktestConfig,
                l10n.aiStepBacktest,
                l10n.aiStepDeploy,
              ],
              active: 2,
              done: const <int>[0, 1],
            ),
            Expanded(
              child: Stack(
                children: <Widget>[
                  SingleChildScrollView(
                    key: const Key('backtest-scroll'),
                    padding: const EdgeInsets.only(
                      left: QzSpacing.lg,
                      top: QzSpacing.md,
                      right: QzSpacing.lg,
                      bottom: 100,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        _RecapStrip(scheme: c),
                        const SizedBox(height: 14),
                        _SectionTitle(
                          scheme: c,
                          title: l10n.backtestFieldRange,
                        ),
                        _SectionCard(
                          scheme: c,
                          marginBottom: 14,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: <Widget>[
                              _RangeChips(
                                ranges: _ranges,
                                value: st.rangeKey,
                                l10n: l10n,
                                scheme: c,
                                onChanged: _ctrl.setRange,
                              ),
                              if (st.isCustomRange) ...<Widget>[
                                const SizedBox(height: 14),
                                Row(
                                  children: <Widget>[
                                    Expanded(
                                      child: _DateField(
                                        key: const Key('backtest-start'),
                                        label: l10n.commonStart,
                                        controller: _start,
                                        scheme: c,
                                        onChanged: (_) => _clearError(),
                                      ),
                                    ),
                                    Padding(
                                      padding: const EdgeInsets.only(
                                        left: QzSpacing.xs,
                                        right: QzSpacing.xs,
                                        top: 20,
                                      ),
                                      child: Icon(
                                        Icons.arrow_forward_rounded,
                                        size: 14,
                                        color: c.textDim,
                                      ),
                                    ),
                                    Expanded(
                                      child: _DateField(
                                        key: const Key('backtest-end'),
                                        label: l10n.commonEnd,
                                        controller: _end,
                                        scheme: c,
                                        onChanged: (_) => _clearError(),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                              const SizedBox(height: 10),
                              Text(
                                key: const Key('backtest-range-echo'),
                                _rangeEchoText(l10n, st.rangeKey),
                                style: TextStyle(
                                  color: c.textDim,
                                  fontSize: 11,
                                  fontFeatures: const <FontFeature>[
                                    FontFeature.tabularFigures(),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                        _SectionTitle(
                          scheme: c,
                          title: l10n.backtestFieldCapital,
                        ),
                        _CapitalCard(
                          controller: _capital,
                          presets: _capitalPresets,
                          scheme: c,
                          inputFormatters: _numericFormatters,
                          onChanged: (_) => _clearError(),
                          onPick: (int v) {
                            _capital.text = v.toString();
                            _clearError();
                          },
                        ),
                        const SizedBox(height: 14),
                        _SectionTitle(
                          scheme: c,
                          title: l10n.backtestFieldMarket,
                        ),
                        _SectionCard(
                          scheme: c,
                          marginBottom: 14,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: <Widget>[
                              _Segmented(
                                key: const Key('backtest-market'),
                                scheme: c,
                                value: st.futures ? 'futures' : 'spot',
                                options: <({String key, String label})>[
                                  (key: 'spot', label: l10n.backtestMarketSpot),
                                  (
                                    key: 'futures',
                                    label: l10n.backtestMarketFutures,
                                  ),
                                ],
                                onChanged: (String v) =>
                                    _ctrl.setFutures(v == 'futures'),
                              ),
                              if (st.futures) ...<Widget>[
                                const SizedBox(height: 14),
                                _LeveragePicker(
                                  controller: _leverage,
                                  scheme: c,
                                  label: l10n.backtestFieldLeverage,
                                  hint: l10n.backtestLeverageHint,
                                  inputFormatters: _integerFormatters,
                                  onChanged: (_) => _clearError(),
                                ),
                                if ((int.tryParse(_leverage.text) ?? 0) >=
                                    20) ...<Widget>[
                                  const SizedBox(height: 10),
                                  _WarnBanner(
                                    key: const Key('backtest-leverage-warn'),
                                    scheme: c,
                                    text: l10n.backtestLeverageWarn,
                                  ),
                                ],
                              ],
                            ],
                          ),
                        ),
                        _SectionTitle(
                          scheme: c,
                          title: l10n.backtestSectionMatching,
                          right: l10n.backtestSectionMatchingRight,
                        ),
                        _MatchingCard(
                          scheme: c,
                          slippage: _slippage,
                          fee: _fee,
                          fillSource: st.fillSource,
                          partialData: st.partialData,
                          l10n: l10n,
                          inputFormatters: _numericFormatters,
                          onInputChanged: (_) => _clearError(),
                          onFillSourceChanged: _ctrl.setFillSource,
                          onPartialDataChanged: (String v) =>
                              _ctrl.setPartialData(v == 'yes'),
                        ),
                        const SizedBox(height: 14),
                        _SummaryCard(
                          scheme: c,
                          title: l10n.backtestSummaryTitle,
                          rows: <({String k, String v})>[
                            (
                              k: l10n.backtestSummaryRange,
                              v: _summaryRangeValue(st.rangeKey),
                            ),
                            (
                              k: l10n.backtestSummaryCapital,
                              v: _summaryCapitalValue(),
                            ),
                            (
                              k: l10n.backtestSummaryMarket,
                              v: _summaryMarketValue(l10n, st.futures),
                            ),
                            (
                              k: l10n.backtestSummaryMatching,
                              v: _summaryMatchingValue(l10n, st.fillSource),
                            ),
                            (
                              k: l10n.backtestSummaryData,
                              v: st.partialData
                                  ? l10n.backtestSummaryDataAllow
                                  : l10n.backtestSummaryDataStrict,
                            ),
                          ],
                        ),
                        if (st.error != null) ...<Widget>[
                          const SizedBox(height: QzSpacing.sm),
                          Text(
                            st.error!,
                            style: TextStyle(
                              color: c.statusDanger,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: 0,
                    child: Container(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: <Color>[c.bg.withValues(alpha: 0), c.bg],
                        ),
                      ),
                      padding: EdgeInsets.fromLTRB(
                        QzSpacing.lg,
                        QzSpacing.md,
                        QzSpacing.lg,
                        QzSpacing.lg + bottomInset,
                      ),
                      child: Row(
                        children: <Widget>[
                          Expanded(
                            child: _ActionButton(
                              key: const Key('backtest-collapse'),
                              scheme: c,
                              label: l10n.backtestCollapseButton,
                              onPressed: _cancel,
                            ),
                          ),
                          const SizedBox(width: QzSpacing.md),
                          Expanded(
                            flex: 2,
                            child: _ActionButton(
                              key: const Key('backtest-submit'),
                              scheme: c,
                              label: l10n.backtestStartButton,
                              onPressed: _submit,
                              accent: true,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

