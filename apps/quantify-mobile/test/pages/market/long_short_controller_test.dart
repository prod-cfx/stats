import 'dart:async';
import 'dart:ui' show Color;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:riverpod/misc.dart' show Override;
import 'package:quantify_mobile/data/models/exchange_long_short_models.dart';
import 'package:quantify_mobile/data/models/kline_models.dart';
import 'package:quantify_mobile/data/models/long_short_models.dart';
import 'package:quantify_mobile/data/repositories/long_short_repository.dart';
import 'package:quantify_mobile/data/providers.dart';
import 'package:quantify_mobile/pages/market/long_short_controller.dart';
import 'package:quantify_mobile/pages/market/long_short_state.dart';

MarketLongShortSnapshot _snapshot(String symbol) => MarketLongShortSnapshot(
      symbol: symbol,
      baseAsset: symbol.replaceAll('USDT', ''),
      assetGlyph: 'X',
      assetGradientStart: const Color(0xFF000000),
      assetGradientEnd: const Color(0xFF000000),
      totalNotional: '0',
      longNotional: '0',
      shortNotional: '0',
      longPct: 50,
      shortPct: 50,
      exchanges: const <ExchangeLongShort>[],
      timestamp: DateTime(2024),
    );

/// 可控时序的假仓库：用 Completer 队列驱动响应，模拟竞态。
class _FakeLongShortRepository implements LongShortRepository {
  final List<Completer<MarketLongShortSnapshot>> pending =
      <Completer<MarketLongShortSnapshot>>[];
  final List<String> calledSymbols = <String>[];
  Object? throwError;

  @override
  Future<MarketLongShortSnapshot> getSnapshot({required String symbol}) {
    calledSymbols.add(symbol);
    if (throwError != null) return Future<MarketLongShortSnapshot>.error(throwError!);
    final Completer<MarketLongShortSnapshot> c =
        Completer<MarketLongShortSnapshot>();
    pending.add(c);
    return c.future;
  }

  @override
  Future<LongShortRatio> getRatio({
    required String symbol,
    required KlineInterval interval,
  }) =>
      throw UnimplementedError();
}

void main() {
  late _FakeLongShortRepository repo;

  ProviderContainer makeContainer() {
    repo = _FakeLongShortRepository();
    final ProviderContainer c = ProviderContainer(
      overrides: <Override>[
        longShortRepositoryProvider.overrideWithValue(repo),
      ],
    );
    // 保持 autoDispose provider 存活（否则无监听者时被销毁，mounted=false
    // 守卫会吞掉异步回调）。
    c.listen(longShortControllerProvider, (_, _) {});
    addTearDown(c.dispose);
    return c;
  }

  LongShortController ctrl(ProviderContainer c) =>
      c.read(longShortControllerProvider.notifier);
  LongShortState read(ProviderContainer c) =>
      c.read(longShortControllerProvider);

  group('LongShortController 异步加载', () {
    test('初始态 loading=true，默认 symbol/period', () {
      final ProviderContainer c = makeContainer();
      final LongShortState s = read(c);
      expect(s.loading, isTrue);
      expect(s.symbol, 'BTCUSDT');
      expect(s.period, '4小时');
      expect(s.snapshot, isNull);
    });

    test('loading→data：快照到达后 loading=false、snapshot 填充', () async {
      final ProviderContainer c = makeContainer();
      ctrl(c); // 触发 build → microtask load
      await Future<void>.delayed(Duration.zero);
      expect(repo.pending, hasLength(1));
      repo.pending.first.complete(_snapshot('BTCUSDT'));
      await Future<void>.delayed(Duration.zero);
      final LongShortState s = read(c);
      expect(s.loading, isFalse);
      expect(s.snapshot?.symbol, 'BTCUSDT');
      expect(s.error, isNull);
    });

    test('loading→error：异常经 ErrorRouter.normalize 填入 error', () async {
      final ProviderContainer c = makeContainer();
      repo.throwError = Exception('boom');
      ctrl(c);
      await Future<void>.delayed(Duration.zero);
      final LongShortState s = read(c);
      expect(s.loading, isFalse);
      expect(s.error, isNotNull);
      expect(s.snapshot, isNull);
    });

    test('竞态：旧 requestId 响应到达不覆盖新 symbol 的 state', () async {
      final ProviderContainer c = makeContainer();
      final LongShortController controller = ctrl(c);
      await Future<void>.delayed(Duration.zero);
      // 首次加载 BTCUSDT 仍 pending（pending[0]）。
      expect(repo.pending, hasLength(1));
      // 切换到 ETHUSDT，触发第二次加载（pending[1]）。
      controller.changeSymbol('ETHUSDT');
      await Future<void>.delayed(Duration.zero);
      expect(repo.pending, hasLength(2));
      // 新请求（ETHUSDT）先返回。
      repo.pending[1].complete(_snapshot('ETHUSDT'));
      await Future<void>.delayed(Duration.zero);
      expect(read(c).snapshot?.symbol, 'ETHUSDT');
      // 旧请求（BTCUSDT）后返回——必须被丢弃，不覆盖 ETHUSDT。
      repo.pending[0].complete(_snapshot('BTCUSDT'));
      await Future<void>.delayed(Duration.zero);
      expect(read(c).snapshot?.symbol, 'ETHUSDT');
    });

    test('changePeriod 仅改展示态，不触发重载', () async {
      final ProviderContainer c = makeContainer();
      ctrl(c);
      await Future<void>.delayed(Duration.zero);
      final int callsBefore = repo.calledSymbols.length;
      ctrl(c).changePeriod('1小时');
      expect(read(c).period, '1小时');
      expect(repo.calledSymbols.length, callsBefore);
    });
  });
}
