import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/models/strategy_models.dart';
import '../../data/providers.dart';
import '../../data/repositories/strategy_repository.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import '../../widgets/qz_empty_state.dart';
import '../../widgets/qz_search_bar.dart';
import '../../widgets/qz_spinner.dart';
import 'widgets/category_chip_bar.dart';
import 'widgets/strategy_card_tile.dart';

/// 策略广场（原型 10）。
///
/// 顶部：搜索栏 + 分类 chip 条
/// 中部：`ListView.builder` + RefreshIndicator（下拉刷新）+ 滚动到底部 loadMore
/// 底部：分页 loading 指示
class StrategyHomePage extends ConsumerStatefulWidget {
  const StrategyHomePage({super.key});

  @override
  ConsumerState<StrategyHomePage> createState() => _StrategyHomePageState();
}

class _StrategyHomePageState extends ConsumerState<StrategyHomePage> {
  static const int _kPageSize = 10;

  final TextEditingController _queryCtrl = TextEditingController();
  final ScrollController _scrollCtrl = ScrollController();

  StrategyCategory _category = StrategyCategory.all;
  String _query = '';
  int _page = 1;
  bool _hasMore = true;
  bool _loading = true;
  bool _loadingMore = false;
  List<StrategyMarketItem> _items = <StrategyMarketItem>[];

  @override
  void initState() {
    super.initState();
    _scrollCtrl.addListener(_onScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) => _reload());
  }

  @override
  void dispose() {
    _scrollCtrl.removeListener(_onScroll);
    _scrollCtrl.dispose();
    _queryCtrl.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_loadingMore || !_hasMore) return;
    if (!_scrollCtrl.hasClients) return;
    final double pos = _scrollCtrl.position.pixels;
    final double max = _scrollCtrl.position.maxScrollExtent;
    if (pos >= max - 200) {
      _loadMore();
    }
  }

  Future<void> _reload() async {
    final StrategyRepository repo = ref.read(strategyRepositoryProvider);
    setState(() {
      _loading = true;
      _page = 1;
    });
    final StrategyMarketPage res = await repo.listMarket(
      page: 1,
      pageSize: _kPageSize,
      query: _query.isEmpty ? null : _query,
      category: _category,
    );
    if (!mounted) return;
    setState(() {
      _items = res.items;
      _hasMore = res.hasMore;
      _loading = false;
    });
  }

  Future<void> _loadMore() async {
    if (_loadingMore || !_hasMore) return;
    setState(() => _loadingMore = true);
    final StrategyRepository repo = ref.read(strategyRepositoryProvider);
    final int next = _page + 1;
    final StrategyMarketPage res = await repo.listMarket(
      page: next,
      pageSize: _kPageSize,
      query: _query.isEmpty ? null : _query,
      category: _category,
    );
    if (!mounted) return;
    setState(() {
      _page = next;
      _items = <StrategyMarketItem>[..._items, ...res.items];
      _hasMore = res.hasMore;
      _loadingMore = false;
    });
  }

  void _onCategoryChanged(StrategyCategory c) {
    if (c == _category) return;
    setState(() => _category = c);
    _reload();
  }

  void _onQueryChanged(String q) {
    setState(() => _query = q);
    _reload();
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Scaffold(
      appBar: AppBar(title: const Text('策略')),
      body: Column(
        children: <Widget>[
          Padding(
            padding: const EdgeInsets.fromLTRB(
                QzSpacing.lg, QzSpacing.sm, QzSpacing.lg, QzSpacing.sm),
            child: QzSearchBar(
              controller: _queryCtrl,
              hint: '搜索策略 / 作者 / 标签',
              onChanged: _onQueryChanged,
            ),
          ),
          CategoryChipBar(
            selected: _category,
            onChanged: _onCategoryChanged,
          ),
          const SizedBox(height: QzSpacing.sm),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _reload,
              child: _loading
                  ? const Center(child: QzSpinner())
                  : _items.isEmpty
                      ? ListView(
                          // RefreshIndicator 要求可滚动 child
                          physics: const AlwaysScrollableScrollPhysics(),
                          children: const <Widget>[
                            SizedBox(height: 80),
                            QzEmptyState(title: '暂无匹配策略'),
                          ],
                        )
                      : ListView.builder(
                          controller: _scrollCtrl,
                          physics: const AlwaysScrollableScrollPhysics(),
                          padding: const EdgeInsets.symmetric(
                              horizontal: QzSpacing.lg),
                          itemCount: _items.length + (_loadingMore ? 1 : 0),
                          itemBuilder: (BuildContext ctx, int i) {
                            if (i >= _items.length) {
                              return const Padding(
                                padding: EdgeInsets.symmetric(vertical: 16),
                                child: Center(child: QzSpinner()),
                              );
                            }
                            final StrategyMarketItem item = _items[i];
                            return StrategyCardTile(
                              key: Key('strategy-tile-${item.card.id}'),
                              item: item,
                              onTap: () =>
                                  context.push('/strategy/${item.card.id}'),
                            );
                          },
                        ),
            ),
          ),
        ],
      ),
      backgroundColor: c.bg,
    );
  }
}
