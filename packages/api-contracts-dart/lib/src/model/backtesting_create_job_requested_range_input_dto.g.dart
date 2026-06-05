// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'backtesting_create_job_requested_range_input_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const BacktestingCreateJobRequestedRangeInputDtoPresetEnum
_$backtestingCreateJobRequestedRangeInputDtoPresetEnum_n7d =
    const BacktestingCreateJobRequestedRangeInputDtoPresetEnum._('n7d');
const BacktestingCreateJobRequestedRangeInputDtoPresetEnum
_$backtestingCreateJobRequestedRangeInputDtoPresetEnum_n30d =
    const BacktestingCreateJobRequestedRangeInputDtoPresetEnum._('n30d');
const BacktestingCreateJobRequestedRangeInputDtoPresetEnum
_$backtestingCreateJobRequestedRangeInputDtoPresetEnum_n90d =
    const BacktestingCreateJobRequestedRangeInputDtoPresetEnum._('n90d');
const BacktestingCreateJobRequestedRangeInputDtoPresetEnum
_$backtestingCreateJobRequestedRangeInputDtoPresetEnum_n1y =
    const BacktestingCreateJobRequestedRangeInputDtoPresetEnum._('n1y');
const BacktestingCreateJobRequestedRangeInputDtoPresetEnum
_$backtestingCreateJobRequestedRangeInputDtoPresetEnum_CUSTOM =
    const BacktestingCreateJobRequestedRangeInputDtoPresetEnum._('CUSTOM');

BacktestingCreateJobRequestedRangeInputDtoPresetEnum
_$backtestingCreateJobRequestedRangeInputDtoPresetEnumValueOf(String name) {
  switch (name) {
    case 'n7d':
      return _$backtestingCreateJobRequestedRangeInputDtoPresetEnum_n7d;
    case 'n30d':
      return _$backtestingCreateJobRequestedRangeInputDtoPresetEnum_n30d;
    case 'n90d':
      return _$backtestingCreateJobRequestedRangeInputDtoPresetEnum_n90d;
    case 'n1y':
      return _$backtestingCreateJobRequestedRangeInputDtoPresetEnum_n1y;
    case 'CUSTOM':
      return _$backtestingCreateJobRequestedRangeInputDtoPresetEnum_CUSTOM;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<BacktestingCreateJobRequestedRangeInputDtoPresetEnum>
_$backtestingCreateJobRequestedRangeInputDtoPresetEnumValues =
    BuiltSet<BacktestingCreateJobRequestedRangeInputDtoPresetEnum>(
      const <BacktestingCreateJobRequestedRangeInputDtoPresetEnum>[
        _$backtestingCreateJobRequestedRangeInputDtoPresetEnum_n7d,
        _$backtestingCreateJobRequestedRangeInputDtoPresetEnum_n30d,
        _$backtestingCreateJobRequestedRangeInputDtoPresetEnum_n90d,
        _$backtestingCreateJobRequestedRangeInputDtoPresetEnum_n1y,
        _$backtestingCreateJobRequestedRangeInputDtoPresetEnum_CUSTOM,
      ],
    );

Serializer<BacktestingCreateJobRequestedRangeInputDtoPresetEnum>
_$backtestingCreateJobRequestedRangeInputDtoPresetEnumSerializer =
    _$BacktestingCreateJobRequestedRangeInputDtoPresetEnumSerializer();

class _$BacktestingCreateJobRequestedRangeInputDtoPresetEnumSerializer
    implements
        PrimitiveSerializer<
          BacktestingCreateJobRequestedRangeInputDtoPresetEnum
        > {
  static const Map<String, Object> _toWire = const <String, Object>{
    'n7d': '7D',
    'n30d': '30D',
    'n90d': '90D',
    'n1y': '1Y',
    'CUSTOM': 'CUSTOM',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    '7D': 'n7d',
    '30D': 'n30d',
    '90D': 'n90d',
    '1Y': 'n1y',
    'CUSTOM': 'CUSTOM',
  };

  @override
  final Iterable<Type> types = const <Type>[
    BacktestingCreateJobRequestedRangeInputDtoPresetEnum,
  ];
  @override
  final String wireName =
      'BacktestingCreateJobRequestedRangeInputDtoPresetEnum';

  @override
  Object serialize(
    Serializers serializers,
    BacktestingCreateJobRequestedRangeInputDtoPresetEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  BacktestingCreateJobRequestedRangeInputDtoPresetEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => BacktestingCreateJobRequestedRangeInputDtoPresetEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$BacktestingCreateJobRequestedRangeInputDto
    extends BacktestingCreateJobRequestedRangeInputDto {
  @override
  final BacktestingCreateJobRequestedRangeInputDtoPresetEnum preset;
  @override
  final String? startAt;
  @override
  final String? endAt;

  factory _$BacktestingCreateJobRequestedRangeInputDto([
    void Function(BacktestingCreateJobRequestedRangeInputDtoBuilder)? updates,
  ]) => (BacktestingCreateJobRequestedRangeInputDtoBuilder()..update(updates))
      ._build();

  _$BacktestingCreateJobRequestedRangeInputDto._({
    required this.preset,
    this.startAt,
    this.endAt,
  }) : super._();
  @override
  BacktestingCreateJobRequestedRangeInputDto rebuild(
    void Function(BacktestingCreateJobRequestedRangeInputDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  BacktestingCreateJobRequestedRangeInputDtoBuilder toBuilder() =>
      BacktestingCreateJobRequestedRangeInputDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is BacktestingCreateJobRequestedRangeInputDto &&
        preset == other.preset &&
        startAt == other.startAt &&
        endAt == other.endAt;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, preset.hashCode);
    _$hash = $jc(_$hash, startAt.hashCode);
    _$hash = $jc(_$hash, endAt.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(
            r'BacktestingCreateJobRequestedRangeInputDto',
          )
          ..add('preset', preset)
          ..add('startAt', startAt)
          ..add('endAt', endAt))
        .toString();
  }
}

class BacktestingCreateJobRequestedRangeInputDtoBuilder
    implements
        Builder<
          BacktestingCreateJobRequestedRangeInputDto,
          BacktestingCreateJobRequestedRangeInputDtoBuilder
        > {
  _$BacktestingCreateJobRequestedRangeInputDto? _$v;

  BacktestingCreateJobRequestedRangeInputDtoPresetEnum? _preset;
  BacktestingCreateJobRequestedRangeInputDtoPresetEnum? get preset =>
      _$this._preset;
  set preset(BacktestingCreateJobRequestedRangeInputDtoPresetEnum? preset) =>
      _$this._preset = preset;

  String? _startAt;
  String? get startAt => _$this._startAt;
  set startAt(String? startAt) => _$this._startAt = startAt;

  String? _endAt;
  String? get endAt => _$this._endAt;
  set endAt(String? endAt) => _$this._endAt = endAt;

  BacktestingCreateJobRequestedRangeInputDtoBuilder() {
    BacktestingCreateJobRequestedRangeInputDto._defaults(this);
  }

  BacktestingCreateJobRequestedRangeInputDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _preset = $v.preset;
      _startAt = $v.startAt;
      _endAt = $v.endAt;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(BacktestingCreateJobRequestedRangeInputDto other) {
    _$v = other as _$BacktestingCreateJobRequestedRangeInputDto;
  }

  @override
  void update(
    void Function(BacktestingCreateJobRequestedRangeInputDtoBuilder)? updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  BacktestingCreateJobRequestedRangeInputDto build() => _build();

  _$BacktestingCreateJobRequestedRangeInputDto _build() {
    final _$result =
        _$v ??
        _$BacktestingCreateJobRequestedRangeInputDto._(
          preset: BuiltValueNullFieldError.checkNotNull(
            preset,
            r'BacktestingCreateJobRequestedRangeInputDto',
            'preset',
          ),
          startAt: startAt,
          endAt: endAt,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
