// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_admin_data_pull_task_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$CreateAdminDataPullTaskDto extends CreateAdminDataPullTaskDto {
  @override
  final String key;
  @override
  final String name;
  @override
  final String? source_;
  @override
  final String? type;
  @override
  final String? cron;
  @override
  final num? intervalSeconds;
  @override
  final bool? enabled;
  @override
  final String? cursor;
  @override
  final JsonObject? meta;

  factory _$CreateAdminDataPullTaskDto([
    void Function(CreateAdminDataPullTaskDtoBuilder)? updates,
  ]) => (CreateAdminDataPullTaskDtoBuilder()..update(updates))._build();

  _$CreateAdminDataPullTaskDto._({
    required this.key,
    required this.name,
    this.source_,
    this.type,
    this.cron,
    this.intervalSeconds,
    this.enabled,
    this.cursor,
    this.meta,
  }) : super._();
  @override
  CreateAdminDataPullTaskDto rebuild(
    void Function(CreateAdminDataPullTaskDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  CreateAdminDataPullTaskDtoBuilder toBuilder() =>
      CreateAdminDataPullTaskDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is CreateAdminDataPullTaskDto &&
        key == other.key &&
        name == other.name &&
        source_ == other.source_ &&
        type == other.type &&
        cron == other.cron &&
        intervalSeconds == other.intervalSeconds &&
        enabled == other.enabled &&
        cursor == other.cursor &&
        meta == other.meta;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, key.hashCode);
    _$hash = $jc(_$hash, name.hashCode);
    _$hash = $jc(_$hash, source_.hashCode);
    _$hash = $jc(_$hash, type.hashCode);
    _$hash = $jc(_$hash, cron.hashCode);
    _$hash = $jc(_$hash, intervalSeconds.hashCode);
    _$hash = $jc(_$hash, enabled.hashCode);
    _$hash = $jc(_$hash, cursor.hashCode);
    _$hash = $jc(_$hash, meta.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'CreateAdminDataPullTaskDto')
          ..add('key', key)
          ..add('name', name)
          ..add('source_', source_)
          ..add('type', type)
          ..add('cron', cron)
          ..add('intervalSeconds', intervalSeconds)
          ..add('enabled', enabled)
          ..add('cursor', cursor)
          ..add('meta', meta))
        .toString();
  }
}

class CreateAdminDataPullTaskDtoBuilder
    implements
        Builder<CreateAdminDataPullTaskDto, CreateAdminDataPullTaskDtoBuilder> {
  _$CreateAdminDataPullTaskDto? _$v;

  String? _key;
  String? get key => _$this._key;
  set key(String? key) => _$this._key = key;

  String? _name;
  String? get name => _$this._name;
  set name(String? name) => _$this._name = name;

  String? _source_;
  String? get source_ => _$this._source_;
  set source_(String? source_) => _$this._source_ = source_;

  String? _type;
  String? get type => _$this._type;
  set type(String? type) => _$this._type = type;

  String? _cron;
  String? get cron => _$this._cron;
  set cron(String? cron) => _$this._cron = cron;

  num? _intervalSeconds;
  num? get intervalSeconds => _$this._intervalSeconds;
  set intervalSeconds(num? intervalSeconds) =>
      _$this._intervalSeconds = intervalSeconds;

  bool? _enabled;
  bool? get enabled => _$this._enabled;
  set enabled(bool? enabled) => _$this._enabled = enabled;

  String? _cursor;
  String? get cursor => _$this._cursor;
  set cursor(String? cursor) => _$this._cursor = cursor;

  JsonObject? _meta;
  JsonObject? get meta => _$this._meta;
  set meta(JsonObject? meta) => _$this._meta = meta;

  CreateAdminDataPullTaskDtoBuilder() {
    CreateAdminDataPullTaskDto._defaults(this);
  }

  CreateAdminDataPullTaskDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _key = $v.key;
      _name = $v.name;
      _source_ = $v.source_;
      _type = $v.type;
      _cron = $v.cron;
      _intervalSeconds = $v.intervalSeconds;
      _enabled = $v.enabled;
      _cursor = $v.cursor;
      _meta = $v.meta;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(CreateAdminDataPullTaskDto other) {
    _$v = other as _$CreateAdminDataPullTaskDto;
  }

  @override
  void update(void Function(CreateAdminDataPullTaskDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  CreateAdminDataPullTaskDto build() => _build();

  _$CreateAdminDataPullTaskDto _build() {
    final _$result =
        _$v ??
        _$CreateAdminDataPullTaskDto._(
          key: BuiltValueNullFieldError.checkNotNull(
            key,
            r'CreateAdminDataPullTaskDto',
            'key',
          ),
          name: BuiltValueNullFieldError.checkNotNull(
            name,
            r'CreateAdminDataPullTaskDto',
            'name',
          ),
          source_: source_,
          type: type,
          cron: cron,
          intervalSeconds: intervalSeconds,
          enabled: enabled,
          cursor: cursor,
          meta: meta,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
