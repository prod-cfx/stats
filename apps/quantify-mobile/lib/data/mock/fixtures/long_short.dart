import '../../models/long_short_models.dart';

/// 多空比静态映射：`symbol` -> (longRatio, shortRatio)，和为 1。
const Map<String, List<double>> mockLongShortBySymbol = <String, List<double>>{
  'BTCUSDT': <double>[0.58, 0.42],
  'ETHUSDT': <double>[0.52, 0.48],
  'SOLUSDT': <double>[0.61, 0.39],
  'BNBUSDT': <double>[0.49, 0.51],
  'XRPUSDT': <double>[0.46, 0.54],
  'DOGEUSDT': <double>[0.66, 0.34],
  'ADAUSDT': <double>[0.50, 0.50],
  'AVAXUSDT': <double>[0.44, 0.56],
};

final Map<String, List<LongShortRatio>> mockLongShortHistory =
    <String, List<LongShortRatio>>{
      'BTCUSDT': <LongShortRatio>[
        LongShortRatio(
          symbol: 'BTCUSDT',
          longRatio: 0.58,
          shortRatio: 0.42,
          timestamp: _t0,
        ),
        LongShortRatio(
          symbol: 'BTCUSDT',
          longRatio: 0.57,
          shortRatio: 0.43,
          timestamp: _t1,
        ),
        LongShortRatio(
          symbol: 'BTCUSDT',
          longRatio: 0.59,
          shortRatio: 0.41,
          timestamp: _t2,
        ),
        LongShortRatio(
          symbol: 'BTCUSDT',
          longRatio: 0.56,
          shortRatio: 0.44,
          timestamp: _t3,
        ),
        LongShortRatio(
          symbol: 'BTCUSDT',
          longRatio: 0.60,
          shortRatio: 0.40,
          timestamp: _t4,
        ),
        LongShortRatio(
          symbol: 'BTCUSDT',
          longRatio: 0.58,
          shortRatio: 0.42,
          timestamp: _t5,
        ),
      ],
      'ETHUSDT': <LongShortRatio>[
        LongShortRatio(
          symbol: 'ETHUSDT',
          longRatio: 0.52,
          shortRatio: 0.48,
          timestamp: _t0,
        ),
        LongShortRatio(
          symbol: 'ETHUSDT',
          longRatio: 0.53,
          shortRatio: 0.47,
          timestamp: _t1,
        ),
        LongShortRatio(
          symbol: 'ETHUSDT',
          longRatio: 0.51,
          shortRatio: 0.49,
          timestamp: _t2,
        ),
        LongShortRatio(
          symbol: 'ETHUSDT',
          longRatio: 0.54,
          shortRatio: 0.46,
          timestamp: _t3,
        ),
        LongShortRatio(
          symbol: 'ETHUSDT',
          longRatio: 0.52,
          shortRatio: 0.48,
          timestamp: _t4,
        ),
        LongShortRatio(
          symbol: 'ETHUSDT',
          longRatio: 0.55,
          shortRatio: 0.45,
          timestamp: _t5,
        ),
      ],
      'SOLUSDT': <LongShortRatio>[
        LongShortRatio(
          symbol: 'SOLUSDT',
          longRatio: 0.61,
          shortRatio: 0.39,
          timestamp: _t0,
        ),
        LongShortRatio(
          symbol: 'SOLUSDT',
          longRatio: 0.62,
          shortRatio: 0.38,
          timestamp: _t1,
        ),
        LongShortRatio(
          symbol: 'SOLUSDT',
          longRatio: 0.60,
          shortRatio: 0.40,
          timestamp: _t2,
        ),
        LongShortRatio(
          symbol: 'SOLUSDT',
          longRatio: 0.63,
          shortRatio: 0.37,
          timestamp: _t3,
        ),
        LongShortRatio(
          symbol: 'SOLUSDT',
          longRatio: 0.59,
          shortRatio: 0.41,
          timestamp: _t4,
        ),
        LongShortRatio(
          symbol: 'SOLUSDT',
          longRatio: 0.61,
          shortRatio: 0.39,
          timestamp: _t5,
        ),
      ],
      'BNBUSDT': <LongShortRatio>[
        LongShortRatio(
          symbol: 'BNBUSDT',
          longRatio: 0.49,
          shortRatio: 0.51,
          timestamp: _t0,
        ),
        LongShortRatio(
          symbol: 'BNBUSDT',
          longRatio: 0.50,
          shortRatio: 0.50,
          timestamp: _t1,
        ),
        LongShortRatio(
          symbol: 'BNBUSDT',
          longRatio: 0.48,
          shortRatio: 0.52,
          timestamp: _t2,
        ),
        LongShortRatio(
          symbol: 'BNBUSDT',
          longRatio: 0.51,
          shortRatio: 0.49,
          timestamp: _t3,
        ),
        LongShortRatio(
          symbol: 'BNBUSDT',
          longRatio: 0.49,
          shortRatio: 0.51,
          timestamp: _t4,
        ),
        LongShortRatio(
          symbol: 'BNBUSDT',
          longRatio: 0.52,
          shortRatio: 0.48,
          timestamp: _t5,
        ),
      ],
      'XRPUSDT': <LongShortRatio>[
        LongShortRatio(
          symbol: 'XRPUSDT',
          longRatio: 0.46,
          shortRatio: 0.54,
          timestamp: _t0,
        ),
        LongShortRatio(
          symbol: 'XRPUSDT',
          longRatio: 0.47,
          shortRatio: 0.53,
          timestamp: _t1,
        ),
        LongShortRatio(
          symbol: 'XRPUSDT',
          longRatio: 0.45,
          shortRatio: 0.55,
          timestamp: _t2,
        ),
        LongShortRatio(
          symbol: 'XRPUSDT',
          longRatio: 0.48,
          shortRatio: 0.52,
          timestamp: _t3,
        ),
        LongShortRatio(
          symbol: 'XRPUSDT',
          longRatio: 0.46,
          shortRatio: 0.54,
          timestamp: _t4,
        ),
        LongShortRatio(
          symbol: 'XRPUSDT',
          longRatio: 0.49,
          shortRatio: 0.51,
          timestamp: _t5,
        ),
      ],
      'DOGEUSDT': <LongShortRatio>[
        LongShortRatio(
          symbol: 'DOGEUSDT',
          longRatio: 0.66,
          shortRatio: 0.34,
          timestamp: _t0,
        ),
        LongShortRatio(
          symbol: 'DOGEUSDT',
          longRatio: 0.64,
          shortRatio: 0.36,
          timestamp: _t1,
        ),
        LongShortRatio(
          symbol: 'DOGEUSDT',
          longRatio: 0.67,
          shortRatio: 0.33,
          timestamp: _t2,
        ),
        LongShortRatio(
          symbol: 'DOGEUSDT',
          longRatio: 0.65,
          shortRatio: 0.35,
          timestamp: _t3,
        ),
        LongShortRatio(
          symbol: 'DOGEUSDT',
          longRatio: 0.68,
          shortRatio: 0.32,
          timestamp: _t4,
        ),
        LongShortRatio(
          symbol: 'DOGEUSDT',
          longRatio: 0.66,
          shortRatio: 0.34,
          timestamp: _t5,
        ),
      ],
      'ADAUSDT': <LongShortRatio>[
        LongShortRatio(
          symbol: 'ADAUSDT',
          longRatio: 0.50,
          shortRatio: 0.50,
          timestamp: _t0,
        ),
        LongShortRatio(
          symbol: 'ADAUSDT',
          longRatio: 0.51,
          shortRatio: 0.49,
          timestamp: _t1,
        ),
        LongShortRatio(
          symbol: 'ADAUSDT',
          longRatio: 0.49,
          shortRatio: 0.51,
          timestamp: _t2,
        ),
        LongShortRatio(
          symbol: 'ADAUSDT',
          longRatio: 0.52,
          shortRatio: 0.48,
          timestamp: _t3,
        ),
        LongShortRatio(
          symbol: 'ADAUSDT',
          longRatio: 0.50,
          shortRatio: 0.50,
          timestamp: _t4,
        ),
        LongShortRatio(
          symbol: 'ADAUSDT',
          longRatio: 0.53,
          shortRatio: 0.47,
          timestamp: _t5,
        ),
      ],
      'AVAXUSDT': <LongShortRatio>[
        LongShortRatio(
          symbol: 'AVAXUSDT',
          longRatio: 0.44,
          shortRatio: 0.56,
          timestamp: _t0,
        ),
        LongShortRatio(
          symbol: 'AVAXUSDT',
          longRatio: 0.45,
          shortRatio: 0.55,
          timestamp: _t1,
        ),
        LongShortRatio(
          symbol: 'AVAXUSDT',
          longRatio: 0.43,
          shortRatio: 0.57,
          timestamp: _t2,
        ),
        LongShortRatio(
          symbol: 'AVAXUSDT',
          longRatio: 0.46,
          shortRatio: 0.54,
          timestamp: _t3,
        ),
        LongShortRatio(
          symbol: 'AVAXUSDT',
          longRatio: 0.44,
          shortRatio: 0.56,
          timestamp: _t4,
        ),
        LongShortRatio(
          symbol: 'AVAXUSDT',
          longRatio: 0.47,
          shortRatio: 0.53,
          timestamp: _t5,
        ),
      ],
    };

final DateTime _t0 = DateTime.fromMillisecondsSinceEpoch(1_716_000_000_000);
final DateTime _t1 = DateTime.fromMillisecondsSinceEpoch(1_716_003_600_000);
final DateTime _t2 = DateTime.fromMillisecondsSinceEpoch(1_716_007_200_000);
final DateTime _t3 = DateTime.fromMillisecondsSinceEpoch(1_716_010_800_000);
final DateTime _t4 = DateTime.fromMillisecondsSinceEpoch(1_716_014_400_000);
final DateTime _t5 = DateTime.fromMillisecondsSinceEpoch(1_716_018_000_000);
