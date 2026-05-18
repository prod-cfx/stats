import 'package:flutter_riverpod/flutter_riverpod.dart';
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
}
