import '../models/trading_order_models.dart';
import '../repositories/account_repository.dart';
import '../repositories/trading_order_repository.dart';
import '../services/api_client.dart';
import '../services/json_codec.dart';

class ApiTradingOrderRepository implements TradingOrderRepository {
  ApiTradingOrderRepository({
    required ApiClient apiClient,
    required AccountRepository accountRepository,
  }) : _apiClient = apiClient,
       _accountRepository = accountRepository;

  final ApiClient _apiClient;
  final AccountRepository _accountRepository;

  @override
  Future<TradingOrderContext> getOrderContext({required String symbol}) async {
    final account = await _accountRepository.getInfo();
    return TradingOrderContext(
      symbol: symbol,
      availableBalanceUsd: account.availableBalanceUsd,
    );
  }

  @override
  Future<TradingOrderPreview> previewOrder(TradingOrderRequest request) async {
    try {
      final dynamic raw = await _apiClient.post(
        '/account/trading/orders/preview',
        body: request.toApiJson(),
      );
      final Map<String, dynamic> root = asMap(raw);
      final Map<String, dynamic> data = asMap(root['data']);
      final Map<String, dynamic> body = data.isEmpty ? root : data;
      return TradingOrderPreview(
        canSubmit: asBool(body['canSubmit']),
        fee: asDoubleOrNull(body['fee']),
        liquidationPrice: asDoubleOrNull(body['liquidationPrice']),
        minAmount: asDoubleOrNull(body['minAmount']),
        reason: asStringOrNull(body['reason']),
      );
    } on ApiException catch (error) {
      return TradingOrderPreview(canSubmit: false, reason: error.message);
    } catch (_) {
      return const TradingOrderPreview(
        canSubmit: false,
        reason: 'server preview unavailable',
      );
    }
  }

  @override
  Future<TradingOrderSubmitResult> submitOrder(
    TradingOrderRequest request,
  ) async {
    final dynamic raw = await _apiClient.post(
      '/account/trading/orders',
      body: request.toApiJson(),
    );
    final Map<String, dynamic> root = asMap(raw);
    final Map<String, dynamic> data = asMap(root['data']);
    final Map<String, dynamic> body = data.isEmpty ? root : data;
    final String? orderId = asStringOrNull(
      pick(body, <String>['orderId', 'id']),
    );
    final String? requestId = asStringOrNull(body['requestId']);
    if (orderId == null && requestId == null) {
      throw const ApiException(
        message: 'trading order response missing order id',
      );
    }
    return TradingOrderSubmitResult(orderId: orderId, requestId: requestId);
  }
}
