import 'api_client.dart';

/// 账户/凭据/AI 域 Service 集合（issue #2189）。stateless，只持 [ApiClient]。
/// path 为占位 RESTful 约定，后端契约就绪后校正。

class AccountService {
  const AccountService(this._client);
  final ApiClient _client;

  Future<dynamic> getInfo() => _client.get('/api/account');
}

class ApiKeyService {
  const ApiKeyService(this._client);
  final ApiClient _client;

  Future<dynamic> listKeys() => _client.get('/api/account/api-keys');

  Future<dynamic> addKey(Map<String, dynamic> body) =>
      _client.post('/api/account/api-keys', body: body);

  Future<void> removeKey(String id) async {
    await _client.delete('/api/account/api-keys/$id');
  }
}

class AiChatService {
  const AiChatService(this._client);
  final ApiClient _client;

  Future<dynamic> listSessions() => _client.get('/api/ai/sessions');

  Future<dynamic> createSession({String? title}) => _client.post(
        '/api/ai/sessions',
        body: <String, dynamic>{'title': ?title},
      );

  Future<void> deleteSession(String sessionId) async {
    await _client.delete('/api/ai/sessions/$sessionId');
  }

  Future<dynamic> sendMessage(String sessionId, Map<String, dynamic> turn) =>
      _client.post('/api/ai/sessions/$sessionId/messages', body: turn);

  Future<dynamic> getSession(String sessionId) =>
      _client.get('/api/ai/sessions/$sessionId');

  Future<dynamic> latestBacktest(String sessionId) =>
      _client.get('/api/ai/sessions/$sessionId/backtest');

  Future<dynamic> markDeployed(String sessionId, String instanceId) =>
      _client.post(
        '/api/ai/sessions/$sessionId/deploy',
        body: <String, dynamic>{'instanceId': instanceId},
      );
}
