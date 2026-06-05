// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'backtesting_create_job_input_summary_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const BacktestingCreateJobInputSummaryDtoMarketTypeEnum
_$backtestingCreateJobInputSummaryDtoMarketTypeEnum_spot =
    const BacktestingCreateJobInputSummaryDtoMarketTypeEnum._('spot');
const BacktestingCreateJobInputSummaryDtoMarketTypeEnum
_$backtestingCreateJobInputSummaryDtoMarketTypeEnum_perp =
    const BacktestingCreateJobInputSummaryDtoMarketTypeEnum._('perp');

BacktestingCreateJobInputSummaryDtoMarketTypeEnum
_$backtestingCreateJobInputSummaryDtoMarketTypeEnumValueOf(String name) {
  switch (name) {
    case 'spot':
      return _$backtestingCreateJobInputSummaryDtoMarketTypeEnum_spot;
    case 'perp':
      return _$backtestingCreateJobInputSummaryDtoMarketTypeEnum_perp;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<BacktestingCreateJobInputSummaryDtoMarketTypeEnum>
_$backtestingCreateJobInputSummaryDtoMarketTypeEnumValues =
    BuiltSet<BacktestingCreateJobInputSummaryDtoMarketTypeEnum>(
      const <BacktestingCreateJobInputSummaryDtoMarketTypeEnum>[
        _$backtestingCreateJobInputSummaryDtoMarketTypeEnum_spot,
        _$backtestingCreateJobInputSummaryDtoMarketTypeEnum_perp,
      ],
    );

Serializer<BacktestingCreateJobInputSummaryDtoMarketTypeEnum>
_$backtestingCreateJobInputSummaryDtoMarketTypeEnumSerializer =
    _$BacktestingCreateJobInputSummaryDtoMarketTypeEnumSerializer();

class _$BacktestingCreateJobInputSummaryDtoMarketTypeEnumSerializer
    implements
        PrimitiveSerializer<BacktestingCreateJobInputSummaryDtoMarketTypeEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'spot': 'spot',
    'perp': 'perp',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'spot': 'spot',
    'perp': 'perp',
  };

  @override
  final Iterable<Type> types = const <Type>[
    BacktestingCreateJobInputSummaryDtoMarketTypeEnum,
  ];
  @override
  final String wireName = 'BacktestingCreateJobInputSummaryDtoMarketTypeEnum';

  @override
  Object serialize(
    Serializers serializers,
    BacktestingCreateJobInputSummaryDtoMarketTypeEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  BacktestingCreateJobInputSummaryDtoMarketTypeEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => BacktestingCreateJobInputSummaryDtoMarketTypeEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$BacktestingCreateJobInputSummaryDto
    extends BacktestingCreateJobInputSummaryDto {
  @override
  final BuiltList<String> symbols;
  @override
  final String baseTimeframe;
  @override
  final BuiltList<String> stateTimeframes;
  @override
  final num initialCash;
  @override
  final num? leverage;
  @override
  final BacktestingCreateJobInputSummaryDtoMarketTypeEnum marketType;
  @override
  final BacktestingCreateJobRangeDto dataRange;
  @override
  final BacktestingCreateJobRangeDto requestedRange;
  @override
  final BacktestingCreateJobRangeDto? appliedRange;
  @override
  final bool allowPartial;
  @override
  final bool isPartial;
  @override
  final String strategyId;
  @override
  final String? strategyInstanceId;
  @override
  final String? strategyTemplateId;
  @override
  final String? snapshotId;
  @override
  final String? snapshotHash;
  @override
  final String? scriptHash;
  @override
  final String? specHash;

  factory _$BacktestingCreateJobInputSummaryDto([
    void Function(BacktestingCreateJobInputSummaryDtoBuilder)? updates,
  ]) =>
      (BacktestingCreateJobInputSummaryDtoBuilder()..update(updates))._build();

  _$BacktestingCreateJobInputSummaryDto._({
    required this.symbols,
    required this.baseTimeframe,
    required this.stateTimeframes,
    required this.initialCash,
    this.leverage,
    required this.marketType,
    required this.dataRange,
    required this.requestedRange,
    this.appliedRange,
    required this.allowPartial,
    required this.isPartial,
    required this.strategyId,
    this.strategyInstanceId,
    this.strategyTemplateId,
    this.snapshotId,
    this.snapshotHash,
    this.scriptHash,
    this.specHash,
  }) : super._();
  @override
  BacktestingCreateJobInputSummaryDto rebuild(
    void Function(BacktestingCreateJobInputSummaryDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  BacktestingCreateJobInputSummaryDtoBuilder toBuilder() =>
      BacktestingCreateJobInputSummaryDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is BacktestingCreateJobInputSummaryDto &&
        symbols == other.symbols &&
        baseTimeframe == other.baseTimeframe &&
        stateTimeframes == other.stateTimeframes &&
        initialCash == other.initialCash &&
        leverage == other.leverage &&
        marketType == other.marketType &&
        dataRange == other.dataRange &&
        requestedRange == other.requestedRange &&
        appliedRange == other.appliedRange &&
        allowPartial == other.allowPartial &&
        isPartial == other.isPartial &&
        strategyId == other.strategyId &&
        strategyInstanceId == other.strategyInstanceId &&
        strategyTemplateId == other.strategyTemplateId &&
        snapshotId == other.snapshotId &&
        snapshotHash == other.snapshotHash &&
        scriptHash == other.scriptHash &&
        specHash == other.specHash;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, symbols.hashCode);
    _$hash = $jc(_$hash, baseTimeframe.hashCode);
    _$hash = $jc(_$hash, stateTimeframes.hashCode);
    _$hash = $jc(_$hash, initialCash.hashCode);
    _$hash = $jc(_$hash, leverage.hashCode);
    _$hash = $jc(_$hash, marketType.hashCode);
    _$hash = $jc(_$hash, dataRange.hashCode);
    _$hash = $jc(_$hash, requestedRange.hashCode);
    _$hash = $jc(_$hash, appliedRange.hashCode);
    _$hash = $jc(_$hash, allowPartial.hashCode);
    _$hash = $jc(_$hash, isPartial.hashCode);
    _$hash = $jc(_$hash, strategyId.hashCode);
    _$hash = $jc(_$hash, strategyInstanceId.hashCode);
    _$hash = $jc(_$hash, strategyTemplateId.hashCode);
    _$hash = $jc(_$hash, snapshotId.hashCode);
    _$hash = $jc(_$hash, snapshotHash.hashCode);
    _$hash = $jc(_$hash, scriptHash.hashCode);
    _$hash = $jc(_$hash, specHash.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'BacktestingCreateJobInputSummaryDto')
          ..add('symbols', symbols)
          ..add('baseTimeframe', baseTimeframe)
          ..add('stateTimeframes', stateTimeframes)
          ..add('initialCash', initialCash)
          ..add('leverage', leverage)
          ..add('marketType', marketType)
          ..add('dataRange', dataRange)
          ..add('requestedRange', requestedRange)
          ..add('appliedRange', appliedRange)
          ..add('allowPartial', allowPartial)
          ..add('isPartial', isPartial)
          ..add('strategyId', strategyId)
          ..add('strategyInstanceId', strategyInstanceId)
          ..add('strategyTemplateId', strategyTemplateId)
          ..add('snapshotId', snapshotId)
          ..add('snapshotHash', snapshotHash)
          ..add('scriptHash', scriptHash)
          ..add('specHash', specHash))
        .toString();
  }
}

class BacktestingCreateJobInputSummaryDtoBuilder
    implements
        Builder<
          BacktestingCreateJobInputSummaryDto,
          BacktestingCreateJobInputSummaryDtoBuilder
        > {
  _$BacktestingCreateJobInputSummaryDto? _$v;

  ListBuilder<String>? _symbols;
  ListBuilder<String> get symbols => _$this._symbols ??= ListBuilder<String>();
  set symbols(ListBuilder<String>? symbols) => _$this._symbols = symbols;

  String? _baseTimeframe;
  String? get baseTimeframe => _$this._baseTimeframe;
  set baseTimeframe(String? baseTimeframe) =>
      _$this._baseTimeframe = baseTimeframe;

  ListBuilder<String>? _stateTimeframes;
  ListBuilder<String> get stateTimeframes =>
      _$this._stateTimeframes ??= ListBuilder<String>();
  set stateTimeframes(ListBuilder<String>? stateTimeframes) =>
      _$this._stateTimeframes = stateTimeframes;

  num? _initialCash;
  num? get initialCash => _$this._initialCash;
  set initialCash(num? initialCash) => _$this._initialCash = initialCash;

  num? _leverage;
  num? get leverage => _$this._leverage;
  set leverage(num? leverage) => _$this._leverage = leverage;

  BacktestingCreateJobInputSummaryDtoMarketTypeEnum? _marketType;
  BacktestingCreateJobInputSummaryDtoMarketTypeEnum? get marketType =>
      _$this._marketType;
  set marketType(
    BacktestingCreateJobInputSummaryDtoMarketTypeEnum? marketType,
  ) => _$this._marketType = marketType;

  BacktestingCreateJobRangeDtoBuilder? _dataRange;
  BacktestingCreateJobRangeDtoBuilder get dataRange =>
      _$this._dataRange ??= BacktestingCreateJobRangeDtoBuilder();
  set dataRange(BacktestingCreateJobRangeDtoBuilder? dataRange) =>
      _$this._dataRange = dataRange;

  BacktestingCreateJobRangeDtoBuilder? _requestedRange;
  BacktestingCreateJobRangeDtoBuilder get requestedRange =>
      _$this._requestedRange ??= BacktestingCreateJobRangeDtoBuilder();
  set requestedRange(BacktestingCreateJobRangeDtoBuilder? requestedRange) =>
      _$this._requestedRange = requestedRange;

  BacktestingCreateJobRangeDtoBuilder? _appliedRange;
  BacktestingCreateJobRangeDtoBuilder get appliedRange =>
      _$this._appliedRange ??= BacktestingCreateJobRangeDtoBuilder();
  set appliedRange(BacktestingCreateJobRangeDtoBuilder? appliedRange) =>
      _$this._appliedRange = appliedRange;

  bool? _allowPartial;
  bool? get allowPartial => _$this._allowPartial;
  set allowPartial(bool? allowPartial) => _$this._allowPartial = allowPartial;

  bool? _isPartial;
  bool? get isPartial => _$this._isPartial;
  set isPartial(bool? isPartial) => _$this._isPartial = isPartial;

  String? _strategyId;
  String? get strategyId => _$this._strategyId;
  set strategyId(String? strategyId) => _$this._strategyId = strategyId;

  String? _strategyInstanceId;
  String? get strategyInstanceId => _$this._strategyInstanceId;
  set strategyInstanceId(String? strategyInstanceId) =>
      _$this._strategyInstanceId = strategyInstanceId;

  String? _strategyTemplateId;
  String? get strategyTemplateId => _$this._strategyTemplateId;
  set strategyTemplateId(String? strategyTemplateId) =>
      _$this._strategyTemplateId = strategyTemplateId;

  String? _snapshotId;
  String? get snapshotId => _$this._snapshotId;
  set snapshotId(String? snapshotId) => _$this._snapshotId = snapshotId;

  String? _snapshotHash;
  String? get snapshotHash => _$this._snapshotHash;
  set snapshotHash(String? snapshotHash) => _$this._snapshotHash = snapshotHash;

  String? _scriptHash;
  String? get scriptHash => _$this._scriptHash;
  set scriptHash(String? scriptHash) => _$this._scriptHash = scriptHash;

  String? _specHash;
  String? get specHash => _$this._specHash;
  set specHash(String? specHash) => _$this._specHash = specHash;

  BacktestingCreateJobInputSummaryDtoBuilder() {
    BacktestingCreateJobInputSummaryDto._defaults(this);
  }

  BacktestingCreateJobInputSummaryDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _symbols = $v.symbols.toBuilder();
      _baseTimeframe = $v.baseTimeframe;
      _stateTimeframes = $v.stateTimeframes.toBuilder();
      _initialCash = $v.initialCash;
      _leverage = $v.leverage;
      _marketType = $v.marketType;
      _dataRange = $v.dataRange.toBuilder();
      _requestedRange = $v.requestedRange.toBuilder();
      _appliedRange = $v.appliedRange?.toBuilder();
      _allowPartial = $v.allowPartial;
      _isPartial = $v.isPartial;
      _strategyId = $v.strategyId;
      _strategyInstanceId = $v.strategyInstanceId;
      _strategyTemplateId = $v.strategyTemplateId;
      _snapshotId = $v.snapshotId;
      _snapshotHash = $v.snapshotHash;
      _scriptHash = $v.scriptHash;
      _specHash = $v.specHash;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(BacktestingCreateJobInputSummaryDto other) {
    _$v = other as _$BacktestingCreateJobInputSummaryDto;
  }

  @override
  void update(
    void Function(BacktestingCreateJobInputSummaryDtoBuilder)? updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  BacktestingCreateJobInputSummaryDto build() => _build();

  _$BacktestingCreateJobInputSummaryDto _build() {
    _$BacktestingCreateJobInputSummaryDto _$result;
    try {
      _$result =
          _$v ??
          _$BacktestingCreateJobInputSummaryDto._(
            symbols: symbols.build(),
            baseTimeframe: BuiltValueNullFieldError.checkNotNull(
              baseTimeframe,
              r'BacktestingCreateJobInputSummaryDto',
              'baseTimeframe',
            ),
            stateTimeframes: stateTimeframes.build(),
            initialCash: BuiltValueNullFieldError.checkNotNull(
              initialCash,
              r'BacktestingCreateJobInputSummaryDto',
              'initialCash',
            ),
            leverage: leverage,
            marketType: BuiltValueNullFieldError.checkNotNull(
              marketType,
              r'BacktestingCreateJobInputSummaryDto',
              'marketType',
            ),
            dataRange: dataRange.build(),
            requestedRange: requestedRange.build(),
            appliedRange: _appliedRange?.build(),
            allowPartial: BuiltValueNullFieldError.checkNotNull(
              allowPartial,
              r'BacktestingCreateJobInputSummaryDto',
              'allowPartial',
            ),
            isPartial: BuiltValueNullFieldError.checkNotNull(
              isPartial,
              r'BacktestingCreateJobInputSummaryDto',
              'isPartial',
            ),
            strategyId: BuiltValueNullFieldError.checkNotNull(
              strategyId,
              r'BacktestingCreateJobInputSummaryDto',
              'strategyId',
            ),
            strategyInstanceId: strategyInstanceId,
            strategyTemplateId: strategyTemplateId,
            snapshotId: snapshotId,
            snapshotHash: snapshotHash,
            scriptHash: scriptHash,
            specHash: specHash,
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'symbols';
        symbols.build();

        _$failedField = 'stateTimeframes';
        stateTimeframes.build();

        _$failedField = 'dataRange';
        dataRange.build();
        _$failedField = 'requestedRange';
        requestedRange.build();
        _$failedField = 'appliedRange';
        _appliedRange?.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'BacktestingCreateJobInputSummaryDto',
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
