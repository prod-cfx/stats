import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/core/providers/notifier_lifecycle.dart';

class _LifeNotifier extends Notifier<int> {
  final NotifierLifecycle life = NotifierLifecycle();

  @override
  int build() {
    life.attach(ref);
    return 0;
  }
}

final _lifeProvider = NotifierProvider<_LifeNotifier, int>(_LifeNotifier.new);

void main() {
  test('attach 后 mounted=true，provider dispose 后复位 false', () {
    final container = ProviderContainer();
    final notifier = container.read(_lifeProvider.notifier);
    expect(notifier.life.mounted, isTrue);

    container.dispose();
    expect(notifier.life.mounted, isFalse);
  });
}
