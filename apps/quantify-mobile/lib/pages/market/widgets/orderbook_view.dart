import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/models/orderbook_models.dart';
import '../../../data/providers.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';
import '../../../widgets/qz_empty_state.dart';
import '../../../widgets/qz_spinner.dart';

class OrderbookView extends ConsumerStatefulWidget {
  const OrderbookView({super.key, required this.symbol});

  final String symbol;

  @override
  ConsumerState<OrderbookView> createState() => _OrderbookViewState();
}

class _OrderbookViewState extends ConsumerState<OrderbookView> {
  OrderbookSnapshot? _snapshot;
  StreamSubscription<OrderbookSnapshot>? _sub;
  bool _loading = true;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(OrderbookView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.symbol != widget.symbol) {
      _sub?.cancel();
      _load();
    }
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final repo = ref.read(orderbookRepositoryProvider);
    try {
      final OrderbookSnapshot initial = await repo.getSnapshot(widget.symbol);
      if (!mounted) return;
      setState(() {
        _snapshot = initial;
        _loading = false;
      });
      _sub = repo.watchOrderbook(widget.symbol).listen((
        OrderbookSnapshot next,
      ) {
        if (!mounted) return;
        setState(() => _snapshot = next);
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error;
        _loading = false;
      });
    }
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: QzSpinner());
    if (_error != null || _snapshot == null) {
      return QzEmptyState(title: AppLocalizations.of(context).orderbookLoadError);
    }
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Expanded(child: _OrderbookSide(levels: _snapshot!.bids, isBid: true)),
        const SizedBox(width: QzSpacing.md),
        Expanded(child: _OrderbookSide(levels: _snapshot!.asks, isBid: false)),
      ],
    );
  }
}

class _OrderbookSide extends StatelessWidget {
  const _OrderbookSide({required this.levels, required this.isBid});

  final List<OrderbookLevel> levels;
  final bool isBid;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final Color color = isBid ? c.marketUp : c.marketDown;
    return Column(
      children: <Widget>[
        for (final OrderbookLevel level in levels.take(10))
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 3),
            child: Row(
              children: <Widget>[
                Expanded(
                  child: Text(
                    level.price.toStringAsFixed(2),
                    style: TextStyle(
                      color: color,
                      fontSize: 12,
                      fontFamilyFallback: QzFont.monoFallback,
                    ),
                  ),
                ),
                Text(
                  level.quantity.toStringAsFixed(3),
                  style: TextStyle(
                    color: c.textMid,
                    fontSize: 12,
                    fontFamilyFallback: QzFont.monoFallback,
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}
