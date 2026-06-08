import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/models/backtest_models.dart';
import 'package:quantify_mobile/data/models/exchange_long_short_models.dart';
import 'package:quantify_mobile/data/api/api.dart';
import 'package:quantify_mobile/data/providers.dart';
import 'package:quantify_mobile/data/services/api_client.dart';
import 'package:quantify_mobile/data/services/generated_backend_api.dart';
import 'package:quantify_mobile/data/services/strategy_services.dart';
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

class _EmptyApiClient extends ApiClient {
  _EmptyApiClient() : super(baseUrl: 'http://localhost');

  @override
  Future<dynamic> get(String path, {Map<String, dynamic>? query}) async =>
      <String, dynamic>{};

  @override
  Future<dynamic> post(
    String path, {
    Object? body,
    Map<String, dynamic>? query,
  }) async => <String, dynamic>{};
}

void main() {
  group('repository providers', () {
    test('核心 provider 始终返回 Api* 真实现', () {
      final ProviderContainer container = ProviderContainer();
      addTearDown(container.dispose);

      expect(container.read(authRepositoryProvider), isA<ApiAuthRepository>());
      expect(
        container.read(tickerRepositoryProvider),
        isA<ApiTickerRepository>(),
      );
      expect(
        container.read(coinStockRepositoryProvider),
        isA<ApiCoinStockRepository>(),
      );
      expect(
        container.read(predMarketRepositoryProvider),
        isA<ApiPredMarketRepository>(),
      );
      expect(
        container.read(whaleExtrasRepositoryProvider),
        isA<ApiWhaleExtrasRepository>(),
      );
      expect(
        container.read(tradesRepositoryProvider),
        isA<ApiTradesRepository>(),
      );
      expect(
        container.read(aggOrderbookRepositoryProvider),
        isA<ApiAggOrderbookRepository>(),
      );
      expect(
        container.read(klineRepositoryProvider),
        isA<ApiKlineRepository>(),
      );
      expect(
        container.read(orderbookRepositoryProvider),
        isA<ApiOrderbookRepository>(),
      );
      expect(
        container.read(longShortRepositoryProvider),
        isA<ApiLongShortRepository>(),
      );
      expect(
        container.read(whaleFeedRepositoryProvider),
        isA<ApiWhaleFeedRepository>(),
      );
      expect(
        container.read(whaleProfileRepositoryProvider),
        isA<ApiWhaleProfileRepository>(),
      );
      expect(
        container.read(whaleLeaderboardRepositoryProvider),
        isA<ApiWhaleLeaderboardRepository>(),
      );
      expect(
        container.read(whaleHoldingsRepositoryProvider),
        isA<ApiWhaleHoldingsRepository>(),
      );
      expect(
        container.read(whaleWatchRepositoryProvider),
        isA<ApiWhaleWatchRepository>(),
      );
      expect(
        container.read(strategyRepositoryProvider),
        isA<ApiStrategyRepository>(),
      );
      expect(
        container.read(liveStrategyRepositoryProvider),
        isA<ApiLiveStrategyRepository>(),
      );
      expect(
        container.read(aiChatRepositoryProvider),
        isA<ApiAiChatRepository>(),
      );
      expect(
        container.read(backtestRepositoryProvider),
        isA<ApiBacktestRepository>(),
      );
      expect(
        container.read(accountRepositoryProvider),
        isA<ApiAccountRepository>(),
      );
      expect(
        container.read(apiKeyRepositoryProvider),
        isA<ApiApiKeyRepository>(),
      );
      expect(
        container.read(tradingOrderRepositoryProvider),
        isA<ApiTradingOrderRepository>(),
      );
    });

    test('生产 data 层不再保留 mock repository 或 fixtures', () {
      final Directory mockDir = Directory('lib/data/mock');
      expect(mockDir.existsSync(), isFalse);
    });

    test('生产 data 层不再 import mock repository 或 fixtures', () {
      final List<File> dataFiles = Directory('lib/data')
          .listSync(recursive: true)
          .whereType<File>()
          .where((File file) => file.path.endsWith('.dart'))
          .toList();

      final List<String> offenders = <String>[];
      for (final File file in dataFiles) {
        final String source = file.readAsStringSync();
        if (source.contains('data/mock') ||
            source.contains('../mock') ||
            source.contains('mock_') ||
            source.contains(RegExp(r'Mock[A-Z].*Repository'))) {
          offenders.add(file.path);
        }
      }

      expect(offenders, isEmpty);
    });

    test('Api repository 不 import mock fixtures 作为真实模式兜底', () {
      final List<File> apiFiles = Directory('lib/data/api')
          .listSync()
          .whereType<File>()
          .where((File file) => file.path.endsWith('.dart'))
          .toList();

      final List<String> offenders = <String>[];
      for (final File file in apiFiles) {
        final String source = file.readAsStringSync();
        if (source.contains('../mock/fixtures') ||
            source.contains('data/mock/fixtures')) {
          offenders.add(file.path);
        }
      }

      expect(offenders, isEmpty);
    });

    test('真实模式空响应不回退 backtest 或 long-short mock fixture 行', () async {
      final _EmptyApiClient client = _EmptyApiClient();
      final ApiBacktestRepository backtest = ApiBacktestRepository(
        BacktestService(client),
      );
      final Dio dio = Dio(BaseOptions(baseUrl: 'https://api.example.test'))
        ..interceptors.add(
          InterceptorsWrapper(
            onRequest: (RequestOptions options, RequestInterceptorHandler h) {
              if (options.path == '/markets/long-short-ratio/exchanges') {
                h.resolve(
                  Response<Object?>(
                    requestOptions: options,
                    statusCode: 200,
                    data: <String, Object?>{
                      'data': <Object?>[],
                      'message': 'Success',
                    },
                  ),
                );
                return;
              }
              h.next(options);
            },
          ),
        );
      final ApiLongShortRepository longShort = ApiLongShortRepository(
        GeneratedBackendApi(dio: dio),
      );

      final BacktestResult result = await backtest.getResult('empty-job');
      expect(result.id, isEmpty);
      expect(result.equityCurve, isEmpty);
      expect(result.monthlyRows, isEmpty);
      expect(result.trades, isEmpty);
      expect(result.riskRows, isEmpty);

      final MarketLongShortSnapshot snapshot = await longShort.getSnapshot(
        symbol: 'BTCUSDT',
      );
      expect(snapshot.totalNotional, '\$0');
      expect(snapshot.exchanges, isEmpty);
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
      expect(container.read(marketFavoritesProvider), <String>{
        'ETHUSDT',
        'BTCUSDT',
      });
      expect(fake.lastWritten, <String>{'ETHUSDT', 'BTCUSDT'});

      await container.read(marketFavoritesProvider.notifier).toggle('ETHUSDT');
      expect(container.read(marketFavoritesProvider), <String>{'BTCUSDT'});
    });

    test('toggle 写盘失败：state 回滚且 rethrow', () async {
      final _FakeMarketFavoritesPersistence fake =
          _FakeMarketFavoritesPersistence(
            seed: <String>{'ETHUSDT'},
            failWrite: true,
          );
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
