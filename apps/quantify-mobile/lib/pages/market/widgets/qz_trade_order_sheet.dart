import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';
import '../../../widgets/qz_sheet.dart';

part 'qz_trade_order_sheet.controls.part.dart';
part 'qz_trade_order_sheet.fields.part.dart';
part 'qz_trade_order_sheet.summary.part.dart';

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
/// 设计稿来源：`design/project/mobile/m-screens-3.jsx` `ScreenOrderEntry`。
/// 主交互：保证金模式 popover、固定倍数杠杆 popover、可拖拽百分比 slider、
/// 止盈止损 toggle、保证金/名义价值/强平价/手续费/止盈止损预估、sticky footer。
///
/// 真后端未接：提交触发 `_submitDuration` `Future.delayed` mock → pop 返回
/// `TradeOrderResult`；调用方据此 toast / 注入「我的成交记录」。
class QzTradeOrderSheet extends StatefulWidget {
  const QzTradeOrderSheet({
    super.key,
    required this.symbol,
    required this.direction,
    this.markPrice,
    this.availableBalance = _defaultAvailableBalance,
    this.bid1Price,
    this.ask1Price,
    this.exchangeName = 'Binance',
  });

  /// 当前交易对，如 `BTCUSDT`。
  final String symbol;

  /// 调起方向（买/卖）。Sheet 内不再切换方向；关闭重开。
  final TradeDirection direction;

  /// 行情快照参考价。限价 tab 用作默认值；市价 tab 用作"成交参考"+ 强平价估算。
  final double? markPrice;

  /// 可用余额（USDT），用于推导保证金/名义价值/数量。真接入账户前用 mock 值。
  final double availableBalance;

  /// 买一价（可选）。为空时回退到 `markPrice`。
  final double? bid1Price;

  /// 卖一价（可选）。为空时回退到 `markPrice`。
  final double? ask1Price;

  /// 交易所名称，渲染在 header 副标题。
  final String exchangeName;

  /// 默认可用余额，对齐设计稿 `AVAILABLE = 1248.40`。
  static const double _defaultAvailableBalance = 1248.40;

  static Future<TradeOrderResult?> show(
    BuildContext context, {
    required String symbol,
    required TradeDirection direction,
    double? markPrice,
    double availableBalance = _defaultAvailableBalance,
    double? bid1Price,
    double? ask1Price,
    String exchangeName = 'Binance',
  }) {
    return QzSheet.show<TradeOrderResult>(
      context: context,
      useRootNavigator: true,
      builder: (BuildContext ctx) => QzTradeOrderSheet(
        symbol: symbol,
        direction: direction,
        markPrice: markPrice,
        availableBalance: availableBalance,
        bid1Price: bid1Price,
        ask1Price: ask1Price,
        exchangeName: exchangeName,
      ),
    );
  }

  @override
  State<QzTradeOrderSheet> createState() => _QzTradeOrderSheetState();
}

class _QzTradeOrderSheetState extends State<QzTradeOrderSheet> {
  /// 验收：固定倍数集合，来自设计稿 `LEVERAGES`。
  static const List<int> _leverageOptions = <int>[3, 5, 10, 20, 50, 75, 100];

  /// 默认杠杆。
  static const double _defaultLeverage = 10;

  /// mock 提交时长。验收：≥0.5s 给用户可见的 loading；取 800ms。
  static const Duration _submitDuration = Duration(milliseconds: 800);

  /// taker 手续费率，mock。
  static const double _takerFeeRate = 0.0005;

  /// 强平价系数（mock）：long → entry × (1 − k/lev)；short → entry × (1 + k/lev)
  /// k 取 0.9 对齐设计稿。
  static const double _liqK = 0.9;

  TradeOrderKind _kind = TradeOrderKind.limit;
  TradeMarginMode _marginMode = TradeMarginMode.cross;
  double _leverage = _defaultLeverage;
  double _pct = 0;
  bool _tpslEnabled = false;
  bool _showLevPopover = false;
  bool _showMarginPopover = false;
  bool _submitting = false;

  late final TextEditingController _priceCtrl;
  late final TextEditingController _triggerCtrl;
  late final TextEditingController _tpCtrl;
  late final TextEditingController _slCtrl;

  @override
  void initState() {
    super.initState();
    final String? defaultPrice = widget.markPrice?.toStringAsFixed(2);
    _priceCtrl = TextEditingController(text: defaultPrice ?? '');
    _triggerCtrl = TextEditingController();
    _tpCtrl = TextEditingController();
    _slCtrl = TextEditingController();
    for (final TextEditingController c in <TextEditingController>[
      _priceCtrl,
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
    if (mounted) setState(() {});
  }

  double? _parsePositive(String text) {
    final double? v = double.tryParse(text.trim());
    if (v == null || v <= 0) return null;
    return v;
  }

  /// 用作所有衍生计算的 entry price：限价/条件 → 输入价；市价 → markPrice。
  double? get _entryPrice {
    if (_kind == TradeOrderKind.market) return widget.markPrice;
    return _parsePositive(_priceCtrl.text);
  }

  double get _margin => widget.availableBalance * _pct / 100;
  double get _notional => _margin * _leverage;
  double get _amount {
    final double? p = _entryPrice;
    if (p == null || p <= 0) return 0;
    return _notional / p;
  }

  double get _fee => _notional * _takerFeeRate;

  double? get _liquidationPrice {
    final double? entry = _entryPrice;
    if (entry == null || _leverage <= 0) return null;
    final double k = _liqK / _leverage;
    return widget.direction == TradeDirection.buy
        ? entry * (1 - k)
        : entry * (1 + k);
  }

  /// TP 必须落在「盈利方向」才计预期收益：buy → tp > entry；sell → tp < entry。
  /// 方向不符返回 null，让 `_EstimatesPanel` 隐藏对应行，避免把误填的 TP 算成盈利。
  double? _tpReturn() {
    final double? entry = _entryPrice;
    final double? tp = _parsePositive(_tpCtrl.text);
    if (entry == null || tp == null || entry <= 0) return null;
    final bool valid = widget.direction == TradeDirection.buy
        ? tp > entry
        : tp < entry;
    if (!valid) return null;
    return (tp - entry).abs() / entry * _notional;
  }

  /// SL 必须落在「亏损方向」才计预期损失：buy → sl < entry；sell → sl > entry。
  /// 方向不符返回 null，避免把误填的 SL 算成损失。
  double? _slLoss() {
    final double? entry = _entryPrice;
    final double? sl = _parsePositive(_slCtrl.text);
    if (entry == null || sl == null || entry <= 0) return null;
    final bool valid = widget.direction == TradeDirection.buy
        ? sl < entry
        : sl > entry;
    if (!valid) return null;
    return (sl - entry).abs() / entry * _notional;
  }

  bool get _canSubmit {
    if (_submitting) return false;
    if (_pct <= 0) return false;
    switch (_kind) {
      case TradeOrderKind.market:
        return widget.markPrice != null && widget.markPrice! > 0;
      case TradeOrderKind.limit:
        return _parsePositive(_priceCtrl.text) != null;
      case TradeOrderKind.conditional:
        return _parsePositive(_priceCtrl.text) != null &&
            _parsePositive(_triggerCtrl.text) != null;
    }
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
      amount: _amount,
      leverage: _leverage,
      marginMode: _marginMode,
      triggerPrice: _kind == TradeOrderKind.conditional
          ? _parsePositive(_triggerCtrl.text)
          : null,
      takeProfit: _tpslEnabled ? _parsePositive(_tpCtrl.text) : null,
      stopLoss: _tpslEnabled ? _parsePositive(_slCtrl.text) : null,
    );
    Navigator.of(context).pop(result);
  }

  void _applyReferencePrice(double? p) {
    if (p == null || p <= 0) return;
    _priceCtrl.text = p.toStringAsFixed(2);
  }

  void _stepPrice(double delta) {
    final double current = double.tryParse(_priceCtrl.text.trim()) ?? 0;
    final double next = (current + delta).clamp(0, double.infinity).toDouble();
    _priceCtrl.text = next.toStringAsFixed(2);
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final Color sideColor = widget.direction == TradeDirection.buy
        ? c.marketUp
        : c.marketDown;

    return Padding(
      padding: EdgeInsets.fromLTRB(
        QzSpacing.lg,
        0,
        QzSpacing.lg,
        QzSpacing.lg + MediaQuery.viewPaddingOf(context).bottom,
      ),
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.85,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            _HeaderRow(
              symbol: widget.symbol,
              direction: widget.direction,
              exchangeName: widget.exchangeName,
            ),
            const SizedBox(height: QzSpacing.sm),
            _PopoverRow(
              marginMode: _marginMode,
              leverage: _leverage.toInt(),
              showMarginPopover: _showMarginPopover,
              showLevPopover: _showLevPopover,
              onTapMargin: () => setState(() {
                _showMarginPopover = !_showMarginPopover;
                _showLevPopover = false;
              }),
              onTapLeverage: () => setState(() {
                _showLevPopover = !_showLevPopover;
                _showMarginPopover = false;
              }),
              onPickMargin: (TradeMarginMode m) => setState(() {
                _marginMode = m;
                _showMarginPopover = false;
              }),
              onPickLeverage: (int lev) => setState(() {
                _leverage = lev.toDouble();
                _showLevPopover = false;
              }),
              leverageOptions: _leverageOptions,
              accentColor: sideColor,
            ),
            const SizedBox(height: QzSpacing.md),
            Expanded(
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    _OrderTypeTabs(
                      value: _kind,
                      onChanged: (TradeOrderKind k) =>
                          setState(() => _kind = k),
                      accentColor: sideColor,
                    ),
                    const SizedBox(height: QzSpacing.md),
                    if (_kind == TradeOrderKind.conditional) ...<Widget>[
                      _NumberField(
                        key: const Key('trade-order-trigger'),
                        label: l10n.tradeOrderSheetFieldTriggerPrice,
                        controller: _triggerCtrl,
                      ),
                      const SizedBox(height: QzSpacing.sm),
                    ],
                    if (_kind != TradeOrderKind.market) ...<Widget>[
                      _PriceFieldWithStepper(
                        controller: _priceCtrl,
                        label: l10n.tradeOrderSheetFieldPrice,
                        onStepUp: () => _stepPrice(0.1),
                        onStepDown: () => _stepPrice(-0.1),
                      ),
                      const SizedBox(height: QzSpacing.xs),
                      _ReferencePriceRow(
                        latest: widget.markPrice,
                        bid1: widget.bid1Price ?? widget.markPrice,
                        ask1: widget.ask1Price ?? widget.markPrice,
                        onPick: _applyReferencePrice,
                      ),
                      const SizedBox(height: QzSpacing.sm),
                    ],
                    if (_kind == TradeOrderKind.market) ...<Widget>[
                      _MarketHintCard(refPrice: widget.markPrice),
                      const SizedBox(height: QzSpacing.sm),
                    ],
                    _AmountRow(
                      amount: _amount,
                      availableBalance: widget.availableBalance,
                    ),
                    const SizedBox(height: QzSpacing.md),
                    _PercentSlider(
                      value: _pct,
                      onChanged: (double v) => setState(() => _pct = v),
                      accentColor: sideColor,
                    ),
                    const SizedBox(height: QzSpacing.md),
                    _TpSlToggleRow(
                      enabled: _tpslEnabled,
                      onChanged: (bool v) =>
                          setState(() => _tpslEnabled = v),
                      accentColor: sideColor,
                    ),
                    if (_tpslEnabled) ...<Widget>[
                      const SizedBox(height: QzSpacing.sm),
                      Row(
                        children: <Widget>[
                          Expanded(
                            child: _NumberField(
                              key: const Key('trade-order-tp'),
                              label: l10n.tradeOrderSheetFieldTakeProfit,
                              controller: _tpCtrl,
                              labelColor: c.marketUp,
                            ),
                          ),
                          const SizedBox(width: QzSpacing.sm),
                          Expanded(
                            child: _NumberField(
                              key: const Key('trade-order-sl'),
                              label: l10n.tradeOrderSheetFieldStopLoss,
                              controller: _slCtrl,
                              labelColor: c.marketDown,
                            ),
                          ),
                        ],
                      ),
                    ],
                    const SizedBox(height: QzSpacing.md),
                    _EstimatesPanel(
                      margin: _margin,
                      notional: _notional,
                      liquidation: _liquidationPrice,
                      fee: _fee,
                      tpReturn: _tpslEnabled ? _tpReturn() : null,
                      slLoss: _tpslEnabled ? _slLoss() : null,
                      direction: widget.direction,
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: QzSpacing.md),
            _StickyFooter(
              key: const Key('trade-order-submit'),
              direction: widget.direction,
              amount: _amount,
              base: _extractBase(widget.symbol),
              enabled: _canSubmit,
              loading: _submitting,
              onPressed: _submit,
              accentColor: sideColor,
            ),
          ],
        ),
      ),
    );
  }

  /// "BTCUSDT" → "BTC"。仅作 UI 展示，不参与下单。
  static String _extractBase(String symbol) {
    for (final String quote in <String>['USDT', 'USDC', 'BUSD', 'USD']) {
      if (symbol.endsWith(quote) && symbol.length > quote.length) {
        return symbol.substring(0, symbol.length - quote.length);
      }
    }
    return symbol;
  }
}

// ---------------------------------------------------------------------------
// 子组件
// ---------------------------------------------------------------------------

