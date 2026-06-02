import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/models/strategy_models.dart';
import '../../data/providers.dart';
import '../../data/repositories/strategy_repository.dart';
import '../../l10n/app_localizations.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import '../../widgets/qz_spinner.dart';
import '../auth/login_sheet.dart';
import 'widgets/sparkline_view.dart';
import 'widgets/strategy_card_tile.dart';

class StrategyGuestPage extends ConsumerStatefulWidget {
  const StrategyGuestPage({super.key});

  @override
  ConsumerState<StrategyGuestPage> createState() => _StrategyGuestPageState();
}

class _StrategyGuestPageState extends ConsumerState<StrategyGuestPage> {
  List<StrategyMarketItem> _items = const <StrategyMarketItem>[];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final StrategyRepository repo = ref.read(strategyRepositoryProvider);
    final StrategyMarketPage page = await repo.listMarket(page: 1, pageSize: 3);
    if (!mounted) return;
    setState(() {
      _items = page.items;
      _loading = false;
    });
  }

  void _openLogin() => showLoginSheet(context);

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final c = context.qzScheme;
    return ColoredBox(
      key: const Key('strategy-guest-page'),
      color: c.bg,
      child: _loading
          ? const Center(child: QzSpinner())
          : ListView(
              padding: const EdgeInsets.only(bottom: 120),
              children: <Widget>[
                _GuestHero(items: _items, onLogin: _openLogin),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 18, 16, 8),
                  child: Row(
                    children: <Widget>[
                      Text(
                        l10n.strategyGuestHotTitle,
                        style: TextStyle(
                          color: c.text,
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 7,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: c.accentSoft,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          l10n.strategyGuestHotBadge,
                          style: TextStyle(
                            color: c.accent,
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                            fontFamily: QzFont.mono,
                          ),
                        ),
                      ),
                      const Spacer(),
                      TextButton.icon(
                        key: const Key('strategy-guest-view-all'),
                        onPressed: _openLogin,
                        iconAlignment: IconAlignment.end,
                        icon: const Icon(Icons.chevron_right, size: 14),
                        label: Text(l10n.strategyGuestViewAll),
                        style: TextButton.styleFrom(
                          foregroundColor: c.accent,
                          padding: EdgeInsets.zero,
                          minimumSize: const Size(0, 32),
                        ),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Column(
                    children: <Widget>[
                      for (final StrategyMarketItem item in _items)
                        StrategyCardTile(
                          key: Key('strategy-guest-card-${item.card.id}'),
                          item: item,
                          starred: true,
                          onTap: _openLogin,
                          onLoadConversation: _openLogin,
                        ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                  child: _UnlockCard(onLogin: _openLogin),
                ),
              ],
            ),
    );
  }
}

class _GuestHero extends StatelessWidget {
  const _GuestHero({required this.items, required this.onLogin});

  final List<StrategyMarketItem> items;
  final VoidCallback onLogin;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final c = context.qzScheme;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: c.bgElev,
        border: Border(bottom: BorderSide(color: c.borderSoft)),
      ),
      child: Stack(
        children: <Widget>[
          Positioned(
            top: -180,
            left: -80,
            child: _Glow(color: c.accent.withValues(alpha: 0.12), size: 360),
          ),
          const Positioned(
            top: -40,
            right: -120,
            child: _Glow(color: Color(0x1A06B6D4), size: 280),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 82, 18, 28),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        l10n.strategyGuestHeroLine1,
                        style: TextStyle(
                          color: c.text,
                          fontSize: 19,
                          fontWeight: FontWeight.w700,
                          height: 1.35,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Row(
                        children: <Widget>[
                          ShaderMask(
                            shaderCallback: (Rect bounds) =>
                                const LinearGradient(
                                  colors: <Color>[
                                    Color(0xFFA78BFA),
                                    Color(0xFF06B6D4),
                                  ],
                                ).createShader(bounds),
                            child: Text(
                              l10n.strategyGuestHeroAiQuant,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 19,
                                fontWeight: FontWeight.w700,
                                height: 1.35,
                              ),
                            ),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            l10n.strategyGuestHeroLine2Suffix,
                            style: TextStyle(
                              color: c.text,
                              fontSize: 19,
                              fontWeight: FontWeight.w700,
                              height: 1.35,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Text(
                        l10n.strategyGuestHeroSubtitle,
                        style: TextStyle(
                          color: c.textMid,
                          fontSize: 12,
                          height: 1.65,
                        ),
                      ),
                      const SizedBox(height: 16),
                      SizedBox(
                        height: 38,
                        child: FilledButton.icon(
                          key: const Key('strategy-guest-cta-primary'),
                          onPressed: onLogin,
                          iconAlignment: IconAlignment.end,
                          icon: const Icon(Icons.chevron_right, size: 12),
                          label: Text(l10n.strategyGuestPrimaryCta),
                          style: FilledButton.styleFrom(
                            backgroundColor: c.accent,
                            foregroundColor: c.accentOn,
                            padding: const EdgeInsets.symmetric(horizontal: 22),
                            shape: const StadiumBorder(),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                SizedBox(
                  width: 140,
                  height: 130,
                  child: Stack(
                    children: <Widget>[
                      for (int i = 0; i < items.length && i < 3; i++)
                        _MiniStrategyCard(
                          key: Key('strategy-guest-mini-$i'),
                          item: items[i],
                          index: i,
                          onTap: onLogin,
                        ),
                    ],
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

class _Glow extends StatelessWidget {
  const _Glow({required this.color, required this.size});

  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: RadialGradient(
          colors: <Color>[color, Colors.transparent],
          stops: const <double>[0, 0.7],
        ),
      ),
    );
  }
}

class _MiniStrategyCard extends StatelessWidget {
  const _MiniStrategyCard({
    super.key,
    required this.item,
    required this.index,
    required this.onTap,
  });

  final StrategyMarketItem item;
  final int index;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.qzScheme;
    final List<Offset> offsets = <Offset>[
      const Offset(2, 0),
      const Offset(28, 16),
      const Offset(14, 58),
    ];
    const List<double> rotations = <double>[-8, 7, -4];
    final StrategyCard card = item.card;
    return Positioned(
      left: offsets[index].dx,
      top: offsets[index].dy,
      child: Transform.rotate(
        angle: rotations[index] * 3.141592653589793 / 180,
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(10),
            child: Container(
              width: 96,
              height: 64,
              padding: const EdgeInsets.fromLTRB(8, 7, 8, 6),
              decoration: BoxDecoration(
                color: c.bgElev,
                border: Border.all(color: c.borderSoft),
                borderRadius: BorderRadius.circular(10),
                boxShadow: const <BoxShadow>[
                  BoxShadow(
                    color: Color(0x330F0B22),
                    blurRadius: 20,
                    offset: Offset(0, 8),
                  ),
                ],
              ),
              child: Column(
                children: <Widget>[
                  Row(
                    children: <Widget>[
                      Container(
                        width: 16,
                        height: 16,
                        decoration: BoxDecoration(
                          color: c.accent,
                          shape: BoxShape.circle,
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          card.symbol.length <= 3
                              ? card.symbol
                              : card.symbol.substring(0, 3),
                          style: TextStyle(
                            color: c.accentOn,
                            fontSize: 7.5,
                            fontWeight: FontWeight.w700,
                            fontFamily: QzFont.mono,
                          ),
                        ),
                      ),
                      const SizedBox(width: 5),
                      Expanded(
                        child: Text(
                          card.pair.split('/').first,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: c.text,
                            fontSize: 9,
                            fontWeight: FontWeight.w600,
                            fontFamily: QzFont.mono,
                          ),
                        ),
                      ),
                      Text(
                        '+${item.stats.cagr.toStringAsFixed(1)}%',
                        style: TextStyle(
                          color: c.marketUp,
                          fontSize: 7.5,
                          fontWeight: FontWeight.w700,
                          fontFamily: QzFont.mono,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  SparklineView(
                    data: item.sparkline.take(12).toList(),
                    height: 22,
                    strokeWidth: 1.4,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _UnlockCard extends StatelessWidget {
  const _UnlockCard({required this.onLogin});

  final VoidCallback onLogin;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final c = context.qzScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: c.accentSoft,
        border: Border.all(color: c.accent.withValues(alpha: 0.20)),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: <Widget>[
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  l10n.strategyGuestUnlockTitle,
                  style: TextStyle(
                    color: c.text,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  l10n.strategyGuestUnlockSubtitle,
                  style: TextStyle(color: c.textMid, fontSize: 11, height: 1.5),
                ),
              ],
            ),
          ),
          SizedBox(
            height: 34,
            child: FilledButton(
              key: const Key('strategy-guest-unlock-login'),
              onPressed: onLogin,
              style: FilledButton.styleFrom(
                backgroundColor: c.accent,
                foregroundColor: c.accentOn,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                shape: const StadiumBorder(),
              ),
              child: Text(l10n.strategyGuestUnlockCta),
            ),
          ),
        ],
      ),
    );
  }
}
