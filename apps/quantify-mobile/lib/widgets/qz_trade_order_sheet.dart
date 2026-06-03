import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../l10n/app_localizations.dart';
import '../theme/colors.dart';
import '../theme/theme_context.dart';
import '../theme/tokens.dart';
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

class _HeaderRow extends StatelessWidget {
  const _HeaderRow({
    required this.symbol,
    required this.direction,
    required this.exchangeName,
  });

  final String symbol;
  final TradeDirection direction;
  final String exchangeName;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final String base = _QzTradeOrderSheetState._extractBase(symbol);
    final String title = direction == TradeDirection.buy
        ? l10n.tradeOrderSheetHeaderTitleBuy(base)
        : l10n.tradeOrderSheetHeaderTitleSell(base);
    final String subtitle = l10n.tradeOrderSheetHeaderSubtitle(
      symbol,
      exchangeName,
    );
    return Row(
      children: <Widget>[
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: c.bgSoft,
            borderRadius: BorderRadius.circular(QzRadii.pill),
          ),
          alignment: Alignment.center,
          child: Text(
            base.isNotEmpty ? base.substring(0, 1) : '?',
            style: TextStyle(
              color: c.text,
              fontSize: 14,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        const SizedBox(width: QzSpacing.sm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(
                title,
                style: TextStyle(
                  color: c.text,
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: TextStyle(color: c.textMid, fontSize: 12),
              ),
            ],
          ),
        ),
        IconButton(
          key: const Key('trade-order-close'),
          tooltip: l10n.tradeOrderSheetCloseTooltip,
          onPressed: () => Navigator.of(context).maybePop(),
          icon: Icon(Icons.close, color: c.textMid, size: 18),
        ),
      ],
    );
  }
}

class _PopoverRow extends StatelessWidget {
  const _PopoverRow({
    required this.marginMode,
    required this.leverage,
    required this.showMarginPopover,
    required this.showLevPopover,
    required this.onTapMargin,
    required this.onTapLeverage,
    required this.onPickMargin,
    required this.onPickLeverage,
    required this.leverageOptions,
    required this.accentColor,
  });

  final TradeMarginMode marginMode;
  final int leverage;
  final bool showMarginPopover;
  final bool showLevPopover;
  final VoidCallback onTapMargin;
  final VoidCallback onTapLeverage;
  final ValueChanged<TradeMarginMode> onPickMargin;
  final ValueChanged<int> onPickLeverage;
  final List<int> leverageOptions;
  final Color accentColor;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final String marginLabel = marginMode == TradeMarginMode.cross
        ? l10n.tradeOrderSheetMarginCross
        : l10n.tradeOrderSheetMarginIsolated;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Row(
          children: <Widget>[
            Expanded(
              child: _PopoverButton(
                key: const Key('trade-order-margin-toggle'),
                label: marginLabel,
                active: showMarginPopover,
                onTap: onTapMargin,
              ),
            ),
            const SizedBox(width: QzSpacing.sm),
            Expanded(
              child: _PopoverButton(
                key: const Key('trade-order-leverage-toggle'),
                label: '${leverage}x',
                active: showLevPopover,
                onTap: onTapLeverage,
                emphasize: true,
              ),
            ),
          ],
        ),
        // 设计稿用 absolute popover；Flutter modal sheet 内的 Positioned
        // 会被 Stack 的 hit-test 边界裁掉。退而求其次：popover 直接撑高
        // 占位，把下方内容推下去——hit-test 正常、布局可预测、对滚动友好。
        if (showMarginPopover)
          Padding(
            padding: const EdgeInsets.only(top: QzSpacing.xs),
            child: Align(
              alignment: Alignment.centerLeft,
              child: _MarginModeMenu(
                value: marginMode,
                onPick: onPickMargin,
                accentColor: accentColor,
              ),
            ),
          ),
        if (showLevPopover)
          Padding(
            padding: const EdgeInsets.only(top: QzSpacing.xs),
            child: Align(
              alignment: Alignment.centerRight,
              child: _LeverageGrid(
                key: const Key('trade-order-leverage-grid'),
                options: leverageOptions,
                value: leverage,
                onPick: onPickLeverage,
                accentColor: accentColor,
                title: l10n.tradeOrderSheetLeverageGridTitle,
                scheme: c,
              ),
            ),
          ),
      ],
    );
  }
}

class _PopoverButton extends StatelessWidget {
  const _PopoverButton({
    super.key,
    required this.label,
    required this.active,
    required this.onTap,
    this.emphasize = false,
  });

  final String label;
  final bool active;
  final VoidCallback onTap;
  final bool emphasize;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(QzRadii.input),
        child: Container(
          height: 34,
          padding: const EdgeInsets.symmetric(horizontal: QzSpacing.md),
          decoration: BoxDecoration(
            color: active ? c.bgInput : c.bgSoft,
            border: Border.all(color: active ? c.accent : c.borderSoft),
            borderRadius: BorderRadius.circular(QzRadii.input),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: <Widget>[
              Text(
                label,
                style: TextStyle(
                  color: c.text,
                  fontSize: 12,
                  fontWeight: emphasize ? FontWeight.w700 : FontWeight.w500,
                ),
              ),
              Icon(Icons.expand_more, size: 14, color: c.textMid),
            ],
          ),
        ),
      ),
    );
  }
}

class _MarginModeMenu extends StatelessWidget {
  const _MarginModeMenu({
    required this.value,
    required this.onPick,
    required this.accentColor,
  });

  final TradeMarginMode value;
  final ValueChanged<TradeMarginMode> onPick;
  final Color accentColor;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    return Material(
      elevation: 4,
      borderRadius: BorderRadius.circular(QzRadii.input),
      color: c.bgElev,
      child: Container(
        width: 160,
        decoration: BoxDecoration(
          border: Border.all(color: c.borderSoft),
          borderRadius: BorderRadius.circular(QzRadii.input),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            _menuItem(
              key: const Key('trade-order-margin-cross'),
              label: l10n.tradeOrderSheetMarginCross,
              active: value == TradeMarginMode.cross,
              scheme: c,
              accentColor: accentColor,
              onTap: () => onPick(TradeMarginMode.cross),
            ),
            _menuItem(
              key: const Key('trade-order-margin-isolated'),
              label: l10n.tradeOrderSheetMarginIsolated,
              active: value == TradeMarginMode.isolated,
              scheme: c,
              accentColor: accentColor,
              onTap: () => onPick(TradeMarginMode.isolated),
            ),
          ],
        ),
      ),
    );
  }

  Widget _menuItem({
    required Key key,
    required String label,
    required bool active,
    required QzColorScheme scheme,
    required Color accentColor,
    required VoidCallback onTap,
  }) {
    return InkWell(
      key: key,
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(
          horizontal: QzSpacing.md,
          vertical: QzSpacing.sm,
        ),
        child: Text(
          label,
          style: TextStyle(
            color: active ? accentColor : scheme.text,
            fontSize: 13,
            fontWeight: active ? FontWeight.w700 : FontWeight.w500,
          ),
        ),
      ),
    );
  }
}

class _LeverageGrid extends StatelessWidget {
  const _LeverageGrid({
    super.key,
    required this.options,
    required this.value,
    required this.onPick,
    required this.accentColor,
    required this.title,
    required this.scheme,
  });

  final List<int> options;
  final int value;
  final ValueChanged<int> onPick;
  final Color accentColor;
  final String title;
  final QzColorScheme scheme;

  @override
  Widget build(BuildContext context) {
    return Material(
      elevation: 4,
      borderRadius: BorderRadius.circular(QzRadii.input),
      color: scheme.bgElev,
      child: Container(
        width: 220,
        padding: const EdgeInsets.all(QzSpacing.sm),
        decoration: BoxDecoration(
          border: Border.all(color: scheme.borderSoft),
          borderRadius: BorderRadius.circular(QzRadii.input),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Padding(
              padding: const EdgeInsets.fromLTRB(4, 2, 4, 6),
              child: Text(
                title,
                style: TextStyle(color: scheme.textMid, fontSize: 11),
              ),
            ),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: <Widget>[
                for (final int lev in options)
                  SizedBox(
                    width: 46,
                    height: 30,
                    child: _LeverageChip(
                      key: Key('trade-order-leverage-$lev'),
                      label: '${lev}x',
                      active: lev == value,
                      onTap: () => onPick(lev),
                      accentColor: accentColor,
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _LeverageChip extends StatelessWidget {
  const _LeverageChip({
    super.key,
    required this.label,
    required this.active,
    required this.onTap,
    required this.accentColor,
  });

  final String label;
  final bool active;
  final VoidCallback onTap;
  final Color accentColor;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Material(
      color: active ? accentColor : c.bgSoft,
      borderRadius: BorderRadius.circular(6),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(6),
        child: Center(
          child: Text(
            label,
            style: TextStyle(
              color: active ? Colors.white : c.text,
              fontSize: 12,
              fontWeight: FontWeight.w700,
              fontFamily: QzFont.mono,
              fontFamilyFallback: QzFont.monoFallback,
            ),
          ),
        ),
      ),
    );
  }
}

class _OrderTypeTabs extends StatelessWidget {
  const _OrderTypeTabs({
    required this.value,
    required this.onChanged,
    required this.accentColor,
  });

  final TradeOrderKind value;
  final ValueChanged<TradeOrderKind> onChanged;
  final Color accentColor;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final List<(TradeOrderKind, String, Key)> entries =
        <(TradeOrderKind, String, Key)>[
      (TradeOrderKind.limit, l10n.tradeOrderSheetTabLimit,
          const Key('trade-order-tab-limit')),
      (TradeOrderKind.market, l10n.tradeOrderSheetTabMarket,
          const Key('trade-order-tab-market')),
      (TradeOrderKind.conditional, l10n.tradeOrderSheetTabConditional,
          const Key('trade-order-tab-conditional')),
    ];
    return Container(
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: c.borderSoft)),
      ),
      child: Row(
        children: <Widget>[
          for (final (TradeOrderKind k, String label, Key key) in entries)
            Padding(
              padding: const EdgeInsets.only(right: QzSpacing.md),
              child: InkWell(
                key: key,
                onTap: () => onChanged(k),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: QzSpacing.sm),
                  child: Column(
                    children: <Widget>[
                      Text(
                        label,
                        style: TextStyle(
                          color: k == value ? c.text : c.textMid,
                          fontSize: 13,
                          fontWeight:
                              k == value ? FontWeight.w700 : FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Container(
                        height: 2,
                        width: 24,
                        color: k == value ? accentColor : Colors.transparent,
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _NumberField extends StatelessWidget {
  const _NumberField({
    super.key,
    required this.label,
    required this.controller,
    this.labelColor,
  });

  final String label;
  final TextEditingController controller;
  final Color? labelColor;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          label,
          style: TextStyle(
            color: labelColor ?? c.textMid,
            fontSize: 12,
            fontWeight: labelColor == null ? FontWeight.w500 : FontWeight.w700,
          ),
        ),
        const SizedBox(height: 4),
        TextField(
          controller: controller,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          inputFormatters: <TextInputFormatter>[
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
            color: c.text,
            fontSize: 14,
            fontWeight: FontWeight.w600,
            fontFamily: QzFont.mono,
            fontFamilyFallback: QzFont.monoFallback,
          ),
          decoration: InputDecoration(
            isDense: true,
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

class _PriceFieldWithStepper extends StatelessWidget {
  const _PriceFieldWithStepper({
    required this.controller,
    required this.label,
    required this.onStepUp,
    required this.onStepDown,
  });

  final TextEditingController controller;
  final String label;
  final VoidCallback onStepUp;
  final VoidCallback onStepDown;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          label,
          style: TextStyle(color: c.textMid, fontSize: 12),
        ),
        const SizedBox(height: 4),
        Row(
          children: <Widget>[
            Expanded(
              child: TextField(
                key: const Key('trade-order-price'),
                controller: controller,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                inputFormatters: <TextInputFormatter>[
                  FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')),
                  TextInputFormatter.withFunction((
                    TextEditingValue oldValue,
                    TextEditingValue newValue,
                  ) {
                    final int dotCount =
                        '.'.allMatches(newValue.text).length;
                    return dotCount > 1 ? oldValue : newValue;
                  }),
                ],
                style: TextStyle(
                  color: c.text,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  fontFamily: QzFont.mono,
                  fontFamilyFallback: QzFont.monoFallback,
                ),
                decoration: InputDecoration(
                  isDense: true,
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
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(QzRadii.input),
                    borderSide: BorderSide(color: c.accent),
                  ),
                ),
              ),
            ),
            const SizedBox(width: QzSpacing.xs),
            Column(
              children: <Widget>[
                _StepperButton(
                  key: const Key('trade-order-price-step-up'),
                  icon: Icons.add,
                  onTap: onStepUp,
                ),
                const SizedBox(height: 2),
                _StepperButton(
                  key: const Key('trade-order-price-step-down'),
                  icon: Icons.remove,
                  onTap: onStepDown,
                ),
              ],
            ),
          ],
        ),
      ],
    );
  }
}

class _StepperButton extends StatelessWidget {
  const _StepperButton({super.key, required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Material(
      color: c.bgSoft,
      borderRadius: BorderRadius.circular(4),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(4),
        child: Container(
          width: 28,
          height: 18,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            border: Border.all(color: c.borderSoft),
            borderRadius: BorderRadius.circular(4),
          ),
          child: Icon(icon, size: 12, color: c.textMid),
        ),
      ),
    );
  }
}

class _ReferencePriceRow extends StatelessWidget {
  const _ReferencePriceRow({
    required this.latest,
    required this.bid1,
    required this.ask1,
    required this.onPick,
  });

  final double? latest;
  final double? bid1;
  final double? ask1;
  final ValueChanged<double?> onPick;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final List<(Key, String, double?)> entries = <(Key, String, double?)>[
      (
        const Key('trade-order-ref-latest'),
        l10n.tradeOrderSheetReferenceLatest,
        latest,
      ),
      (
        const Key('trade-order-ref-bid1'),
        l10n.tradeOrderSheetReferenceBid1,
        bid1,
      ),
      (
        const Key('trade-order-ref-ask1'),
        l10n.tradeOrderSheetReferenceAsk1,
        ask1,
      ),
    ];
    return Row(
      children: <Widget>[
        for (final (Key key, String label, double? value) in entries)
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(right: QzSpacing.xs),
              child: Material(
                color: c.bgSoft,
                borderRadius: BorderRadius.circular(6),
                child: InkWell(
                  key: key,
                  onTap: value == null ? null : () => onPick(value),
                  borderRadius: BorderRadius.circular(6),
                  child: Container(
                    height: 26,
                    alignment: Alignment.center,
                    child: Text(
                      value == null
                          ? label
                          : '$label ${value.toStringAsFixed(2)}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: c.textMid,
                        fontSize: 11,
                        fontFamily: QzFont.mono,
                        fontFamilyFallback: QzFont.monoFallback,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _MarketHintCard extends StatelessWidget {
  const _MarketHintCard({required this.refPrice});

  final double? refPrice;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: QzSpacing.md,
        vertical: QzSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: c.bgSoft,
        borderRadius: BorderRadius.circular(QzRadii.input),
      ),
      child: Row(
        children: <Widget>[
          Icon(Icons.bolt, size: 14, color: c.accent),
          const SizedBox(width: QzSpacing.xs),
          Expanded(
            child: Text.rich(
              TextSpan(
                style: TextStyle(color: c.textMid, fontSize: 12),
                children: <InlineSpan>[
                  TextSpan(text: l10n.tradeOrderSheetMarketHintPrefix),
                  TextSpan(
                    text: refPrice?.toStringAsFixed(2) ?? '—',
                    style: TextStyle(
                      color: c.text,
                      fontWeight: FontWeight.w700,
                      fontFamily: QzFont.mono,
                      fontFamilyFallback: QzFont.monoFallback,
                    ),
                  ),
                  TextSpan(text: l10n.tradeOrderSheetMarketHintSuffix),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AmountRow extends StatelessWidget {
  const _AmountRow({required this.amount, required this.availableBalance});

  final double amount;
  final double availableBalance;

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
              l10n.tradeOrderSheetFieldAmount,
              style: TextStyle(color: c.textMid, fontSize: 12),
            ),
            const Spacer(),
            Text(
              l10n.tradeOrderSheetAvailableLabel(
                availableBalance.toStringAsFixed(2),
              ),
              style: TextStyle(
                color: c.textDim,
                fontSize: 11,
                fontFamily: QzFont.mono,
                fontFamilyFallback: QzFont.monoFallback,
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Container(
          key: const Key('trade-order-amount'),
          height: 46,
          padding: const EdgeInsets.symmetric(horizontal: QzSpacing.md),
          decoration: BoxDecoration(
            color: c.bgInput,
            border: Border.all(color: c.border),
            borderRadius: BorderRadius.circular(QzRadii.input),
          ),
          alignment: Alignment.centerLeft,
          child: Text(
            amount.toStringAsFixed(4),
            style: TextStyle(
              color: c.text,
              fontSize: 14,
              fontWeight: FontWeight.w600,
              fontFamily: QzFont.mono,
              fontFamilyFallback: QzFont.monoFallback,
            ),
          ),
        ),
      ],
    );
  }
}

class _PercentSlider extends StatelessWidget {
  const _PercentSlider({
    required this.value,
    required this.onChanged,
    required this.accentColor,
  });

  final double value;
  final ValueChanged<double> onChanged;
  final Color accentColor;

  static const List<int> _stops = <int>[0, 25, 50, 75, 100];

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return SizedBox(
      key: const Key('trade-order-pct-slider'),
      height: 48,
      child: LayoutBuilder(
        builder: (BuildContext ctx, BoxConstraints constraints) {
          final double w = constraints.maxWidth;
          double pctFromDx(double dx) {
            if (w <= 0) return 0;
            return (dx / w * 100).clamp(0, 100).toDouble();
          }

          return GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTapDown: (TapDownDetails d) =>
                onChanged(pctFromDx(d.localPosition.dx).roundToDouble()),
            onPanUpdate: (DragUpdateDetails d) =>
                onChanged(pctFromDx(d.localPosition.dx)),
            child: Stack(
              children: <Widget>[
                Positioned(
                  left: 0,
                  right: 0,
                  top: 22,
                  child: Container(height: 2, color: c.border),
                ),
                Positioned(
                  left: 0,
                  top: 22,
                  width: w * value / 100,
                  child: Container(height: 2, color: accentColor),
                ),
                for (final int p in _stops)
                  Positioned(
                    left: (w * p / 100) - 7,
                    top: 16,
                    child: GestureDetector(
                      key: Key('trade-order-pct-$p'),
                      onTap: () => onChanged(p.toDouble()),
                      child: Container(
                        width: 14,
                        height: 14,
                        decoration: BoxDecoration(
                          color: value >= p ? accentColor : c.bgElev,
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: value >= p ? accentColor : c.border,
                            width: 2,
                          ),
                        ),
                      ),
                    ),
                  ),
                Positioned(
                  left: (w * value / 100) - 12,
                  top: 11,
                  child: IgnorePointer(
                    child: Container(
                      width: 24,
                      height: 24,
                      decoration: BoxDecoration(
                        color: accentColor,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 3),
                        boxShadow: <BoxShadow>[
                          BoxShadow(
                            color: accentColor.withValues(alpha: 0.4),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                for (final int p in _stops)
                  Positioned(
                    left: (w * p / 100) - 14,
                    top: 34,
                    child: Text(
                      '$p%',
                      style: TextStyle(
                        color: value.round() == p ? accentColor : c.textDim,
                        fontSize: 10,
                        fontWeight: value.round() == p
                            ? FontWeight.w700
                            : FontWeight.w500,
                        fontFamily: QzFont.mono,
                        fontFamilyFallback: QzFont.monoFallback,
                      ),
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _TpSlToggleRow extends StatelessWidget {
  const _TpSlToggleRow({
    required this.enabled,
    required this.onChanged,
    required this.accentColor,
  });

  final bool enabled;
  final ValueChanged<bool> onChanged;
  final Color accentColor;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    return InkWell(
      key: const Key('trade-order-tpsl-toggle'),
      onTap: () => onChanged(!enabled),
      borderRadius: BorderRadius.circular(QzRadii.input),
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: QzSpacing.md,
          vertical: QzSpacing.sm,
        ),
        decoration: BoxDecoration(
          color: c.bgSoft,
          borderRadius: BorderRadius.circular(QzRadii.input),
        ),
        child: Row(
          children: <Widget>[
            Icon(
              Icons.shield_outlined,
              size: 14,
              color: enabled ? accentColor : c.textMid,
            ),
            const SizedBox(width: QzSpacing.xs),
            Expanded(
              child: Text(
                l10n.tradeOrderSheetTpsl,
                style: TextStyle(
                  color: enabled ? c.text : c.textMid,
                  fontSize: 12,
                ),
              ),
            ),
            Switch.adaptive(
              value: enabled,
              onChanged: onChanged,
              activeThumbColor: Colors.white,
              activeTrackColor: accentColor,
            ),
          ],
        ),
      ),
    );
  }
}

class _EstimatesPanel extends StatelessWidget {
  const _EstimatesPanel({
    required this.margin,
    required this.notional,
    required this.liquidation,
    required this.fee,
    required this.tpReturn,
    required this.slLoss,
    required this.direction,
  });

  final double margin;
  final double notional;
  final double? liquidation;
  final double fee;
  final double? tpReturn;
  final double? slLoss;
  final TradeDirection direction;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    return Container(
      padding: const EdgeInsets.all(QzSpacing.md),
      decoration: BoxDecoration(
        color: c.bgSoft,
        borderRadius: BorderRadius.circular(QzRadii.input),
      ),
      child: Column(
        children: <Widget>[
          _StatRow(
            label: l10n.tradeOrderSheetStatMargin,
            value: '${margin.toStringAsFixed(2)} USDT',
          ),
          const SizedBox(height: QzSpacing.xs),
          _StatRow(
            label: l10n.tradeOrderSheetStatNotional,
            value: '${notional.toStringAsFixed(2)} USDT',
          ),
          const SizedBox(height: QzSpacing.xs),
          _StatRow(
            label: l10n.tradeOrderSheetEstLiqPrice,
            value: liquidation == null
                ? l10n.tradeOrderSheetEstLiqPlaceholder
                : liquidation!.toStringAsFixed(2),
            tone: direction == TradeDirection.buy
                ? c.marketDown
                : c.marketUp,
          ),
          const SizedBox(height: QzSpacing.xs),
          _StatRow(
            label: l10n.tradeOrderSheetStatFee,
            value: '${fee.toStringAsFixed(2)} USDT',
          ),
          if (tpReturn != null) ...<Widget>[
            const SizedBox(height: QzSpacing.xs),
            _StatRow(
              label: l10n.tradeOrderSheetStatTpReturn,
              value: '+${tpReturn!.toStringAsFixed(2)} USDT',
              tone: c.marketUp,
            ),
          ],
          if (slLoss != null) ...<Widget>[
            const SizedBox(height: QzSpacing.xs),
            _StatRow(
              label: l10n.tradeOrderSheetStatSlLoss,
              value: '-${slLoss!.toStringAsFixed(2)} USDT',
              tone: c.marketDown,
            ),
          ],
        ],
      ),
    );
  }
}

class _StatRow extends StatelessWidget {
  const _StatRow({required this.label, required this.value, this.tone});

  final String label;
  final String value;
  final Color? tone;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Row(
      children: <Widget>[
        Text(label, style: TextStyle(color: c.textMid, fontSize: 12)),
        const Spacer(),
        Text(
          value,
          style: TextStyle(
            color: tone ?? c.text,
            fontSize: 12,
            fontWeight: FontWeight.w600,
            fontFamily: QzFont.mono,
            fontFamilyFallback: QzFont.monoFallback,
          ),
        ),
      ],
    );
  }
}

class _StickyFooter extends StatelessWidget {
  const _StickyFooter({
    super.key,
    required this.direction,
    required this.amount,
    required this.base,
    required this.enabled,
    required this.loading,
    required this.onPressed,
    required this.accentColor,
  });

  final TradeDirection direction;
  final double amount;
  final String base;
  final bool enabled;
  final bool loading;
  final VoidCallback onPressed;
  final Color accentColor;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final bool empty = amount <= 0;
    final String label;
    if (loading) {
      label = l10n.tradeOrderSheetSubmitting;
    } else if (empty) {
      label = l10n.tradeOrderSheetSubmitEmpty;
    } else {
      label = direction == TradeDirection.buy
          ? l10n.tradeOrderSheetSubmitConfirmBuy(
              amount.toStringAsFixed(4), base)
          : l10n.tradeOrderSheetSubmitConfirmSell(
              amount.toStringAsFixed(4), base);
    }
    return Column(
      children: <Widget>[
        Opacity(
          opacity: enabled ? 1 : 0.5,
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: enabled ? onPressed : null,
              borderRadius: BorderRadius.circular(QzRadii.input),
              child: Container(
                height: 50,
                width: double.infinity,
                decoration: BoxDecoration(
                  color: empty && !loading ? c.borderSoft : accentColor,
                  borderRadius: BorderRadius.circular(QzRadii.input),
                ),
                alignment: Alignment.center,
                child: loading
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor:
                              AlwaysStoppedAnimation<Color>(Colors.white),
                        ),
                      )
                    : Text(
                        label,
                        style: TextStyle(
                          color: empty
                              ? c.textMid
                              : Colors.white,
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
              ),
            ),
          ),
        ),
        const SizedBox(height: QzSpacing.xs),
        Text(
          l10n.tradeOrderSheetRiskHint,
          style: TextStyle(color: c.textDim, fontSize: 10),
        ),
      ],
    );
  }
}
