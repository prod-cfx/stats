import 'package:backend_api_contracts/backend_api_contracts.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/api/api_whale_extras_repository.dart';
import 'package:quantify_mobile/data/models/whale_extra_models.dart';

WhaleNotificationInboxResponseDto _dto({
  String id = 'n1',
  String title = 't',
  String content = 'c',
  bool read = false,
  String createdAt = '2026-06-06T00:00:00.000Z',
}) {
  return WhaleNotificationInboxResponseDto((b) {
    b
      ..id = id
      ..title = title
      ..content = content
      ..read = read
      ..createdAt = createdAt;
    b.channels.replace(WhaleNotificationDeliveryMapDto((c) => c
      ..web = 'sent'
      ..email = 'skipped'
      ..telegram = 'skipped'));
  });
}

void main() {
  group('ApiWhaleExtrasRepository.mapNotification', () {
    test('maps fields and inverts read→unread', () {
      final WhaleNotification n = ApiWhaleExtrasRepository.mapNotification(
        _dto(title: 'Whale moved', content: 'body', read: true),
      );
      expect(n.id, 'n1');
      expect(n.title, 'Whale moved');
      expect(n.body, 'body');
      expect(n.unread, isFalse);
      expect(n.meta, '2026-06-06T00:00:00.000Z');
      expect(n.tone, 'neutral');
    });

    test('unread true when read=false', () {
      expect(
        ApiWhaleExtrasRepository.mapNotification(_dto(read: false)).unread,
        isTrue,
      );
    });

    test('kind derived from content keywords', () {
      expect(
        ApiWhaleExtrasRepository.mapNotification(_dto(content: '大额流入交易所')).kind,
        WhaleNotificationKind.flow,
      );
      expect(
        ApiWhaleExtrasRepository.mapNotification(_dto(content: '监控地址异动')).kind,
        WhaleNotificationKind.watch,
      );
      expect(
        ApiWhaleExtrasRepository.mapNotification(_dto(content: '价格告警触发')).kind,
        WhaleNotificationKind.alert,
      );
      expect(
        ApiWhaleExtrasRepository.mapNotification(_dto(content: '系统公告')).kind,
        WhaleNotificationKind.system,
      );
    });
  });
}
