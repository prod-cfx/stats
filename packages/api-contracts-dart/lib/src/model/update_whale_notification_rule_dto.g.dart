// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'update_whale_notification_rule_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$UpdateWhaleNotificationRuleDto extends UpdateWhaleNotificationRuleDto {
  @override
  final num? thresholdUsd;
  @override
  final String? note;
  @override
  final WhaleNotificationChannelsDto? channels;
  @override
  final bool? isActive;

  factory _$UpdateWhaleNotificationRuleDto([
    void Function(UpdateWhaleNotificationRuleDtoBuilder)? updates,
  ]) => (UpdateWhaleNotificationRuleDtoBuilder()..update(updates))._build();

  _$UpdateWhaleNotificationRuleDto._({
    this.thresholdUsd,
    this.note,
    this.channels,
    this.isActive,
  }) : super._();
  @override
  UpdateWhaleNotificationRuleDto rebuild(
    void Function(UpdateWhaleNotificationRuleDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  UpdateWhaleNotificationRuleDtoBuilder toBuilder() =>
      UpdateWhaleNotificationRuleDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is UpdateWhaleNotificationRuleDto &&
        thresholdUsd == other.thresholdUsd &&
        note == other.note &&
        channels == other.channels &&
        isActive == other.isActive;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, thresholdUsd.hashCode);
    _$hash = $jc(_$hash, note.hashCode);
    _$hash = $jc(_$hash, channels.hashCode);
    _$hash = $jc(_$hash, isActive.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'UpdateWhaleNotificationRuleDto')
          ..add('thresholdUsd', thresholdUsd)
          ..add('note', note)
          ..add('channels', channels)
          ..add('isActive', isActive))
        .toString();
  }
}

class UpdateWhaleNotificationRuleDtoBuilder
    implements
        Builder<
          UpdateWhaleNotificationRuleDto,
          UpdateWhaleNotificationRuleDtoBuilder
        > {
  _$UpdateWhaleNotificationRuleDto? _$v;

  num? _thresholdUsd;
  num? get thresholdUsd => _$this._thresholdUsd;
  set thresholdUsd(num? thresholdUsd) => _$this._thresholdUsd = thresholdUsd;

  String? _note;
  String? get note => _$this._note;
  set note(String? note) => _$this._note = note;

  WhaleNotificationChannelsDtoBuilder? _channels;
  WhaleNotificationChannelsDtoBuilder get channels =>
      _$this._channels ??= WhaleNotificationChannelsDtoBuilder();
  set channels(WhaleNotificationChannelsDtoBuilder? channels) =>
      _$this._channels = channels;

  bool? _isActive;
  bool? get isActive => _$this._isActive;
  set isActive(bool? isActive) => _$this._isActive = isActive;

  UpdateWhaleNotificationRuleDtoBuilder() {
    UpdateWhaleNotificationRuleDto._defaults(this);
  }

  UpdateWhaleNotificationRuleDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _thresholdUsd = $v.thresholdUsd;
      _note = $v.note;
      _channels = $v.channels?.toBuilder();
      _isActive = $v.isActive;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(UpdateWhaleNotificationRuleDto other) {
    _$v = other as _$UpdateWhaleNotificationRuleDto;
  }

  @override
  void update(void Function(UpdateWhaleNotificationRuleDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  UpdateWhaleNotificationRuleDto build() => _build();

  _$UpdateWhaleNotificationRuleDto _build() {
    _$UpdateWhaleNotificationRuleDto _$result;
    try {
      _$result =
          _$v ??
          _$UpdateWhaleNotificationRuleDto._(
            thresholdUsd: thresholdUsd,
            note: note,
            channels: _channels?.build(),
            isActive: isActive,
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'channels';
        _channels?.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'UpdateWhaleNotificationRuleDto',
          _$failedField,
          e.toString(),
        );
      }
      rethrow;
    }
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
