import 'package:backend_api_contracts/backend_api_contracts.dart';
import 'package:flutter/foundation.dart';

import '../models/whale_watch_models.dart';
import '../repositories/whale_watch_repository.dart';
import '../services/generated_backend_api.dart';

/// [WhaleWatchRepository] 真实现。
///
/// 监控规则经 generated [WhaleNotificationApi] 消费
/// `/whale-notification/rules` 的 list/create/update/delete 契约。搜索端点暂无
/// 后端契约，仍保持真实空态，避免回退 mock 数据。
class ApiWhaleWatchRepository implements WhaleWatchRepository {
  ApiWhaleWatchRepository(this._api);

  final GeneratedBackendApi _api;

  WhaleNotificationApi get _notificationApi =>
      _api.client.getWhaleNotificationApi();

  @override
  Future<List<WatchRule>> listRules() async {
    final response = await _notificationApi
        .whaleNotificationRulesControllerList(extra: _unwrapDataExtra);
    final List<WhaleNotificationRuleResponseDto> data =
        response.data?.toList() ?? const <WhaleNotificationRuleResponseDto>[];
    return data.map(mapRule).toList(growable: false);
  }

  @override
  Future<WatchRule> createRule(WatchRule rule) async {
    final response = await _notificationApi
        .whaleNotificationRulesControllerCreate(
          extra: _unwrapDataExtra,
          createWhaleNotificationRuleDto: CreateWhaleNotificationRuleDto((b) {
            b
              ..type = CreateWhaleNotificationRuleDtoTypeEnum.ADDRESS
              ..address = rule.address
              ..thresholdUsd = rule.thresholdUsd
              ..note = _note(rule);
            b.channels.replace(_channelsDto(rule.channels));
          }),
        );
    final WhaleNotificationRuleResponseDto? data = response.data;
    if (data == null) {
      throw StateError('Create whale watch rule response is empty');
    }
    return mapRule(data);
  }

  @override
  Future<WatchRule> updateRule(WatchRule rule) async {
    final response = await _notificationApi
        .whaleNotificationRulesControllerUpdate(
          id: rule.id,
          extra: _unwrapDataExtra,
          updateWhaleNotificationRuleDto: UpdateWhaleNotificationRuleDto((b) {
            b
              ..thresholdUsd = rule.thresholdUsd
              ..note = _note(rule)
              ..isActive = !rule.muted;
            b.channels.replace(_channelsDto(rule.channels));
          }),
        );
    final WhaleNotificationRuleResponseDto? data = response.data;
    if (data == null) {
      throw StateError('Update whale watch rule response is empty');
    }
    return mapRule(data);
  }

  @override
  Future<void> deleteRule(WatchRule rule) async {
    await _notificationApi.whaleNotificationRulesControllerDelete(
      id: rule.id,
      extra: _unwrapDataExtra,
    );
  }

  @override
  Future<List<WhaleSearchResult>> search(String query) async {
    if (query.trim().isEmpty) return const <WhaleSearchResult>[];
    return const <WhaleSearchResult>[];
  }

  /// Contract DTO → monitor card model.
  @visibleForTesting
  static WatchRule mapRule(WhaleNotificationRuleResponseDto dto) {
    final String address = dto.address ?? dto.symbol ?? '';
    final String note = dto.note?.trim() ?? '';
    final String name = note.isNotEmpty ? note : address;
    return WatchRule(
      id: dto.id,
      name: name,
      address: address,
      lastEventDisplay: dto.updatedAt,
      tone: 'up',
      pnlDisplay: '',
      live: dto.isActive,
      thresholdUsd: dto.thresholdUsd.toDouble(),
      channels: _channels(dto.channels),
      muted: !dto.isActive,
      alias: note.isEmpty ? null : note,
    );
  }

  static Set<WatchRuleChannel> _channels(WhaleNotificationChannelsDto dto) {
    return <WatchRuleChannel>{
      if (dto.web) WatchRuleChannel.push,
      if (dto.email) WatchRuleChannel.email,
      if (dto.telegram) WatchRuleChannel.telegram,
    };
  }

  static WhaleNotificationChannelsDto _channelsDto(
    Set<WatchRuleChannel> channels,
  ) {
    return WhaleNotificationChannelsDto(
      (b) => b
        ..web = channels.contains(WatchRuleChannel.push)
        ..email = channels.contains(WatchRuleChannel.email)
        ..telegram = channels.contains(WatchRuleChannel.telegram),
    );
  }

  static String? _note(WatchRule rule) {
    final String text = (rule.alias ?? rule.name).trim();
    if (text.isEmpty || text == rule.address) return null;
    return text;
  }

  static const Map<String, dynamic> _unwrapDataExtra = <String, dynamic>{
    'unwrapData': true,
  };
}
