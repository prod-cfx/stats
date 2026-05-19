import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../l10n/app_localizations.dart';
import '../theme/colors.dart';
import '../theme/theme_context.dart';
import '../theme/tokens.dart';
import 'qz_segmented_tabs.dart';
import 'qz_sheet.dart';

/// 下单方向。
enum TradeDirection { buy, sell }

/// 委托类型 tab。
enum TradeOrderKind { limit, market, conditional }

/// 保证金模式。
enum TradeMarginMode { cross, isolated }

/// mock 提交结果。本期未接交易后端，调用方通常只关心是否成功（非 null）。
class TradeOrderResult {
  const TradeOrderResult({
    required this.direction,
    required this.kind,
    required this.symbol,
    required this.price,
    required this.amount,
    required this.leverage,
    required this.marginMode,
    this.triggerPrice,
    this.takeProfit,
    this.stopLoss,
  });

  final TradeDirection direction;
  final TradeOrderKind kind;
  final String symbol;
  final double? price; // 市价为 null
  final double amount;
  final double leverage;
  final TradeMarginMode marginMode;
  final double? triggerPrice;
  final double? takeProfit;
  final double? stopLoss;
}

/// 交易详情底部下单弹层。
///
/// 单一 widget 承载下单 UI 状态机：tab 切换会改变价格字段的可编辑性 +
/// 触发价的显隐。校验逻辑由表单字段提供，提交按钮根据校验结果禁用。
///
/// 真后端未接：提交触发 800ms `Future.delayed` mock → pop 返回
/// `TradeOrderResult`；调用方据此 toast / 注入「我的成交记录」。
class QzTradeOrderSheet extends StatefulWidget {
  const QzTradeOrderSheet({
    super.key,
    required this.symbol,
    required this.direction,
    this.markPrice,
  });

  /// 当前交易对，如 `BTCUSDT`。
  final String symbol;

  /// 调起方向（买/卖）。Sheet 内不再切换方向；关闭重开。
  final TradeDirection direction;

  /// 行情快照参考价。限价 tab 用作默认值；市价 tab 用作"成交参考"+ 强平价估算。
  final double? markPrice;

  static Future<TradeOrderResult?> show(
    BuildContext context, {
    required String symbol,
    required TradeDirection direction,
    double? markPrice,
  }) {
    return QzSheet.show<TradeOrderResult>(
      context: context,
      builder: (BuildContext ctx) => QzTradeOrderSheet(
        symbol: symbol,
        direction: direction,
        markPrice: markPrice,
      ),
    );
  }

  @override
  State<QzTradeOrderSheet> createState() => _QzTradeOrderSheetState();
}

class _QzTradeOrderSheetState extends State<QzTradeOrderSheet> {
  /// 默认杠杆。验收：范围 1-125，默认 10。
  static const double _defaultLeverage = 10;
  static const double _minLeverage = 1;
  static const double _maxLeverage = 125;

  /// mock 提交时长。验收：≥0.5s 给用户可见的 loading；取 800ms。
  static const Duration _submitDuration = Duration(milliseconds: 800);

  TradeOrderKind _kind = TradeOrderKind.limit;
  TradeMarginMode _marginMode = TradeMarginMode.cross;
  double _leverage = _defaultLeverage;

  late final TextEditingController _priceCtrl;
  late final TextEditingController _amountCtrl;
  late final TextEditingController _triggerCtrl;
  late final TextEditingController _tpCtrl;
  late final TextEditingController _slCtrl;

  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    final String? defaultPrice = widget.markPrice?.toStringAsFixed(2);
    _priceCtrl = TextEditingController(text: defaultPrice ?? '');
    _amountCtrl = TextEditingController();
    _triggerCtrl = TextEditingController();
    _tpCtrl = TextEditingController();
    _slCtrl = TextEditingController();
    // 所有字段都 listen，触发提交按钮可用性 + 强平价重新计算。
    for (final TextEditingController c in <TextEditingController>[
      _priceCtrl,
      _amountCtrl,
      _triggerCtrl,
      _tpCtrl,
      _slCtrl,
    ]) {
      c.addListener(_onFieldChanged);
    }
  }

  @override
  void dispose() {
    for (final TextEditingController c in <TextEditingController>[
      _priceCtrl,
      _amountCtrl,
      _triggerCtrl,
      _tpCtrl,
      _slCtrl,
    ]) {
      c.removeListener(_onFieldChanged);
      c.dispose();
    }
    super.dispose();
  }

  void _onFieldChanged() {
    // 字段值变更会影响 `_canSubmit` 与强平价显示，setState 触发 build。
    if (mounted) setState(() {});
  }

  double? _parsePositive(String text) {
    final double? v = double.tryParse(text.trim());
    if (v == null || v <= 0) return null;
    return v;
  }

  bool get _canSubmit {
    if (_submitting) return false;
    final double? amount = _parsePositive(_amountCtrl.text);
    if (amount == null) return false;
    switch (_kind) {
      case TradeOrderKind.market:
        return true;
      case TradeOrderKind.limit:
        return _parsePositive(_priceCtrl.text) != null;
      case TradeOrderKind.conditional:
        return _parsePositive(_priceCtrl.text) != null &&
            _parsePositive(_triggerCtrl.text) != null;
    }
  }

  /// 预计强平价（mock 公式）：
  /// 以 entry price 与杠杆推导维持保证金触发的价位。
  /// 公式：long  → entry × (1 − 1/lev)
  ///       short → entry × (1 + 1/lev)
  /// 真实交易所公式涉及维持保证金率 / 资金费率，本期 mock 仅作 UI 演示。
  double? _estLiquidationPrice() {
    final double? entry = _kind == TradeOrderKind.market
        ? widget.markPrice
        : _parsePositive(_priceCtrl.text);
    if (entry == null) return null;
    if (_leverage <= 0) return null;
    final double margin = 1 / _leverage;
    return widget.direction == TradeDirection.buy
        ? entry * (1 - margin)
        : entry * (1 + margin);
  }

  Future<void> _submit() async {
    if (!_canSubmit) return;
    setState(() => _submitting = true);
    await Future<void>.delayed(_submitDuration);
    if (!mounted) return;
    final double? price = _kind == TradeOrderKind.market
        ? null
        : _parsePositive(_priceCtrl.text);
    final TradeOrderResult result = TradeOrderResult(
      direction: widget.direction,
      kind: _kind,
      symbol: widget.symbol,
      price: price,
      amount: _parsePositive(_amountCtrl.text) ?? 0,
      leverage: _leverage,
      marginMode: _marginMode,
      triggerPrice: _kind == TradeOrderKind.conditional
          ? _parsePositive(_triggerCtrl.text)
          : null,
      takeProfit: _parsePositive(_tpCtrl.text),
      stopLoss: _parsePositive(_slCtrl.text),
    );
    Navigator.of(context).pop(result);
  }

  void _applyPercent(double percent) {
    // 占位实现：把 chip 百分比直接当成"可用仓位比例"（0-1）填入数量字段。
    // 与「百分比仓位」语义对齐——点 25% 得 0.25、100% 得 1.0，
    // 用户能直观看到 chip 与 amount 字段的正比关系。
    // 真接入账户余额后替换为 (availableBalance × percent / 100 / entryPrice)。
    final double amount = percent / 100;
    if (amount <= 0) return;
    _amountCtrl.text = amount.toStringAsFixed(4);
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final String tabLimit = l10n.tradeOrderSheetTabLimit;
    final String tabMarket = l10n.tradeOrderSheetTabMarket;
    final String tabCond = l10n.tradeOrderSheetTabConditional;
    final String tabValue = switch (_kind) {
      TradeOrderKind.limit => tabLimit,
      TradeOrderKind.market => tabMarket,
      TradeOrderKind.conditional => tabCond,
    };

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        QzSpacing.lg,
        0,
        QzSpacing.lg,
        QzSpacing.lg,
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Row(
              children: <Widget>[
                Text(
                  widget.symbol,
                  style: TextStyle(
                    color: c.text,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const Spacer(),
                _MarginToggle(
                  value: _marginMode,
                  onChanged: (TradeMarginMode m) =>
                      setState(() => _marginMode = m),
                ),
              ],
            ),
            const SizedBox(height: QzSpacing.md),
            QzSegmentedTabs(
              key: const Key('trade-order-tabs'),
              size: QzSegSize.md,
              options: <String>[tabLimit, tabMarket, tabCond],
              value: tabValue,
              onChanged: (String next) {
                setState(() {
                  if (next == tabLimit) _kind = TradeOrderKind.limit;
                  if (next == tabMarket) _kind = TradeOrderKind.market;
                  if (next == tabCond) _kind = TradeOrderKind.conditional;
                });
              },
            ),
            const SizedBox(height: QzSpacing.md),
            _NumberField(
              key: const Key('trade-order-price'),
              label: l10n.tradeOrderSheetFieldPrice,
              controller: _priceCtrl,
              enabled: _kind != TradeOrderKind.market,
              placeholder: _kind == TradeOrderKind.market
                  ? l10n.tradeOrderSheetMarketPriceHint
                  : null,
            ),
            if (_kind == TradeOrderKind.conditional) ...<Widget>[
              const SizedBox(height: QzSpacing.sm),
              _NumberField(
                key: const Key('trade-order-trigger'),
                label: l10n.tradeOrderSheetFieldTriggerPrice,
                controller: _triggerCtrl,
              ),
            ],
            const SizedBox(height: QzSpacing.sm),
            _NumberField(
              key: const Key('trade-order-amount'),
              label: l10n.tradeOrderSheetFieldAmount,
              controller: _amountCtrl,
            ),
            const SizedBox(height: QzSpacing.sm),
            Row(
              children: <Widget>[
                for (final int p in <int>[25, 50, 75, 100])
                  Padding(
                    padding: const EdgeInsets.only(right: QzSpacing.xs),
                    child: _PercentChip(
                      percent: p,
                      onTap: () => _applyPercent(p.toDouble()),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: QzSpacing.md),
            _LeverageSlider(
              value: _leverage,
              min: _minLeverage,
              max: _maxLeverage,
              onChanged: (double v) => setState(() => _leverage = v),
            ),
            const SizedBox(height: QzSpacing.md),
            Row(
              children: <Widget>[
                Expanded(
                  child: _NumberField(
                    key: const Key('trade-order-tp'),
                    label: l10n.tradeOrderSheetFieldTakeProfit,
                    controller: _tpCtrl,
                  ),
                ),
                const SizedBox(width: QzSpacing.sm),
                Expanded(
                  child: _NumberField(
                    key: const Key('trade-order-sl'),
                    label: l10n.tradeOrderSheetFieldStopLoss,
                    controller: _slCtrl,
                  ),
                ),
              ],
            ),
            const SizedBox(height: QzSpacing.md),
            _LiqPriceLine(
              label: l10n.tradeOrderSheetEstLiqPrice,
              value: _estLiquidationPrice(),
              placeholder: l10n.tradeOrderSheetEstLiqPlaceholder,
            ),
            const SizedBox(height: QzSpacing.lg),
            _SubmitButton(
              key: const Key('trade-order-submit'),
              direction: widget.direction,
              symbol: widget.symbol,
              enabled: _canSubmit,
              loading: _submitting,
              onPressed: _submit,
              prefixBuy: l10n.tradeOrderSheetSubmitBuyPrefix,
              prefixSell: l10n.tradeOrderSheetSubmitSellPrefix,
            ),
          ],
        ),
      ),
    );
  }
}

class _MarginToggle extends StatelessWidget {
  const _MarginToggle({required this.value, required this.onChanged});

  final TradeMarginMode value;
  final ValueChanged<TradeMarginMode> onChanged;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final String cross = l10n.tradeOrderSheetMarginCross;
    final String iso = l10n.tradeOrderSheetMarginIsolated;
    return QzSegmentedTabs(
      key: const Key('trade-order-margin'),
      options: <String>[cross, iso],
      value: value == TradeMarginMode.cross ? cross : iso,
      onChanged: (String next) {
        onChanged(next == cross ? TradeMarginMode.cross : TradeMarginMode.isolated);
      },
    );
  }
}

class _NumberField extends StatelessWidget {
  const _NumberField({
    super.key,
    required this.label,
    required this.controller,
    this.enabled = true,
    this.placeholder,
  });

  final String label;
  final TextEditingController controller;
  final bool enabled;
  final String? placeholder;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          label,
          style: TextStyle(color: c.textDim, fontSize: 12),
        ),
        const SizedBox(height: 4),
        TextField(
          controller: controller,
          enabled: enabled,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          inputFormatters: <TextInputFormatter>[
            // 数字 + 至多一个小数点。先过 `[0-9.]` 字符白名单，
            // 再用 withFunction 兜底拒绝多个小数点的中间态。
            // 旧版只放白名单允许 "1.2.3" 进来，被 double.tryParse 判 null，
            // 用户只能靠提交按钮禁用反推，体验不直观。
            FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')),
            TextInputFormatter.withFunction((
              TextEditingValue oldValue,
              TextEditingValue newValue,
            ) {
              final int dotCount = '.'.allMatches(newValue.text).length;
              return dotCount > 1 ? oldValue : newValue;
            }),
          ],
          style: TextStyle(
            color: enabled ? c.text : c.textDim,
            fontSize: 14,
            fontWeight: FontWeight.w600,
            fontFamilyFallback: QzFont.monoFallback,
          ),
          decoration: InputDecoration(
            isDense: true,
            hintText: placeholder,
            hintStyle: TextStyle(color: c.textFaint, fontSize: 14),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: QzSpacing.md,
              vertical: QzSpacing.sm,
            ),
            filled: true,
            fillColor: c.bgInput,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(QzRadii.input),
              borderSide: BorderSide(color: c.border),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(QzRadii.input),
              borderSide: BorderSide(color: c.border),
            ),
            disabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(QzRadii.input),
              borderSide: BorderSide(color: c.borderSoft),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(QzRadii.input),
              borderSide: BorderSide(color: c.accent),
            ),
          ),
        ),
      ],
    );
  }
}

class _PercentChip extends StatelessWidget {
  const _PercentChip({required this.percent, required this.onTap});

  final int percent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(QzRadii.pill),
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: QzSpacing.md,
            vertical: 6,
          ),
          decoration: BoxDecoration(
            color: c.bgSoft,
            border: Border.all(color: c.border),
            borderRadius: BorderRadius.circular(QzRadii.pill),
          ),
          child: Text(
            '$percent%',
            style: TextStyle(
              color: c.textMid,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ),
    );
  }
}

class _LeverageSlider extends StatelessWidget {
  const _LeverageSlider({
    required this.value,
    required this.min,
    required this.max,
    required this.onChanged,
  });

  final double value;
  final double min;
  final double max;
  final ValueChanged<double> onChanged;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Row(
          children: <Widget>[
            Text(
              l10n.tradeOrderSheetLeverageLabel,
              style: TextStyle(color: c.textDim, fontSize: 12),
            ),
            const Spacer(),
            Text(
              '${value.toInt()}x',
              style: TextStyle(
                color: c.accent,
                fontSize: 14,
                fontWeight: FontWeight.w700,
                fontFamilyFallback: QzFont.monoFallback,
              ),
            ),
          ],
        ),
        Slider(
          key: const Key('trade-order-leverage'),
          value: value,
          min: min,
          max: max,
          divisions: (max - min).toInt(),
          activeColor: c.accent,
          inactiveColor: c.borderSoft,
          onChanged: onChanged,
        ),
      ],
    );
  }
}

class _LiqPriceLine extends StatelessWidget {
  const _LiqPriceLine({
    required this.label,
    required this.value,
    required this.placeholder,
  });

  final String label;
  final double? value;
  final String placeholder;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Row(
      children: <Widget>[
        Text(
          label,
          style: TextStyle(color: c.textDim, fontSize: 12),
        ),
        const Spacer(),
        Text(
          value == null ? placeholder : value!.toStringAsFixed(2),
          style: TextStyle(
            color: c.text,
            fontSize: 13,
            fontWeight: FontWeight.w700,
            fontFamilyFallback: QzFont.monoFallback,
          ),
        ),
      ],
    );
  }
}

class _SubmitButton extends StatelessWidget {
  const _SubmitButton({
    super.key,
    required this.direction,
    required this.symbol,
    required this.enabled,
    required this.loading,
    required this.onPressed,
    required this.prefixBuy,
    required this.prefixSell,
  });

  final TradeDirection direction;
  final String symbol;
  final bool enabled;
  final bool loading;
  final VoidCallback onPressed;
  final String prefixBuy;
  final String prefixSell;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final Color bg = direction == TradeDirection.buy ? c.marketUp : c.marketDown;
    final String label =
        '${direction == TradeDirection.buy ? prefixBuy : prefixSell}$symbol';
    final bool disabled = !enabled;
    return Opacity(
      opacity: disabled ? 0.5 : 1,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: disabled ? null : onPressed,
          borderRadius: BorderRadius.circular(QzRadii.input),
          child: Container(
            height: 48,
            decoration: BoxDecoration(
              color: bg,
              borderRadius: BorderRadius.circular(QzRadii.input),
            ),
            alignment: Alignment.center,
            child: loading
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                    ),
                  )
                : Text(
                    label,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
          ),
        ),
      ),
    );
  }
}
