import 'package:flutter/foundation.dart';

import '../../../data/models/strategy_models.dart';

/// 单次联合搜索的作者聚合命中（issue #2228，原 widget 私有 `_AuthorHit` 提升）。
@immutable
class AuthorHit {
  const AuthorHit({
    required this.name,
    required this.count,
    required this.verified,
  });

  final String name;
  final int count;
  final bool verified;
}

/// 策略广场联合搜索取数态（issue #2228）。
///
/// 由 [StrategySearchController] 维护：`build()` 首屏 `loadGuess`（猜你想跟 Top3）；
/// `search` 写入策略 / 作者命中。标签段为纯本地匹配（依赖 `AppLocalizations`），由
/// widget 算好后通过 `search` 传入。输入框文本 / 焦点等纯 UI 态仍由 widget 自管。
@immutable
class StrategySearchState {
  const StrategySearchState({
    this.loading = false,
    this.stratHits = const <StrategyMarketItem>[],
    this.authorHits = const <AuthorHit>[],
    this.tagHits = const <StrategyCategory>[],
    this.guess = const <StrategyMarketItem>[],
  });

  final bool loading;
  final List<StrategyMarketItem> stratHits;
  final List<AuthorHit> authorHits;
  final List<StrategyCategory> tagHits;
  final List<StrategyMarketItem> guess;

  StrategySearchState copyWith({
    bool? loading,
    List<StrategyMarketItem>? stratHits,
    List<AuthorHit>? authorHits,
    List<StrategyCategory>? tagHits,
    List<StrategyMarketItem>? guess,
  }) {
    return StrategySearchState(
      loading: loading ?? this.loading,
      stratHits: stratHits ?? this.stratHits,
      authorHits: authorHits ?? this.authorHits,
      tagHits: tagHits ?? this.tagHits,
      guess: guess ?? this.guess,
    );
  }
}
