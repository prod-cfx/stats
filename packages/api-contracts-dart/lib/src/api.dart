//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

import 'package:dio/dio.dart';
import 'package:built_value/serializer.dart';
import 'package:backend_api_contracts/src/serializers.dart';
import 'package:backend_api_contracts/src/auth/api_key_auth.dart';
import 'package:backend_api_contracts/src/auth/basic_auth.dart';
import 'package:backend_api_contracts/src/auth/bearer_auth.dart';
import 'package:backend_api_contracts/src/auth/oauth.dart';
import 'package:backend_api_contracts/src/api/default_api.dart';
import 'package:backend_api_contracts/src/api/account_ai_quant_api.dart';
import 'package:backend_api_contracts/src/api/account_exchange_accounts_api.dart';
import 'package:backend_api_contracts/src/api/admin_auth_api.dart';
import 'package:backend_api_contracts/src/api/admin_beta_codes_api.dart';
import 'package:backend_api_contracts/src/api/admin_data_pull_tasks_api.dart';
import 'package:backend_api_contracts/src/api/admin_exchange_config_api.dart';
import 'package:backend_api_contracts/src/api/admin_menu_api.dart';
import 'package:backend_api_contracts/src/api/admin_orderbook_config_api.dart';
import 'package:backend_api_contracts/src/api/admin_role_api.dart';
import 'package:backend_api_contracts/src/api/admin_settings_api.dart';
import 'package:backend_api_contracts/src/api/admin_trades_config_api.dart';
import 'package:backend_api_contracts/src/api/admin_user_api.dart';
import 'package:backend_api_contracts/src/api/auth_api.dart';
import 'package:backend_api_contracts/src/api/backtesting_api.dart';
import 'package:backend_api_contracts/src/api/crypto_stock_quotes_api.dart';
import 'package:backend_api_contracts/src/api/health_api.dart';
import 'package:backend_api_contracts/src/api/kline_api.dart';
import 'package:backend_api_contracts/src/api/liquidation_heatmap_api.dart';
import 'package:backend_api_contracts/src/api/llm_strategy_codegen_api.dart';
import 'package:backend_api_contracts/src/api/llm_strategy_instances_api.dart';
import 'package:backend_api_contracts/src/api/llm_strategy_subscriptions_api.dart';
import 'package:backend_api_contracts/src/api/markets_api.dart';
import 'package:backend_api_contracts/src/api/orderbook_api.dart';
import 'package:backend_api_contracts/src/api/polymarket_api.dart';
import 'package:backend_api_contracts/src/api/strategy_plaza_api.dart';
import 'package:backend_api_contracts/src/api/users_api.dart';
import 'package:backend_api_contracts/src/api/whale_alerts_api.dart';
import 'package:backend_api_contracts/src/api/whale_notification_api.dart';
import 'package:backend_api_contracts/src/api/whale_tracking_api.dart';

class BackendApiContracts {
  static const String basePath = r'http://localhost';

  final Dio dio;
  final Serializers serializers;

  BackendApiContracts({
    Dio? dio,
    Serializers? serializers,
    String? basePathOverride,
    List<Interceptor>? interceptors,
  })  : this.serializers = serializers ?? standardSerializers,
        this.dio = dio ??
            Dio(BaseOptions(
              baseUrl: basePathOverride ?? basePath,
              connectTimeout: const Duration(milliseconds: 5000),
              receiveTimeout: const Duration(milliseconds: 3000),
            )) {
    if (interceptors == null) {
      this.dio.interceptors.addAll([
        OAuthInterceptor(),
        BasicAuthInterceptor(),
        BearerAuthInterceptor(),
        ApiKeyAuthInterceptor(),
      ]);
    } else {
      this.dio.interceptors.addAll(interceptors);
    }
  }

  void setOAuthToken(String name, String token) {
    if (this.dio.interceptors.any((i) => i is OAuthInterceptor)) {
      (this.dio.interceptors.firstWhere((i) => i is OAuthInterceptor) as OAuthInterceptor).tokens[name] = token;
    }
  }

  /// Removes the OAuth token associated with the given [name].
  ///
  /// If no [OAuthInterceptor] is registered or no token exists for the given
  /// [name], this method has no effect.
  void removeOAuthToken(String name) {
    if (this.dio.interceptors.any((i) => i is OAuthInterceptor)) {
      (this.dio.interceptors.firstWhere((i) => i is OAuthInterceptor) as OAuthInterceptor).tokens.remove(name);
    }
  }

  void setBearerAuth(String name, String token) {
    if (this.dio.interceptors.any((i) => i is BearerAuthInterceptor)) {
      (this.dio.interceptors.firstWhere((i) => i is BearerAuthInterceptor) as BearerAuthInterceptor).tokens[name] = token;
    }
  }

  /// Removes the bearer authentication token associated with the given [name].
  ///
  /// If no [BearerAuthInterceptor] is registered or no token exists for the
  /// given [name], this method has no effect.
  void removeBearerAuth(String name) {
    if (this.dio.interceptors.any((i) => i is BearerAuthInterceptor)) {
      (this.dio.interceptors.firstWhere((i) => i is BearerAuthInterceptor) as BearerAuthInterceptor).tokens.remove(name);
    }
  }

  void setBasicAuth(String name, String username, String password) {
    if (this.dio.interceptors.any((i) => i is BasicAuthInterceptor)) {
      (this.dio.interceptors.firstWhere((i) => i is BasicAuthInterceptor) as BasicAuthInterceptor).authInfo[name] = BasicAuthInfo(username, password);
    }
  }

  /// Removes the basic authentication credentials associated with the given [name].
  ///
  /// If no [BasicAuthInterceptor] is registered or no credentials exist for the
  /// given [name], this method has no effect.
  void removeBasicAuth(String name) {
    if (this.dio.interceptors.any((i) => i is BasicAuthInterceptor)) {
      (this.dio.interceptors.firstWhere((i) => i is BasicAuthInterceptor) as BasicAuthInterceptor).authInfo.remove(name);
    }
  }

  void setApiKey(String name, String apiKey) {
    if (this.dio.interceptors.any((i) => i is ApiKeyAuthInterceptor)) {
      (this.dio.interceptors.firstWhere((element) => element is ApiKeyAuthInterceptor) as ApiKeyAuthInterceptor).apiKeys[name] = apiKey;
    }
  }

  /// Removes the API key associated with the given [name].
  ///
  /// If no [ApiKeyAuthInterceptor] is registered or no API key exists for the
  /// given [name], this method has no effect.
  void removeApiKey(String name) {
    if (this.dio.interceptors.any((i) => i is ApiKeyAuthInterceptor)) {
      (this.dio.interceptors.firstWhere((element) => element is ApiKeyAuthInterceptor) as ApiKeyAuthInterceptor).apiKeys.remove(name);
    }
  }

  /// Get DefaultApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  DefaultApi getDefaultApi() {
    return DefaultApi(dio, serializers);
  }

  /// Get AccountAiQuantApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  AccountAiQuantApi getAccountAiQuantApi() {
    return AccountAiQuantApi(dio, serializers);
  }

  /// Get AccountExchangeAccountsApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  AccountExchangeAccountsApi getAccountExchangeAccountsApi() {
    return AccountExchangeAccountsApi(dio, serializers);
  }

  /// Get AdminAuthApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  AdminAuthApi getAdminAuthApi() {
    return AdminAuthApi(dio, serializers);
  }

  /// Get AdminBetaCodesApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  AdminBetaCodesApi getAdminBetaCodesApi() {
    return AdminBetaCodesApi(dio, serializers);
  }

  /// Get AdminDataPullTasksApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  AdminDataPullTasksApi getAdminDataPullTasksApi() {
    return AdminDataPullTasksApi(dio, serializers);
  }

  /// Get AdminExchangeConfigApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  AdminExchangeConfigApi getAdminExchangeConfigApi() {
    return AdminExchangeConfigApi(dio, serializers);
  }

  /// Get AdminMenuApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  AdminMenuApi getAdminMenuApi() {
    return AdminMenuApi(dio, serializers);
  }

  /// Get AdminOrderbookConfigApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  AdminOrderbookConfigApi getAdminOrderbookConfigApi() {
    return AdminOrderbookConfigApi(dio, serializers);
  }

  /// Get AdminRoleApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  AdminRoleApi getAdminRoleApi() {
    return AdminRoleApi(dio, serializers);
  }

  /// Get AdminSettingsApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  AdminSettingsApi getAdminSettingsApi() {
    return AdminSettingsApi(dio, serializers);
  }

  /// Get AdminTradesConfigApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  AdminTradesConfigApi getAdminTradesConfigApi() {
    return AdminTradesConfigApi(dio, serializers);
  }

  /// Get AdminUserApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  AdminUserApi getAdminUserApi() {
    return AdminUserApi(dio, serializers);
  }

  /// Get AuthApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  AuthApi getAuthApi() {
    return AuthApi(dio, serializers);
  }

  /// Get BacktestingApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  BacktestingApi getBacktestingApi() {
    return BacktestingApi(dio, serializers);
  }

  /// Get CryptoStockQuotesApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  CryptoStockQuotesApi getCryptoStockQuotesApi() {
    return CryptoStockQuotesApi(dio, serializers);
  }

  /// Get HealthApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  HealthApi getHealthApi() {
    return HealthApi(dio, serializers);
  }

  /// Get KlineApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  KlineApi getKlineApi() {
    return KlineApi(dio, serializers);
  }

  /// Get LiquidationHeatmapApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  LiquidationHeatmapApi getLiquidationHeatmapApi() {
    return LiquidationHeatmapApi(dio, serializers);
  }

  /// Get LlmStrategyCodegenApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  LlmStrategyCodegenApi getLlmStrategyCodegenApi() {
    return LlmStrategyCodegenApi(dio, serializers);
  }

  /// Get LlmStrategyInstancesApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  LlmStrategyInstancesApi getLlmStrategyInstancesApi() {
    return LlmStrategyInstancesApi(dio, serializers);
  }

  /// Get LlmStrategySubscriptionsApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  LlmStrategySubscriptionsApi getLlmStrategySubscriptionsApi() {
    return LlmStrategySubscriptionsApi(dio, serializers);
  }

  /// Get MarketsApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  MarketsApi getMarketsApi() {
    return MarketsApi(dio, serializers);
  }

  /// Get OrderbookApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  OrderbookApi getOrderbookApi() {
    return OrderbookApi(dio, serializers);
  }

  /// Get PolymarketApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  PolymarketApi getPolymarketApi() {
    return PolymarketApi(dio, serializers);
  }

  /// Get StrategyPlazaApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  StrategyPlazaApi getStrategyPlazaApi() {
    return StrategyPlazaApi(dio, serializers);
  }

  /// Get UsersApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  UsersApi getUsersApi() {
    return UsersApi(dio, serializers);
  }

  /// Get WhaleAlertsApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  WhaleAlertsApi getWhaleAlertsApi() {
    return WhaleAlertsApi(dio, serializers);
  }

  /// Get WhaleNotificationApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  WhaleNotificationApi getWhaleNotificationApi() {
    return WhaleNotificationApi(dio, serializers);
  }

  /// Get WhaleTrackingApi instance, base route and serializer can be overridden by a given but be careful,
  /// by doing that all interceptors will not be executed
  WhaleTrackingApi getWhaleTrackingApi() {
    return WhaleTrackingApi(dio, serializers);
  }
}
