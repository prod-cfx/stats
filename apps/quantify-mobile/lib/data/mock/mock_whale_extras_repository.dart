import '../models/whale_extra_models.dart';
import '../repositories/whale_extras_repository.dart';
import 'fixtures/whale_extras.dart';

class MockWhaleExtrasRepository implements WhaleExtrasRepository {
  const MockWhaleExtrasRepository();

  @override
  Future<List<WhaleNotification>> listNotifications() async =>
      mockWhaleNotifications;
}
