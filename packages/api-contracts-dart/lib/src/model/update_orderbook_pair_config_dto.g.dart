// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'update_orderbook_pair_config_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$UpdateOrderbookPairConfigDto extends UpdateOrderbookPairConfigDto {
  @override
  final bool? enabled;
  @override
  final num? pullIntervalSeconds;
  @override
  final num? depthLevels;
  @override
  final num? priority;
  @override
  final JsonObject? metadata;
  @override
  final String? description;

  factory _$UpdateOrderbookPairConfigDto([
    void Function(UpdateOrderbookPairConfigDtoBuilder)? updates,
  ]) => (UpdateOrderbookPairConfigDtoBuilder()..update(updates))._build();

  _$UpdateOrderbookPairConfigDto._({
    this.enabled,
    this.pullIntervalSeconds,
    this.depthLevels,
    this.priority,
    this.metadata,
    this.description,
  }) : super._();
  @override
  UpdateOrderbookPairConfigDto rebuild(
    void Function(UpdateOrderbookPairConfigDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  UpdateOrderbookPairConfigDtoBuilder toBuilder() =>
      UpdateOrderbookPairConfigDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is UpdateOrderbookPairConfigDto &&
        enabled == other.enabled &&
        pullIntervalSeconds == other.pullIntervalSeconds &&
        depthLevels == other.depthLevels &&
        priority == other.priority &&
        metadata == other.metadata &&
        description == other.description;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, enabled.hashCode);
    _$hash = $jc(_$hash, pullIntervalSeconds.hashCode);
    _$hash = $jc(_$hash, depthLevels.hashCode);
    _$hash = $jc(_$hash, priority.hashCode);
    _$hash = $jc(_$hash, metadata.hashCode);
    _$hash = $jc(_$hash, description.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'UpdateOrderbookPairConfigDto')
          ..add('enabled', enabled)
          ..add('pullIntervalSeconds', pullIntervalSeconds)
          ..add('depthLevels', depthLevels)
          ..add('priority', priority)
          ..add('metadata', metadata)
          ..add('description', description))
        .toString();
  }
}

class UpdateOrderbookPairConfigDtoBuilder
    implements
        Builder<
          UpdateOrderbookPairConfigDto,
          UpdateOrderbookPairConfigDtoBuilder
        > {
  _$UpdateOrderbookPairConfigDto? _$v;

  bool? _enabled;
  bool? get enabled => _$this._enabled;
  set enabled(bool? enabled) => _$this._enabled = enabled;

  num? _pullIntervalSeconds;
  num? get pullIntervalSeconds => _$this._pullIntervalSeconds;
  set pullIntervalSeconds(num? pullIntervalSeconds) =>
      _$this._pullIntervalSeconds = pullIntervalSeconds;

  num? _depthLevels;
  num? get depthLevels => _$this._depthLevels;
  set depthLevels(num? depthLevels) => _$this._depthLevels = depthLevels;

  num? _priority;
  num? get priority => _$this._priority;
  set priority(num? priority) => _$this._priority = priority;

  JsonObject? _metadata;
  JsonObject? get metadata => _$this._metadata;
  set metadata(JsonObject? metadata) => _$this._metadata = metadata;

  String? _description;
  String? get description => _$this._description;
  set description(String? description) => _$this._description = description;

  UpdateOrderbookPairConfigDtoBuilder() {
    UpdateOrderbookPairConfigDto._defaults(this);
  }

  UpdateOrderbookPairConfigDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _enabled = $v.enabled;
      _pullIntervalSeconds = $v.pullIntervalSeconds;
      _depthLevels = $v.depthLevels;
      _priority = $v.priority;
      _metadata = $v.metadata;
      _description = $v.description;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(UpdateOrderbookPairConfigDto other) {
    _$v = other as _$UpdateOrderbookPairConfigDto;
  }

  @override
  void update(void Function(UpdateOrderbookPairConfigDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  UpdateOrderbookPairConfigDto build() => _build();

  _$UpdateOrderbookPairConfigDto _build() {
    final _$result =
        _$v ??
        _$UpdateOrderbookPairConfigDto._(
          enabled: enabled,
          pullIntervalSeconds: pullIntervalSeconds,
          depthLevels: depthLevels,
          priority: priority,
          metadata: metadata,
          description: description,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
