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

  Future<dynamic> latestBacktest(String sessionId) =>
      _client.get('/account/ai-quant/conversations/$sessionId');

  Future<dynamic> markDeployed(String sessionId, String instanceId) =>
      _client.post(
        '/account/ai-quant/strategies/deploy',
        body: <String, dynamic>{'instanceId': instanceId},
      );
}
