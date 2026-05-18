import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/storage/secure_token_storage.dart';

void main() {
  group('InMemoryTokenStorage', () {
    test('write -> read returns the same value', () async {
      final InMemoryTokenStorage s = InMemoryTokenStorage();
      await s.write('k', 'v');
      expect(await s.read('k'), 'v');
    });

    test('read missing key returns null', () async {
      final InMemoryTokenStorage s = InMemoryTokenStorage();
      expect(await s.read('missing'), isNull);
    });

    test('delete removes the key', () async {
      final InMemoryTokenStorage s = InMemoryTokenStorage();
      await s.write('k', 'v');
      await s.delete('k');
      expect(await s.read('k'), isNull);
    });

    test('seed constructor pre-populates entries', () async {
      final InMemoryTokenStorage s = InMemoryTokenStorage(<String, String>{
        'token': 'abc',
      });
      expect(await s.read('token'), 'abc');
    });

    test('snapshot exposes immutable view', () async {
      final InMemoryTokenStorage s = InMemoryTokenStorage();
      await s.write('k', 'v');
      expect(s.snapshot, <String, String>{'k': 'v'});
      expect(() => s.snapshot['x'] = 'y', throwsUnsupportedError);
    });
  });
}
