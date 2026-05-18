import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/models/auth_models.dart';
import 'package:quantify_mobile/data/providers.dart';
import 'package:quantify_mobile/data/repositories/auth_repository.dart';

class _FakeAuthRepository implements AuthRepository {
  @override
  Future<AuthSession> login({required String email, required String password}) async =>
      const AuthSession(userId: 'fake', token: 'fake', email: 'fake@example.com');
  @override
  Future<void> logout() async {}
  @override
  Stream<AuthSession?> watchSession() => const Stream<AuthSession?>.empty();
}

class _AuthProbeWidget extends ConsumerWidget {
  const _AuthProbeWidget();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AuthRepository repo = ref.watch(authRepositoryProvider);
    return MaterialApp(
      home: Scaffold(
        body: Center(child: Text(repo.runtimeType.toString())),
      ),
    );
  }
}

void main() {
  testWidgets('widget test 通过 ProviderScope.overrides 替换 authRepositoryProvider 生效',
      (WidgetTester tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[
          authRepositoryProvider.overrideWithValue(_FakeAuthRepository()),
        ],
        child: const _AuthProbeWidget(),
      ),
    );

    expect(find.text('_FakeAuthRepository'), findsOneWidget);
  });
}
