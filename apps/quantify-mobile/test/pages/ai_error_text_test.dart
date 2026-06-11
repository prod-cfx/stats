import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/services/api_client.dart';
import 'package:quantify_mobile/pages/ai/ai_error_text.dart';

void main() {
  group('formatAiErrorText', () {
    test('ApiException displays human message only', () {
      expect(
        formatAiErrorText(
          const ApiException(
            message: '回测请求冲突，可能已有相同回测任务正在处理。请稍后重试。',
            statusCode: 409,
          ),
        ),
        '回测请求冲突，可能已有相同回测任务正在处理。请稍后重试。',
      );
    });

    test('FormatException displays message without type prefix', () {
      expect(
        formatAiErrorText(const FormatException('缺少已发布策略快照，无法发起回测。')),
        '缺少已发布策略快照，无法发起回测。',
      );
    });
  });
}
