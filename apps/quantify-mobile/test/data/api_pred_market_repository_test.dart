import 'package:backend_api_contracts/backend_api_contracts.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/api/api_pred_market_repository.dart';
import 'package:quantify_mobile/data/models/pred_market_models.dart';
import 'package:quantify_mobile/data/services/generated_backend_api.dart';

PredictionMarketCardDto _dto({
  String id = 'm1',
  String title = 'Will BTC hit 100k?',
  String? status,
  String? probability,
  List<PredictionMarketOutcomeDto>? options,
  String? volume24h,
  PredictionMarketRulesDto? rules,
}) {
  return PredictionMarketCardDto((b) {
    b
      ..id = id
      ..title = title
      ..status = status
      ..probability = probability
      ..volume24h = volume24h;
    if (options != null) b.options.replace(options);
    if (rules != null) b.rules.replace(rules);
  });
}

PredictionMarketOutcomeDto _outcome(String label, String probability) {
  return PredictionMarketOutcomeDto(
    (b) => b
      ..label = label
      ..probability = probability,
  );
}

PredictionMarketRulesDto _rules(List<String> paragraphs, String createdAt) {
  return PredictionMarketRulesDto(
    (b) => b
      ..paragraphs.replace(paragraphs)
      ..createdAt = createdAt,
  );
}

void main() {
  group('ApiPredMarketRepository.mapPredMarket', () {
    test('maps id/title/volume and live from open-like status', () {
      final PredMarket m = ApiPredMarketRepository.mapPredMarket(
        _dto(status: 'OPEN', volume24h: '12345.5'),
        0,
      );
      expect(m.id, 'm1');
      expect(m.question, 'Will BTC hit 100k?');
      expect(m.volume, 12345.5);
      expect(m.live, isTrue);
    });

    test('live false when status not open', () {
      final PredMarket m = ApiPredMarketRepository.mapPredMarket(
        _dto(status: 'closed'),
        0,
      );
      expect(m.live, isFalse);
    });

    test('yesPercent from options ratio (0-1) normalized to 0-100', () {
      final PredMarket m = ApiPredMarketRepository.mapPredMarket(
        _dto(
          options: <PredictionMarketOutcomeDto>[
            _outcome('Yes', '0.62'),
            _outcome('No', '0.38'),
          ],
        ),
        0,
      );
      expect(m.yesPercent, 62);
    });

    test('yesPercent from top-level percentage (0-100) when no options', () {
      final PredMarket m = ApiPredMarketRepository.mapPredMarket(
        _dto(probability: '73'),
        0,
      );
      expect(m.yesPercent, 73);
    });

    test('yesPercent null when no probability anywhere', () {
      final PredMarket m = ApiPredMarketRepository.mapPredMarket(_dto(), 0);
      expect(m.yesPercent, isNull);
    });

    test('icon/color cycle deterministically by index', () {
      final PredMarket a = ApiPredMarketRepository.mapPredMarket(_dto(), 0);
      final PredMarket b = ApiPredMarketRepository.mapPredMarket(_dto(), 1);
      expect(a.icon, PredIcon.values[0]);
      expect(b.icon, PredIcon.values[1]);
      expect(a.color, kPredIconPalette[0]);
    });

    test('maps backend rules and createdAt into detail fields', () {
      final PredMarket m = ApiPredMarketRepository.mapPredMarket(
        _dto(
          rules: _rules(<String>[
            'Event window: 2026-01-01T00:00:00.000Z',
          ], '2026-06-08T16:47:47.433Z'),
        ),
        0,
      );
      expect(m.rules, <String>['Event window: 2026-01-01T00:00:00.000Z']);
      expect(m.createdAt, '2026-06-08T16:47:47.433Z');
    });
  });

  group('ApiPredMarketRepository.listPredMarkets', () {
    test(
      'decodes backend envelope and sends front-aligned query params',
      () async {
        late RequestOptions captured;
        final Dio dio = Dio(BaseOptions(baseUrl: 'https://api.example.test'))
          ..interceptors.add(
            InterceptorsWrapper(
              onRequest: (RequestOptions options, RequestInterceptorHandler h) {
                captured = options;
                h.resolve(
                  Response<Object?>(
                    requestOptions: options,
                    statusCode: 200,
                    data: <String, Object?>{
                      'data': <Object?>[
                        <String, Object?>{
                          'id': '1162208',
                          'title': 'Revolut会在2026年推出美元稳定币吗？',
                          'options': <Object?>[
                            <String, Object?>{
                              'label': '否',
                              'probability': '0.63',
                            },
                            <String, Object?>{
                              'label': '是',
                              'probability': '0.37',
                            },
                          ],
                          'status': 'OPEN',
                          'volume24h': '21',
                          'rules': <String, Object?>{
                            'paragraphs': <String>[
                              'Event window: 2026-01-11T18:31:21.067Z ~ 2027-01-01T05:00:00.000Z',
                            ],
                            'createdAt': '2026-06-08T16:47:47.433Z',
                          },
                        },
                      ],
                      'message': 'Success',
                    },
                  ),
                );
              },
            ),
          );

        final ApiPredMarketRepository repository = ApiPredMarketRepository(
          GeneratedBackendApi(dio: dio),
        );
        final List<PredMarket> markets = await repository.listPredMarkets(
          locale: 'zh',
        );

        expect(captured.path, '/polymarket/markets');
        expect(captured.queryParameters['page'], 1);
        expect(captured.queryParameters['limit'], 48);
        expect(captured.queryParameters['onlyActive'], isTrue);
        expect(captured.queryParameters['locale'], 'zh');
        expect(markets.single.id, '1162208');
        expect(markets.single.question, 'Revolut会在2026年推出美元稳定币吗？');
        expect(markets.single.yesPercent, 37);
        expect(markets.single.volume, 21);
        expect(markets.single.live, isTrue);
        expect(markets.single.rules, hasLength(1));
        expect(markets.single.createdAt, '2026-06-08T16:47:47.433Z');
      },
    );
  });
}
