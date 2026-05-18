import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/utils/mask_helpers.dart';

void main() {
  group('maskApiKey', () {
    test('空字符串保持空', () {
      expect(maskApiKey(''), '');
    });

    test('< 8 字符 → ****', () {
      expect(maskApiKey('abc'), '****');
      expect(maskApiKey('1234567'), '****');
    });

    test('恰好 8 字符 → 前 4 + **** + 后 4（边界）', () {
      // 8 字符时首尾各 4 会相邻不重叠，maskedKey 长度 = 12（4 + 4 + 4）。
      expect(maskApiKey('12345678'), '1234****5678');
    });

    test('≥ 8 字符 → 前 4 + **** + 后 4', () {
      expect(maskApiKey('AKIA12341234'), 'AKIA****1234');
      expect(maskApiKey('3aJ8BcF9zX1qW4eR7tY'), '3aJ8****R7tY');
    });
  });

  group('maskEmail', () {
    test('victor@gmail.com → vi***@gmail.com', () {
      expect(maskEmail('victor@gmail.com'), 'vi***@gmail.com');
    });

    test('本地部分 ≤ 2 → ***@domain', () {
      expect(maskEmail('ab@x.io'), '***@x.io');
      expect(maskEmail('a@x.io'), '***@x.io');
    });

    test('@ 在首位（local 为空）→ ***@domain（边界）', () {
      expect(maskEmail('@domain.com'), '***@domain.com');
    });

    test('不含 @ → 当作本地部分处理', () {
      expect(maskEmail('abcdef'), 'ab***');
      expect(maskEmail('ab'), '***');
    });

    test('空字符串 → 空字符串', () {
      expect(maskEmail(''), '');
    });
  });
}
