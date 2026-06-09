import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/api/api_whale_watch_repository.dart';
import 'package:quantify_mobile/data/models/whale_watch_models.dart';
import 'package:quantify_mobile/data/services/generated_backend_api.dart';

void main() {
  test(
    'ApiWhaleWatchRepository uses generated whale notification contract',
    () async {
      final List<RequestOptions> requests = <RequestOptions>[];
      final Dio dio = Dio(BaseOptions(baseUrl: 'https://api.example.test'))
        ..interceptors.add(
          InterceptorsWrapper(
            onRequest: (RequestOptions options, RequestInterceptorHandler h) {
              requests.add(options);
              if (options.method == 'GET' &&
                  options.path == '/whale-notification/rules') {
                h.resolve(
                  Response<Object?>(
                    requestOptions: options,
                    statusCode: 200,
                    data: <Map<String, Object?>>[
                      <String, Object?>{
                        'id': 'rule-1',
                        'type': 'ADDRESS',
                        'address': '0xabcdefabcdefabcdef01',
                        'thresholdUsd': 500000,
                        'note': 'Alpha wallet',
                        'channels': <String, Object?>{
                          'web': true,
                          'email': false,
                          'telegram': true,
                        },
                        'isActive': false,
                        'createdAt': '2026-06-09T01:00:00.000Z',
                        'updatedAt': '2026-06-09T02:00:00.000Z',
                      },
                    ],
                  ),
                );
                return;
              }
              if (options.method == 'POST' &&
                  options.path == '/whale-notification/rules') {
                h.resolve(
                  Response<Object?>(
                    requestOptions: options,
                    statusCode: 201,
                    data: <String, Object?>{
                      'id': 'rule-2',
                      'type': 'ADDRESS',
                      'address': '0x2222',
                      'thresholdUsd': 750000,
                      'note': 'New whale',
                      'channels': <String, Object?>{
                        'web': true,
                        'email': true,
                        'telegram': false,
                      },
                      'isActive': true,
                      'createdAt': '2026-06-09T03:00:00.000Z',
                      'updatedAt': '2026-06-09T03:00:00.000Z',
                    },
                  ),
                );
                return;
              }
              h.reject(
                DioException(requestOptions: options, error: 'unexpected'),
              );
            },
          ),
        );

      final ApiWhaleWatchRepository repo = ApiWhaleWatchRepository(
        GeneratedBackendApi(dio: dio),
      );

      final List<WatchRule> rules = await repo.listRules();
      expect(rules, hasLength(1));
      expect(rules.single.id, 'rule-1');
      expect(rules.single.name, 'Alpha wallet');
      expect(rules.single.address, '0xabcdefabcdefabcdef01');
      expect(rules.single.thresholdUsd, 500000);
      expect(rules.single.channels, <WatchRuleChannel>{
        WatchRuleChannel.push,
        WatchRuleChannel.telegram,
      });
      expect(rules.single.muted, isTrue);

      final WatchRule created = await repo.createRule(
        const WatchRule(
          id: 'local',
          name: 'New whale',
          address: '0x2222',
          lastEventDisplay: '',
          tone: 'up',
          pnlDisplay: '',
          live: true,
          thresholdUsd: 750000,
          channels: <WatchRuleChannel>{
            WatchRuleChannel.push,
            WatchRuleChannel.email,
          },
          muted: false,
        ),
      );

      expect(created.id, 'rule-2');
      expect(created.channels, <WatchRuleChannel>{
        WatchRuleChannel.push,
        WatchRuleChannel.email,
      });

      expect(
        requests.map((RequestOptions r) => '${r.method} ${r.path}'),
        <String>[
          'GET /whale-notification/rules',
          'POST /whale-notification/rules',
        ],
      );
      expect(requests.last.data, <String, Object?>{
        'type': 'ADDRESS',
        'address': '0x2222',
        'thresholdUsd': 750000,
        'note': 'New whale',
        'channels': <String, Object?>{
          'web': true,
          'email': true,
          'telegram': false,
        },
      });
    },
  );

  test(
    'ApiWhaleWatchRepository updates mute and deletes through contract',
    () async {
      final List<RequestOptions> requests = <RequestOptions>[];
      final Dio dio = Dio(BaseOptions(baseUrl: 'https://api.example.test'))
        ..interceptors.add(
          InterceptorsWrapper(
            onRequest: (RequestOptions options, RequestInterceptorHandler h) {
              requests.add(options);
              if (options.method == 'PUT' &&
                  options.path == '/whale-notification/rules/rule-1') {
                h.resolve(
                  Response<Object?>(
                    requestOptions: options,
                    statusCode: 200,
                    data: <String, Object?>{
                      'id': 'rule-1',
                      'type': 'ADDRESS',
                      'address': '0xabcdef',
                      'thresholdUsd': 900000,
                      'note': 'Alpha',
                      'channels': <String, Object?>{
                        'web': true,
                        'email': false,
                        'telegram': false,
                      },
                      'isActive': false,
                      'createdAt': '2026-06-09T01:00:00.000Z',
                      'updatedAt': '2026-06-09T04:00:00.000Z',
                    },
                  ),
                );
                return;
              }
              if (options.method == 'DELETE' &&
                  options.path == '/whale-notification/rules/rule-1') {
                h.resolve(
                  Response<Object?>(
                    requestOptions: options,
                    statusCode: 200,
                    data: <String, Object?>{},
                  ),
                );
                return;
              }
              h.reject(
                DioException(requestOptions: options, error: 'unexpected'),
              );
            },
          ),
        );

      final ApiWhaleWatchRepository repo = ApiWhaleWatchRepository(
        GeneratedBackendApi(dio: dio),
      );
      const WatchRule rule = WatchRule(
        id: 'rule-1',
        name: 'Alpha',
        address: '0xabcdef',
        lastEventDisplay: '',
        tone: 'up',
        pnlDisplay: '',
        live: true,
        thresholdUsd: 900000,
        channels: <WatchRuleChannel>{WatchRuleChannel.push},
        muted: false,
      );

      final WatchRule muted = await repo.updateRule(rule.copyWith(muted: true));
      await repo.deleteRule(muted);

      expect(muted.muted, isTrue);
      expect(
        requests.map((RequestOptions r) => '${r.method} ${r.path}'),
        <String>[
          'PUT /whale-notification/rules/rule-1',
          'DELETE /whale-notification/rules/rule-1',
        ],
      );
      expect(requests.first.data, <String, Object?>{
        'thresholdUsd': 900000,
        'note': 'Alpha',
        'channels': <String, Object?>{
          'web': true,
          'email': false,
          'telegram': false,
        },
        'isActive': false,
      });
    },
  );
}
