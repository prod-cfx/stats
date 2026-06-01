import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/models/backtest_models.dart';
import '../../data/providers.dart';
import '../../data/repositories/backtest_repository.dart';
import '../../l10n/app_localizations.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import '../../widgets/qz_button.dart';

/// Backtest configuration sheet — route `/ai/backtest-config` (#1566 / #1893)。
///
/// 字段基准 = `design/project/mobile/m-screens-btconfig.jsx` ScreenBacktestConfig
/// （整屏版字段集），但形态按 #1890 形态裁决（方案 B：维持对话中心/弹层形态）
/// 落到当前 sheet，不引入整屏 StepBar/线性导航（StepBar 集成显式延后至 #1890
/// future 工作）。字段对齐 (#1893)：
///   - 顶部策略 recap 条
///   - 历史区间 chips（7D / 30D / 90D / 1Y / 3Y / 自定义）+ 区间回显
///     （非自定义：数据范围 start → end；自定义：共 N 天 · N 根 15m K 线）
///   - 初始资金（USDT）+ 快捷预设 1k/5k/10k/50k/100k + 模拟资金提示
///   - 交易市场 现货/合约 segmented + 杠杆 1x–50x（20x/50x 高杠杆告警）
///   - 撮合参数：滑点 / 手续费（带 hint）+ 成交价来源 / 数据缺失策略 segmented
///   - 「本次回测设定」summary 卡（区间 / 资金 / 市场 / 撮合 / 数据 5 行回显）
///   - 底部 shield 提示 banner + 双按钮：「收起」+「确认并开始回测」
///
/// symbol / period 仍由 AI 对话上下文推断（mock 默认）；market / leverage 现已
/// 在本页显式选择并随 `BacktestRequest.params` 提交。提交时 `BacktestResult`
/// 通过 `context.pop(result)` 回写到 AI 对话页。
class BacktestConfigSheet extends ConsumerStatefulWidget {
  const BacktestConfigSheet({super.key});

  @override
  ConsumerState<BacktestConfigSheet> createState() =>
      _BacktestConfigSheetState();
}

class _BacktestConfigSheetState extends ConsumerState<BacktestConfigSheet> {
  /// 历史区间预设。值为「相对今天往前推的天数」；0 = 自定义。
  static const List<({String key, int days})> _ranges =
      <({String key, int days})>[
    (key: '7D', days: 7),
    (key: '30D', days: 30),
    (key: '90D', days: 90),
    (key: '1Y', days: 365),
    (key: '3Y', days: 1095),
    (key: 'custom', days: 0),
  ];

  /// 初始资金快捷预设（对齐设计稿：1k/5k/10k/50k/100k）。
  static const List<({String label, int value})> _capitalPresets =
      <({String label, int value})>[
    (label: '1k', value: 1000),
    (label: '5k', value: 5000),
    (label: '10k', value: 10000),
    (label: '50k', value: 50000),
    (label: '100k', value: 100000),
  ];

  /// 杠杆预设（对齐设计稿：1x–50x；20x/50x 触发高杠杆告警）。
  static const List<String> _leverages = <String>[
    '1x',
    '2x',
    '3x',
    '5x',
    '10x',
    '20x',
    '50x',
  ];
  static const Set<String> _highLeverages = <String>{'20x', '50x'};

  String _rangeKey = '30D';
  final TextEditingController _capital =
      TextEditingController(text: '10000');
  final TextEditingController _slippage = TextEditingController(text: '5');
  final TextEditingController _fee = TextEditingController(text: '2');
  String _fillSource = 'close';
  bool _partialData = true;
  // 交易市场：现货无杠杆；合约启用杠杆选择。默认合约 · 5x 对齐设计稿。
  bool _futures = true;
  String _leverage = '5x';

  /// 仅自定义模式启用。
  final TextEditingController _start =
      TextEditingController(text: _isoDate(DateTime.now().subtract(const Duration(days: 30))));
  final TextEditingController _end =
      TextEditingController(text: _isoDate(DateTime.now()));

  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    // summary 卡需随资金/滑点/手续费输入实时回显 → 监听重建。
    _capital.addListener(_onInputChanged);
    _slippage.addListener(_onInputChanged);
    _fee.addListener(_onInputChanged);
    _start.addListener(_onInputChanged);
    _end.addListener(_onInputChanged);
  }

  void _onInputChanged() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _capital.removeListener(_onInputChanged);
    _slippage.removeListener(_onInputChanged);
    _fee.removeListener(_onInputChanged);
    _start.removeListener(_onInputChanged);
    _end.removeListener(_onInputChanged);
    _capital.dispose();
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
    TextInputFormatter.withFunction((TextEditingValue oldV, TextEditingValue newV) {
      final int dots = '.'.allMatches(newV.text).length;
      return dots > 1 ? oldV : newV;
    }),
  ];

  static String _isoDate(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  /// 返回值约定：
  ///   - `range != null`：解析成功
  ///   - `range == null && error != null`：自定义模式校验失败，error 是对应 i18n key 取值
  ///   - 预设区间永远成功；key 不在 `_ranges` 时直接抛 StateError（开发期暴露不变量被破坏）
  ({({DateTime start, DateTime end})? range, String? error}) _resolveRange(
      AppLocalizations l10n) {
    if (_rangeKey == 'custom') {
      final DateTime? s = DateTime.tryParse(_start.text.trim());
      final DateTime? e = DateTime.tryParse(_end.text.trim());
      if (s == null || e == null) {
        return (range: null, error: l10n.backtestErrorInvalidDate);
      }
      if (!e.isAfter(s)) {
        return (range: null, error: l10n.backtestErrorEndBeforeStart);
      }
      return (range: (start: s, end: e), error: null);
    }
    final int days = _ranges
        .firstWhere(
          (r) => r.key == _rangeKey,
          orElse: () => throw StateError('unknown range key: $_rangeKey'),
        )
        .days;
    final DateTime end = DateTime.now();
    final DateTime start = end.subtract(Duration(days: days));
    return (range: (start: start, end: end), error: null);
  }

  void _clearError() {
    if (_error != null) setState(() => _error = null);
  }

  /// 成交价来源 i18n 标签（用于 segmented + summary 回显）。
  String _fillSourceLabel(AppLocalizations l10n) {
    switch (_fillSource) {
      case 'open':
        return l10n.backtestFillOpen;
      case 'mid':
        return l10n.backtestFillMid;
      default:
        return l10n.backtestFillClose;
    }
  }

  /// 非自定义：`数据范围: start → end`；自定义：`共 N 天 · 覆盖 N 根 15m K 线`。
  /// 15m K 线一天 96 根（对齐设计稿 daysBetween * 96）。
  String _rangeEchoText(AppLocalizations l10n) {
    if (_rangeKey == 'custom') {
      final DateTime? s = DateTime.tryParse(_start.text.trim());
      final DateTime? e = DateTime.tryParse(_end.text.trim());
      final int days =
          (s == null || e == null) ? 0 : e.difference(s).inDays.clamp(0, 1 << 30);
      return l10n.backtestRangeCustomSummary(
        days.toString(),
        (days * 96).toString(),
      );
    }
    final int days = _ranges.firstWhere((r) => r.key == _rangeKey).days;
    final DateTime end = DateTime.now();
    final DateTime start = end.subtract(Duration(days: days));
    return l10n.backtestRangeDataLabel(_isoDate(start), _isoDate(end));
  }

  String _summaryRangeValue() {
    if (_rangeKey == 'custom') {
      return '${_start.text.trim()} → ${_end.text.trim()}';
    }
    return _rangeKey;
  }

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

  String _summaryMarketValue(AppLocalizations l10n) => _futures
      ? l10n.backtestSummaryMarketFutures(_leverage)
      : l10n.backtestSummaryMarketSpot;

  String _summaryMatchingValue(AppLocalizations l10n) =>
      l10n.backtestSummaryMatchingValue(
        _slippage.text.trim().isEmpty ? '0' : _slippage.text.trim(),
        _fee.text.trim().isEmpty ? '0' : _fee.text.trim(),
        _fillSourceLabel(l10n),
      );

  Future<void> _submit() async {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final ({({DateTime start, DateTime end})? range, String? error}) parsed =
        _resolveRange(l10n);
    if (parsed.range == null) {
      setState(() => _error = parsed.error);
      return;
    }
    final ({DateTime start, DateTime end}) range = parsed.range!;
    final double? capital = double.tryParse(_capital.text.trim());
    if (capital == null || capital <= 0) {
      setState(() => _error = l10n.backtestErrorInvalidCapital);
      return;
    }
    final double? slippageBps = double.tryParse(_slippage.text.trim());
    if (slippageBps == null || slippageBps < 0) {
      setState(() => _error = l10n.backtestErrorInvalidSlippage);
      return;
    }
    final double? feeBps = double.tryParse(_fee.text.trim());
    if (feeBps == null || feeBps < 0) {
      setState(() => _error = l10n.backtestErrorInvalidFee);
      return;
    }

    setState(() {
      _error = null;
      _submitting = true;
    });

    final BacktestRepository repo = ref.read(backtestRepositoryProvider);
    // symbol / period 仍由对话上下文推断 → mock 默认值；market / leverage
    // 现已在本页显式选择（#1893），随 params 一并提交。
    final int? leverage = _futures
        ? int.tryParse(_leverage.replaceAll('x', ''))
        : null;
    final BacktestRequest req = BacktestRequest(
      strategyId: 'mock-strategy',
      symbol: 'BTCUSDT',
      startTime: range.start,
      endTime: range.end,
      params: <String, dynamic>{
        'capital': capital,
        'slippageBps': slippageBps,
        'feeBps': feeBps,
        'fillSource': _fillSource,
        'partialData': _partialData,
        'market': _futures ? 'futures' : 'spot',
        'leverage': ?leverage,
      },
    );

    BacktestResult result;
    try {
      result = await repo.run(req);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = '${l10n.backtestErrorFailedPrefix}$e';
      });
      return;
    }
    if (!mounted) return;
    context.pop(result);
  }

  void _cancel() {
    if (_submitting) return;
    context.pop();
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    // 设计稿 m-screens-2.jsx ScreenAIConfig：sheet 固定 top:120，圆角 24，
    // body 滚动，footer 贴底；scrim 占据 sheet 上方 120px 区域，点击关闭。
    final double bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    return Scaffold(
      backgroundColor: c.scrim,
      resizeToAvoidBottomInset: false,
      body: Stack(
        children: <Widget>[
          Positioned(
            left: 0,
            right: 0,
            top: 0,
            height: 120,
            child: GestureDetector(
              key: const Key('backtest-sheet-scrim'),
              behavior: HitTestBehavior.opaque,
              onTap: _cancel,
              child: const SizedBox.expand(),
            ),
          ),
          Positioned(
            left: 0,
            right: 0,
            top: 120,
            bottom: 0,
            child: Container(
              decoration: BoxDecoration(
                color: c.bgElev,
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(24),
                ),
              ),
              child: Column(
                children: <Widget>[
                  const SizedBox(height: QzSpacing.sm),
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: c.borderStrong,
                        borderRadius: BorderRadius.circular(QzRadii.pill),
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(
                      QzSpacing.lg,
                      QzSpacing.md,
                      QzSpacing.lg,
                      QzSpacing.xs,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text(
                          l10n.backtestSheetTitle,
                          style: TextStyle(
                            color: c.text,
                            fontSize: 17,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          l10n.backtestSheetSubtitle,
                          style: TextStyle(color: c.textMid, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                  Expanded(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.fromLTRB(
                        QzSpacing.lg,
                        QzSpacing.sm,
                        QzSpacing.lg,
                        QzSpacing.lg,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                      _RecapStrip(
                        scheme: c,
                        text: l10n.backtestRecap('BTC 趋势 · 双均线'),
                      ),
                      const SizedBox(height: QzSpacing.md),
                      _FieldLabel(label: l10n.backtestFieldRange, scheme: c),
                      const SizedBox(height: QzSpacing.xs),
                      _RangeChips(
                        ranges: _ranges,
                        value: _rangeKey,
                        l10n: l10n,
                        scheme: c,
                        onChanged: (String v) => setState(() => _rangeKey = v),
                      ),
                      if (_rangeKey == 'custom') ...<Widget>[
                        const SizedBox(height: QzSpacing.md),
                        Row(
                          children: <Widget>[
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: <Widget>[
                                  _FieldLabel(label: l10n.commonStart, scheme: c),
                                  const SizedBox(height: QzSpacing.xs),
                                  _TextInput(
                                    key: const Key('backtest-start'),
                                    controller: _start,
                                    scheme: c,
                                    onChanged: (_) => _clearError(),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: QzSpacing.md),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: <Widget>[
                                  _FieldLabel(label: l10n.commonEnd, scheme: c),
                                  const SizedBox(height: QzSpacing.xs),
                                  _TextInput(
                                    key: const Key('backtest-end'),
                                    controller: _end,
                                    scheme: c,
                                    onChanged: (_) => _clearError(),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ],
                      const SizedBox(height: QzSpacing.xs),
                      Text(
                        key: const Key('backtest-range-echo'),
                        _rangeEchoText(l10n),
                        style: TextStyle(
                          color: c.textDim,
                          fontSize: 11,
                          fontFeatures: const <FontFeature>[
                            FontFeature.tabularFigures(),
                          ],
                        ),
                      ),
                      const SizedBox(height: QzSpacing.md),
                      _FieldLabel(label: l10n.backtestFieldCapital, scheme: c),
                      const SizedBox(height: QzSpacing.xs),
                      _TextInput(
                        key: const Key('backtest-capital'),
                        controller: _capital,
                        scheme: c,
                        keyboard: const TextInputType.numberWithOptions(decimal: true),
                        suffix: 'USDT',
                        inputFormatters: _numericFormatters,
                        onChanged: (_) => _clearError(),
                      ),
                      const SizedBox(height: QzSpacing.xs),
                      _CapitalPresets(
                        presets: _capitalPresets,
                        scheme: c,
                        onPick: (int v) {
                          _capital.text = v.toString();
                          _clearError();
                        },
                      ),
                      const SizedBox(height: QzSpacing.xs),
                      Text(
                        l10n.backtestCapitalPresetHint,
                        style: TextStyle(color: c.textDim, fontSize: 11),
                      ),
                      const SizedBox(height: QzSpacing.md),
                      _FieldLabel(label: l10n.backtestFieldMarket, scheme: c),
                      const SizedBox(height: QzSpacing.xs),
                      _Segmented(
                        key: const Key('backtest-market'),
                        scheme: c,
                        value: _futures ? 'futures' : 'spot',
                        options: <({String key, String label})>[
                          (key: 'spot', label: l10n.backtestMarketSpot),
                          (key: 'futures', label: l10n.backtestMarketFutures),
                        ],
                        onChanged: (String v) =>
                            setState(() => _futures = v == 'futures'),
                      ),
                      if (_futures) ...<Widget>[
                        const SizedBox(height: QzSpacing.md),
                        _LeveragePicker(
                          leverages: _leverages,
                          value: _leverage,
                          scheme: c,
                          label: l10n.backtestFieldLeverage,
                          hint: l10n.backtestLeverageHint,
                          onChanged: (String v) =>
                              setState(() => _leverage = v),
                        ),
                        if (_highLeverages.contains(_leverage)) ...<Widget>[
                          const SizedBox(height: QzSpacing.xs),
                          _WarnBanner(
                            key: const Key('backtest-leverage-warn'),
                            scheme: c,
                            text: l10n.backtestLeverageWarn,
                          ),
                        ],
                      ],
                      const SizedBox(height: QzSpacing.md),
                      _SectionTitle(
                        scheme: c,
                        title: l10n.backtestSectionMatching,
                        right: l10n.backtestSectionMatchingRight,
                      ),
                      const SizedBox(height: QzSpacing.xs),
                      _FieldLabel(label: l10n.backtestFieldSlippage, scheme: c),
                      const SizedBox(height: 2),
                      Text(
                        l10n.backtestHintSlippage,
                        style: TextStyle(color: c.textDim, fontSize: 11),
                      ),
                      const SizedBox(height: QzSpacing.xs),
                      _TextInput(
                        key: const Key('backtest-slippage'),
                        controller: _slippage,
                        scheme: c,
                        keyboard: const TextInputType.numberWithOptions(decimal: true),
                        suffix: 'bps',
                        inputFormatters: _numericFormatters,
                        onChanged: (_) => _clearError(),
                      ),
                      const SizedBox(height: QzSpacing.md),
                      _FieldLabel(label: l10n.backtestFieldFee, scheme: c),
                      const SizedBox(height: 2),
                      Text(
                        l10n.backtestHintFee,
                        style: TextStyle(color: c.textDim, fontSize: 11),
                      ),
                      const SizedBox(height: QzSpacing.xs),
                      _TextInput(
                        key: const Key('backtest-fee'),
                        controller: _fee,
                        scheme: c,
                        keyboard: const TextInputType.numberWithOptions(decimal: true),
                        suffix: 'bps',
                        inputFormatters: _numericFormatters,
                        onChanged: (_) => _clearError(),
                      ),
                      const SizedBox(height: QzSpacing.md),
                      _FieldLabel(label: l10n.backtestFieldFillSource, scheme: c),
                      const SizedBox(height: 2),
                      Text(
                        l10n.backtestHintFillSource,
                        style: TextStyle(color: c.textDim, fontSize: 11),
                      ),
                      const SizedBox(height: QzSpacing.xs),
                      _Segmented(
                        key: const Key('backtest-fill-source'),
                        scheme: c,
                        value: _fillSource,
                        options: <({String key, String label})>[
                          (key: 'open', label: l10n.backtestFillOpen),
                          (key: 'close', label: l10n.backtestFillClose),
                          (key: 'mid', label: l10n.backtestFillMid),
                        ],
                        onChanged: (String v) =>
                            setState(() => _fillSource = v),
                      ),
                      const SizedBox(height: QzSpacing.md),
                      _FieldLabel(
                          label: l10n.backtestFieldPartialData, scheme: c),
                      const SizedBox(height: 2),
                      Text(
                        l10n.backtestHintPartialData,
                        style: TextStyle(color: c.textDim, fontSize: 11),
                      ),
                      const SizedBox(height: QzSpacing.xs),
                      _Segmented(
                        key: const Key('backtest-partial-data'),
                        scheme: c,
                        value: _partialData ? 'yes' : 'no',
                        options: <({String key, String label})>[
                          (key: 'yes', label: l10n.backtestPartialAllow),
                          (key: 'no', label: l10n.backtestPartialDisallow),
                        ],
                        onChanged: (String v) =>
                            setState(() => _partialData = v == 'yes'),
                      ),
                      const SizedBox(height: QzSpacing.md),
                      _SummaryCard(
                        scheme: c,
                        title: l10n.backtestSummaryTitle,
                        rows: <({String k, String v})>[
                          (k: l10n.backtestSummaryRange, v: _summaryRangeValue()),
                          (k: l10n.backtestSummaryCapital, v: _summaryCapitalValue()),
                          (k: l10n.backtestSummaryMarket, v: _summaryMarketValue(l10n)),
                          (k: l10n.backtestSummaryMatching, v: _summaryMatchingValue(l10n)),
                          (
                            k: l10n.backtestSummaryData,
                            v: _partialData
                                ? l10n.backtestSummaryDataAllow
                                : l10n.backtestSummaryDataStrict,
                          ),
                        ],
                      ),
                      const SizedBox(height: QzSpacing.lg),
                      _ShieldBanner(
                        scheme: c,
                        text: l10n.backtestShieldHint,
                      ),
                      if (_error != null) ...<Widget>[
                        const SizedBox(height: QzSpacing.sm),
                        Text(
                          _error!,
                          style: TextStyle(
                            color: c.statusDanger,
                            fontSize: 12,
                          ),
                        ),
                      ],
                        ],
                      ),
                    ),
                  ),
                  // Footer：贴底固定，键盘弹起时 padding 顶起避免被遮挡。
                  Container(
                    decoration: BoxDecoration(
                      border: Border(
                        top: BorderSide(color: c.border),
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
                          child: QzButton(
                            key: const Key('backtest-collapse'),
                            label: l10n.backtestCollapseButton,
                            variant: QzButtonVariant.ghost,
                            onPressed: _submitting ? null : _cancel,
                            expanded: true,
                          ),
                        ),
                        const SizedBox(width: QzSpacing.md),
                        Expanded(
                          flex: 2,
                          child: QzButton(
                            key: const Key('backtest-submit'),
                            label: l10n.backtestStartButton,
                            variant: QzButtonVariant.accent,
                            onPressed: _submitting ? null : _submit,
                            loading: _submitting,
                            expanded: true,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
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

  String _label(String key) {
    switch (key) {
      case 'custom':
        return l10n.backtestRangeCustom;
      default:
        return key;
    }
  }

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
              height: 32,
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(
                color: r.key == value ? scheme.accentSoft : scheme.bgInput,
                border: Border.all(
                  color: r.key == value
                      ? scheme.accent.withValues(alpha: 0.3)
                      : scheme.border,
                ),
                borderRadius: BorderRadius.circular(QzRadii.pill),
              ),
              alignment: Alignment.center,
              child: Text(
                _label(r.key),
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: r.key == value ? scheme.accent : scheme.textMid,
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// 顶部策略 recap 条：「正在为「...」配置回测参数」（对齐设计稿 violetSoft 条）。
class _RecapStrip extends StatelessWidget {
  const _RecapStrip({required this.scheme, required this.text});
  final QzColorScheme scheme;
  final String text;
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
            child: Text(
              text,
              style: TextStyle(
                color: scheme.accent,
                fontSize: 12,
                height: 1.5,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// 初始资金快捷预设按钮排（1k/5k/10k/50k/100k）。
class _CapitalPresets extends StatelessWidget {
  const _CapitalPresets({
    required this.presets,
    required this.scheme,
    required this.onPick,
  });
  final List<({String label, int value})> presets;
  final QzColorScheme scheme;
  final ValueChanged<int> onPick;
  @override
  Widget build(BuildContext context) {
    return Row(
      children: <Widget>[
        for (int i = 0; i < presets.length; i++) ...<Widget>[
          if (i > 0) const SizedBox(width: QzSpacing.xs),
          Expanded(
            child: GestureDetector(
              key: Key('backtest-capital-${presets[i].label}'),
              behavior: HitTestBehavior.opaque,
              onTap: () => onPick(presets[i].value),
              child: Container(
                height: 28,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: scheme.bgInput,
                  border: Border.all(color: scheme.border),
                  borderRadius: BorderRadius.circular(7),
                ),
                child: Text(
                  presets[i].label,
                  style: TextStyle(
                    color: scheme.textMid,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
          ),
        ],
      ],
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
  });
  final QzColorScheme scheme;
  final String value;
  final List<({String key, String label})> options;
  final ValueChanged<String> onChanged;
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
        children: <Widget>[
          for (final o in options)
            Expanded(
              child: GestureDetector(
                key: Key('backtest-seg-${o.key}'),
                behavior: HitTestBehavior.opaque,
                onTap: () => onChanged(o.key),
                child: Container(
                  height: 34,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: o.key == value ? scheme.bgElev : Colors.transparent,
                    borderRadius: BorderRadius.circular(8),
                    border: o.key == value
                        ? Border.all(color: scheme.border)
                        : null,
                  ),
                  child: Text(
                    o.label,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight:
                          o.key == value ? FontWeight.w600 : FontWeight.w500,
                      color: o.key == value ? scheme.accent : scheme.textMid,
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

/// 杠杆选择：标题 + hint + 当前倍数大字 + 1x–50x chips。
class _LeveragePicker extends StatelessWidget {
  const _LeveragePicker({
    required this.leverages,
    required this.value,
    required this.scheme,
    required this.label,
    required this.hint,
    required this.onChanged,
  });
  final List<String> leverages;
  final String value;
  final QzColorScheme scheme;
  final String label;
  final String hint;
  final ValueChanged<String> onChanged;
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
              value,
              style: TextStyle(
                color: scheme.accent,
                fontSize: 20,
                fontWeight: FontWeight.w700,
                fontFeatures: const <FontFeature>[
                  FontFeature.tabularFigures(),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: QzSpacing.xs),
        Wrap(
          spacing: QzSpacing.xs,
          runSpacing: QzSpacing.xs,
          children: <Widget>[
            for (final l in leverages)
              GestureDetector(
                key: Key('backtest-leverage-$l'),
                behavior: HitTestBehavior.opaque,
                onTap: () => onChanged(l),
                child: Container(
                  height: 30,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: l == value ? scheme.accentSoft : scheme.bgInput,
                    border: Border.all(
                      color: l == value
                          ? scheme.accent.withValues(alpha: 0.3)
                          : scheme.border,
                    ),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    l,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: l == value ? scheme.accent : scheme.textMid,
                      fontFeatures: const <FontFeature>[
                        FontFeature.tabularFigures(),
                      ],
                    ),
                  ),
                ),
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

/// 区块标题 + 右侧补充说明（撮合参数 · 影响成交模拟）。
class _SectionTitle extends StatelessWidget {
  const _SectionTitle({
    required this.scheme,
    required this.title,
    required this.right,
  });
  final QzColorScheme scheme;
  final String title;
  final String right;
  @override
  Widget build(BuildContext context) {
    return Row(
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
        Text(
          right,
          style: TextStyle(color: scheme.textDim, fontSize: 11),
        ),
      ],
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
          const SizedBox(height: QzSpacing.xs),
          for (final r in rows)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: <Widget>[
                  SizedBox(
                    width: 44,
                    child: Text(
                      r.k,
                      style: TextStyle(color: scheme.textDim, fontSize: 11),
                    ),
                  ),
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
            ),
        ],
      ),
    );
  }
}

class _ShieldBanner extends StatelessWidget {
  const _ShieldBanner({required this.scheme, required this.text});
  final QzColorScheme scheme;
  final String text;
  @override
  Widget build(BuildContext context) {
    return Container(
      padding:
          const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: scheme.accentSoft,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Icon(Icons.shield_outlined, size: 16, color: scheme.accent),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                color: scheme.accent,
                fontSize: 12,
                height: 1.55,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel({required this.label, required this.scheme});
  final String label;
  final QzColorScheme scheme;
  @override
  Widget build(BuildContext context) {
    return Text(
      label,
      style: TextStyle(color: scheme.textMid, fontSize: 12),
    );
  }
}

class _TextInput extends StatelessWidget {
  const _TextInput({
    super.key,
    required this.controller,
    required this.scheme,
    this.keyboard,
    this.suffix,
    this.inputFormatters,
    this.onChanged,
  });
  final TextEditingController controller;
  final QzColorScheme scheme;
  final TextInputType? keyboard;
  final String? suffix;
  final List<TextInputFormatter>? inputFormatters;
  final ValueChanged<String>? onChanged;
  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: scheme.bgInput,
        border: Border.all(color: scheme.border),
        borderRadius: BorderRadius.circular(QzRadii.input),
      ),
      padding: const EdgeInsets.symmetric(
        horizontal: QzSpacing.md,
        vertical: QzSpacing.xs,
      ),
      child: Row(
        children: <Widget>[
          Expanded(
            child: TextField(
              controller: controller,
              keyboardType: keyboard,
              inputFormatters: inputFormatters,
              onChanged: onChanged,
              style: TextStyle(color: scheme.text, fontSize: 14),
              decoration: const InputDecoration(
                border: InputBorder.none,
                isDense: true,
              ),
            ),
          ),
          if (suffix != null)
            Padding(
              padding: const EdgeInsets.only(left: 8),
              child: Text(
                suffix!,
                style: TextStyle(color: scheme.textMid, fontSize: 12),
              ),
            ),
        ],
      ),
    );
  }
}
