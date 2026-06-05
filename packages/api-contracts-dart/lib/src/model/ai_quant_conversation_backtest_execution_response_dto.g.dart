// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'ai_quant_conversation_backtest_execution_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const AiQuantConversationBacktestExecutionResponseDtoPriceSourceEnum
_$aiQuantConversationBacktestExecutionResponseDtoPriceSourceEnum_open =
    const AiQuantConversationBacktestExecutionResponseDtoPriceSourceEnum._(
      'open',
    );
const AiQuantConversationBacktestExecutionResponseDtoPriceSourceEnum
_$aiQuantConversationBacktestExecutionResponseDtoPriceSourceEnum_close =
    const AiQuantConversationBacktestExecutionResponseDtoPriceSourceEnum._(
      'close',
    );
const AiQuantConversationBacktestExecutionResponseDtoPriceSourceEnum
_$aiQuantConversationBacktestExecutionResponseDtoPriceSourceEnum_mid =
    const AiQuantConversationBacktestExecutionResponseDtoPriceSourceEnum._(
      'mid',
    );

AiQuantConversationBacktestExecutionResponseDtoPriceSourceEnum
_$aiQuantConversationBacktestExecutionResponseDtoPriceSourceEnumValueOf(
  String name,
) {
  switch (name) {
    case 'open':
      return _$aiQuantConversationBacktestExecutionResponseDtoPriceSourceEnum_open;
    case 'close':
      return _$aiQuantConversationBacktestExecutionResponseDtoPriceSourceEnum_close;
    case 'mid':
      return _$aiQuantConversationBacktestExecutionResponseDtoPriceSourceEnum_mid;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<AiQuantConversationBacktestExecutionResponseDtoPriceSourceEnum>
_$aiQuantConversationBacktestExecutionResponseDtoPriceSourceEnumValues =
    BuiltSet<AiQuantConversationBacktestExecutionResponseDtoPriceSourceEnum>(
      const <AiQuantConversationBacktestExecutionResponseDtoPriceSourceEnum>[
        _$aiQuantConversationBacktestExecutionResponseDtoPriceSourceEnum_open,
        _$aiQuantConversationBacktestExecutionResponseDtoPriceSourceEnum_close,
        _$aiQuantConversationBacktestExecutionResponseDtoPriceSourceEnum_mid,
      ],
    );

Serializer<AiQuantConversationBacktestExecutionResponseDtoPriceSourceEnum>
_$aiQuantConversationBacktestExecutionResponseDtoPriceSourceEnumSerializer =
    _$AiQuantConversationBacktestExecutionResponseDtoPriceSourceEnumSerializer();

class _$AiQuantConversationBacktestExecutionResponseDtoPriceSourceEnumSerializer
    implements
        PrimitiveSerializer<
          AiQuantConversationBacktestExecutionResponseDtoPriceSourceEnum
        > {
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
    AiQuantConversationBacktestExecutionResponseDtoPriceSourceEnum,
  ];
  @override
  final String wireName =
      'AiQuantConversationBacktestExecutionResponseDtoPriceSourceEnum';

  @override
  Object serialize(
    Serializers serializers,
    AiQuantConversationBacktestExecutionResponseDtoPriceSourceEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  AiQuantConversationBacktestExecutionResponseDtoPriceSourceEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => AiQuantConversationBacktestExecutionResponseDtoPriceSourceEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$AiQuantConversationBacktestExecutionResponseDto
    extends AiQuantConversationBacktestExecutionResponseDto {
  @override
  final num initialCash;
  @override
  final num? leverage;
  @override
  final num slippageBps;
  @override
  final num feeBps;
  @override
  final AiQuantConversationBacktestExecutionResponseDtoPriceSourceEnum
  priceSource;
  @override
  final bool allowPartial;

  factory _$AiQuantConversationBacktestExecutionResponseDto([
    void Function(AiQuantConversationBacktestExecutionResponseDtoBuilder)?
    updates,
  ]) =>
      (AiQuantConversationBacktestExecutionResponseDtoBuilder()
            ..update(updates))
          ._build();

  _$AiQuantConversationBacktestExecutionResponseDto._({
    required this.initialCash,
    this.leverage,
    required this.slippageBps,
    required this.feeBps,
    required this.priceSource,
    required this.allowPartial,
  }) : super._();
  @override
  AiQuantConversationBacktestExecutionResponseDto rebuild(
    void Function(AiQuantConversationBacktestExecutionResponseDtoBuilder)
    updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AiQuantConversationBacktestExecutionResponseDtoBuilder toBuilder() =>
      AiQuantConversationBacktestExecutionResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AiQuantConversationBacktestExecutionResponseDto &&
        initialCash == other.initialCash &&
        leverage == other.leverage &&
        slippageBps == other.slippageBps &&
        feeBps == other.feeBps &&
        priceSource == other.priceSource &&
        allowPartial == other.allowPartial;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, initialCash.hashCode);
    _$hash = $jc(_$hash, leverage.hashCode);
    _$hash = $jc(_$hash, slippageBps.hashCode);
    _$hash = $jc(_$hash, feeBps.hashCode);
    _$hash = $jc(_$hash, priceSource.hashCode);
    _$hash = $jc(_$hash, allowPartial.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(
            r'AiQuantConversationBacktestExecutionResponseDto',
          )
          ..add('initialCash', initialCash)
          ..add('leverage', leverage)
          ..add('slippageBps', slippageBps)
          ..add('feeBps', feeBps)
          ..add('priceSource', priceSource)
          ..add('allowPartial', allowPartial))
        .toString();
  }
}

class AiQuantConversationBacktestExecutionResponseDtoBuilder
    implements
        Builder<
          AiQuantConversationBacktestExecutionResponseDto,
          AiQuantConversationBacktestExecutionResponseDtoBuilder
        > {
  _$AiQuantConversationBacktestExecutionResponseDto? _$v;

  num? _initialCash;
  num? get initialCash => _$this._initialCash;
  set initialCash(num? initialCash) => _$this._initialCash = initialCash;

  num? _leverage;
  num? get leverage => _$this._leverage;
  set leverage(num? leverage) => _$this._leverage = leverage;

  num? _slippageBps;
  num? get slippageBps => _$this._slippageBps;
  set slippageBps(num? slippageBps) => _$this._slippageBps = slippageBps;

  num? _feeBps;
  num? get feeBps => _$this._feeBps;
  set feeBps(num? feeBps) => _$this._feeBps = feeBps;

  AiQuantConversationBacktestExecutionResponseDtoPriceSourceEnum? _priceSource;
  AiQuantConversationBacktestExecutionResponseDtoPriceSourceEnum?
  get priceSource => _$this._priceSource;
  set priceSource(
    AiQuantConversationBacktestExecutionResponseDtoPriceSourceEnum? priceSource,
  ) => _$this._priceSource = priceSource;

  bool? _allowPartial;
  bool? get allowPartial => _$this._allowPartial;
  set allowPartial(bool? allowPartial) => _$this._allowPartial = allowPartial;

  AiQuantConversationBacktestExecutionResponseDtoBuilder() {
    AiQuantConversationBacktestExecutionResponseDto._defaults(this);
  }

  AiQuantConversationBacktestExecutionResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _initialCash = $v.initialCash;
      _leverage = $v.leverage;
      _slippageBps = $v.slippageBps;
      _feeBps = $v.feeBps;
      _priceSource = $v.priceSource;
      _allowPartial = $v.allowPartial;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AiQuantConversationBacktestExecutionResponseDto other) {
    _$v = other as _$AiQuantConversationBacktestExecutionResponseDto;
  }

  @override
  void update(
    void Function(AiQuantConversationBacktestExecutionResponseDtoBuilder)?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  AiQuantConversationBacktestExecutionResponseDto build() => _build();

  _$AiQuantConversationBacktestExecutionResponseDto _build() {
    final _$result =
        _$v ??
        _$AiQuantConversationBacktestExecutionResponseDto._(
          initialCash: BuiltValueNullFieldError.checkNotNull(
            initialCash,
            r'AiQuantConversationBacktestExecutionResponseDto',
            'initialCash',
          ),
          leverage: leverage,
          slippageBps: BuiltValueNullFieldError.checkNotNull(
            slippageBps,
            r'AiQuantConversationBacktestExecutionResponseDto',
            'slippageBps',
          ),
          feeBps: BuiltValueNullFieldError.checkNotNull(
            feeBps,
            r'AiQuantConversationBacktestExecutionResponseDto',
            'feeBps',
          ),
          priceSource: BuiltValueNullFieldError.checkNotNull(
            priceSource,
            r'AiQuantConversationBacktestExecutionResponseDto',
            'priceSource',
          ),
          allowPartial: BuiltValueNullFieldError.checkNotNull(
            allowPartial,
            r'AiQuantConversationBacktestExecutionResponseDto',
            'allowPartial',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
