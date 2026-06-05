// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'backtesting_create_job_strategy_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const BacktestingCreateJobStrategyDtoProtocolVersionEnum
_$backtestingCreateJobStrategyDtoProtocolVersionEnum_v1 =
    const BacktestingCreateJobStrategyDtoProtocolVersionEnum._('v1');

BacktestingCreateJobStrategyDtoProtocolVersionEnum
_$backtestingCreateJobStrategyDtoProtocolVersionEnumValueOf(String name) {
  switch (name) {
    case 'v1':
      return _$backtestingCreateJobStrategyDtoProtocolVersionEnum_v1;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<BacktestingCreateJobStrategyDtoProtocolVersionEnum>
_$backtestingCreateJobStrategyDtoProtocolVersionEnumValues =
    BuiltSet<BacktestingCreateJobStrategyDtoProtocolVersionEnum>(
      const <BacktestingCreateJobStrategyDtoProtocolVersionEnum>[
        _$backtestingCreateJobStrategyDtoProtocolVersionEnum_v1,
      ],
    );

Serializer<BacktestingCreateJobStrategyDtoProtocolVersionEnum>
_$backtestingCreateJobStrategyDtoProtocolVersionEnumSerializer =
    _$BacktestingCreateJobStrategyDtoProtocolVersionEnumSerializer();

class _$BacktestingCreateJobStrategyDtoProtocolVersionEnumSerializer
    implements
        PrimitiveSerializer<
          BacktestingCreateJobStrategyDtoProtocolVersionEnum
        > {
  static const Map<String, Object> _toWire = const <String, Object>{'v1': 'v1'};
  static const Map<Object, String> _fromWire = const <Object, String>{
    'v1': 'v1',
  };

  @override
  final Iterable<Type> types = const <Type>[
    BacktestingCreateJobStrategyDtoProtocolVersionEnum,
  ];
  @override
  final String wireName = 'BacktestingCreateJobStrategyDtoProtocolVersionEnum';

  @override
  Object serialize(
    Serializers serializers,
    BacktestingCreateJobStrategyDtoProtocolVersionEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  BacktestingCreateJobStrategyDtoProtocolVersionEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => BacktestingCreateJobStrategyDtoProtocolVersionEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$BacktestingCreateJobStrategyDto
    extends BacktestingCreateJobStrategyDto {
  @override
  final String? id;
  @override
  final BacktestingCreateJobStrategyDtoProtocolVersionEnum protocolVersion;
  @override
  final String? publishedSnapshotId;
  @override
  final BuiltMap<String, JsonObject?>? params;

  factory _$BacktestingCreateJobStrategyDto([
    void Function(BacktestingCreateJobStrategyDtoBuilder)? updates,
  ]) => (BacktestingCreateJobStrategyDtoBuilder()..update(updates))._build();

  _$BacktestingCreateJobStrategyDto._({
    this.id,
    required this.protocolVersion,
    this.publishedSnapshotId,
    this.params,
  }) : super._();
  @override
  BacktestingCreateJobStrategyDto rebuild(
    void Function(BacktestingCreateJobStrategyDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  BacktestingCreateJobStrategyDtoBuilder toBuilder() =>
      BacktestingCreateJobStrategyDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is BacktestingCreateJobStrategyDto &&
        id == other.id &&
        protocolVersion == other.protocolVersion &&
        publishedSnapshotId == other.publishedSnapshotId &&
        params == other.params;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, id.hashCode);
    _$hash = $jc(_$hash, protocolVersion.hashCode);
    _$hash = $jc(_$hash, publishedSnapshotId.hashCode);
    _$hash = $jc(_$hash, params.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'BacktestingCreateJobStrategyDto')
          ..add('id', id)
          ..add('protocolVersion', protocolVersion)
          ..add('publishedSnapshotId', publishedSnapshotId)
          ..add('params', params))
        .toString();
  }
}

class BacktestingCreateJobStrategyDtoBuilder
    implements
        Builder<
          BacktestingCreateJobStrategyDto,
          BacktestingCreateJobStrategyDtoBuilder
        > {
  _$BacktestingCreateJobStrategyDto? _$v;

  String? _id;
  String? get id => _$this._id;
  set id(String? id) => _$this._id = id;

  BacktestingCreateJobStrategyDtoProtocolVersionEnum? _protocolVersion;
  BacktestingCreateJobStrategyDtoProtocolVersionEnum? get protocolVersion =>
      _$this._protocolVersion;
  set protocolVersion(
    BacktestingCreateJobStrategyDtoProtocolVersionEnum? protocolVersion,
  ) => _$this._protocolVersion = protocolVersion;

  String? _publishedSnapshotId;
  String? get publishedSnapshotId => _$this._publishedSnapshotId;
  set publishedSnapshotId(String? publishedSnapshotId) =>
      _$this._publishedSnapshotId = publishedSnapshotId;

  MapBuilder<String, JsonObject?>? _params;
  MapBuilder<String, JsonObject?> get params =>
      _$this._params ??= MapBuilder<String, JsonObject?>();
  set params(MapBuilder<String, JsonObject?>? params) =>
      _$this._params = params;

  BacktestingCreateJobStrategyDtoBuilder() {
    BacktestingCreateJobStrategyDto._defaults(this);
  }

  BacktestingCreateJobStrategyDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _protocolVersion = $v.protocolVersion;
      _publishedSnapshotId = $v.publishedSnapshotId;
      _params = $v.params?.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(BacktestingCreateJobStrategyDto other) {
    _$v = other as _$BacktestingCreateJobStrategyDto;
  }

  @override
  void update(void Function(BacktestingCreateJobStrategyDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  BacktestingCreateJobStrategyDto build() => _build();

  _$BacktestingCreateJobStrategyDto _build() {
    _$BacktestingCreateJobStrategyDto _$result;
    try {
      _$result =
          _$v ??
          _$BacktestingCreateJobStrategyDto._(
            id: id,
            protocolVersion: BuiltValueNullFieldError.checkNotNull(
              protocolVersion,
              r'BacktestingCreateJobStrategyDto',
              'protocolVersion',
            ),
            publishedSnapshotId: publishedSnapshotId,
            params: _params?.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'params';
        _params?.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'BacktestingCreateJobStrategyDto',
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
