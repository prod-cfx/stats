import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/api/api_api_key_repository.dart';
import 'package:quantify_mobile/data/models/api_key_models.dart';
import 'package:quantify_mobile/data/services/account_services.dart';
import 'package:quantify_mobile/data/services/api_client.dart';

class _StubApiKeyService extends ApiKeyService {
  _StubApiKeyService({this.listResponse, this.addResponse})
    : super(ApiClient(baseUrl: 'http://localhost'));

  final Object? listResponse;
  final Object? addResponse;
  Map<String, dynamic>? lastAddBody;

  @override
  Future<dynamic> listKeys() async => listResponse;

  @override
  Future<dynamic> addKey(Map<String, dynamic> body) async {
    lastAddBody = body;
    return addResponse;
  }
}

void main() {
  group('ApiApiKeyRepository', () {
    test(
      'listKeys maps backend exchange account contract and filters unbound rows',
      () async {
        final _StubApiKeyService service = _StubApiKeyService(
          listResponse: <String, Object?>{
            'data': <Object?>[
              <String, Object?>{
                'id': 'acc-binance-1',
                'exchangeId': 'binance',
                'isBound': true,
                'name': 'Main Binance',
                'maskedCredential': 'BINN****1234',
                'createdAt': '2026-06-09T00:00:00.000Z',
              },
              <String, Object?>{
                'id': null,
                'exchangeId': 'okx',
                'isBound': false,
                'name': null,
                'maskedCredential': null,
                'createdAt': null,
              },
            ],
          },
        );

        final ApiApiKeyRepository repo = ApiApiKeyRepository(service);
        final List<ExchangeApiKey> keys = await repo.listKeys();

        expect(keys, hasLength(1));
        expect(keys.single.id, 'acc-binance-1');
        expect(keys.single.exchange, 'binance');
        expect(keys.single.label, 'Main Binance');
        expect(keys.single.maskedKey, 'BINN****1234');
      },
    );

    test(
      'addKey sends backend dto fields and unwraps response envelope',
      () async {
        final _StubApiKeyService service = _StubApiKeyService(
          addResponse: <String, Object?>{
            'data': <String, Object?>{
              'id': 'acc-okx-1',
              'exchangeId': 'okx',
              'isBound': true,
              'name': 'OKX Main',
              'maskedCredential': 'OKXA****5678',
              'createdAt': '2026-06-09T00:00:00.000Z',
            },
          },
        );

        final ApiApiKeyRepository repo = ApiApiKeyRepository(service);
        final ExchangeApiKey key = await repo.addKey(
          exchange: 'OKX',
          label: 'OKX Main',
          apiKey: 'OKXABCDEFGHIJKLMNOP5678',
          apiSecret: 'secret',
          apiPassphrase: 'pass',
        );

        expect(service.lastAddBody, <String, Object?>{
          'exchangeId': 'okx',
          'label': 'OKX Main',
          'name': 'OKX Main',
          'apiKey': 'OKXABCDEFGHIJKLMNOP5678',
          'apiSecret': 'secret',
          'passphrase': 'pass',
        });
        expect(key.id, 'acc-okx-1');
        expect(key.exchange, 'okx');
        expect(key.label, 'OKX Main');
        expect(key.maskedKey, 'OKXA****5678');
      },
    );
  });
}
