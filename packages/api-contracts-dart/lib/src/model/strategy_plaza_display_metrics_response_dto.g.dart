// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'strategy_plaza_display_metrics_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const StrategyPlazaDisplayMetricsResponseDtoLabelEnum
_$strategyPlazaDisplayMetricsResponseDtoLabelEnum_officialSampleBacktest =
    const StrategyPlazaDisplayMetricsResponseDtoLabelEnum._(
      'officialSampleBacktest',
    );

StrategyPlazaDisplayMetricsResponseDtoLabelEnum
_$strategyPlazaDisplayMetricsResponseDtoLabelEnumValueOf(String name) {
  switch (name) {
    case 'officialSampleBacktest':
      return _$strategyPlazaDisplayMetricsResponseDtoLabelEnum_officialSampleBacktest;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<StrategyPlazaDisplayMetricsResponseDtoLabelEnum>
_$strategyPlazaDisplayMetricsResponseDtoLabelEnumValues =
    BuiltSet<StrategyPlazaDisplayMetricsResponseDtoLabelEnum>(const <
      StrategyPlazaDisplayMetricsResponseDtoLabelEnum
    >[
      _$strategyPlazaDisplayMetricsResponseDtoLabelEnum_officialSampleBacktest,
    ]);

Serializer<StrategyPlazaDisplayMetricsResponseDtoLabelEnum>
_$strategyPlazaDisplayMetricsResponseDtoLabelEnumSerializer =
    _$StrategyPlazaDisplayMetricsResponseDtoLabelEnumSerializer();

class _$StrategyPlazaDisplayMetricsResponseDtoLabelEnumSerializer
    implements
        PrimitiveSerializer<StrategyPlazaDisplayMetricsResponseDtoLabelEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'officialSampleBacktest': 'official_sample_backtest',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'official_sample_backtest': 'officialSampleBacktest',
  };

  @override
  final Iterable<Type> types = const <Type>[
    StrategyPlazaDisplayMetricsResponseDtoLabelEnum,
  ];
  @override
  final String wireName = 'StrategyPlazaDisplayMetricsResponseDtoLabelEnum';

  @override
  Object serialize(
    Serializers serializers,
    StrategyPlazaDisplayMetricsResponseDtoLabelEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  StrategyPlazaDisplayMetricsResponseDtoLabelEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => StrategyPlazaDisplayMetricsResponseDtoLabelEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$StrategyPlazaDisplayMetricsResponseDto
    extends StrategyPlazaDisplayMetricsResponseDto {
  @override
  final StrategyPlazaDisplayMetricsResponseDtoLabelEnum label;
  @override
  final num? returnPct;
  @override
  final num? winRatePct;
  @override
  final num? maxDrawdownPct;
  @override
  final num? sharpe;
  @override
  final num? profitLossRatio;
  @override
  final num? tradeCount;
  @override
  final num? users;

  factory _$StrategyPlazaDisplayMetricsResponseDto([
    void Function(StrategyPlazaDisplayMetricsResponseDtoBuilder)? updates,
  ]) => (StrategyPlazaDisplayMetricsResponseDtoBuilder()..update(updates))
      ._build();

  _$StrategyPlazaDisplayMetricsResponseDto._({
    required this.label,
    this.returnPct,
    this.winRatePct,
    this.maxDrawdownPct,
    this.sharpe,
    this.profitLossRatio,
    this.tradeCount,
    this.users,
  }) : super._();
  @override
  StrategyPlazaDisplayMetricsResponseDto rebuild(
    void Function(StrategyPlazaDisplayMetricsResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  StrategyPlazaDisplayMetricsResponseDtoBuilder toBuilder() =>
      StrategyPlazaDisplayMetricsResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is StrategyPlazaDisplayMetricsResponseDto &&
        label == other.label &&
        returnPct == other.returnPct &&
        winRatePct == other.winRatePct &&
        maxDrawdownPct == other.maxDrawdownPct &&
        sharpe == other.sharpe &&
        profitLossRatio == other.profitLossRatio &&
        tradeCount == other.tradeCount &&
        users == other.users;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, label.hashCode);
    _$hash = $jc(_$hash, returnPct.hashCode);
    _$hash = $jc(_$hash, winRatePct.hashCode);
    _$hash = $jc(_$hash, maxDrawdownPct.hashCode);
    _$hash = $jc(_$hash, sharpe.hashCode);
    _$hash = $jc(_$hash, profitLossRatio.hashCode);
    _$hash = $jc(_$hash, tradeCount.hashCode);
    _$hash = $jc(_$hash, users.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(
            r'StrategyPlazaDisplayMetricsResponseDto',
          )
          ..add('label', label)
          ..add('returnPct', returnPct)
          ..add('winRatePct', winRatePct)
          ..add('maxDrawdownPct', maxDrawdownPct)
          ..add('sharpe', sharpe)
          ..add('profitLossRatio', profitLossRatio)
          ..add('tradeCount', tradeCount)
          ..add('users', users))
        .toString();
  }
}

class StrategyPlazaDisplayMetricsResponseDtoBuilder
    implements
        Builder<
          StrategyPlazaDisplayMetricsResponseDto,
          StrategyPlazaDisplayMetricsResponseDtoBuilder
        > {
  _$StrategyPlazaDisplayMetricsResponseDto? _$v;

  StrategyPlazaDisplayMetricsResponseDtoLabelEnum? _label;
  StrategyPlazaDisplayMetricsResponseDtoLabelEnum? get label => _$this._label;
  set label(StrategyPlazaDisplayMetricsResponseDtoLabelEnum? label) =>
      _$this._label = label;

  num? _returnPct;
  num? get returnPct => _$this._returnPct;
  set returnPct(num? returnPct) => _$this._returnPct = returnPct;

  num? _winRatePct;
  num? get winRatePct => _$this._winRatePct;
  set winRatePct(num? winRatePct) => _$this._winRatePct = winRatePct;

  num? _maxDrawdownPct;
  num? get maxDrawdownPct => _$this._maxDrawdownPct;
  set maxDrawdownPct(num? maxDrawdownPct) =>
      _$this._maxDrawdownPct = maxDrawdownPct;

  num? _sharpe;
  num? get sharpe => _$this._sharpe;
  set sharpe(num? sharpe) => _$this._sharpe = sharpe;

  num? _profitLossRatio;
  num? get profitLossRatio => _$this._profitLossRatio;
  set profitLossRatio(num? profitLossRatio) =>
      _$this._profitLossRatio = profitLossRatio;

  num? _tradeCount;
  num? get tradeCount => _$this._tradeCount;
  set tradeCount(num? tradeCount) => _$this._tradeCount = tradeCount;

  num? _users;
  num? get users => _$this._users;
  set users(num? users) => _$this._users = users;

  StrategyPlazaDisplayMetricsResponseDtoBuilder() {
    StrategyPlazaDisplayMetricsResponseDto._defaults(this);
  }

  StrategyPlazaDisplayMetricsResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _label = $v.label;
      _returnPct = $v.returnPct;
      _winRatePct = $v.winRatePct;
      _maxDrawdownPct = $v.maxDrawdownPct;
      _sharpe = $v.sharpe;
      _profitLossRatio = $v.profitLossRatio;
      _tradeCount = $v.tradeCount;
      _users = $v.users;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(StrategyPlazaDisplayMetricsResponseDto other) {
    _$v = other as _$StrategyPlazaDisplayMetricsResponseDto;
  }

  @override
  void update(
    void Function(StrategyPlazaDisplayMetricsResponseDtoBuilder)? updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  StrategyPlazaDisplayMetricsResponseDto build() => _build();

  _$StrategyPlazaDisplayMetricsResponseDto _build() {
    final _$result =
        _$v ??
        _$StrategyPlazaDisplayMetricsResponseDto._(
          label: BuiltValueNullFieldError.checkNotNull(
            label,
            r'StrategyPlazaDisplayMetricsResponseDto',
            'label',
          ),
          returnPct: returnPct,
          winRatePct: winRatePct,
          maxDrawdownPct: maxDrawdownPct,
          sharpe: sharpe,
          profitLossRatio: profitLossRatio,
          tradeCount: tradeCount,
          users: users,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
