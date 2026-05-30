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

/// Backtest configuration sheet — route `/ai/backtest-config` (#1566).
///
/// 字段对齐原型 `design/project/mobile/m-screens-2.jsx` ScreenAIConfig：
///   - 历史区间快选 chips（7D / 30D / 90D / 1Y / 3Y / 自定义）；选「自定义」时
///     展开 start / end 文本框。
///   - 初始资金（USDT）
///   - 滑点（bps，默认 5 ≈ 0.05%）
///   - 手续费（bps，默认 2 ≈ 0.02%）
///   - 成交价来源 select：开盘价 / 收盘价 / 中间价（默认 收盘价，对齐设计稿）
///   - 允许部分覆盖数据 select：是 / 否（默认 是）
///   - 底部 shield 风格提示 banner（说明回测仅供参考、策略参数请回对话改）
///   - 底部双按钮：「收起」（次要）+「确认并开始回测」（主要）
///
/// 不再承载 symbol / period / leverage 这些策略参数——按原型语义
/// 「这些字段由 AI 对话上下文推断」，参数弹层只管回测配置。
/// 提交时 `BacktestResult` 通过 `context.pop(result)` 回写到 AI 对话页，
/// AI 对话页是唯一持有「当前会话上下文」的地方，由它决定下一条消息要不要
/// 带上这些回测配置（callback contract = 上层 `await context.push(...)`）。
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

  String _rangeKey = '30D';
  final TextEditingController _capital =
      TextEditingController(text: '10000');
  final TextEditingController _slippage = TextEditingController(text: '5');
  final TextEditingController _fee = TextEditingController(text: '2');
  String _fillSource = 'close';
  bool _partialData = true;

  /// 仅自定义模式启用。
  final TextEditingController _start =
      TextEditingController(text: _isoDate(DateTime.now().subtract(const Duration(days: 30))));
  final TextEditingController _end =
      TextEditingController(text: _isoDate(DateTime.now()));

  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
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
    // symbol / period / leverage 由对话上下文推断 → mock 默认值，等
    // chat → sheet 的上下文管道接通后再注入。
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
                      const SizedBox(height: QzSpacing.md),
                      _FieldLabel(label: l10n.backtestFieldSlippage, scheme: c),
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
                      const SizedBox(height: QzSpacing.xs),
                      _SelectField(
                        key: const Key('backtest-fill-source'),
                        scheme: c,
                        value: _fillSource,
                        items: <({String key, String label})>[
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
                      const SizedBox(height: QzSpacing.xs),
                      _SelectField(
                        key: const Key('backtest-partial-data'),
                        scheme: c,
                        value: _partialData ? 'yes' : 'no',
                        items: <({String key, String label})>[
                          (key: 'yes', label: l10n.commonYes),
                          (key: 'no', label: l10n.commonNo),
                        ],
                        onChanged: (String v) =>
                            setState(() => _partialData = v == 'yes'),
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

class _SelectField extends StatelessWidget {
  const _SelectField({
    super.key,
    required this.scheme,
    required this.value,
    required this.items,
    required this.onChanged,
  });
  final QzColorScheme scheme;
  final String value;
  final List<({String key, String label})> items;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: scheme.bgInput,
        border: Border.all(color: scheme.border),
        borderRadius: BorderRadius.circular(QzRadii.input),
      ),
      padding: const EdgeInsets.symmetric(horizontal: QzSpacing.md),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: value,
          isExpanded: true,
          dropdownColor: scheme.bgElev,
          style: TextStyle(color: scheme.text, fontSize: 14),
          icon: Icon(Icons.expand_more, color: scheme.textMid, size: 18),
          items: <DropdownMenuItem<String>>[
            for (final it in items)
              DropdownMenuItem<String>(
                value: it.key,
                child: Text(it.label),
              ),
          ],
          onChanged: (String? v) {
            if (v != null) onChanged(v);
          },
        ),
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
