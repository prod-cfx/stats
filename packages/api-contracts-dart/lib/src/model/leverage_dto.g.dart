// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'leverage_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const LeverageDtoTypeEnum _$leverageDtoTypeEnum_cross =
    const LeverageDtoTypeEnum._('cross');
const LeverageDtoTypeEnum _$leverageDtoTypeEnum_isolated =
    const LeverageDtoTypeEnum._('isolated');

LeverageDtoTypeEnum _$leverageDtoTypeEnumValueOf(String name) {
  switch (name) {
    case 'cross':
      return _$leverageDtoTypeEnum_cross;
    case 'isolated':
      return _$leverageDtoTypeEnum_isolated;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<LeverageDtoTypeEnum> _$leverageDtoTypeEnumValues =
    BuiltSet<LeverageDtoTypeEnum>(const <LeverageDtoTypeEnum>[
      _$leverageDtoTypeEnum_cross,
      _$leverageDtoTypeEnum_isolated,
    ]);

Serializer<LeverageDtoTypeEnum> _$leverageDtoTypeEnumSerializer =
    _$LeverageDtoTypeEnumSerializer();

class _$LeverageDtoTypeEnumSerializer
    implements PrimitiveSerializer<LeverageDtoTypeEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'cross': 'cross',
    'isolated': 'isolated',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'cross': 'cross',
    'isolated': 'isolated',
  };

  @override
  final Iterable<Type> types = const <Type>[LeverageDtoTypeEnum];
  @override
  final String wireName = 'LeverageDtoTypeEnum';

  @override
  Object serialize(
    Serializers serializers,
    LeverageDtoTypeEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  LeverageDtoTypeEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => LeverageDtoTypeEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$LeverageDto extends LeverageDto {
  @override
  final LeverageDtoTypeEnum type;
  @override
  final num value;

  factory _$LeverageDto([void Function(LeverageDtoBuilder)? updates]) =>
      (LeverageDtoBuilder()..update(updates))._build();

  _$LeverageDto._({required this.type, required this.value}) : super._();
  @override
  LeverageDto rebuild(void Function(LeverageDtoBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  LeverageDtoBuilder toBuilder() => LeverageDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is LeverageDto && type == other.type && value == other.value;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, type.hashCode);
    _$hash = $jc(_$hash, value.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'LeverageDto')
          ..add('type', type)
          ..add('value', value))
        .toString();
  }
}

class LeverageDtoBuilder implements Builder<LeverageDto, LeverageDtoBuilder> {
  _$LeverageDto? _$v;

  LeverageDtoTypeEnum? _type;
  LeverageDtoTypeEnum? get type => _$this._type;
  set type(LeverageDtoTypeEnum? type) => _$this._type = type;

  num? _value;
  num? get value => _$this._value;
  set value(num? value) => _$this._value = value;

  LeverageDtoBuilder() {
    LeverageDto._defaults(this);
  }

  LeverageDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _type = $v.type;
      _value = $v.value;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(LeverageDto other) {
    _$v = other as _$LeverageDto;
  }

  @override
  void update(void Function(LeverageDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  LeverageDto build() => _build();

  _$LeverageDto _build() {
    final _$result =
        _$v ??
        _$LeverageDto._(
          type: BuiltValueNullFieldError.checkNotNull(
            type,
            r'LeverageDto',
            'type',
          ),
          value: BuiltValueNullFieldError.checkNotNull(
            value,
            r'LeverageDto',
            'value',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
