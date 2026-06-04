import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/core/error/error_router.dart';
import 'package:quantify_mobile/core/network/domain_error.dart';

void main() {
  group('ErrorRouter.normalize', () {
    test('透传已是 DomainError 的入参', () {
      const original = DomainError(
        code: DomainErrorCode.notFound,
        message: 'missing',
      );
      expect(identical(ErrorRouter.normalize(original), original), isTrue);
    });

    test('非 DomainError 包装为 unknown 并保留 cause', () {
      final err = Exception('boom');
      final normalized = ErrorRouter.normalize(err);
      expect(normalized.code, DomainErrorCode.unknown);
      expect(normalized.message, err.toString());
      expect(normalized.cause, same(err));
    });
  });

  group('ErrorRouter.decide', () {
    test('cancelled → silent', () {
      const e = DomainError(code: DomainErrorCode.cancelled, message: 'x');
      expect(ErrorRouter.decide(e).kind, ErrorRouterActionKind.silent);
    });

    test('unauthorized → signOut', () {
      const e = DomainError(code: DomainErrorCode.unauthorized, message: 'x');
      expect(ErrorRouter.decide(e).kind, ErrorRouterActionKind.signOut);
    });

    test('其余 + 非空文案 → toast 带文案', () {
      const e = DomainError(code: DomainErrorCode.network, message: '断网');
      final action = ErrorRouter.decide(e);
      expect(action.kind, ErrorRouterActionKind.toast);
      expect(action.message, '断网');
    });

    test('空文案降级为 silent', () {
      const e = DomainError(code: DomainErrorCode.serverError, message: '');
      expect(ErrorRouter.decide(e).kind, ErrorRouterActionKind.silent);
    });
  });
}
