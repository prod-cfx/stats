// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'strategy_plaza_proxy_controller_run200_response_data.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const StrategyPlazaProxyControllerRun200ResponseDataStatusEnum
_$strategyPlazaProxyControllerRun200ResponseDataStatusEnum_running =
    const StrategyPlazaProxyControllerRun200ResponseDataStatusEnum._('running');
const StrategyPlazaProxyControllerRun200ResponseDataStatusEnum
_$strategyPlazaProxyControllerRun200ResponseDataStatusEnum_stopped =
    const StrategyPlazaProxyControllerRun200ResponseDataStatusEnum._('stopped');
const StrategyPlazaProxyControllerRun200ResponseDataStatusEnum
_$strategyPlazaProxyControllerRun200ResponseDataStatusEnum_draft =
    const StrategyPlazaProxyControllerRun200ResponseDataStatusEnum._('draft');

StrategyPlazaProxyControllerRun200ResponseDataStatusEnum
_$strategyPlazaProxyControllerRun200ResponseDataStatusEnumValueOf(String name) {
  switch (name) {
    case 'running':
      return _$strategyPlazaProxyControllerRun200ResponseDataStatusEnum_running;
    case 'stopped':
      return _$strategyPlazaProxyControllerRun200ResponseDataStatusEnum_stopped;
    case 'draft':
      return _$strategyPlazaProxyControllerRun200ResponseDataStatusEnum_draft;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<StrategyPlazaProxyControllerRun200ResponseDataStatusEnum>
_$strategyPlazaProxyControllerRun200ResponseDataStatusEnumValues =
    BuiltSet<StrategyPlazaProxyControllerRun200ResponseDataStatusEnum>(
      const <StrategyPlazaProxyControllerRun200ResponseDataStatusEnum>[
        _$strategyPlazaProxyControllerRun200ResponseDataStatusEnum_running,
        _$strategyPlazaProxyControllerRun200ResponseDataStatusEnum_stopped,
        _$strategyPlazaProxyControllerRun200ResponseDataStatusEnum_draft,
      ],
    );

const StrategyPlazaProxyControllerRun200ResponseDataResultEnum
_$strategyPlazaProxyControllerRun200ResponseDataResultEnum_existing =
    const StrategyPlazaProxyControllerRun200ResponseDataResultEnum._(
      'existing',
    );

StrategyPlazaProxyControllerRun200ResponseDataResultEnum
_$strategyPlazaProxyControllerRun200ResponseDataResultEnumValueOf(String name) {
  switch (name) {
    case 'existing':
      return _$strategyPlazaProxyControllerRun200ResponseDataResultEnum_existing;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<StrategyPlazaProxyControllerRun200ResponseDataResultEnum>
_$strategyPlazaProxyControllerRun200ResponseDataResultEnumValues =
    BuiltSet<StrategyPlazaProxyControllerRun200ResponseDataResultEnum>(
      const <StrategyPlazaProxyControllerRun200ResponseDataResultEnum>[
        _$strategyPlazaProxyControllerRun200ResponseDataResultEnum_existing,
      ],
    );

Serializer<StrategyPlazaProxyControllerRun200ResponseDataStatusEnum>
_$strategyPlazaProxyControllerRun200ResponseDataStatusEnumSerializer =
    _$StrategyPlazaProxyControllerRun200ResponseDataStatusEnumSerializer();
Serializer<StrategyPlazaProxyControllerRun200ResponseDataResultEnum>
_$strategyPlazaProxyControllerRun200ResponseDataResultEnumSerializer =
    _$StrategyPlazaProxyControllerRun200ResponseDataResultEnumSerializer();

class _$StrategyPlazaProxyControllerRun200ResponseDataStatusEnumSerializer
    implements
        PrimitiveSerializer<
          StrategyPlazaProxyControllerRun200ResponseDataStatusEnum
        > {
  static const Map<String, Object> _toWire = const <String, Object>{
    'running': 'running',
    'stopped': 'stopped',
    'draft': 'draft',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'running': 'running',
    'stopped': 'stopped',
    'draft': 'draft',
  };

  @override
  final Iterable<Type> types = const <Type>[
    StrategyPlazaProxyControllerRun200ResponseDataStatusEnum,
  ];
  @override
  final String wireName =
      'StrategyPlazaProxyControllerRun200ResponseDataStatusEnum';

  @override
  Object serialize(
    Serializers serializers,
    StrategyPlazaProxyControllerRun200ResponseDataStatusEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  StrategyPlazaProxyControllerRun200ResponseDataStatusEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => StrategyPlazaProxyControllerRun200ResponseDataStatusEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$StrategyPlazaProxyControllerRun200ResponseDataResultEnumSerializer
    implements
        PrimitiveSerializer<
          StrategyPlazaProxyControllerRun200ResponseDataResultEnum
        > {
  static const Map<String, Object> _toWire = const <String, Object>{
    'existing': 'existing',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'existing': 'existing',
  };

  @override
  final Iterable<Type> types = const <Type>[
    StrategyPlazaProxyControllerRun200ResponseDataResultEnum,
  ];
  @override
  final String wireName =
      'StrategyPlazaProxyControllerRun200ResponseDataResultEnum';

  @override
  Object serialize(
    Serializers serializers,
    StrategyPlazaProxyControllerRun200ResponseDataResultEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  StrategyPlazaProxyControllerRun200ResponseDataResultEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => StrategyPlazaProxyControllerRun200ResponseDataResultEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$StrategyPlazaProxyControllerRun200ResponseData
    extends StrategyPlazaProxyControllerRun200ResponseData {
  @override
  final OneOf oneOf;

  factory _$StrategyPlazaProxyControllerRun200ResponseData([
    void Function(StrategyPlazaProxyControllerRun200ResponseDataBuilder)?
    updates,
  ]) =>
      (StrategyPlazaProxyControllerRun200ResponseDataBuilder()..update(updates))
          ._build();

  _$StrategyPlazaProxyControllerRun200ResponseData._({required this.oneOf})
    : super._();
  @override
  StrategyPlazaProxyControllerRun200ResponseData rebuild(
    void Function(StrategyPlazaProxyControllerRun200ResponseDataBuilder)
    updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  StrategyPlazaProxyControllerRun200ResponseDataBuilder toBuilder() =>
      StrategyPlazaProxyControllerRun200ResponseDataBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is StrategyPlazaProxyControllerRun200ResponseData &&
        oneOf == other.oneOf;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, oneOf.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(
      r'StrategyPlazaProxyControllerRun200ResponseData',
    )..add('oneOf', oneOf)).toString();
  }
}

class StrategyPlazaProxyControllerRun200ResponseDataBuilder
    implements
        Builder<
          StrategyPlazaProxyControllerRun200ResponseData,
          StrategyPlazaProxyControllerRun200ResponseDataBuilder
        > {
  _$StrategyPlazaProxyControllerRun200ResponseData? _$v;

  OneOf? _oneOf;
  OneOf? get oneOf => _$this._oneOf;
  set oneOf(OneOf? oneOf) => _$this._oneOf = oneOf;

  StrategyPlazaProxyControllerRun200ResponseDataBuilder() {
    StrategyPlazaProxyControllerRun200ResponseData._defaults(this);
  }

  StrategyPlazaProxyControllerRun200ResponseDataBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _oneOf = $v.oneOf;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(StrategyPlazaProxyControllerRun200ResponseData other) {
    _$v = other as _$StrategyPlazaProxyControllerRun200ResponseData;
  }

  @override
  void update(
    void Function(StrategyPlazaProxyControllerRun200ResponseDataBuilder)?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  StrategyPlazaProxyControllerRun200ResponseData build() => _build();

  _$StrategyPlazaProxyControllerRun200ResponseData _build() {
    final _$result =
        _$v ??
        _$StrategyPlazaProxyControllerRun200ResponseData._(
          oneOf: BuiltValueNullFieldError.checkNotNull(
            oneOf,
            r'StrategyPlazaProxyControllerRun200ResponseData',
            'oneOf',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
