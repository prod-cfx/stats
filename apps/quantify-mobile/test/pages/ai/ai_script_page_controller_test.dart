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
    test('舞台机：build 为 generating，收到 PUBLISHED 后推进 ready', () {
      final ProviderContainer c = makeContainer();
      pin(c);
      expect(read(c).stage, ScriptStage.generating);
      expect(read(c).ready, isFalse);

      ctrl(c).syncCodegenStatus('PUBLISHED');
      expect(read(c).stage, ScriptStage.ready);
      expect(read(c).ready, isTrue);
    });

    test('舞台机：收到失败状态后停在 failed 并保留错误', () {
      final ProviderContainer c = makeContainer();
      pin(c);

      ctrl(c).syncCodegenStatus(
        'CONSISTENCY_FAILED',
        errorMessage: 'syntax mismatch',
      );
      expect(read(c).stage, ScriptStage.failed);
      expect(read(c).failed, isTrue);
      expect(read(c).errorMessage, 'syntax mismatch');
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
      });
    });

    test('dispose 取消复制 timer：销毁不再回调', () {
      fakeAsync((FakeAsync async) {
        final ProviderContainer c = ProviderContainer();
        c.read(aiScriptPageControllerProvider.notifier).markCopied();
        c.dispose();
        async.elapse(AiScriptPageController.copiedHold * 2);
      });
    });
  });
}
