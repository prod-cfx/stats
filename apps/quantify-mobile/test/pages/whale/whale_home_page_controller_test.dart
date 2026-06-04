import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/pages/whale/whale_home_page_controller.dart';
import 'package:quantify_mobile/pages/whale/whale_home_page_state.dart';

/// issue #2183 验收：首页 controller 纯同步导航态 selectTab 的状态流转。
void main() {
  ProviderContainer makeContainer() {
    final ProviderContainer c = ProviderContainer();
    addTearDown(c.dispose);
    return c;
  }

  WhaleHomePageController ctrl(ProviderContainer c) =>
      c.read(whaleHomePageControllerProvider.notifier);
  WhaleHomePageState read(ProviderContainer c) =>
      c.read(whaleHomePageControllerProvider);

  group('WhaleHomePageController', () {
    test('初始 tabIndex 为 0（发现 tab）', () {
      expect(read(makeContainer()).tabIndex, 0);
    });

    test('selectTab 切换并保持幂等', () {
      final ProviderContainer c = makeContainer();
      ctrl(c).selectTab(2);
      expect(read(c).tabIndex, 2);
      ctrl(c).selectTab(2);
      expect(read(c).tabIndex, 2);
    });

    test('selectTab 连续切换', () {
      final ProviderContainer c = makeContainer();
      ctrl(c)
        ..selectTab(1)
        ..selectTab(3);
      expect(read(c).tabIndex, 3);
    });
  });
}
