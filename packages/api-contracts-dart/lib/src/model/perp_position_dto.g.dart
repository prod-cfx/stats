// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'perp_position_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const PerpPositionDtoSideEnum _$perpPositionDtoSideEnum_LONG =
    const PerpPositionDtoSideEnum._('LONG');
const PerpPositionDtoSideEnum _$perpPositionDtoSideEnum_SHORT =
    const PerpPositionDtoSideEnum._('SHORT');

PerpPositionDtoSideEnum _$perpPositionDtoSideEnumValueOf(String name) {
  switch (name) {
    case 'LONG':
      return _$perpPositionDtoSideEnum_LONG;
    case 'SHORT':
      return _$perpPositionDtoSideEnum_SHORT;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<PerpPositionDtoSideEnum> _$perpPositionDtoSideEnumValues =
    BuiltSet<PerpPositionDtoSideEnum>(const <PerpPositionDtoSideEnum>[
      _$perpPositionDtoSideEnum_LONG,
      _$perpPositionDtoSideEnum_SHORT,
    ]);

Serializer<PerpPositionDtoSideEnum> _$perpPositionDtoSideEnumSerializer =
    _$PerpPositionDtoSideEnumSerializer();

class _$PerpPositionDtoSideEnumSerializer
    implements PrimitiveSerializer<PerpPositionDtoSideEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'LONG': 'LONG',
    'SHORT': 'SHORT',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'LONG': 'LONG',
    'SHORT': 'SHORT',
  };

  @override
  final Iterable<Type> types = const <Type>[PerpPositionDtoSideEnum];
  @override
  final String wireName = 'PerpPositionDtoSideEnum';

  @override
  Object serialize(
    Serializers serializers,
    PerpPositionDtoSideEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  PerpPositionDtoSideEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => PerpPositionDtoSideEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$PerpPositionDto extends PerpPositionDto {
  @override
  final String coin;
  @override
  final PerpPositionDtoSideEnum side;
  @override
  final num size;
  @override
  final num entryPrice;
  @override
  final num markPrice;
  @override
  final num liquidationPrice;
  @override
  final num positionValue;
  @override
  final num marginUsed;
  @override
  final LeverageDto leverage;
  @override
  final num unrealizedPnl;
  @override
  final num unrealizedPnlPercent;
  @override
  final num? fundingRate;
  @override
  final num roi;

  factory _$PerpPositionDto([void Function(PerpPositionDtoBuilder)? updates]) =>
      (PerpPositionDtoBuilder()..update(updates))._build();

  _$PerpPositionDto._({
    required this.coin,
    required this.side,
    required this.size,
    required this.entryPrice,
    required this.markPrice,
    required this.liquidationPrice,
    required this.positionValue,
    required this.marginUsed,
    required this.leverage,
    required this.unrealizedPnl,
    required this.unrealizedPnlPercent,
    this.fundingRate,
    required this.roi,
  }) : super._();
  @override
  PerpPositionDto rebuild(void Function(PerpPositionDtoBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  PerpPositionDtoBuilder toBuilder() => PerpPositionDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is PerpPositionDto &&
        coin == other.coin &&
        side == other.side &&
        size == other.size &&
        entryPrice == other.entryPrice &&
        markPrice == other.markPrice &&
        liquidationPrice == other.liquidationPrice &&
        positionValue == other.positionValue &&
        marginUsed == other.marginUsed &&
        leverage == other.leverage &&
        unrealizedPnl == other.unrealizedPnl &&
        unrealizedPnlPercent == other.unrealizedPnlPercent &&
        fundingRate == other.fundingRate &&
        roi == other.roi;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, coin.hashCode);
    _$hash = $jc(_$hash, side.hashCode);
    _$hash = $jc(_$hash, size.hashCode);
    _$hash = $jc(_$hash, entryPrice.hashCode);
    _$hash = $jc(_$hash, markPrice.hashCode);
    _$hash = $jc(_$hash, liquidationPrice.hashCode);
    _$hash = $jc(_$hash, positionValue.hashCode);
    _$hash = $jc(_$hash, marginUsed.hashCode);
    _$hash = $jc(_$hash, leverage.hashCode);
    _$hash = $jc(_$hash, unrealizedPnl.hashCode);
    _$hash = $jc(_$hash, unrealizedPnlPercent.hashCode);
    _$hash = $jc(_$hash, fundingRate.hashCode);
    _$hash = $jc(_$hash, roi.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'PerpPositionDto')
          ..add('coin', coin)
          ..add('side', side)
          ..add('size', size)
          ..add('entryPrice', entryPrice)
          ..add('markPrice', markPrice)
          ..add('liquidationPrice', liquidationPrice)
          ..add('positionValue', positionValue)
          ..add('marginUsed', marginUsed)
          ..add('leverage', leverage)
          ..add('unrealizedPnl', unrealizedPnl)
          ..add('unrealizedPnlPercent', unrealizedPnlPercent)
          ..add('fundingRate', fundingRate)
          ..add('roi', roi))
        .toString();
  }
}

class PerpPositionDtoBuilder
    implements Builder<PerpPositionDto, PerpPositionDtoBuilder> {
  _$PerpPositionDto? _$v;

  String? _coin;
  String? get coin => _$this._coin;
  set coin(String? coin) => _$this._coin = coin;

  PerpPositionDtoSideEnum? _side;
  PerpPositionDtoSideEnum? get side => _$this._side;
  set side(PerpPositionDtoSideEnum? side) => _$this._side = side;

  num? _size;
  num? get size => _$this._size;
  set size(num? size) => _$this._size = size;

  num? _entryPrice;
  num? get entryPrice => _$this._entryPrice;
  set entryPrice(num? entryPrice) => _$this._entryPrice = entryPrice;

  num? _markPrice;
  num? get markPrice => _$this._markPrice;
  set markPrice(num? markPrice) => _$this._markPrice = markPrice;

  num? _liquidationPrice;
  num? get liquidationPrice => _$this._liquidationPrice;
  set liquidationPrice(num? liquidationPrice) =>
      _$this._liquidationPrice = liquidationPrice;

  num? _positionValue;
  num? get positionValue => _$this._positionValue;
  set positionValue(num? positionValue) =>
      _$this._positionValue = positionValue;

  num? _marginUsed;
  num? get marginUsed => _$this._marginUsed;
  set marginUsed(num? marginUsed) => _$this._marginUsed = marginUsed;

  LeverageDtoBuilder? _leverage;
  LeverageDtoBuilder get leverage => _$this._leverage ??= LeverageDtoBuilder();
  set leverage(LeverageDtoBuilder? leverage) => _$this._leverage = leverage;

  num? _unrealizedPnl;
  num? get unrealizedPnl => _$this._unrealizedPnl;
  set unrealizedPnl(num? unrealizedPnl) =>
      _$this._unrealizedPnl = unrealizedPnl;

  num? _unrealizedPnlPercent;
  num? get unrealizedPnlPercent => _$this._unrealizedPnlPercent;
  set unrealizedPnlPercent(num? unrealizedPnlPercent) =>
      _$this._unrealizedPnlPercent = unrealizedPnlPercent;

  num? _fundingRate;
  num? get fundingRate => _$this._fundingRate;
  set fundingRate(num? fundingRate) => _$this._fundingRate = fundingRate;

  num? _roi;
  num? get roi => _$this._roi;
  set roi(num? roi) => _$this._roi = roi;

  PerpPositionDtoBuilder() {
    PerpPositionDto._defaults(this);
  }

  PerpPositionDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _coin = $v.coin;
      _side = $v.side;
      _size = $v.size;
      _entryPrice = $v.entryPrice;
      _markPrice = $v.markPrice;
      _liquidationPrice = $v.liquidationPrice;
      _positionValue = $v.positionValue;
      _marginUsed = $v.marginUsed;
      _leverage = $v.leverage.toBuilder();
      _unrealizedPnl = $v.unrealizedPnl;
      _unrealizedPnlPercent = $v.unrealizedPnlPercent;
      _fundingRate = $v.fundingRate;
      _roi = $v.roi;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(PerpPositionDto other) {
    _$v = other as _$PerpPositionDto;
  }

  @override
  void update(void Function(PerpPositionDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  PerpPositionDto build() => _build();

  _$PerpPositionDto _build() {
    _$PerpPositionDto _$result;
    try {
      _$result =
          _$v ??
          _$PerpPositionDto._(
            coin: BuiltValueNullFieldError.checkNotNull(
              coin,
              r'PerpPositionDto',
              'coin',
            ),
            side: BuiltValueNullFieldError.checkNotNull(
              side,
              r'PerpPositionDto',
              'side',
            ),
            size: BuiltValueNullFieldError.checkNotNull(
              size,
              r'PerpPositionDto',
              'size',
            ),
            entryPrice: BuiltValueNullFieldError.checkNotNull(
              entryPrice,
              r'PerpPositionDto',
              'entryPrice',
            ),
            markPrice: BuiltValueNullFieldError.checkNotNull(
              markPrice,
              r'PerpPositionDto',
              'markPrice',
            ),
            liquidationPrice: BuiltValueNullFieldError.checkNotNull(
              liquidationPrice,
              r'PerpPositionDto',
              'liquidationPrice',
            ),
            positionValue: BuiltValueNullFieldError.checkNotNull(
              positionValue,
              r'PerpPositionDto',
              'positionValue',
            ),
            marginUsed: BuiltValueNullFieldError.checkNotNull(
              marginUsed,
              r'PerpPositionDto',
              'marginUsed',
            ),
            leverage: leverage.build(),
            unrealizedPnl: BuiltValueNullFieldError.checkNotNull(
              unrealizedPnl,
              r'PerpPositionDto',
              'unrealizedPnl',
            ),
            unrealizedPnlPercent: BuiltValueNullFieldError.checkNotNull(
              unrealizedPnlPercent,
              r'PerpPositionDto',
              'unrealizedPnlPercent',
            ),
            fundingRate: fundingRate,
            roi: BuiltValueNullFieldError.checkNotNull(
              roi,
              r'PerpPositionDto',
              'roi',
            ),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'leverage';
        leverage.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'PerpPositionDto',
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
