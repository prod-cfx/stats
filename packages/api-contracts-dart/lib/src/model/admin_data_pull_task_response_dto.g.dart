// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'admin_data_pull_task_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AdminDataPullTaskResponseDto extends AdminDataPullTaskResponseDto {
  @override
  final num id;
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
  final bool enabled;
  @override
  final String? cursor;
  @override
  final String? lastStatus;
  @override
  final DateTime? lastRunAt;
  @override
  final DateTime? lastSuccessAt;
  @override
  final String? lastError;
  @override
  final JsonObject? meta;
  @override
  final DateTime createdAt;
  @override
  final DateTime updatedAt;

  factory _$AdminDataPullTaskResponseDto([
    void Function(AdminDataPullTaskResponseDtoBuilder)? updates,
  ]) => (AdminDataPullTaskResponseDtoBuilder()..update(updates))._build();

  _$AdminDataPullTaskResponseDto._({
    required this.id,
    required this.key,
    required this.name,
    this.source_,
    this.type,
    this.cron,
    this.intervalSeconds,
    required this.enabled,
    this.cursor,
    this.lastStatus,
    this.lastRunAt,
    this.lastSuccessAt,
    this.lastError,
    this.meta,
    required this.createdAt,
    required this.updatedAt,
  }) : super._();
  @override
  AdminDataPullTaskResponseDto rebuild(
    void Function(AdminDataPullTaskResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AdminDataPullTaskResponseDtoBuilder toBuilder() =>
      AdminDataPullTaskResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AdminDataPullTaskResponseDto &&
        id == other.id &&
        key == other.key &&
        name == other.name &&
        source_ == other.source_ &&
        type == other.type &&
        cron == other.cron &&
        intervalSeconds == other.intervalSeconds &&
        enabled == other.enabled &&
        cursor == other.cursor &&
        lastStatus == other.lastStatus &&
        lastRunAt == other.lastRunAt &&
        lastSuccessAt == other.lastSuccessAt &&
        lastError == other.lastError &&
        meta == other.meta &&
        createdAt == other.createdAt &&
        updatedAt == other.updatedAt;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, id.hashCode);
    _$hash = $jc(_$hash, key.hashCode);
    _$hash = $jc(_$hash, name.hashCode);
    _$hash = $jc(_$hash, source_.hashCode);
    _$hash = $jc(_$hash, type.hashCode);
    _$hash = $jc(_$hash, cron.hashCode);
    _$hash = $jc(_$hash, intervalSeconds.hashCode);
    _$hash = $jc(_$hash, enabled.hashCode);
    _$hash = $jc(_$hash, cursor.hashCode);
    _$hash = $jc(_$hash, lastStatus.hashCode);
    _$hash = $jc(_$hash, lastRunAt.hashCode);
    _$hash = $jc(_$hash, lastSuccessAt.hashCode);
    _$hash = $jc(_$hash, lastError.hashCode);
    _$hash = $jc(_$hash, meta.hashCode);
    _$hash = $jc(_$hash, createdAt.hashCode);
    _$hash = $jc(_$hash, updatedAt.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'AdminDataPullTaskResponseDto')
          ..add('id', id)
          ..add('key', key)
          ..add('name', name)
          ..add('source_', source_)
          ..add('type', type)
          ..add('cron', cron)
          ..add('intervalSeconds', intervalSeconds)
          ..add('enabled', enabled)
          ..add('cursor', cursor)
          ..add('lastStatus', lastStatus)
          ..add('lastRunAt', lastRunAt)
          ..add('lastSuccessAt', lastSuccessAt)
          ..add('lastError', lastError)
          ..add('meta', meta)
          ..add('createdAt', createdAt)
          ..add('updatedAt', updatedAt))
        .toString();
  }
}

class AdminDataPullTaskResponseDtoBuilder
    implements
        Builder<
          AdminDataPullTaskResponseDto,
          AdminDataPullTaskResponseDtoBuilder
        > {
  _$AdminDataPullTaskResponseDto? _$v;

  num? _id;
  num? get id => _$this._id;
  set id(num? id) => _$this._id = id;

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

  String? _lastStatus;
  String? get lastStatus => _$this._lastStatus;
  set lastStatus(String? lastStatus) => _$this._lastStatus = lastStatus;

  DateTime? _lastRunAt;
  DateTime? get lastRunAt => _$this._lastRunAt;
  set lastRunAt(DateTime? lastRunAt) => _$this._lastRunAt = lastRunAt;

  DateTime? _lastSuccessAt;
  DateTime? get lastSuccessAt => _$this._lastSuccessAt;
  set lastSuccessAt(DateTime? lastSuccessAt) =>
      _$this._lastSuccessAt = lastSuccessAt;

  String? _lastError;
  String? get lastError => _$this._lastError;
  set lastError(String? lastError) => _$this._lastError = lastError;

  JsonObject? _meta;
  JsonObject? get meta => _$this._meta;
  set meta(JsonObject? meta) => _$this._meta = meta;

  DateTime? _createdAt;
  DateTime? get createdAt => _$this._createdAt;
  set createdAt(DateTime? createdAt) => _$this._createdAt = createdAt;

  DateTime? _updatedAt;
  DateTime? get updatedAt => _$this._updatedAt;
  set updatedAt(DateTime? updatedAt) => _$this._updatedAt = updatedAt;

  AdminDataPullTaskResponseDtoBuilder() {
    AdminDataPullTaskResponseDto._defaults(this);
  }

  AdminDataPullTaskResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _key = $v.key;
      _name = $v.name;
      _source_ = $v.source_;
      _type = $v.type;
      _cron = $v.cron;
      _intervalSeconds = $v.intervalSeconds;
      _enabled = $v.enabled;
      _cursor = $v.cursor;
      _lastStatus = $v.lastStatus;
      _lastRunAt = $v.lastRunAt;
      _lastSuccessAt = $v.lastSuccessAt;
      _lastError = $v.lastError;
      _meta = $v.meta;
      _createdAt = $v.createdAt;
      _updatedAt = $v.updatedAt;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AdminDataPullTaskResponseDto other) {
    _$v = other as _$AdminDataPullTaskResponseDto;
  }

  @override
  void update(void Function(AdminDataPullTaskResponseDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  AdminDataPullTaskResponseDto build() => _build();

  _$AdminDataPullTaskResponseDto _build() {
    final _$result =
        _$v ??
        _$AdminDataPullTaskResponseDto._(
          id: BuiltValueNullFieldError.checkNotNull(
            id,
            r'AdminDataPullTaskResponseDto',
            'id',
          ),
          key: BuiltValueNullFieldError.checkNotNull(
            key,
            r'AdminDataPullTaskResponseDto',
            'key',
          ),
          name: BuiltValueNullFieldError.checkNotNull(
            name,
            r'AdminDataPullTaskResponseDto',
            'name',
          ),
          source_: source_,
          type: type,
          cron: cron,
          intervalSeconds: intervalSeconds,
          enabled: BuiltValueNullFieldError.checkNotNull(
            enabled,
            r'AdminDataPullTaskResponseDto',
            'enabled',
          ),
          cursor: cursor,
          lastStatus: lastStatus,
          lastRunAt: lastRunAt,
          lastSuccessAt: lastSuccessAt,
          lastError: lastError,
          meta: meta,
          createdAt: BuiltValueNullFieldError.checkNotNull(
            createdAt,
            r'AdminDataPullTaskResponseDto',
            'createdAt',
          ),
          updatedAt: BuiltValueNullFieldError.checkNotNull(
            updatedAt,
            r'AdminDataPullTaskResponseDto',
            'updatedAt',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
