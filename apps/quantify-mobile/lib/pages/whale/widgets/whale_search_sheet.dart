import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../data/models/whale_watch_models.dart';
import '../../../data/providers.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';
import '../../../widgets/qz_sheet.dart';

/// 巨鲸搜索 sheet（issue #1754）。
///
/// 输入框实时过滤 mock 语料，按 kind（地址/标签/资产/交易所/事件类型）
/// 分组渲染。空 query 显示提示，无命中显示空态；点击地址类结果关闭 sheet
/// 并 push 地址详情 `/whale/profile/:addr`（复用 #1753 route）。
class WhaleSearchSheet {
  const WhaleSearchSheet._();

  static Future<void> show(BuildContext context) {
    return QzSheet.show<void>(
      context: context,
      builder: (BuildContext ctx) => const _WhaleSearchBody(),
    );
  }
}

class _WhaleSearchBody extends ConsumerStatefulWidget {
  const _WhaleSearchBody();

  @override
  ConsumerState<_WhaleSearchBody> createState() => _WhaleSearchBodyState();
}

class _WhaleSearchBodyState extends ConsumerState<_WhaleSearchBody> {
  final TextEditingController _controller = TextEditingController();
  String _query = '';
  List<WhaleSearchResult> _results = const <WhaleSearchResult>[];

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _onChanged(String value) async {
    final String query = value.trim();
    final List<WhaleSearchResult> results =
        await ref.read(whaleWatchRepositoryProvider).search(value);
    // 丢弃过期请求：异步返回时输入已变化则不覆盖更新的结果。
    if (!mounted || _controller.text.trim() != query) return;
    setState(() {
      _query = query;
      _results = results;
    });
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        QzSpacing.lg,
        0,
        QzSpacing.lg,
        QzSpacing.lg,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          TextField(
            controller: _controller,
            autofocus: true,
            onChanged: _onChanged,
            style: TextStyle(color: c.text, fontSize: 14),
            decoration: InputDecoration(
              prefixIcon: Icon(Icons.search, color: c.textMid, size: 18),
              hintText: l10n.whaleSearchHint,
              hintStyle: TextStyle(color: c.textDim, fontSize: 14),
              filled: true,
              fillColor: c.bgSoft,
              contentPadding: const EdgeInsets.symmetric(vertical: 12),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none,
              ),
            ),
          ),
          const SizedBox(height: QzSpacing.md),
          Flexible(child: _buildResults(l10n, c)),
        ],
      ),
    );
  }

  Widget _buildResults(AppLocalizations l10n, QzColorScheme c) {
    if (_query.isEmpty) {
      return _Hint(text: l10n.whaleSearchPrompt);
    }
    if (_results.isEmpty) {
      return _Hint(text: l10n.whaleSearchEmpty);
    }
    return ListView(
      shrinkWrap: true,
      children: <Widget>[
        for (final WhaleSearchResultKind kind in WhaleSearchResultKind.values)
          ..._buildGroup(kind, l10n, c),
      ],
    );
  }

  List<Widget> _buildGroup(
    WhaleSearchResultKind kind,
    AppLocalizations l10n,
    QzColorScheme c,
  ) {
    final List<WhaleSearchResult> group =
        _results.where((WhaleSearchResult r) => r.kind == kind).toList();
    if (group.isEmpty) return const <Widget>[];
    return <Widget>[
      Padding(
        padding: const EdgeInsets.fromLTRB(2, QzSpacing.sm, 2, QzSpacing.xs),
        child: Text(
          _kindLabel(kind, l10n),
          style: TextStyle(
            color: c.textDim,
            fontSize: 11,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      for (final WhaleSearchResult r in group) _ResultRow(result: r),
    ];
  }

  String _kindLabel(WhaleSearchResultKind kind, AppLocalizations l10n) {
    switch (kind) {
      case WhaleSearchResultKind.address:
        return l10n.whaleSearchKindAddress;
      case WhaleSearchResultKind.label:
        return l10n.whaleSearchKindLabel;
      case WhaleSearchResultKind.asset:
        return l10n.whaleSearchKindAsset;
      case WhaleSearchResultKind.exchange:
        return l10n.whaleSearchKindExchange;
      case WhaleSearchResultKind.eventType:
        return l10n.whaleSearchKindEventType;
    }
  }
}

class _ResultRow extends StatelessWidget {
  const _ResultRow({required this.result});

  final WhaleSearchResult result;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final bool tappable = result.address != null;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: tappable
            ? () {
                Navigator.of(context).pop();
                context.push(
                  '/whale/profile/${Uri.encodeComponent(result.address!)}',
                );
              }
            : null,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 2),
          child: Row(
            children: <Widget>[
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      result.title,
                      style: TextStyle(
                        color: c.text,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      result.subtitle,
                      style: TextStyle(color: c.textDim, fontSize: 11),
                    ),
                  ],
                ),
              ),
              if (tappable)
                Icon(Icons.chevron_right, color: c.textFaint, size: 18),
            ],
          ),
        ),
      ),
    );
  }
}

class _Hint extends StatelessWidget {
  const _Hint({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: QzSpacing.xl),
      child: Center(
        child: Text(
          text,
          style: TextStyle(color: c.textDim, fontSize: 13),
        ),
      ),
    );
  }
}
