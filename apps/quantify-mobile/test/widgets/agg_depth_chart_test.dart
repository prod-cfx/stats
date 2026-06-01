import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/models/agg_orders_models.dart';
import 'package:quantify_mobile/pages/market/widgets/agg_depth_chart.dart';

import '../helpers/golden_harness.dart';

AggBookLevel _level(double price, double total) => AggBookLevel(
      price: price,
      qty: total,
      exchange: 'BIN',
      total: total,
    );

void main() {
  // asks: price descending, total cumulative (first = nearest mid).
  // asks.first.total = 100 → maxCum = 100.
  final List<AggBookLevel> asks = <AggBookLevel>[
    _level(102, 100),
    _level(103, 60),
    _level(104, 20),
  ];
  // bids: price descending; bids.last.total = 80 (< asks.first → maxCum=100).
  final List<AggBookLevel> bids = <AggBookLevel>[
    _level(101, 20),
    _level(100, 50),
    _level(99, 80),
  ];

  Widget chart() => AggDepthChart(
        asks: asks,
        bids: bids,
        upColor: Colors.green,
        downColor: Colors.red,
        gridColor: Colors.grey,
        labelColor: Colors.black54,
      );

  testWidgets('renders 5 Y-axis cumulative tick labels (0..maxCum)',
      (tester) async {
    await pumpQz(tester, chart(), surfaceSize: const Size(360, 160));
    // maxCum=100 → ticks 0/25/50/75/100. X labels are 99/101/104 (no overlap).
    expect(find.text('0'), findsOneWidget);
    expect(find.text('25'), findsOneWidget);
    expect(find.text('50'), findsOneWidget);
    expect(find.text('75'), findsOneWidget);
    expect(find.text('100'), findsOneWidget);
  });

  testWidgets('renders 3 X-axis price labels (min / mid / max)',
      (tester) async {
    await pumpQz(tester, chart(), surfaceSize: const Size(360, 160));
    // minP=99, maxP=104, mid=floor((99+104)/2)=101.
    expect(find.text('99'), findsOneWidget);
    expect(find.text('101'), findsOneWidget);
    expect(find.text('104'), findsOneWidget);
  });

  testWidgets('empty book renders no axis labels and no exception',
      (tester) async {
    await pumpQz(
      tester,
      const AggDepthChart(
        asks: <AggBookLevel>[],
        bids: <AggBookLevel>[],
        upColor: Colors.green,
        downColor: Colors.red,
        gridColor: Colors.grey,
        labelColor: Colors.black54,
      ),
      surfaceSize: const Size(360, 160),
    );
    expect(find.byType(Text), findsNothing);
    expect(tester.takeException(), isNull);
  });
}
