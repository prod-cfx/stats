import 'package:quantify_mobile/data/models/whale_watch_models.dart';
import 'package:quantify_mobile/data/repositories/whale_watch_repository.dart';
import 'fixtures/whale_watch.dart';

/// 监控/搜索 mock 实现（#1754）。listRules 返回种子副本；search 对语料
/// title+subtitle 做大小写不敏感子串匹配。
class MockWhaleWatchRepository implements WhaleWatchRepository {
  const MockWhaleWatchRepository();

  @override
  Future<List<WatchRule>> listRules() async =>
      List<WatchRule>.of(mockWatchRules);

  @override
  Future<WatchRule> createRule(WatchRule rule) async => rule;

  @override
  Future<WatchRule> updateRule(WatchRule rule) async => rule;

  @override
  Future<void> deleteRule(WatchRule rule) async {}

  @override
  Future<List<WhaleSearchResult>> search(String query) async {
    final String q = query.trim().toLowerCase();
    if (q.isEmpty) return const <WhaleSearchResult>[];
    return mockSearchCorpus
        .where(
          (WhaleSearchResult r) =>
              r.title.toLowerCase().contains(q) ||
              r.subtitle.toLowerCase().contains(q),
        )
        .toList();
  }
}
