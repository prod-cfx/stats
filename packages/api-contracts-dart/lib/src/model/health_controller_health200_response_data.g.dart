// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'health_controller_health200_response_data.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const HealthControllerHealth200ResponseDataStatusEnum
_$healthControllerHealth200ResponseDataStatusEnum_ok =
    const HealthControllerHealth200ResponseDataStatusEnum._('ok');
const HealthControllerHealth200ResponseDataStatusEnum
_$healthControllerHealth200ResponseDataStatusEnum_degraded =
    const HealthControllerHealth200ResponseDataStatusEnum._('degraded');
const HealthControllerHealth200ResponseDataStatusEnum
_$healthControllerHealth200ResponseDataStatusEnum_down =
    const HealthControllerHealth200ResponseDataStatusEnum._('down');

HealthControllerHealth200ResponseDataStatusEnum
_$healthControllerHealth200ResponseDataStatusEnumValueOf(String name) {
  switch (name) {
    case 'ok':
      return _$healthControllerHealth200ResponseDataStatusEnum_ok;
    case 'degraded':
      return _$healthControllerHealth200ResponseDataStatusEnum_degraded;
    case 'down':
      return _$healthControllerHealth200ResponseDataStatusEnum_down;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<HealthControllerHealth200ResponseDataStatusEnum>
_$healthControllerHealth200ResponseDataStatusEnumValues =
    BuiltSet<HealthControllerHealth200ResponseDataStatusEnum>(
      const <HealthControllerHealth200ResponseDataStatusEnum>[
        _$healthControllerHealth200ResponseDataStatusEnum_ok,
        _$healthControllerHealth200ResponseDataStatusEnum_degraded,
        _$healthControllerHealth200ResponseDataStatusEnum_down,
      ],
    );

Serializer<HealthControllerHealth200ResponseDataStatusEnum>
_$healthControllerHealth200ResponseDataStatusEnumSerializer =
    _$HealthControllerHealth200ResponseDataStatusEnumSerializer();

class _$HealthControllerHealth200ResponseDataStatusEnumSerializer
    implements
        PrimitiveSerializer<HealthControllerHealth200ResponseDataStatusEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'ok': 'ok',
    'degraded': 'degraded',
    'down': 'down',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'ok': 'ok',
    'degraded': 'degraded',
    'down': 'down',
  };

  @override
  final Iterable<Type> types = const <Type>[
    HealthControllerHealth200ResponseDataStatusEnum,
  ];
  @override
  final String wireName = 'HealthControllerHealth200ResponseDataStatusEnum';

  @override
  Object serialize(
    Serializers serializers,
    HealthControllerHealth200ResponseDataStatusEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  HealthControllerHealth200ResponseDataStatusEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => HealthControllerHealth200ResponseDataStatusEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$HealthControllerHealth200ResponseData
    extends HealthControllerHealth200ResponseData {
  @override
  final String? service;
  @override
  final HealthControllerHealth200ResponseDataStatusEnum? status;
  @override
  final String? timestamp;

  factory _$HealthControllerHealth200ResponseData([
    void Function(HealthControllerHealth200ResponseDataBuilder)? updates,
  ]) => (HealthControllerHealth200ResponseDataBuilder()..update(updates))
      ._build();

  _$HealthControllerHealth200ResponseData._({
    this.service,
    this.status,
    this.timestamp,
  }) : super._();
  @override
  HealthControllerHealth200ResponseData rebuild(
    void Function(HealthControllerHealth200ResponseDataBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  HealthControllerHealth200ResponseDataBuilder toBuilder() =>
      HealthControllerHealth200ResponseDataBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is HealthControllerHealth200ResponseData &&
        service == other.service &&
        status == other.status &&
        timestamp == other.timestamp;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, service.hashCode);
    _$hash = $jc(_$hash, status.hashCode);
    _$hash = $jc(_$hash, timestamp.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(
            r'HealthControllerHealth200ResponseData',
          )
          ..add('service', service)
          ..add('status', status)
          ..add('timestamp', timestamp))
        .toString();
  }
}

class HealthControllerHealth200ResponseDataBuilder
    implements
        Builder<
          HealthControllerHealth200ResponseData,
          HealthControllerHealth200ResponseDataBuilder
        > {
  _$HealthControllerHealth200ResponseData? _$v;

  String? _service;
  String? get service => _$this._service;
  set service(String? service) => _$this._service = service;

  HealthControllerHealth200ResponseDataStatusEnum? _status;
  HealthControllerHealth200ResponseDataStatusEnum? get status => _$this._status;
  set status(HealthControllerHealth200ResponseDataStatusEnum? status) =>
      _$this._status = status;

  String? _timestamp;
  String? get timestamp => _$this._timestamp;
  set timestamp(String? timestamp) => _$this._timestamp = timestamp;

  HealthControllerHealth200ResponseDataBuilder() {
    HealthControllerHealth200ResponseData._defaults(this);
  }

  HealthControllerHealth200ResponseDataBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _service = $v.service;
      _status = $v.status;
      _timestamp = $v.timestamp;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(HealthControllerHealth200ResponseData other) {
    _$v = other as _$HealthControllerHealth200ResponseData;
  }

  @override
  void update(
    void Function(HealthControllerHealth200ResponseDataBuilder)? updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  HealthControllerHealth200ResponseData build() => _build();

  _$HealthControllerHealth200ResponseData _build() {
    final _$result =
        _$v ??
        _$HealthControllerHealth200ResponseData._(
          service: service,
          status: status,
          timestamp: timestamp,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
