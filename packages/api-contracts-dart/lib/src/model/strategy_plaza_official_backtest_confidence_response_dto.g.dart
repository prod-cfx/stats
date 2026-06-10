// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'strategy_plaza_official_backtest_confidence_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const StrategyPlazaOfficialBacktestConfidenceResponseDtoLevelEnum
_$strategyPlazaOfficialBacktestConfidenceResponseDtoLevelEnum_high =
    const StrategyPlazaOfficialBacktestConfidenceResponseDtoLevelEnum._('high');
const StrategyPlazaOfficialBacktestConfidenceResponseDtoLevelEnum
_$strategyPlazaOfficialBacktestConfidenceResponseDtoLevelEnum_medium =
    const StrategyPlazaOfficialBacktestConfidenceResponseDtoLevelEnum._(
      'medium',
    );
const StrategyPlazaOfficialBacktestConfidenceResponseDtoLevelEnum
_$strategyPlazaOfficialBacktestConfidenceResponseDtoLevelEnum_low =
    const StrategyPlazaOfficialBacktestConfidenceResponseDtoLevelEnum._('low');

StrategyPlazaOfficialBacktestConfidenceResponseDtoLevelEnum
_$strategyPlazaOfficialBacktestConfidenceResponseDtoLevelEnumValueOf(
  String name,
) {
  switch (name) {
    case 'high':
      return _$strategyPlazaOfficialBacktestConfidenceResponseDtoLevelEnum_high;
    case 'medium':
      return _$strategyPlazaOfficialBacktestConfidenceResponseDtoLevelEnum_medium;
    case 'low':
      return _$strategyPlazaOfficialBacktestConfidenceResponseDtoLevelEnum_low;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<StrategyPlazaOfficialBacktestConfidenceResponseDtoLevelEnum>
_$strategyPlazaOfficialBacktestConfidenceResponseDtoLevelEnumValues =
    BuiltSet<StrategyPlazaOfficialBacktestConfidenceResponseDtoLevelEnum>(
      const <StrategyPlazaOfficialBacktestConfidenceResponseDtoLevelEnum>[
        _$strategyPlazaOfficialBacktestConfidenceResponseDtoLevelEnum_high,
        _$strategyPlazaOfficialBacktestConfidenceResponseDtoLevelEnum_medium,
        _$strategyPlazaOfficialBacktestConfidenceResponseDtoLevelEnum_low,
      ],
    );

Serializer<StrategyPlazaOfficialBacktestConfidenceResponseDtoLevelEnum>
_$strategyPlazaOfficialBacktestConfidenceResponseDtoLevelEnumSerializer =
    _$StrategyPlazaOfficialBacktestConfidenceResponseDtoLevelEnumSerializer();

class _$StrategyPlazaOfficialBacktestConfidenceResponseDtoLevelEnumSerializer
    implements
        PrimitiveSerializer<
          StrategyPlazaOfficialBacktestConfidenceResponseDtoLevelEnum
        > {
  static const Map<String, Object> _toWire = const <String, Object>{
    'high': 'high',
    'medium': 'medium',
    'low': 'low',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'high': 'high',
    'medium': 'medium',
    'low': 'low',
  };

  @override
  final Iterable<Type> types = const <Type>[
    StrategyPlazaOfficialBacktestConfidenceResponseDtoLevelEnum,
  ];
  @override
  final String wireName =
      'StrategyPlazaOfficialBacktestConfidenceResponseDtoLevelEnum';

  @override
  Object serialize(
    Serializers serializers,
    StrategyPlazaOfficialBacktestConfidenceResponseDtoLevelEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  StrategyPlazaOfficialBacktestConfidenceResponseDtoLevelEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => StrategyPlazaOfficialBacktestConfidenceResponseDtoLevelEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$StrategyPlazaOfficialBacktestConfidenceResponseDto
    extends StrategyPlazaOfficialBacktestConfidenceResponseDto {
  @override
  final StrategyPlazaOfficialBacktestConfidenceResponseDtoLevelEnum level;
  @override
  final BuiltList<String> reasons;

  factory _$StrategyPlazaOfficialBacktestConfidenceResponseDto([
    void Function(StrategyPlazaOfficialBacktestConfidenceResponseDtoBuilder)?
    updates,
  ]) =>
      (StrategyPlazaOfficialBacktestConfidenceResponseDtoBuilder()
            ..update(updates))
          ._build();

  _$StrategyPlazaOfficialBacktestConfidenceResponseDto._({
    required this.level,
    required this.reasons,
  }) : super._();
  @override
  StrategyPlazaOfficialBacktestConfidenceResponseDto rebuild(
    void Function(StrategyPlazaOfficialBacktestConfidenceResponseDtoBuilder)
    updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  StrategyPlazaOfficialBacktestConfidenceResponseDtoBuilder toBuilder() =>
      StrategyPlazaOfficialBacktestConfidenceResponseDtoBuilder()
        ..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is StrategyPlazaOfficialBacktestConfidenceResponseDto &&
        level == other.level &&
        reasons == other.reasons;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, level.hashCode);
    _$hash = $jc(_$hash, reasons.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(
            r'StrategyPlazaOfficialBacktestConfidenceResponseDto',
          )
          ..add('level', level)
          ..add('reasons', reasons))
        .toString();
  }
}

class StrategyPlazaOfficialBacktestConfidenceResponseDtoBuilder
    implements
        Builder<
          StrategyPlazaOfficialBacktestConfidenceResponseDto,
          StrategyPlazaOfficialBacktestConfidenceResponseDtoBuilder
        > {
  _$StrategyPlazaOfficialBacktestConfidenceResponseDto? _$v;

  StrategyPlazaOfficialBacktestConfidenceResponseDtoLevelEnum? _level;
  StrategyPlazaOfficialBacktestConfidenceResponseDtoLevelEnum? get level =>
      _$this._level;
  set level(
    StrategyPlazaOfficialBacktestConfidenceResponseDtoLevelEnum? level,
  ) => _$this._level = level;

  ListBuilder<String>? _reasons;
  ListBuilder<String> get reasons => _$this._reasons ??= ListBuilder<String>();
  set reasons(ListBuilder<String>? reasons) => _$this._reasons = reasons;

  StrategyPlazaOfficialBacktestConfidenceResponseDtoBuilder() {
    StrategyPlazaOfficialBacktestConfidenceResponseDto._defaults(this);
  }

  StrategyPlazaOfficialBacktestConfidenceResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _level = $v.level;
      _reasons = $v.reasons.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(StrategyPlazaOfficialBacktestConfidenceResponseDto other) {
    _$v = other as _$StrategyPlazaOfficialBacktestConfidenceResponseDto;
  }

  @override
  void update(
    void Function(StrategyPlazaOfficialBacktestConfidenceResponseDtoBuilder)?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  StrategyPlazaOfficialBacktestConfidenceResponseDto build() => _build();

  _$StrategyPlazaOfficialBacktestConfidenceResponseDto _build() {
    _$StrategyPlazaOfficialBacktestConfidenceResponseDto _$result;
    try {
      _$result =
          _$v ??
          _$StrategyPlazaOfficialBacktestConfidenceResponseDto._(
            level: BuiltValueNullFieldError.checkNotNull(
              level,
              r'StrategyPlazaOfficialBacktestConfidenceResponseDto',
              'level',
            ),
            reasons: reasons.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'reasons';
        reasons.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'StrategyPlazaOfficialBacktestConfidenceResponseDto',
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
