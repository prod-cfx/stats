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

class TickerRow extends ConsumerStatefulWidget {
  const TickerRow({super.key, required this.ticker, this.onTap});

  final Ticker ticker;
  final VoidCallback? onTap;

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

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final String initial = _ticker.symbol.isEmpty
        ? '?'
        : _ticker.symbol.substring(0, 1);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: widget.onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: QzSpacing.lg,
            vertical: QzSpacing.md,
          ),
          child: Row(
            children: <Widget>[
              QzAvatar(label: initial, monospace: true),
              const SizedBox(width: QzSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      _ticker.symbol,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: c.text,
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '24h ${_formatVolume(_ticker.volume24h)}',
                      style: TextStyle(color: c.textDim, fontSize: 12),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: QzSpacing.md),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: <Widget>[
                  Text(
                    _ticker.price.toStringAsFixed(2),
                    style: TextStyle(
                      color: c.text,
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      fontFamilyFallback: QzFont.monoFallback,
                    ),
                  ),
                  const SizedBox(height: 6),
                  QzStatChip(value: _ticker.changePercent / 100),
                ],
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
}
