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

class _RecapStrip extends StatelessWidget {
  const _RecapStrip({required this.scheme});
  final QzColorScheme scheme;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: scheme.accentSoft,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: <Widget>[
          Icon(Icons.auto_awesome, size: 14, color: scheme.accent),
          const SizedBox(width: 10),
          Expanded(
            child: Text.rich(
              TextSpan(
                text: '正在为「',
                children: <InlineSpan>[
                  const TextSpan(
                    text: 'BTC 趋势 · 双均线',
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                  const TextSpan(text: '」配置回测参数'),
                ],
              ),
              style: TextStyle(color: scheme.accent, fontSize: 12, height: 1.5),
            ),
          ),
        ],
      ),
    );
  }
}

class _RangeChips extends StatelessWidget {
  const _RangeChips({
    required this.ranges,
    required this.value,
    required this.l10n,
    required this.scheme,
    required this.onChanged,
  });
  final List<({String key, int days})> ranges;
  final String value;
  final AppLocalizations l10n;
  final QzColorScheme scheme;
  final ValueChanged<String> onChanged;

  String _label(String key) => key == 'custom' ? l10n.backtestRangeCustom : key;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: QzSpacing.xs,
      runSpacing: QzSpacing.xs,
      children: <Widget>[
        for (final r in ranges)
          GestureDetector(
            key: Key('backtest-range-${r.key}'),
            onTap: () => onChanged(r.key),
            behavior: HitTestBehavior.opaque,
            child: Container(
              height: 34,
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(
                color: r.key == value ? scheme.accentSoft : scheme.bgElev,
                border: Border.all(
                  color: r.key == value
                      ? scheme.accent.withValues(alpha: 0.3)
                      : scheme.border,
                ),
                borderRadius: BorderRadius.circular(QzRadii.pill),
              ),
              child: Align(
                widthFactor: 1,
                alignment: Alignment.center,
                child: Text(
                  _label(r.key),
                  style: TextStyle(
                    color: r.key == value ? scheme.accent : scheme.textMid,
                    fontSize: 13,
                    fontWeight: r.key == value
                        ? FontWeight.w600
                        : FontWeight.w500,
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _DateField extends StatelessWidget {
  const _DateField({
    super.key,
    required this.label,
    required this.controller,
    required this.scheme,
    required this.onChanged,
  });
  final String label;
  final TextEditingController controller;
  final QzColorScheme scheme;
  final ValueChanged<String> onChanged;

  Future<void> _pickDate(BuildContext context) async {
    final DateTime now = DateTime.now();
    final DateTime initial = DateTime.tryParse(controller.text.trim()) ?? now;
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2020),
      lastDate: DateTime(now.year + 1, 12, 31),
    );
    if (picked == null) return;
    controller.text =
        '${picked.year.toString().padLeft(4, '0')}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
    onChanged(controller.text);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(label, style: TextStyle(color: scheme.textDim, fontSize: 10)),
        const SizedBox(height: 5),
        GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () => _pickDate(context),
          child: Container(
            height: 42,
            padding: const EdgeInsets.symmetric(horizontal: 10),
            decoration: BoxDecoration(
              color: scheme.bgInput,
              border: Border.all(color: scheme.borderSoft),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              children: <Widget>[
                Expanded(
                  child: IgnorePointer(
                    child: TextField(
                      controller: controller,
                      readOnly: true,
                      style: TextStyle(
                        color: scheme.text,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        fontFeatures: const <FontFeature>[
                          FontFeature.tabularFigures(),
                        ],
                      ),
                      decoration: const InputDecoration(
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        fillColor: Colors.transparent,
                        filled: false,
                        isDense: true,
                        contentPadding: EdgeInsets.zero,
                      ),
                    ),
                  ),
                ),
                Icon(
                  Icons.calendar_today_outlined,
                  size: 14,
                  color: scheme.textDim,
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _CapitalCard extends StatelessWidget {
  const _CapitalCard({
    required this.controller,
    required this.presets,
    required this.scheme,
    required this.inputFormatters,
    required this.onChanged,
    required this.onPick,
  });
  final TextEditingController controller;
  final List<({String label, int value})> presets;
  final QzColorScheme scheme;
  final List<TextInputFormatter> inputFormatters;
  final ValueChanged<String> onChanged;
  final ValueChanged<int> onPick;

  @override
  Widget build(BuildContext context) {
    return _SectionCard(
      scheme: scheme,
      marginBottom: 0,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Container(
            key: const Key('backtest-capital'),
            padding: const EdgeInsets.only(bottom: 10),
            decoration: BoxDecoration(
              border: Border(bottom: BorderSide(color: scheme.borderSoft)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: <Widget>[
                Text(
                  r'$',
                  style: TextStyle(
                    color: scheme.textDim,
                    fontSize: 14,
                    fontFeatures: const <FontFeature>[
                      FontFeature.tabularFigures(),
                    ],
                  ),
                ),
                const SizedBox(width: QzSpacing.xs),
                Expanded(
                  child: TextField(
                    controller: controller,
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                    ),
                    inputFormatters: inputFormatters,
                    onChanged: onChanged,
                    style: TextStyle(
                      color: scheme.text,
                      fontSize: 26,
                      fontWeight: FontWeight.w700,
                      fontFeatures: const <FontFeature>[
                        FontFeature.tabularFigures(),
                      ],
                    ),
                    decoration: const InputDecoration(
                      border: InputBorder.none,
                      isDense: true,
                      contentPadding: EdgeInsets.zero,
                    ),
                  ),
                ),
                Text(
                  'USDT',
                  style: TextStyle(
                    color: scheme.textDim,
                    fontSize: 13,
                    fontFeatures: const <FontFeature>[
                      FontFeature.tabularFigures(),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: <Widget>[
              for (int i = 0; i < presets.length; i++) ...<Widget>[
                if (i > 0) const SizedBox(width: QzSpacing.xs),
                Expanded(
                  child: GestureDetector(
                    key: Key('backtest-capital-${presets[i].label}'),
                    onTap: () => onPick(presets[i].value),
                    behavior: HitTestBehavior.opaque,
                    child: Container(
                      height: 28,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: scheme.bgSoft,
                        borderRadius: BorderRadius.circular(7),
                      ),
                      child: Text(
                        presets[i].label,
                        style: TextStyle(
                          color: scheme.textMid,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          fontFeatures: const <FontFeature>[
                            FontFeature.tabularFigures(),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: QzSpacing.sm),
          Text(
            '模拟资金,仅用于本次回测,不影响实盘',
            style: TextStyle(color: scheme.textDim, fontSize: 11),
          ),
        ],
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.scheme,
    required this.child,
    this.padding = const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    this.marginBottom = 0,
  });
  final QzColorScheme scheme;
  final Widget child;
  final EdgeInsetsGeometry padding;
  final double marginBottom;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: EdgeInsets.only(bottom: marginBottom),
      padding: padding,
      decoration: BoxDecoration(
        color: scheme.bgElev,
        border: Border.all(color: scheme.border),
        borderRadius: BorderRadius.circular(12),
      ),
      child: child,
    );
  }
}

/// 通用 segmented 选择器（现货/合约、成交价来源、数据缺失策略共用）。
class _Segmented extends StatelessWidget {
  const _Segmented({
    super.key,
    required this.scheme,
    required this.value,
    required this.options,
    required this.onChanged,
    this.expanded = true,
  });
  final QzColorScheme scheme;
  final String value;
  final List<({String key, String label})> options;
  final ValueChanged<String> onChanged;
  final bool expanded;

  Widget _item(({String key, String label}) o) {
    return GestureDetector(
      key: Key('backtest-seg-${o.key}'),
      behavior: HitTestBehavior.opaque,
      onTap: () => onChanged(o.key),
      child: Container(
        height: expanded ? 34 : 28,
        padding: expanded
            ? EdgeInsets.zero
            : const EdgeInsets.symmetric(horizontal: QzSpacing.sm),
        alignment: expanded ? Alignment.center : null,
        decoration: BoxDecoration(
          color: o.key == value ? scheme.bgElev : Colors.transparent,
          borderRadius: BorderRadius.circular(expanded ? 8 : 6),
          border: o.key == value ? Border.all(color: scheme.border) : null,
        ),
        child: Align(
          widthFactor: expanded ? null : 1,
          alignment: Alignment.center,
          child: Text(
            o.label,
            style: TextStyle(
              fontSize: expanded ? 13 : 11.5,
              fontWeight: o.key == value ? FontWeight.w600 : FontWeight.w500,
              color: o.key == value ? scheme.accent : scheme.textMid,
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: scheme.bgInput,
        border: Border.all(color: scheme.borderSoft),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisSize: expanded ? MainAxisSize.max : MainAxisSize.min,
        children: <Widget>[
          for (final o in options)
            expanded ? Expanded(child: _item(o)) : _item(o),
        ],
      ),
    );
  }
}

/// 杠杆选择：标题 + hint + 当前倍数大字 + 数字输入。
class _LeveragePicker extends StatelessWidget {
  const _LeveragePicker({
    required this.controller,
    required this.scheme,
    required this.label,
    required this.hint,
    required this.inputFormatters,
    required this.onChanged,
  });
  final TextEditingController controller;
  final QzColorScheme scheme;
  final String label;
  final String hint;
  final List<TextInputFormatter> inputFormatters;
  final ValueChanged<String> onChanged;

  String get _valueLabel =>
      '${controller.text.trim().isEmpty ? '5' : controller.text.trim()}x';

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Row(
          children: <Widget>[
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    label,
                    style: TextStyle(
                      color: scheme.text,
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    hint,
                    style: TextStyle(color: scheme.textDim, fontSize: 11),
                  ),
                ],
              ),
            ),
            Text(
              _valueLabel,
              style: TextStyle(
                color: scheme.accent,
                fontSize: 20,
                fontWeight: FontWeight.w700,
                fontFeatures: const <FontFeature>[FontFeature.tabularFigures()],
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: <Widget>[
            Expanded(
              child: Container(
                key: const Key('backtest-leverage-input'),
                height: 36,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  color: scheme.bgSoft,
                  border: Border.all(color: scheme.borderSoft),
                  borderRadius: BorderRadius.circular(9),
                ),
                child: Row(
                  children: <Widget>[
                    Expanded(
                      child: TextField(
                        controller: controller,
                        keyboardType: TextInputType.number,
                        inputFormatters: inputFormatters,
                        onChanged: onChanged,
                        style: TextStyle(
                          color: scheme.text,
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          fontFeatures: const <FontFeature>[
                            FontFeature.tabularFigures(),
                          ],
                        ),
                        decoration: const InputDecoration(
                          border: InputBorder.none,
                          enabledBorder: InputBorder.none,
                          focusedBorder: InputBorder.none,
                          fillColor: Colors.transparent,
                          filled: false,
                          isDense: true,
                          contentPadding: EdgeInsets.zero,
                        ),
                      ),
                    ),
                    Text(
                      'x',
                      style: TextStyle(
                        color: scheme.textDim,
                        fontSize: 13,
                        fontFeatures: const <FontFeature>[
                          FontFeature.tabularFigures(),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: QzSpacing.sm),
            Text(
              '最大 100 倍',
              style: TextStyle(color: scheme.textDim, fontSize: 11),
            ),
          ],
        ),
      ],
    );
  }
}

/// 高杠杆告警 banner（warn 色，20x/50x 时显示）。
class _WarnBanner extends StatelessWidget {
  const _WarnBanner({super.key, required this.scheme, required this.text});
  final QzColorScheme scheme;
  final String text;
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: scheme.statusWarn.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Icon(Icons.warning_amber_rounded, size: 14, color: scheme.statusWarn),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                color: scheme.statusWarn,
                fontSize: 11,
                height: 1.5,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MatchingCard extends StatelessWidget {
  const _MatchingCard({
    required this.scheme,
    required this.slippage,
    required this.fee,
    required this.fillSource,
    required this.partialData,
    required this.l10n,
    required this.inputFormatters,
    required this.onInputChanged,
    required this.onFillSourceChanged,
    required this.onPartialDataChanged,
  });
  final QzColorScheme scheme;
  final TextEditingController slippage;
  final TextEditingController fee;
  final String fillSource;
  final bool partialData;
  final AppLocalizations l10n;
  final List<TextInputFormatter> inputFormatters;
  final ValueChanged<String> onInputChanged;
  final ValueChanged<String> onFillSourceChanged;
  final ValueChanged<String> onPartialDataChanged;

  @override
  Widget build(BuildContext context) {
    return _SectionCard(
      scheme: scheme,
      padding: EdgeInsets.zero,
      child: Column(
        children: <Widget>[
          _MatchingRow(
            scheme: scheme,
            label: l10n.backtestFieldSlippage,
            hint: l10n.backtestHintSlippage,
            right: _BpsInput(
              key: const Key('backtest-slippage'),
              controller: slippage,
              scheme: scheme,
              inputFormatters: inputFormatters,
              onChanged: onInputChanged,
            ),
          ),
          _MatchingRow(
            scheme: scheme,
            label: l10n.backtestFieldFee,
            hint: l10n.backtestHintFee,
            right: _BpsInput(
              key: const Key('backtest-fee'),
              controller: fee,
              scheme: scheme,
              inputFormatters: inputFormatters,
              onChanged: onInputChanged,
            ),
          ),
          _MatchingRow(
            scheme: scheme,
            label: l10n.backtestFieldFillSource,
            hint: l10n.backtestHintFillSource,
            right: _Segmented(
              key: const Key('backtest-fill-source'),
              scheme: scheme,
              value: fillSource,
              expanded: false,
              options: <({String key, String label})>[
                (key: 'open', label: l10n.backtestFillOpen),
                (key: 'close', label: l10n.backtestFillClose),
                (key: 'mid', label: l10n.backtestFillMid),
              ],
              onChanged: onFillSourceChanged,
            ),
          ),
          _MatchingRow(
            scheme: scheme,
            label: l10n.backtestFieldPartialData,
            hint: l10n.backtestHintPartialData,
            last: true,
            right: _Segmented(
              key: const Key('backtest-partial-data'),
              scheme: scheme,
              value: partialData ? 'yes' : 'no',
              expanded: false,
              options: <({String key, String label})>[
                (key: 'yes', label: l10n.backtestPartialAllow),
                (key: 'no', label: l10n.backtestPartialDisallow),
              ],
              onChanged: onPartialDataChanged,
            ),
          ),
        ],
      ),
    );
  }
}

class _MatchingRow extends StatelessWidget {
  const _MatchingRow({
    required this.scheme,
    required this.label,
    required this.hint,
    required this.right,
    this.last = false,
  });
  final QzColorScheme scheme;
  final String label;
  final String hint;
  final Widget right;
  final bool last;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
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
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  label,
                  style: TextStyle(
                    color: scheme.text,
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  hint,
                  style: TextStyle(color: scheme.textDim, fontSize: 11),
                ),
              ],
            ),
          ),
          const SizedBox(width: QzSpacing.md),
          right,
        ],
      ),
    );
  }
}

class _BpsInput extends StatelessWidget {
  const _BpsInput({
    super.key,
    required this.controller,
    required this.scheme,
    required this.inputFormatters,
    required this.onChanged,
  });
  final TextEditingController controller;
  final QzColorScheme scheme;
  final List<TextInputFormatter> inputFormatters;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 118,
      height: 34,
      padding: const EdgeInsets.symmetric(horizontal: 10),
      decoration: BoxDecoration(
        color: scheme.bgInput,
        border: Border.all(color: scheme.borderSoft),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: <Widget>[
          Expanded(
            child: TextField(
              controller: controller,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              inputFormatters: inputFormatters,
              onChanged: onChanged,
              textAlign: TextAlign.right,
              style: TextStyle(
                color: scheme.text,
                fontSize: 14,
                fontWeight: FontWeight.w600,
                fontFeatures: const <FontFeature>[FontFeature.tabularFigures()],
              ),
              decoration: const InputDecoration(
                border: InputBorder.none,
                isDense: true,
                contentPadding: EdgeInsets.zero,
              ),
            ),
          ),
          const SizedBox(width: QzSpacing.xs),
          Text(
            'bps',
            style: TextStyle(
              color: scheme.textDim,
              fontSize: 11,
              fontFeatures: const <FontFeature>[FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }
}

/// 区块标题 + 右侧补充说明（撮合参数 · 影响成交模拟）。
class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.scheme, required this.title, this.right});
  final QzColorScheme scheme;
  final String title;
  final String? right;
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 4, 4, 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: <Widget>[
          Text(
            title,
            style: TextStyle(
              color: scheme.textMid,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
          if (right != null)
            Text(right!, style: TextStyle(color: scheme.textDim, fontSize: 11)),
        ],
      ),
    );
  }
}

/// 「本次回测设定」summary 卡：5 行 key/value 双列回显。
class _SummaryCard extends StatelessWidget {
  const _SummaryCard({
    required this.scheme,
    required this.title,
    required this.rows,
  });
  final QzColorScheme scheme;
  final String title;
  final List<({String k, String v})> rows;
  @override
  Widget build(BuildContext context) {
    return Container(
      key: const Key('backtest-summary'),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: scheme.bgElev,
        border: Border.all(color: scheme.border),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            title,
            style: TextStyle(
              color: scheme.textDim,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: QzSpacing.sm),
          GridView.count(
            crossAxisCount: 2,
            childAspectRatio: 5.8,
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            padding: EdgeInsets.zero,
            physics: const NeverScrollableScrollPhysics(),
            shrinkWrap: true,
            children: <Widget>[
              for (final r in rows)
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: <Widget>[
                    Text(
                      r.k,
                      style: TextStyle(color: scheme.textDim, fontSize: 11),
                    ),
                    const SizedBox(width: QzSpacing.sm),
                    Expanded(
                      child: Text(
                        r.v,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: scheme.text,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          fontFeatures: const <FontFeature>[
                            FontFeature.tabularFigures(),
                          ],
                        ),
                      ),
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

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    super.key,
    required this.scheme,
    required this.label,
    required this.onPressed,
    this.accent = false,
  });
  final QzColorScheme scheme;
  final String label;
  final VoidCallback onPressed;
  final bool accent;

  @override
  Widget build(BuildContext context) {
    final Color fg = accent ? scheme.accentOn : scheme.text;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          height: 50,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: accent ? null : scheme.bgElev,
            gradient: accent ? scheme.accentGrad : null,
            border: accent ? null : Border.all(color: scheme.border),
            borderRadius: BorderRadius.circular(14),
            boxShadow: accent ? <BoxShadow>[scheme.accentShadow] : null,
          ),
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: fg,
              fontSize: 14,
              fontWeight: accent ? FontWeight.w600 : FontWeight.w500,
            ),
          ),
        ),
      ),
    );
  }
}
