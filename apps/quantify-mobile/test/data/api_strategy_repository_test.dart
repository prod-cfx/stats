import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/api/api_strategy_repository.dart';
import 'package:quantify_mobile/data/models/strategy_models.dart';
import 'package:quantify_mobile/data/services/api_client.dart';
import 'package:quantify_mobile/data/services/strategy_services.dart';

/// 任何 HTTP 请求都抛错的拦截器：用于证明广场域 signals/equity 不发网络请求。
class _ThrowOnRequestInterceptor extends Interceptor {
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    handler.reject(
      DioException(
        requestOptions: options,
        error: StateError('unexpected HTTP call: ${options.path}'),
      ),
    );
  }
}

void main() {
  // 构造一个「被调即抛」的 StrategyService：底层 Dio 任何请求都失败。
  ApiStrategyRepository buildRepo() {
    final Dio dio = Dio(BaseOptions(baseUrl: 'http://stub.invalid'))
      ..interceptors.add(_ThrowOnRequestInterceptor());
    final ApiClient client = ApiClient(baseUrl: 'http://stub.invalid', dio: dio);
    return ApiStrategyRepository(StrategyService(client));
  }

  group('ApiStrategyRepository 广场域契约缺口短路', () {
    test('listStrategySignals 返回非空 mock 且不触发 HTTP', () async {
      final ApiStrategyRepository repo = buildRepo();
      final List<StrategySignal> signals =
          await repo.listStrategySignals('st-grid-btc', limit: 5);
      expect(signals, isNotEmpty);
      expect(signals.length, 5);
    });

    test('getEquityCurve 返回非空 mock 且不触发 HTTP', () async {
      final ApiStrategyRepository repo = buildRepo();
      final List<double> curve =
          await repo.getEquityCurve('st-grid-btc', EquityTimeframe.d30);
      expect(curve, isNotEmpty);
    });

    test('两方法对同 id 派生稳定（确认走确定性 mock 而非随机网络）', () async {
      final ApiStrategyRepository repo = buildRepo();
      final List<double> a =
          await repo.getEquityCurve('st-grid-btc', EquityTimeframe.d30);
      final List<double> b =
          await repo.getEquityCurve('st-grid-btc', EquityTimeframe.d30);
      expect(a, b);
    });
  });
}
