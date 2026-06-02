import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/models/ticker_models.dart';
import '../../../data/providers.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';
import '../../../widgets/qz_avatar.dart';
import '../../../widgets/qz_stat_chip.dart';

/// 三列 flex 配比；与 [MarketHomeBody] 的 _ColumnHeader 保持一致：
/// 名称/量 12 | 最新价 10 | 24H 涨跌 10。
const int kTickerRowNameFlex = 12;
const int kTickerRowPriceFlex = 10;
const int kTickerRowChangeFlex = 10;

/// 设计稿常用的 quote 资产；非这些后缀则原样展示。
const List<String> _kKnownQuotes = <String>[
  'USDT',
  'USDC',
  'USD',
  'BUSD',
  'BTC',
  'ETH',
  'DAI',
  'TUSD',
];

/// 资产专属品牌色（与 `design/project/mobile/m-screens-2.jsx` 的
/// `TICKERS[*].tone` 1:1 对齐）。未匹配的资产回退到默认 accent。
const Map<String, Color> _kAssetTone = <String, Color>{
  'BTC': Color(0xFFF7931A),
  'ETH': Color(0xFF627EEA),
  'SOL': Color(0xFF9945FF),
  'BNB': Color(0xFFF0B90B),
  'XRP': Color(0xFF23292F),
  'DOGE': Color(0xFFC2A633),
  'TON': Color(0xFF0098EA),
  'AVAX': Color(0xFFE84142),
};

/// Resolve brand tone for the given base symbol; `null` falls back to theme accent.
Color? tickerAssetTone(String base) => _kAssetTone[base.toUpperCase()];

/// 行情列表中的一行（issue #1598 三列布局）。
///
/// 布局：
/// - 左列：头像 + 主符号 `BTC` + 小字 `/ USDT` + 24H 量。
/// - 中列：最新价，右对齐，等宽字体。
/// - 右列：24H 涨跌 chip，右对齐。
class TickerRow extends ConsumerStatefulWidget {
  const TickerRow({
    super.key,
    required this.ticker,
    this.onTap,
    this.nameSuffix,
  });

  final Ticker ticker;
  final VoidCallback? onTap;
  final String? nameSuffix;

  @override
  ConsumerState<TickerRow> createState() => _TickerRowState();
}

class _TickerRowState extends ConsumerState<TickerRow> {
  late Ticker _ticker;
  StreamSubscription<Ticker>? _sub;

  @override
  void initState() {
    super.initState();
    _ticker = widget.ticker;
    _subscribe();
  }

  @override
  void didUpdateWidget(TickerRow oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.ticker.symbol == widget.ticker.symbol) {
      return;
    }
    _ticker = widget.ticker;
    _sub?.cancel();
    _subscribe();
  }

  void _subscribe() {
    _sub = ref
        .read(tickerRepositoryProvider)
        .watchTicker(_ticker.symbol)
        .listen((Ticker next) {
          if (!mounted) return;
          setState(() => _ticker = next);
        });
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  /// 将 symbol 拆为 base + quote；未识别 quote 时 quote 为空，整串作为 base。
  ({String base, String quote}) _split(String symbol) {
    for (final String q in _kKnownQuotes) {
      if (symbol.length > q.length && symbol.endsWith(q)) {
        return (base: symbol.substring(0, symbol.length - q.length), quote: q);
      }
    }
    return (base: symbol, quote: '');
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final ({String base, String quote}) parts = _split(_ticker.symbol);
    final String initial = parts.base.isEmpty
        ? '?'
        : parts.base.substring(0, 1);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: widget.onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: QzSpacing.lg,
            vertical: 12,
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: <Widget>[
              Expanded(
                flex: kTickerRowNameFlex,
                child: Row(
                  children: <Widget>[
                    QzAvatar(
                      label: initial,
                      monospace: true,
                      backgroundColor: tickerAssetTone(parts.base),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: <Widget>[
                          RichText(
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            text: TextSpan(
                              style: TextStyle(
                                color: c.text,
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                              ),
                              children: <InlineSpan>[
                                TextSpan(text: parts.base),
                                if (parts.quote.isNotEmpty)
                                  TextSpan(
                                    text: ' / ${parts.quote}',
                                    style: TextStyle(
                                      color: c.textDim,
                                      fontSize: 10,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                if (widget.nameSuffix != null)
                                  TextSpan(
                                    text: ' · ${widget.nameSuffix}',
                                    style: TextStyle(
                                      color: c.textDim,
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Vol \$${_formatVolume(_ticker.volume24h)}',
                            style: TextStyle(color: c.textDim, fontSize: 11),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                flex: kTickerRowPriceFlex,
                child: Text(
                  _formatPrice(_ticker.price),
                  textAlign: TextAlign.right,
                  style: TextStyle(
                    color: c.text,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    fontFamily: QzFont.mono,
                    fontFamilyFallback: QzFont.monoFallback,
                  ),
                ),
              ),
              Expanded(
                flex: kTickerRowChangeFlex,
                // Row(end) 给 chip 无界宽度约束，使其按内容自适应（≥minWidth），
                // 对齐设计稿 justifyContent:flex-end + inline-flex；
                // 不能用 Align —— 它传入有界约束会让 chip 撑满整列留白。
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: <Widget>[
                    QzStatChip(
                      value: _ticker.changePercent / 100,
                      variant: QzStatChipVariant.solid,
                      minWidth: 70,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatVolume(double value) {
    final double abs = value.abs();
    if (abs >= 1e9) return '${(value / 1e9).toStringAsFixed(1)}B';
    if (abs >= 1e6) return '${(value / 1e6).toStringAsFixed(1)}M';
    if (abs >= 1e3) return '${(value / 1e3).toStringAsFixed(1)}K';
    return value.toStringAsFixed(1);
  }

  String _formatPrice(double value) {
    final String fixed = value.toStringAsFixed(2);
    final List<String> parts = fixed.split('.');
    final String whole = parts.first;
    final StringBuffer buffer = StringBuffer();
    for (int i = 0; i < whole.length; i++) {
      if (i > 0 && (whole.length - i) % 3 == 0) buffer.write(',');
      buffer.write(whole[i]);
    }
    return '${buffer.toString()}.${parts[1]}';
  }
}
