import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/api/api_trading_order_repository.dart';
import 'package:quantify_mobile/data/mock/mock_trading_order_repository.dart';
import 'package:quantify_mobile/data/models/account_models.dart';
import 'package:quantify_mobile/data/models/trading_order_models.dart';
import 'package:quantify_mobile/data/repositories/account_repository.dart';
import 'package:quantify_mobile/data/services/api_client.dart';

class _AccountRepo implements AccountRepository {
  const _AccountRepo(this.info);

  final AccountInfo info;

  @override
  Future<AccountInfo> getInfo() async => info;

  @override
  Stream<AccountInfo> watchInfo() => Stream<AccountInfo>.value(info);
}

class _CaptureApiClient extends ApiClient {
  _CaptureApiClient(this.response) : super(baseUrl: 'http://stub.invalid');

  final Object? response;
  String? lastPath;
  Object? lastBody;

  @override
  Future<dynamic> post(
    String path, {
    Object? body,
    Map<String, dynamic>? query,
  }) async {
    lastPath = path;
    lastBody = body;
    return response;
  }
}

const AccountInfo _account = AccountInfo(
  userId: 'user-1',
  email: 'u@example.com',
  uid: 'uid-1',
  totalEquityUsd: 2000,
  availableBalanceUsd: 1500,
  unrealizedPnlUsd: 12,
);

TradingOrderRequest _request() => const TradingOrderRequest(
  symbol: 'BTCUSDT',
  direction: TradingOrderDirection.buy,
  kind: TradingOrderKind.limit,
  price: 100,
  amount: 2,
  leverage: 10,
  marginMode: TradingMarginMode.cross,
);

void main() {
  group('MockTradingOrderRepository', () {
    test(
      'context exposes mock balance and preview keeps current estimates',
      () async {
        const MockTradingOrderRepository repo = MockTradingOrderRepository();

        final TradingOrderContext context = await repo.getOrderContext(
          symbol: 'BTCUSDT',
        );
        final TradingOrderPreview preview = await repo.previewOrder(_request());

        expect(context.availableBalanceUsd, 8210.50);
        expect(context.fee, isNull);
        expect(preview.fee, closeTo(0.1, 0.0001));
        expect(preview.liquidationPrice, closeTo(91, 0.0001));
        expect(preview.canSubmit, isTrue);
      },
    );

    test('submit returns deterministic mock order id', () async {
      const MockTradingOrderRepository repo = MockTradingOrderRepository();

      final TradingOrderSubmitResult result = await repo.submitOrder(
        _request(),
      );

      expect(result.orderId, 'mock-BTCUSDT-buy-limit');
      expect(result.requestId, isNull);
    });
  });

  group('ApiTradingOrderRepository', () {
    test(
      'context reads real account balance and does not fake estimates',
      () async {
        final ApiTradingOrderRepository repo = ApiTradingOrderRepository(
          apiClient: _CaptureApiClient(<String, dynamic>{}),
          accountRepository: const _AccountRepo(_account),
        );

        final TradingOrderContext context = await repo.getOrderContext(
          symbol: 'ETHUSDT',
        );
        final TradingOrderPreview preview = await repo.previewOrder(_request());

        expect(context.availableBalanceUsd, 1500);
        expect(context.fee, isNull);
        expect(context.liquidationPrice, isNull);
        expect(preview.canSubmit, isFalse);
        expect(preview.reason, contains('preview'));
      },
    );

    test('submit posts normalized order body and parses orderId', () async {
      final _CaptureApiClient client = _CaptureApiClient(<String, dynamic>{
        'data': <String, dynamic>{'orderId': 'ord-1'},
      });
      final ApiTradingOrderRepository repo = ApiTradingOrderRepository(
        apiClient: client,
        accountRepository: const _AccountRepo(_account),
      );

      final TradingOrderSubmitResult result = await repo.submitOrder(
        _request(),
      );

      expect(client.lastPath, '/account/trading/orders');
      expect(client.lastBody, <String, dynamic>{
        'symbol': 'BTCUSDT',
        'side': 'BUY',
        'type': 'LIMIT',
        'price': 100,
        'amount': 2,
        'leverage': 10,
        'marginMode': 'CROSS',
      });
      expect(result.orderId, 'ord-1');
      expect(result.requestId, isNull);
    });

    test('submit parses requestId when orderId is absent', () async {
      final ApiTradingOrderRepository repo = ApiTradingOrderRepository(
        apiClient: _CaptureApiClient(<String, dynamic>{'requestId': 'req-1'}),
        accountRepository: const _AccountRepo(_account),
      );

      final TradingOrderSubmitResult result = await repo.submitOrder(
        _request(),
      );

      expect(result.orderId, isNull);
      expect(result.requestId, 'req-1');
    });

    test('submit rejects successful responses without an order identifier', () {
      final ApiTradingOrderRepository repo = ApiTradingOrderRepository(
        apiClient: _CaptureApiClient(<String, dynamic>{}),
        accountRepository: const _AccountRepo(_account),
      );

      expect(repo.submitOrder(_request()), throwsA(isA<ApiException>()));
    });
  });
}
