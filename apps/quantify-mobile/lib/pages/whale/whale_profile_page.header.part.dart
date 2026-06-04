part of 'whale_profile_page.dart';
// ignore_for_file: unused_element

/// 详情页单条 header bar（设计稿 `WhaleProfileDetail` header，jsx:639-676）：
/// 返回 + tier 配色圆形 avatar + 地址(mono) + 复制 + 一键监控 + 刷新。
class _ProfileHeader extends StatelessWidget implements PreferredSizeWidget {
  const _ProfileHeader({
    required this.address,
    required this.onBack,
    required this.onCopy,
    required this.onWatch,
    required this.onRefresh,
    this.tagTone,
  });

  final String address;
  final String? tagTone;
  final VoidCallback onBack;
  final VoidCallback onCopy;
  final VoidCallback onWatch;
  final VoidCallback onRefresh;

  @override
  Size get preferredSize => const Size.fromHeight(56);

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    return Material(
      color: c.bgElev,
      child: Container(
        decoration: BoxDecoration(
          border: Border(bottom: BorderSide(color: c.borderSoft)),
        ),
        child: SafeArea(
          top: true,
          bottom: false,
          child: SizedBox(
            height: 44,
            child: Row(
              children: <Widget>[
                const SizedBox(width: 14),
                SizedBox(
                  width: 32,
                  height: 32,
                  child: IconButton(
                    padding: EdgeInsets.zero,
                    icon: const Icon(Icons.arrow_back_ios_new, size: 18),
                    color: c.text,
                    onPressed: onBack,
                    tooltip: 'Back',
                  ),
                ),
                const SizedBox(width: 10),
                _TierAvatar(seed: address, tagTone: tagTone),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    address,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: c.text,
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      fontFeatures: const <FontFeature>[
                        FontFeature.tabularFigures(),
                      ],
                    ),
                  ),
                ),
                SizedBox(
                  width: 30,
                  height: 30,
                  child: IconButton(
                    padding: EdgeInsets.zero,
                    icon: const Icon(Icons.copy, size: 15),
                    color: c.textMid,
                    tooltip: l10n.whaleProfileCopyTooltip,
                    onPressed: onCopy,
                  ),
                ),
                const SizedBox(width: 8),
                _WatchButton(label: l10n.whaleProfileWatch, onTap: onWatch),
                const SizedBox(width: 8),
                SizedBox(
                  width: 30,
                  height: 30,
                  child: IconButton(
                    padding: EdgeInsets.zero,
                    icon: const Icon(Icons.refresh, size: 14),
                    color: c.textMid,
                    tooltip: l10n.whaleProfileRefreshTooltip,
                    onPressed: onRefresh,
                    style: IconButton.styleFrom(
                      backgroundColor: c.bgElev,
                      shape: RoundedRectangleBorder(
                        side: BorderSide(color: c.border),
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 14),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// tier 配色圆形 avatar：色相取自地址 hash，glyph 取地址首段字符。
/// tagTone 命中语义色时优先使用语义色（accent/info/warn）。
class _TierAvatar extends StatelessWidget {
  const _TierAvatar({required this.seed, this.tagTone});
  final String seed;
  final String? tagTone;

  static const double _size = 32;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final Color bg = switch (tagTone) {
      'accent' => c.accent,
      'info' => c.statusInfo,
      'warn' => c.statusWarn,
      _ => HSLColor.fromAHSL(
        1,
        (seed.codeUnits.fold<int>(0, (int a, int b) => a + b) * 17) % 360,
        0.55,
        0.62,
      ).toColor(),
    };
    final String glyph = _glyph(seed);
    return Container(
      width: _size,
      height: _size,
      decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
      alignment: Alignment.center,
      child: Text(
        glyph,
        style: const TextStyle(
          color: Color(0xFFFFFFFF),
          fontSize: 12,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  // 取地址 '0x' 之后的两位字符（无则回退首两位），与设计稿 av 短标一致。
  String _glyph(String s) {
    final String body = s.startsWith('0x') && s.length >= 4
        ? s.substring(2)
        : s;
    final String picked = body.length >= 2 ? body.substring(0, 2) : body;
    return picked.toUpperCase();
  }
}

/// 「一键监控」按钮（设计稿 violet soft 背景，jsx:659-665）。
class _WatchButton extends StatelessWidget {
  const _WatchButton({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return TextButton(
      onPressed: onTap,
      style: TextButton.styleFrom(
        backgroundColor: c.accentSoft,
        foregroundColor: c.accent,
        minimumSize: const Size(0, 30),
        padding: const EdgeInsets.symmetric(horizontal: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
      child: Text(
        label,
        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
      ),
    );
  }
}

class _Detail extends StatelessWidget {
  const _Detail({required this.profile, required this.header});
  final WhaleProfile profile;
  final Widget header;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return DefaultTabController(
      length: 6,
      child: Column(
        children: <Widget>[
          header,
          _TabBar(profile: profile),
          Expanded(
            child: TabBarView(
              children: <Widget>[
                _BasicTab(profile: profile),
                _SpotTab(
                  items: profile.spotHoldings,
                  empty: l10n.whaleProfileEmptySpot,
                ),
                _PerpTab(
                  items: profile.perpHoldings,
                  empty: l10n.whaleProfileEmptyPerp,
                ),
                _OrderTab(
                  items: profile.openOrders,
                  empty: l10n.whaleProfileEmptyOrders,
                ),
                _TradeTab(
                  items: profile.recentTrades,
                  empty: l10n.whaleProfileEmptyTrades,
                ),
                _HistTab(
                  items: profile.histOrders,
                  empty: l10n.whaleProfileEmptyHistory,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _TabBar extends StatelessWidget {
  const _TabBar({required this.profile});
  final WhaleProfile profile;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    return Container(
      decoration: BoxDecoration(
        color: c.bgElev,
        border: Border(bottom: BorderSide(color: c.borderSoft)),
      ),
      child: TabBar(
        isScrollable: true,
        tabAlignment: TabAlignment.start,
        labelColor: c.accent,
        unselectedLabelColor: c.textMid,
        indicatorColor: c.accent,
        indicatorSize: TabBarIndicatorSize.label,
        dividerColor: Colors.transparent,
        labelStyle: const TextStyle(
          fontSize: 12.5,
          fontWeight: FontWeight.w700,
        ),
        unselectedLabelStyle: const TextStyle(
          fontSize: 12.5,
          fontWeight: FontWeight.w500,
        ),
        tabs: <Widget>[
          _CountTab(index: 0, label: l10n.whaleProfileTabBasic),
          _CountTab(
            index: 1,
            label: l10n.whaleProfileTabSpot,
            count: profile.spotHoldings.length,
          ),
          _CountTab(
            index: 2,
            label: l10n.whaleProfileTabPerp,
            count: profile.perpHoldings.length,
          ),
          _CountTab(
            index: 3,
            label: l10n.whaleProfileTabOrders,
            count: profile.openOrders.length,
          ),
          _CountTab(
            index: 4,
            label: l10n.whaleProfileTabTrades,
            count: profile.recentTrades.length,
          ),
          _CountTab(
            index: 5,
            label: l10n.whaleProfileTabHistory,
            count: profile.histOrders.length,
          ),
        ],
      ),
    );
  }
}

/// Tab label + 独立计数 chip（设计稿 jsx:745-750）：计数为单独 mono 小字，
/// inactive 灰、active 紫；count 为 0 时不渲染。
class _CountTab extends StatelessWidget {
  const _CountTab({required this.index, required this.label, this.count = 0});
  final int index;
  final String label;
  final int count;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final TabController controller = DefaultTabController.of(context);
    return Tab(
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Text(label),
          if (count > 0) ...<Widget>[
            const SizedBox(width: 4),
            AnimatedBuilder(
              animation: controller.animation!,
              builder: (BuildContext context, Widget? _) {
                final bool active = controller.index == index;
                return Text(
                  '$count',
                  style: TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w600,
                    color: active ? c.accent : c.textFaint,
                    fontFamily: QzFont.mono,
                    fontFamilyFallback: QzFont.monoFallback,
                  ),
                );
              },
            ),
          ],
        ],
      ),
    );
  }
}
