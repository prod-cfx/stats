// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'update_trades_pair_config_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$UpdateTradesPairConfigDto extends UpdateTradesPairConfigDto {
  @override
  final bool? enabled;
  @override
  final num? priority;
  @override
  final JsonObject? metadata;
  @override
  final String? description;

  factory _$UpdateTradesPairConfigDto([
    void Function(UpdateTradesPairConfigDtoBuilder)? updates,
  ]) => (UpdateTradesPairConfigDtoBuilder()..update(updates))._build();

  _$UpdateTradesPairConfigDto._({
    this.enabled,
    this.priority,
    this.metadata,
    this.description,
  }) : super._();
  @override
  UpdateTradesPairConfigDto rebuild(
    void Function(UpdateTradesPairConfigDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  UpdateTradesPairConfigDtoBuilder toBuilder() =>
      UpdateTradesPairConfigDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is UpdateTradesPairConfigDto &&
        enabled == other.enabled &&
        priority == other.priority &&
        metadata == other.metadata &&
        description == other.description;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, enabled.hashCode);
    _$hash = $jc(_$hash, priority.hashCode);
    _$hash = $jc(_$hash, metadata.hashCode);
    _$hash = $jc(_$hash, description.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'UpdateTradesPairConfigDto')
          ..add('enabled', enabled)
          ..add('priority', priority)
          ..add('metadata', metadata)
          ..add('description', description))
        .toString();
  }
}

class UpdateTradesPairConfigDtoBuilder
    implements
        Builder<UpdateTradesPairConfigDto, UpdateTradesPairConfigDtoBuilder> {
  _$UpdateTradesPairConfigDto? _$v;

  bool? _enabled;
  bool? get enabled => _$this._enabled;
  set enabled(bool? enabled) => _$this._enabled = enabled;

  num? _priority;
  num? get priority => _$this._priority;
  set priority(num? priority) => _$this._priority = priority;

  JsonObject? _metadata;
  JsonObject? get metadata => _$this._metadata;
  set metadata(JsonObject? metadata) => _$this._metadata = metadata;

  String? _description;
  String? get description => _$this._description;
  set description(String? description) => _$this._description = description;

  UpdateTradesPairConfigDtoBuilder() {
    UpdateTradesPairConfigDto._defaults(this);
  }

  UpdateTradesPairConfigDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _enabled = $v.enabled;
      _priority = $v.priority;
      _metadata = $v.metadata;
      _description = $v.description;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(UpdateTradesPairConfigDto other) {
    _$v = other as _$UpdateTradesPairConfigDto;
  }

  @override
  void update(void Function(UpdateTradesPairConfigDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  UpdateTradesPairConfigDto build() => _build();

  _$UpdateTradesPairConfigDto _build() {
    final _$result =
        _$v ??
        _$UpdateTradesPairConfigDto._(
          enabled: enabled,
          priority: priority,
          metadata: metadata,
          description: description,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
