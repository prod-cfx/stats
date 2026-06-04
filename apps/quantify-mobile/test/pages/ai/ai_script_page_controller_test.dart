import 'package:fake_async/fake_async.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/pages/ai/ai_script_page_controller.dart';
import 'package:quantify_mobile/pages/ai/ai_script_page_state.dart';

void main() {
  ProviderContainer makeContainer() {
    final ProviderContainer c = ProviderContainer();
    addTearDown(c.dispose);
    return c;
  }

  AiScriptPageController ctrl(ProviderContainer c) =>
      c.read(aiScriptPageControllerProvider.notifier);
  AiScriptPageState read(ProviderContainer c) =>
      c.read(aiScriptPageControllerProvider);

  /// autoDispose provider 在无监听者时会在 read 之间被释放，导致 timer 回调落在
  /// 已 dispose 的 controller 上（mounted=false）。pin 一个 listener 保活，模拟
  /// widget `ref.watch` 的真实订阅生命周期。
  void pin(ProviderContainer c) {
    c.listen(aiScriptPageControllerProvider, (_, _) {}, fireImmediately: true);
  }

  group('AiScriptPageController', () {
    test('舞台机：build 为 generating，genDelay 后推进 ready', () {
      fakeAsync((FakeAsync async) {
        final ProviderContainer c = makeContainer();
        pin(c);
        expect(read(c).stage, ScriptStage.generating);
        expect(read(c).ready, isFalse);

        async.elapse(AiScriptPageController.genDelay);
        expect(read(c).stage, ScriptStage.ready);
        expect(read(c).ready, isTrue);
      });
    });

    test('toggleExpand 翻转展开态', () {
      final ProviderContainer c = makeContainer();
      expect(read(c).expanded, isFalse);
      ctrl(c).toggleExpand();
      expect(read(c).expanded, isTrue);
      ctrl(c).toggleExpand();
      expect(read(c).expanded, isFalse);
    });

    test('markCopied 置位并在 copiedHold 后自动复位', () {
      fakeAsync((FakeAsync async) {
        final ProviderContainer c = makeContainer();
        pin(c);
        ctrl(c).markCopied();
        expect(read(c).copied, isTrue);

        async.elapse(AiScriptPageController.copiedHold);
        expect(read(c).copied, isFalse);
        // 排空残留的 genTimer，避免 fakeAsync 末尾 pending timer 报错
        async.elapse(AiScriptPageController.genDelay);
      });
    });

    test('dispose 取消 timer：generating 态销毁不再推进', () {
      fakeAsync((FakeAsync async) {
        final ProviderContainer c = ProviderContainer();
        c.read(aiScriptPageControllerProvider); // 触发 build 启动 genTimer
        c.dispose();
        // 即便越过 genDelay，已 dispose 的 controller 不应抛（timer 已取消）
        async.elapse(AiScriptPageController.genDelay * 2);
      });
    });
  });
}
