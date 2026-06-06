import 'package:backend_api_contracts/backend_api_contracts.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/api/api_pred_market_repository.dart';
import 'package:quantify_mobile/data/models/pred_market_models.dart';

PredictionMarketCardDto _dto({
  String id = 'm1',
  String title = 'Will BTC hit 100k?',
  String? status,
  String? probability,
  List<PredictionMarketOutcomeDto>? options,
  String? volume24h,
}) {
  return PredictionMarketCardDto((b) {
    b
      ..id = id
      ..title = title
      ..status = status
      ..probability = probability
      ..volume24h = volume24h;
    if (options != null) b.options.replace(options);
  });
}

PredictionMarketOutcomeDto _outcome(String label, String probability) {
  return PredictionMarketOutcomeDto((b) => b
    ..label = label
    ..probability = probability);
}

void main() {
  group('ApiPredMarketRepository.mapPredMarket', () {
    test('maps id/title/volume and live from status=open', () {
      final PredMarket m = ApiPredMarketRepository.mapPredMarket(
        _dto(status: 'open', volume24h: '12345.5'),
        0,
      );
      expect(m.id, 'm1');
      expect(m.question, 'Will BTC hit 100k?');
      expect(m.volume, 12345.5);
      expect(m.live, isTrue);
    });

    test('live false when status not open', () {
      final PredMarket m =
          ApiPredMarketRepository.mapPredMarket(_dto(status: 'closed'), 0);
      expect(m.live, isFalse);
    });

    test('yesPercent from options ratio (0-1) normalized to 0-100', () {
      final PredMarket m = ApiPredMarketRepository.mapPredMarket(
        _dto(options: <PredictionMarketOutcomeDto>[
          _outcome('Yes', '0.62'),
          _outcome('No', '0.38'),
        ]),
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
      final PredMarket m =
          ApiPredMarketRepository.mapPredMarket(_dto(), 0);
      expect(m.yesPercent, isNull);
    });

    test('icon/color cycle deterministically by index', () {
      final PredMarket a = ApiPredMarketRepository.mapPredMarket(_dto(), 0);
      final PredMarket b = ApiPredMarketRepository.mapPredMarket(_dto(), 1);
      expect(a.icon, PredIcon.values[0]);
      expect(b.icon, PredIcon.values[1]);
      expect(a.color, kPredIconPalette[0]);
    });
  });
}
