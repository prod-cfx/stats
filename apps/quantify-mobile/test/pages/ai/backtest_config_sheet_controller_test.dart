import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/pages/ai/backtest_config_sheet_controller.dart';
import 'package:quantify_mobile/pages/ai/backtest_config_sheet_state.dart';

void main() {
  ProviderContainer makeContainer() {
    final ProviderContainer c = ProviderContainer();
    addTearDown(c.dispose);
    return c;
  }

  BacktestConfigSheetController ctrl(ProviderContainer c) =>
      c.read(backtestConfigSheetControllerProvider.notifier);
  BacktestConfigSheetState read(ProviderContainer c) =>
      c.read(backtestConfigSheetControllerProvider);

  group('BacktestConfigSheetController', () {
    test('初始态：30D / close / 允许部分数据 / 合约 / 无错误', () {
      final ProviderContainer c = makeContainer();
      final BacktestConfigSheetState s = read(c);
      expect(s.rangeKey, '30D');
      expect(s.fillSource, 'close');
      expect(s.partialData, isTrue);
      expect(s.futures, isTrue);
      expect(s.error, isNull);
      expect(s.isCustomRange, isFalse);
    });

    test('setRange 切区间并清错误', () {
      final ProviderContainer c = makeContainer();
      ctrl(c).setError('boom');
      expect(read(c).error, 'boom');

      ctrl(c).setRange('custom');
      final BacktestConfigSheetState s = read(c);
      expect(s.rangeKey, 'custom');
      expect(s.isCustomRange, isTrue);
      expect(s.error, isNull);
    });

    test('setFutures / setFillSource / setPartialData 互不干扰', () {
      final ProviderContainer c = makeContainer();
      ctrl(c).setFutures(false);
      ctrl(c).setFillSource('mid');
      ctrl(c).setPartialData(false);
      final BacktestConfigSheetState s = read(c);
      expect(s.futures, isFalse);
      expect(s.fillSource, 'mid');
      expect(s.partialData, isFalse);
      // 区间不受影响
      expect(s.rangeKey, '30D');
    });

    test('setError / clearError 经 _unset 哨兵正确置空', () {
      final ProviderContainer c = makeContainer();
      ctrl(c).setError('invalid');
      expect(read(c).error, 'invalid');

      ctrl(c).clearError();
      expect(read(c).error, isNull);
    });

    test('clearError 无错误时不改 state（引用不变）', () {
      final ProviderContainer c = makeContainer();
      final BacktestConfigSheetState before = read(c);
      ctrl(c).clearError();
      expect(identical(read(c), before), isTrue);
    });

    test('setError 不连带改其它流程字段', () {
      final ProviderContainer c = makeContainer();
      ctrl(c).setFutures(false);
      ctrl(c).setRange('7D');
      ctrl(c).setError('e');
      final BacktestConfigSheetState s = read(c);
      expect(s.error, 'e');
      expect(s.futures, isFalse);
      expect(s.rangeKey, '7D');
    });
  });
}
