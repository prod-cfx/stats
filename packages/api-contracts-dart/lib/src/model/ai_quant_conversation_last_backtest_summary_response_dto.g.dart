// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'ai_quant_conversation_last_backtest_summary_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const AiQuantConversationLastBacktestSummaryResponseDtoMarketTypeEnum
_$aiQuantConversationLastBacktestSummaryResponseDtoMarketTypeEnum_spot =
    const AiQuantConversationLastBacktestSummaryResponseDtoMarketTypeEnum._(
      'spot',
    );
const AiQuantConversationLastBacktestSummaryResponseDtoMarketTypeEnum
_$aiQuantConversationLastBacktestSummaryResponseDtoMarketTypeEnum_perp =
    const AiQuantConversationLastBacktestSummaryResponseDtoMarketTypeEnum._(
      'perp',
    );

AiQuantConversationLastBacktestSummaryResponseDtoMarketTypeEnum
_$aiQuantConversationLastBacktestSummaryResponseDtoMarketTypeEnumValueOf(
  String name,
) {
  switch (name) {
    case 'spot':
      return _$aiQuantConversationLastBacktestSummaryResponseDtoMarketTypeEnum_spot;
    case 'perp':
      return _$aiQuantConversationLastBacktestSummaryResponseDtoMarketTypeEnum_perp;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<AiQuantConversationLastBacktestSummaryResponseDtoMarketTypeEnum>
_$aiQuantConversationLastBacktestSummaryResponseDtoMarketTypeEnumValues =
    BuiltSet<AiQuantConversationLastBacktestSummaryResponseDtoMarketTypeEnum>(
      const <AiQuantConversationLastBacktestSummaryResponseDtoMarketTypeEnum>[
        _$aiQuantConversationLastBacktestSummaryResponseDtoMarketTypeEnum_spot,
        _$aiQuantConversationLastBacktestSummaryResponseDtoMarketTypeEnum_perp,
      ],
    );

Serializer<AiQuantConversationLastBacktestSummaryResponseDtoMarketTypeEnum>
_$aiQuantConversationLastBacktestSummaryResponseDtoMarketTypeEnumSerializer =
    _$AiQuantConversationLastBacktestSummaryResponseDtoMarketTypeEnumSerializer();

class _$AiQuantConversationLastBacktestSummaryResponseDtoMarketTypeEnumSerializer
    implements
        PrimitiveSerializer<
          AiQuantConversationLastBacktestSummaryResponseDtoMarketTypeEnum
        > {
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
    AiQuantConversationLastBacktestSummaryResponseDtoMarketTypeEnum,
  ];
  @override
  final String wireName =
      'AiQuantConversationLastBacktestSummaryResponseDtoMarketTypeEnum';

  @override
  Object serialize(
    Serializers serializers,
    AiQuantConversationLastBacktestSummaryResponseDtoMarketTypeEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  AiQuantConversationLastBacktestSummaryResponseDtoMarketTypeEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => AiQuantConversationLastBacktestSummaryResponseDtoMarketTypeEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$AiQuantConversationLastBacktestSummaryResponseDto
    extends AiQuantConversationLastBacktestSummaryResponseDto {
  @override
  final num maxDrawdownPct;
  @override
  final num totalReturnPct;
  @override
  final num winRatePct;
  @override
  final num tradeCount;
  @override
  final num? openTradeCount;
  @override
  final num? openPnl;
  @override
  final AiQuantConversationLastBacktestSummaryResponseDtoMarketTypeEnum?
  marketType;

  factory _$AiQuantConversationLastBacktestSummaryResponseDto([
    void Function(AiQuantConversationLastBacktestSummaryResponseDtoBuilder)?
    updates,
  ]) =>
      (AiQuantConversationLastBacktestSummaryResponseDtoBuilder()
            ..update(updates))
          ._build();

  _$AiQuantConversationLastBacktestSummaryResponseDto._({
    required this.maxDrawdownPct,
    required this.totalReturnPct,
    required this.winRatePct,
    required this.tradeCount,
    this.openTradeCount,
    this.openPnl,
    this.marketType,
  }) : super._();
  @override
  AiQuantConversationLastBacktestSummaryResponseDto rebuild(
    void Function(AiQuantConversationLastBacktestSummaryResponseDtoBuilder)
    updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AiQuantConversationLastBacktestSummaryResponseDtoBuilder toBuilder() =>
      AiQuantConversationLastBacktestSummaryResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AiQuantConversationLastBacktestSummaryResponseDto &&
        maxDrawdownPct == other.maxDrawdownPct &&
        totalReturnPct == other.totalReturnPct &&
        winRatePct == other.winRatePct &&
        tradeCount == other.tradeCount &&
        openTradeCount == other.openTradeCount &&
        openPnl == other.openPnl &&
        marketType == other.marketType;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, maxDrawdownPct.hashCode);
    _$hash = $jc(_$hash, totalReturnPct.hashCode);
    _$hash = $jc(_$hash, winRatePct.hashCode);
    _$hash = $jc(_$hash, tradeCount.hashCode);
    _$hash = $jc(_$hash, openTradeCount.hashCode);
    _$hash = $jc(_$hash, openPnl.hashCode);
    _$hash = $jc(_$hash, marketType.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(
            r'AiQuantConversationLastBacktestSummaryResponseDto',
          )
          ..add('maxDrawdownPct', maxDrawdownPct)
          ..add('totalReturnPct', totalReturnPct)
          ..add('winRatePct', winRatePct)
          ..add('tradeCount', tradeCount)
          ..add('openTradeCount', openTradeCount)
          ..add('openPnl', openPnl)
          ..add('marketType', marketType))
        .toString();
  }
}

class AiQuantConversationLastBacktestSummaryResponseDtoBuilder
    implements
        Builder<
          AiQuantConversationLastBacktestSummaryResponseDto,
          AiQuantConversationLastBacktestSummaryResponseDtoBuilder
        > {
  _$AiQuantConversationLastBacktestSummaryResponseDto? _$v;

  num? _maxDrawdownPct;
  num? get maxDrawdownPct => _$this._maxDrawdownPct;
  set maxDrawdownPct(num? maxDrawdownPct) =>
      _$this._maxDrawdownPct = maxDrawdownPct;

  num? _totalReturnPct;
  num? get totalReturnPct => _$this._totalReturnPct;
  set totalReturnPct(num? totalReturnPct) =>
      _$this._totalReturnPct = totalReturnPct;

  num? _winRatePct;
  num? get winRatePct => _$this._winRatePct;
  set winRatePct(num? winRatePct) => _$this._winRatePct = winRatePct;

  num? _tradeCount;
  num? get tradeCount => _$this._tradeCount;
  set tradeCount(num? tradeCount) => _$this._tradeCount = tradeCount;

  num? _openTradeCount;
  num? get openTradeCount => _$this._openTradeCount;
  set openTradeCount(num? openTradeCount) =>
      _$this._openTradeCount = openTradeCount;

  num? _openPnl;
  num? get openPnl => _$this._openPnl;
  set openPnl(num? openPnl) => _$this._openPnl = openPnl;

  AiQuantConversationLastBacktestSummaryResponseDtoMarketTypeEnum? _marketType;
  AiQuantConversationLastBacktestSummaryResponseDtoMarketTypeEnum?
  get marketType => _$this._marketType;
  set marketType(
    AiQuantConversationLastBacktestSummaryResponseDtoMarketTypeEnum? marketType,
  ) => _$this._marketType = marketType;

  AiQuantConversationLastBacktestSummaryResponseDtoBuilder() {
    AiQuantConversationLastBacktestSummaryResponseDto._defaults(this);
  }

  AiQuantConversationLastBacktestSummaryResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _maxDrawdownPct = $v.maxDrawdownPct;
      _totalReturnPct = $v.totalReturnPct;
      _winRatePct = $v.winRatePct;
      _tradeCount = $v.tradeCount;
      _openTradeCount = $v.openTradeCount;
      _openPnl = $v.openPnl;
      _marketType = $v.marketType;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AiQuantConversationLastBacktestSummaryResponseDto other) {
    _$v = other as _$AiQuantConversationLastBacktestSummaryResponseDto;
  }

  @override
  void update(
    void Function(AiQuantConversationLastBacktestSummaryResponseDtoBuilder)?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  AiQuantConversationLastBacktestSummaryResponseDto build() => _build();

  _$AiQuantConversationLastBacktestSummaryResponseDto _build() {
    final _$result =
        _$v ??
        _$AiQuantConversationLastBacktestSummaryResponseDto._(
          maxDrawdownPct: BuiltValueNullFieldError.checkNotNull(
            maxDrawdownPct,
            r'AiQuantConversationLastBacktestSummaryResponseDto',
            'maxDrawdownPct',
          ),
          totalReturnPct: BuiltValueNullFieldError.checkNotNull(
            totalReturnPct,
            r'AiQuantConversationLastBacktestSummaryResponseDto',
            'totalReturnPct',
          ),
          winRatePct: BuiltValueNullFieldError.checkNotNull(
            winRatePct,
            r'AiQuantConversationLastBacktestSummaryResponseDto',
            'winRatePct',
          ),
          tradeCount: BuiltValueNullFieldError.checkNotNull(
            tradeCount,
            r'AiQuantConversationLastBacktestSummaryResponseDto',
            'tradeCount',
          ),
          openTradeCount: openTradeCount,
          openPnl: openPnl,
          marketType: marketType,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
