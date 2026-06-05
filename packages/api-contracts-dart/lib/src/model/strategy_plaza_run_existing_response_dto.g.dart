// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'strategy_plaza_run_existing_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const StrategyPlazaRunExistingResponseDtoResultEnum
_$strategyPlazaRunExistingResponseDtoResultEnum_existing =
    const StrategyPlazaRunExistingResponseDtoResultEnum._('existing');

StrategyPlazaRunExistingResponseDtoResultEnum
_$strategyPlazaRunExistingResponseDtoResultEnumValueOf(String name) {
  switch (name) {
    case 'existing':
      return _$strategyPlazaRunExistingResponseDtoResultEnum_existing;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<StrategyPlazaRunExistingResponseDtoResultEnum>
_$strategyPlazaRunExistingResponseDtoResultEnumValues =
    BuiltSet<StrategyPlazaRunExistingResponseDtoResultEnum>(
      const <StrategyPlazaRunExistingResponseDtoResultEnum>[
        _$strategyPlazaRunExistingResponseDtoResultEnum_existing,
      ],
    );

Serializer<StrategyPlazaRunExistingResponseDtoResultEnum>
_$strategyPlazaRunExistingResponseDtoResultEnumSerializer =
    _$StrategyPlazaRunExistingResponseDtoResultEnumSerializer();

class _$StrategyPlazaRunExistingResponseDtoResultEnumSerializer
    implements
        PrimitiveSerializer<StrategyPlazaRunExistingResponseDtoResultEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'existing': 'existing',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'existing': 'existing',
  };

  @override
  final Iterable<Type> types = const <Type>[
    StrategyPlazaRunExistingResponseDtoResultEnum,
  ];
  @override
  final String wireName = 'StrategyPlazaRunExistingResponseDtoResultEnum';

  @override
  Object serialize(
    Serializers serializers,
    StrategyPlazaRunExistingResponseDtoResultEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  StrategyPlazaRunExistingResponseDtoResultEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => StrategyPlazaRunExistingResponseDtoResultEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$StrategyPlazaRunExistingResponseDto
    extends StrategyPlazaRunExistingResponseDto {
  @override
  final StrategyPlazaRunExistingResponseDtoResultEnum result;
  @override
  final AccountAiQuantStrategyDetailResponseDto strategy;

  factory _$StrategyPlazaRunExistingResponseDto([
    void Function(StrategyPlazaRunExistingResponseDtoBuilder)? updates,
  ]) =>
      (StrategyPlazaRunExistingResponseDtoBuilder()..update(updates))._build();

  _$StrategyPlazaRunExistingResponseDto._({
    required this.result,
    required this.strategy,
  }) : super._();
  @override
  StrategyPlazaRunExistingResponseDto rebuild(
    void Function(StrategyPlazaRunExistingResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  StrategyPlazaRunExistingResponseDtoBuilder toBuilder() =>
      StrategyPlazaRunExistingResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is StrategyPlazaRunExistingResponseDto &&
        result == other.result &&
        strategy == other.strategy;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, result.hashCode);
    _$hash = $jc(_$hash, strategy.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'StrategyPlazaRunExistingResponseDto')
          ..add('result', result)
          ..add('strategy', strategy))
        .toString();
  }
}

class StrategyPlazaRunExistingResponseDtoBuilder
    implements
        Builder<
          StrategyPlazaRunExistingResponseDto,
          StrategyPlazaRunExistingResponseDtoBuilder
        > {
  _$StrategyPlazaRunExistingResponseDto? _$v;

  StrategyPlazaRunExistingResponseDtoResultEnum? _result;
  StrategyPlazaRunExistingResponseDtoResultEnum? get result => _$this._result;
  set result(StrategyPlazaRunExistingResponseDtoResultEnum? result) =>
      _$this._result = result;

  AccountAiQuantStrategyDetailResponseDtoBuilder? _strategy;
  AccountAiQuantStrategyDetailResponseDtoBuilder get strategy =>
      _$this._strategy ??= AccountAiQuantStrategyDetailResponseDtoBuilder();
  set strategy(AccountAiQuantStrategyDetailResponseDtoBuilder? strategy) =>
      _$this._strategy = strategy;

  StrategyPlazaRunExistingResponseDtoBuilder() {
    StrategyPlazaRunExistingResponseDto._defaults(this);
  }

  StrategyPlazaRunExistingResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _result = $v.result;
      _strategy = $v.strategy.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(StrategyPlazaRunExistingResponseDto other) {
    _$v = other as _$StrategyPlazaRunExistingResponseDto;
  }

  @override
  void update(
    void Function(StrategyPlazaRunExistingResponseDtoBuilder)? updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  StrategyPlazaRunExistingResponseDto build() => _build();

  _$StrategyPlazaRunExistingResponseDto _build() {
    _$StrategyPlazaRunExistingResponseDto _$result;
    try {
      _$result =
          _$v ??
          _$StrategyPlazaRunExistingResponseDto._(
            result: BuiltValueNullFieldError.checkNotNull(
              result,
              r'StrategyPlazaRunExistingResponseDto',
              'result',
            ),
            strategy: strategy.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'strategy';
        strategy.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'StrategyPlazaRunExistingResponseDto',
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
