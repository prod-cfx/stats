import 'api_client.dart';

/// 账户/凭据/AI 域 Service 集合（issue #2189）。stateless，只持 [ApiClient]。
/// path 对齐 `packages/api-contracts-dart` 生成契约。

class AccountService {
  const AccountService(this._client);
  final ApiClient _client;

  Future<dynamic> getInfo() => _client.get('/users/me');
}

class ApiKeyService {
  const ApiKeyService(this._client);
  final ApiClient _client;

  Future<dynamic> listKeys() => _client.get('/account/exchange-accounts');

  Future<dynamic> addKey(Map<String, dynamic> body) =>
      _client.post('/account/exchange-accounts', body: body);

  Future<void> removeKey(String id) async {
    await _client.delete('/account/exchange-accounts/$id');
  }
}

class AiChatService {
  const AiChatService(this._client);
  final ApiClient _client;

  Future<dynamic> listSessions() =>
      _client.get('/account/ai-quant/conversations');

  Future<dynamic> createSession({String? title}) => _client.post(
        '/llm-strategy-codegen/sessions',
        body: <String, dynamic>{'title': ?title},
      );

  Future<void> deleteSession(String sessionId) async {
    await _client.delete('/account/ai-quant/conversations/$sessionId');
  }

  Future<dynamic> sendMessage(String sessionId, Map<String, dynamic> turn) =>
      _client.post('/llm-strategy-codegen/sessions/$sessionId/messages',
          body: turn);

  Future<dynamic> getSession(String sessionId) =>
      _client.get('/account/ai-quant/conversations/$sessionId');

  /// 异步 deploy 第一段：提交部署请求，返回详情信封。
  /// 契约 body 为 AccountAiQuantDeployRequestDto。
  Future<dynamic> deployStrategy(Map<String, dynamic> body) =>
      _client.post('/account/ai-quant/strategies/deploy', body: body);

  /// 异步 deploy 第二段：按 deployRequestId 轮询结果，
  /// `data == null` 表示 pending。
  Future<dynamic> getDeployResult(String deployRequestId) => _client.get(
        '/account/ai-quant/strategies/deploy-requests/$deployRequestId/result',
      );
}
