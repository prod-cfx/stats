// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'backtesting_create_job_execution_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const BacktestingCreateJobExecutionDtoPriceSourceEnum
_$backtestingCreateJobExecutionDtoPriceSourceEnum_open =
    const BacktestingCreateJobExecutionDtoPriceSourceEnum._('open');
const BacktestingCreateJobExecutionDtoPriceSourceEnum
_$backtestingCreateJobExecutionDtoPriceSourceEnum_close =
    const BacktestingCreateJobExecutionDtoPriceSourceEnum._('close');
const BacktestingCreateJobExecutionDtoPriceSourceEnum
_$backtestingCreateJobExecutionDtoPriceSourceEnum_mid =
    const BacktestingCreateJobExecutionDtoPriceSourceEnum._('mid');

BacktestingCreateJobExecutionDtoPriceSourceEnum
_$backtestingCreateJobExecutionDtoPriceSourceEnumValueOf(String name) {
  switch (name) {
    case 'open':
      return _$backtestingCreateJobExecutionDtoPriceSourceEnum_open;
    case 'close':
      return _$backtestingCreateJobExecutionDtoPriceSourceEnum_close;
    case 'mid':
      return _$backtestingCreateJobExecutionDtoPriceSourceEnum_mid;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<BacktestingCreateJobExecutionDtoPriceSourceEnum>
_$backtestingCreateJobExecutionDtoPriceSourceEnumValues =
    BuiltSet<BacktestingCreateJobExecutionDtoPriceSourceEnum>(
      const <BacktestingCreateJobExecutionDtoPriceSourceEnum>[
        _$backtestingCreateJobExecutionDtoPriceSourceEnum_open,
        _$backtestingCreateJobExecutionDtoPriceSourceEnum_close,
        _$backtestingCreateJobExecutionDtoPriceSourceEnum_mid,
      ],
    );

Serializer<BacktestingCreateJobExecutionDtoPriceSourceEnum>
_$backtestingCreateJobExecutionDtoPriceSourceEnumSerializer =
    _$BacktestingCreateJobExecutionDtoPriceSourceEnumSerializer();

class _$BacktestingCreateJobExecutionDtoPriceSourceEnumSerializer
    implements
        PrimitiveSerializer<BacktestingCreateJobExecutionDtoPriceSourceEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'open': 'open',
    'close': 'close',
    'mid': 'mid',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'open': 'open',
    'close': 'close',
    'mid': 'mid',
  };

  @override
  final Iterable<Type> types = const <Type>[
    BacktestingCreateJobExecutionDtoPriceSourceEnum,
  ];
  @override
  final String wireName = 'BacktestingCreateJobExecutionDtoPriceSourceEnum';

  @override
  Object serialize(
    Serializers serializers,
    BacktestingCreateJobExecutionDtoPriceSourceEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  BacktestingCreateJobExecutionDtoPriceSourceEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => BacktestingCreateJobExecutionDtoPriceSourceEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$BacktestingCreateJobExecutionDto
    extends BacktestingCreateJobExecutionDto {
  @override
  final num slippageBps;
  @override
  final num feeBps;
  @override
  final BacktestingCreateJobExecutionDtoPriceSourceEnum priceSource;

  factory _$BacktestingCreateJobExecutionDto([
    void Function(BacktestingCreateJobExecutionDtoBuilder)? updates,
  ]) => (BacktestingCreateJobExecutionDtoBuilder()..update(updates))._build();

  _$BacktestingCreateJobExecutionDto._({
    required this.slippageBps,
    required this.feeBps,
    required this.priceSource,
  }) : super._();
  @override
  BacktestingCreateJobExecutionDto rebuild(
    void Function(BacktestingCreateJobExecutionDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  BacktestingCreateJobExecutionDtoBuilder toBuilder() =>
      BacktestingCreateJobExecutionDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is BacktestingCreateJobExecutionDto &&
        slippageBps == other.slippageBps &&
        feeBps == other.feeBps &&
        priceSource == other.priceSource;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, slippageBps.hashCode);
    _$hash = $jc(_$hash, feeBps.hashCode);
    _$hash = $jc(_$hash, priceSource.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'BacktestingCreateJobExecutionDto')
          ..add('slippageBps', slippageBps)
          ..add('feeBps', feeBps)
          ..add('priceSource', priceSource))
        .toString();
  }
}

class BacktestingCreateJobExecutionDtoBuilder
    implements
        Builder<
          BacktestingCreateJobExecutionDto,
          BacktestingCreateJobExecutionDtoBuilder
        > {
  _$BacktestingCreateJobExecutionDto? _$v;

  num? _slippageBps;
  num? get slippageBps => _$this._slippageBps;
  set slippageBps(num? slippageBps) => _$this._slippageBps = slippageBps;

  num? _feeBps;
  num? get feeBps => _$this._feeBps;
  set feeBps(num? feeBps) => _$this._feeBps = feeBps;

  BacktestingCreateJobExecutionDtoPriceSourceEnum? _priceSource;
  BacktestingCreateJobExecutionDtoPriceSourceEnum? get priceSource =>
      _$this._priceSource;
  set priceSource(
    BacktestingCreateJobExecutionDtoPriceSourceEnum? priceSource,
  ) => _$this._priceSource = priceSource;

  BacktestingCreateJobExecutionDtoBuilder() {
    BacktestingCreateJobExecutionDto._defaults(this);
  }

  BacktestingCreateJobExecutionDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _slippageBps = $v.slippageBps;
      _feeBps = $v.feeBps;
      _priceSource = $v.priceSource;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(BacktestingCreateJobExecutionDto other) {
    _$v = other as _$BacktestingCreateJobExecutionDto;
  }

  @override
  void update(void Function(BacktestingCreateJobExecutionDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  BacktestingCreateJobExecutionDto build() => _build();

  _$BacktestingCreateJobExecutionDto _build() {
    final _$result =
        _$v ??
        _$BacktestingCreateJobExecutionDto._(
          slippageBps: BuiltValueNullFieldError.checkNotNull(
            slippageBps,
            r'BacktestingCreateJobExecutionDto',
            'slippageBps',
          ),
          feeBps: BuiltValueNullFieldError.checkNotNull(
            feeBps,
            r'BacktestingCreateJobExecutionDto',
            'feeBps',
          ),
          priceSource: BuiltValueNullFieldError.checkNotNull(
            priceSource,
            r'BacktestingCreateJobExecutionDto',
            'priceSource',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
