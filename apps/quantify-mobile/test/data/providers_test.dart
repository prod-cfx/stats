import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/mock/mock_account_repository.dart';
import 'package:quantify_mobile/data/mock/mock_ai_chat_repository.dart';
import 'package:quantify_mobile/data/mock/mock_api_key_repository.dart';
import 'package:quantify_mobile/data/mock/mock_auth_repository.dart';
import 'package:quantify_mobile/data/mock/mock_backtest_repository.dart';
import 'package:quantify_mobile/data/mock/mock_kline_repository.dart';
import 'package:quantify_mobile/data/mock/mock_long_short_repository.dart';
import 'package:quantify_mobile/data/mock/mock_orderbook_repository.dart';
import 'package:quantify_mobile/data/mock/mock_strategy_repository.dart';
import 'package:quantify_mobile/data/mock/mock_ticker_repository.dart';
import 'package:quantify_mobile/data/mock/mock_whale_feed_repository.dart';
import 'package:quantify_mobile/data/mock/unimplemented_repositories.dart';
import 'package:quantify_mobile/data/providers.dart';
import 'package:quantify_mobile/data/repositories/repositories.dart';
import 'package:quantify_mobile/data/storage/market_favorites_persistence.dart';

/// 可控的自选持久化桩：用注入的 [seed] 模拟 read()（null=未写盘），
/// [failWrite] 为 true 时 write 抛错，用于覆盖回滚路径。
class _FakeMarketFavoritesPersistence implements MarketFavoritesPersistence {
  _FakeMarketFavoritesPersistence({this.seed, this.failWrite = false});

  Set<String>? seed;
  bool failWrite;
  Set<String>? lastWritten;

  @override
  Set<String>? read() => seed;

  @override
  Future<void> write(Set<String> symbols) async {
    if (failWrite) throw StateError('mock write failure');
    lastWritten = symbols;
  }
}

void main() {
  group('useMockProvider', () {
    test('默认 useMock=true：authRepositoryProvider 返回 MockAuthRepository', () {
      final ProviderContainer container = ProviderContainer();
      addTearDown(container.dispose);

      expect(container.read(useMockProvider), isTrue);
      expect(container.read(authRepositoryProvider), isA<MockAuthRepository>());
    });

    test('override useMock=false：authRepositoryProvider 返回 Unimplemented，调用方法抛 UnimplementedError 且消息含中文提示', () async {
      final ProviderContainer container = ProviderContainer(
        overrides: <Override>[
          useMockProvider.overrideWithValue(false),
        ],
      );
      addTearDown(container.dispose);

      final AuthRepository repo = container.read(authRepositoryProvider);
      expect(repo, isA<UnimplementedAuthRepository>());
      expect(
        () => repo.login(email: 'a@b.com', password: 'x'),
        throwsA(
          isA<UnimplementedError>().having(
            (UnimplementedError e) => e.message,
            'message',
            contains('真实 API 待接入'),
          ),
        ),
      );
    });

    test('默认 useMock=true：所有 11 个 provider 返回对应的 MockXxxRepository', () {
      final ProviderContainer container = ProviderContainer();
      addTearDown(container.dispose);

      expect(container.read(authRepositoryProvider), isA<MockAuthRepository>());
      expect(container.read(tickerRepositoryProvider), isA<MockTickerRepository>());
      expect(container.read(klineRepositoryProvider), isA<MockKlineRepository>());
      expect(container.read(orderbookRepositoryProvider), isA<MockOrderbookRepository>());
      expect(container.read(longShortRepositoryProvider), isA<MockLongShortRepository>());
      expect(container.read(whaleFeedRepositoryProvider), isA<MockWhaleFeedRepository>());
      expect(container.read(strategyRepositoryProvider), isA<MockStrategyRepository>());
      expect(container.read(aiChatRepositoryProvider), isA<MockAiChatRepository>());
      expect(container.read(backtestRepositoryProvider), isA<MockBacktestRepository>());
      expect(container.read(accountRepositoryProvider), isA<MockAccountRepository>());
      expect(container.read(apiKeyRepositoryProvider), isA<MockApiKeyRepository>());
    });

    test('override useMock=false：tickerRepository.listTickers() 抛 UnimplementedError', () {
      final ProviderContainer container = ProviderContainer(
        overrides: <Override>[
          useMockProvider.overrideWithValue(false),
        ],
      );
      addTearDown(container.dispose);

      final TickerRepository repo = container.read(tickerRepositoryProvider);
      expect(
        () => repo.listTickers(),
        throwsA(isA<UnimplementedError>()),
      );
    });

    test('所有 11 个 provider 均可解析（useMock=false 下全部为 Unimplemented stub）', () {
      final ProviderContainer container = ProviderContainer(
        overrides: <Override>[
          useMockProvider.overrideWithValue(false),
        ],
      );
      addTearDown(container.dispose);

      expect(container.read(authRepositoryProvider), isA<UnimplementedAuthRepository>());
      expect(container.read(tickerRepositoryProvider), isA<UnimplementedTickerRepository>());
      expect(container.read(klineRepositoryProvider), isA<UnimplementedKlineRepository>());
      expect(container.read(orderbookRepositoryProvider), isA<UnimplementedOrderbookRepository>());
      expect(container.read(longShortRepositoryProvider), isA<UnimplementedLongShortRepository>());
      expect(container.read(whaleFeedRepositoryProvider), isA<UnimplementedWhaleFeedRepository>());
      expect(container.read(strategyRepositoryProvider), isA<UnimplementedStrategyRepository>());
      expect(container.read(aiChatRepositoryProvider), isA<UnimplementedAiChatRepository>());
      expect(container.read(backtestRepositoryProvider), isA<UnimplementedBacktestRepository>());
      expect(container.read(accountRepositoryProvider), isA<UnimplementedAccountRepository>());
      expect(container.read(apiKeyRepositoryProvider), isA<UnimplementedApiKeyRepository>());
    });
  });

  group('marketFavoritesProvider（#1755）', () {
    ProviderContainer makeContainer(_FakeMarketFavoritesPersistence fake) {
      final ProviderContainer container = ProviderContainer(
        overrides: <Override>[
          marketFavoritesPersistenceProvider.overrideWithValue(fake),
        ],
      );
      addTearDown(container.dispose);
      return container;
    }

    test('首次启动（read 返回 null）以默认 5 条种子兜底', () {
      final ProviderContainer container = makeContainer(
        _FakeMarketFavoritesPersistence(seed: null),
      );
      expect(
        container.read(marketFavoritesProvider),
        MarketFavoritesNotifier.kDefaultSymbols,
      );
    });

    test('用户已清空（read 返回空集）保持空，不被种子复活', () {
      final ProviderContainer container = makeContainer(
        _FakeMarketFavoritesPersistence(seed: <String>{}),
      );
      expect(container.read(marketFavoritesProvider), isEmpty);
    });

    test('toggle 成功：增删并写盘', () async {
      final _FakeMarketFavoritesPersistence fake =
          _FakeMarketFavoritesPersistence(seed: <String>{'ETHUSDT'});
      final ProviderContainer container = makeContainer(fake);

      await container.read(marketFavoritesProvider.notifier).toggle('BTCUSDT');
      expect(container.read(marketFavoritesProvider), <String>{'ETHUSDT', 'BTCUSDT'});
      expect(fake.lastWritten, <String>{'ETHUSDT', 'BTCUSDT'});

      await container.read(marketFavoritesProvider.notifier).toggle('ETHUSDT');
      expect(container.read(marketFavoritesProvider), <String>{'BTCUSDT'});
    });

    test('toggle 写盘失败：state 回滚且 rethrow', () async {
      final _FakeMarketFavoritesPersistence fake =
          _FakeMarketFavoritesPersistence(seed: <String>{'ETHUSDT'}, failWrite: true);
      final ProviderContainer container = makeContainer(fake);

      await expectLater(
        container.read(marketFavoritesProvider.notifier).toggle('BTCUSDT'),
        throwsA(isA<StateError>()),
      );
      expect(
        container.read(marketFavoritesProvider),
        <String>{'ETHUSDT'},
        reason: '写盘失败应回滚到 toggle 前的 state',
      );
    });
  });
}
