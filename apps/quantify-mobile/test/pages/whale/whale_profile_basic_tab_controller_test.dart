import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/pages/whale/whale_profile_basic_tab_controller.dart';
import 'package:quantify_mobile/pages/whale/whale_profile_basic_tab_state.dart';

/// issue #2183 验收：基本信息 tab controller 纯同步 period/scope/metric 流转。
/// 初值为 null（widget 只读回退 l10n 默认），用户选择后才写入。
void main() {
  ProviderContainer makeContainer() {
    final ProviderContainer c = ProviderContainer();
    addTearDown(c.dispose);
    return c;
  }

  WhaleProfileBasicTabController ctrl(ProviderContainer c) =>
      c.read(whaleProfileBasicTabControllerProvider.notifier);
  WhaleProfileBasicTabState read(ProviderContainer c) =>
      c.read(whaleProfileBasicTabControllerProvider);

  group('WhaleProfileBasicTabController', () {
    test('初始态三字段为 null（未改动）', () {
      final WhaleProfileBasicTabState s = read(makeContainer());
      expect(s.period, isNull);
      expect(s.scope, isNull);
      expect(s.metric, isNull);
    });

    test('setPeriod/setScope/setMetric 互不影响', () {
      final ProviderContainer c = makeContainer();
      ctrl(c).setPeriod('1月');
      ctrl(c).setScope('永续+现货');
      ctrl(c).setMetric('账户价值');
      final WhaleProfileBasicTabState s = read(c);
      expect(s.period, '1月');
      expect(s.scope, '永续+现货');
      expect(s.metric, '账户价值');
    });

    test('单字段更新不连带改其它字段', () {
      final ProviderContainer c = makeContainer();
      ctrl(c).setPeriod('全部');
      expect(read(c).scope, isNull);
      expect(read(c).metric, isNull);
    });
  });
}
