// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'liquidation_heatmap_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const LiquidationHeatmapResponseDtoModelTypeEnum
_$liquidationHeatmapResponseDtoModelTypeEnum_MODEL1 =
    const LiquidationHeatmapResponseDtoModelTypeEnum._('MODEL1');
const LiquidationHeatmapResponseDtoModelTypeEnum
_$liquidationHeatmapResponseDtoModelTypeEnum_MODEL2 =
    const LiquidationHeatmapResponseDtoModelTypeEnum._('MODEL2');
const LiquidationHeatmapResponseDtoModelTypeEnum
_$liquidationHeatmapResponseDtoModelTypeEnum_MODEL3 =
    const LiquidationHeatmapResponseDtoModelTypeEnum._('MODEL3');

LiquidationHeatmapResponseDtoModelTypeEnum
_$liquidationHeatmapResponseDtoModelTypeEnumValueOf(String name) {
  switch (name) {
    case 'MODEL1':
      return _$liquidationHeatmapResponseDtoModelTypeEnum_MODEL1;
    case 'MODEL2':
      return _$liquidationHeatmapResponseDtoModelTypeEnum_MODEL2;
    case 'MODEL3':
      return _$liquidationHeatmapResponseDtoModelTypeEnum_MODEL3;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<LiquidationHeatmapResponseDtoModelTypeEnum>
_$liquidationHeatmapResponseDtoModelTypeEnumValues =
    BuiltSet<LiquidationHeatmapResponseDtoModelTypeEnum>(
      const <LiquidationHeatmapResponseDtoModelTypeEnum>[
        _$liquidationHeatmapResponseDtoModelTypeEnum_MODEL1,
        _$liquidationHeatmapResponseDtoModelTypeEnum_MODEL2,
        _$liquidationHeatmapResponseDtoModelTypeEnum_MODEL3,
      ],
    );

Serializer<LiquidationHeatmapResponseDtoModelTypeEnum>
_$liquidationHeatmapResponseDtoModelTypeEnumSerializer =
    _$LiquidationHeatmapResponseDtoModelTypeEnumSerializer();

class _$LiquidationHeatmapResponseDtoModelTypeEnumSerializer
    implements PrimitiveSerializer<LiquidationHeatmapResponseDtoModelTypeEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'MODEL1': 'MODEL1',
    'MODEL2': 'MODEL2',
    'MODEL3': 'MODEL3',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'MODEL1': 'MODEL1',
    'MODEL2': 'MODEL2',
    'MODEL3': 'MODEL3',
  };

  @override
  final Iterable<Type> types = const <Type>[
    LiquidationHeatmapResponseDtoModelTypeEnum,
  ];
  @override
  final String wireName = 'LiquidationHeatmapResponseDtoModelTypeEnum';

  @override
  Object serialize(
    Serializers serializers,
    LiquidationHeatmapResponseDtoModelTypeEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  LiquidationHeatmapResponseDtoModelTypeEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => LiquidationHeatmapResponseDtoModelTypeEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$LiquidationHeatmapResponseDto extends LiquidationHeatmapResponseDto {
  @override
  final num snapshotId;
  @override
  final String symbol;
  @override
  final String? exchangeCode;
  @override
  final String? tradingPair;
  @override
  final String? contractType;
  @override
  final LiquidationHeatmapResponseDtoModelTypeEnum modelType;
  @override
  final String? timeInterval;
  @override
  final String valueCurrency;
  @override
  final DateTime fetchedAt;
  @override
  final DateTime? effectiveFrom;
  @override
  final DateTime? effectiveTo;
  @override
  final BuiltList<num> yAxis;
  @override
  final BuiltList<BuiltList<num>> liquidationLeverageData;
  @override
  final BuiltList<
    BuiltList<LiquidationHeatmapResponseDtoPriceCandlesticksInnerInner>
  >
  priceCandlesticks;

  factory _$LiquidationHeatmapResponseDto([
    void Function(LiquidationHeatmapResponseDtoBuilder)? updates,
  ]) => (LiquidationHeatmapResponseDtoBuilder()..update(updates))._build();

  _$LiquidationHeatmapResponseDto._({
    required this.snapshotId,
    required this.symbol,
    this.exchangeCode,
    this.tradingPair,
    this.contractType,
    required this.modelType,
    this.timeInterval,
    required this.valueCurrency,
    required this.fetchedAt,
    this.effectiveFrom,
    this.effectiveTo,
    required this.yAxis,
    required this.liquidationLeverageData,
    required this.priceCandlesticks,
  }) : super._();
  @override
  LiquidationHeatmapResponseDto rebuild(
    void Function(LiquidationHeatmapResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  LiquidationHeatmapResponseDtoBuilder toBuilder() =>
      LiquidationHeatmapResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is LiquidationHeatmapResponseDto &&
        snapshotId == other.snapshotId &&
        symbol == other.symbol &&
        exchangeCode == other.exchangeCode &&
        tradingPair == other.tradingPair &&
        contractType == other.contractType &&
        modelType == other.modelType &&
        timeInterval == other.timeInterval &&
        valueCurrency == other.valueCurrency &&
        fetchedAt == other.fetchedAt &&
        effectiveFrom == other.effectiveFrom &&
        effectiveTo == other.effectiveTo &&
        yAxis == other.yAxis &&
        liquidationLeverageData == other.liquidationLeverageData &&
        priceCandlesticks == other.priceCandlesticks;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, snapshotId.hashCode);
    _$hash = $jc(_$hash, symbol.hashCode);
    _$hash = $jc(_$hash, exchangeCode.hashCode);
    _$hash = $jc(_$hash, tradingPair.hashCode);
    _$hash = $jc(_$hash, contractType.hashCode);
    _$hash = $jc(_$hash, modelType.hashCode);
    _$hash = $jc(_$hash, timeInterval.hashCode);
    _$hash = $jc(_$hash, valueCurrency.hashCode);
    _$hash = $jc(_$hash, fetchedAt.hashCode);
    _$hash = $jc(_$hash, effectiveFrom.hashCode);
    _$hash = $jc(_$hash, effectiveTo.hashCode);
    _$hash = $jc(_$hash, yAxis.hashCode);
    _$hash = $jc(_$hash, liquidationLeverageData.hashCode);
    _$hash = $jc(_$hash, priceCandlesticks.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'LiquidationHeatmapResponseDto')
          ..add('snapshotId', snapshotId)
          ..add('symbol', symbol)
          ..add('exchangeCode', exchangeCode)
          ..add('tradingPair', tradingPair)
          ..add('contractType', contractType)
          ..add('modelType', modelType)
          ..add('timeInterval', timeInterval)
          ..add('valueCurrency', valueCurrency)
          ..add('fetchedAt', fetchedAt)
          ..add('effectiveFrom', effectiveFrom)
          ..add('effectiveTo', effectiveTo)
          ..add('yAxis', yAxis)
          ..add('liquidationLeverageData', liquidationLeverageData)
          ..add('priceCandlesticks', priceCandlesticks))
        .toString();
  }
}

class LiquidationHeatmapResponseDtoBuilder
    implements
        Builder<
          LiquidationHeatmapResponseDto,
          LiquidationHeatmapResponseDtoBuilder
        > {
  _$LiquidationHeatmapResponseDto? _$v;

  num? _snapshotId;
  num? get snapshotId => _$this._snapshotId;
  set snapshotId(num? snapshotId) => _$this._snapshotId = snapshotId;

  String? _symbol;
  String? get symbol => _$this._symbol;
  set symbol(String? symbol) => _$this._symbol = symbol;

  String? _exchangeCode;
  String? get exchangeCode => _$this._exchangeCode;
  set exchangeCode(String? exchangeCode) => _$this._exchangeCode = exchangeCode;

  String? _tradingPair;
  String? get tradingPair => _$this._tradingPair;
  set tradingPair(String? tradingPair) => _$this._tradingPair = tradingPair;

  String? _contractType;
  String? get contractType => _$this._contractType;
  set contractType(String? contractType) => _$this._contractType = contractType;

  LiquidationHeatmapResponseDtoModelTypeEnum? _modelType;
  LiquidationHeatmapResponseDtoModelTypeEnum? get modelType =>
      _$this._modelType;
  set modelType(LiquidationHeatmapResponseDtoModelTypeEnum? modelType) =>
      _$this._modelType = modelType;

  String? _timeInterval;
  String? get timeInterval => _$this._timeInterval;
  set timeInterval(String? timeInterval) => _$this._timeInterval = timeInterval;

  String? _valueCurrency;
  String? get valueCurrency => _$this._valueCurrency;
  set valueCurrency(String? valueCurrency) =>
      _$this._valueCurrency = valueCurrency;

  DateTime? _fetchedAt;
  DateTime? get fetchedAt => _$this._fetchedAt;
  set fetchedAt(DateTime? fetchedAt) => _$this._fetchedAt = fetchedAt;

  DateTime? _effectiveFrom;
  DateTime? get effectiveFrom => _$this._effectiveFrom;
  set effectiveFrom(DateTime? effectiveFrom) =>
      _$this._effectiveFrom = effectiveFrom;

  DateTime? _effectiveTo;
  DateTime? get effectiveTo => _$this._effectiveTo;
  set effectiveTo(DateTime? effectiveTo) => _$this._effectiveTo = effectiveTo;

  ListBuilder<num>? _yAxis;
  ListBuilder<num> get yAxis => _$this._yAxis ??= ListBuilder<num>();
  set yAxis(ListBuilder<num>? yAxis) => _$this._yAxis = yAxis;

  ListBuilder<BuiltList<num>>? _liquidationLeverageData;
  ListBuilder<BuiltList<num>> get liquidationLeverageData =>
      _$this._liquidationLeverageData ??= ListBuilder<BuiltList<num>>();
  set liquidationLeverageData(
    ListBuilder<BuiltList<num>>? liquidationLeverageData,
  ) => _$this._liquidationLeverageData = liquidationLeverageData;

  ListBuilder<
    BuiltList<LiquidationHeatmapResponseDtoPriceCandlesticksInnerInner>
  >?
  _priceCandlesticks;
  ListBuilder<
    BuiltList<LiquidationHeatmapResponseDtoPriceCandlesticksInnerInner>
  >
  get priceCandlesticks => _$this._priceCandlesticks ??=
      ListBuilder<
        BuiltList<LiquidationHeatmapResponseDtoPriceCandlesticksInnerInner>
      >();
  set priceCandlesticks(
    ListBuilder<
      BuiltList<LiquidationHeatmapResponseDtoPriceCandlesticksInnerInner>
    >?
    priceCandlesticks,
  ) => _$this._priceCandlesticks = priceCandlesticks;

  LiquidationHeatmapResponseDtoBuilder() {
    LiquidationHeatmapResponseDto._defaults(this);
  }

  LiquidationHeatmapResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _snapshotId = $v.snapshotId;
      _symbol = $v.symbol;
      _exchangeCode = $v.exchangeCode;
      _tradingPair = $v.tradingPair;
      _contractType = $v.contractType;
      _modelType = $v.modelType;
      _timeInterval = $v.timeInterval;
      _valueCurrency = $v.valueCurrency;
      _fetchedAt = $v.fetchedAt;
      _effectiveFrom = $v.effectiveFrom;
      _effectiveTo = $v.effectiveTo;
      _yAxis = $v.yAxis.toBuilder();
      _liquidationLeverageData = $v.liquidationLeverageData.toBuilder();
      _priceCandlesticks = $v.priceCandlesticks.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(LiquidationHeatmapResponseDto other) {
    _$v = other as _$LiquidationHeatmapResponseDto;
  }

  @override
  void update(void Function(LiquidationHeatmapResponseDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  LiquidationHeatmapResponseDto build() => _build();

  _$LiquidationHeatmapResponseDto _build() {
    _$LiquidationHeatmapResponseDto _$result;
    try {
      _$result =
          _$v ??
          _$LiquidationHeatmapResponseDto._(
            snapshotId: BuiltValueNullFieldError.checkNotNull(
              snapshotId,
              r'LiquidationHeatmapResponseDto',
              'snapshotId',
            ),
            symbol: BuiltValueNullFieldError.checkNotNull(
              symbol,
              r'LiquidationHeatmapResponseDto',
              'symbol',
            ),
            exchangeCode: exchangeCode,
            tradingPair: tradingPair,
            contractType: contractType,
            modelType: BuiltValueNullFieldError.checkNotNull(
              modelType,
              r'LiquidationHeatmapResponseDto',
              'modelType',
            ),
            timeInterval: timeInterval,
            valueCurrency: BuiltValueNullFieldError.checkNotNull(
              valueCurrency,
              r'LiquidationHeatmapResponseDto',
              'valueCurrency',
            ),
            fetchedAt: BuiltValueNullFieldError.checkNotNull(
              fetchedAt,
              r'LiquidationHeatmapResponseDto',
              'fetchedAt',
            ),
            effectiveFrom: effectiveFrom,
            effectiveTo: effectiveTo,
            yAxis: yAxis.build(),
            liquidationLeverageData: liquidationLeverageData.build(),
            priceCandlesticks: priceCandlesticks.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'yAxis';
        yAxis.build();
        _$failedField = 'liquidationLeverageData';
        liquidationLeverageData.build();
        _$failedField = 'priceCandlesticks';
        priceCandlesticks.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'LiquidationHeatmapResponseDto',
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
