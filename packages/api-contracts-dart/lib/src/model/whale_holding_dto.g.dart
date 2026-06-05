// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'whale_holding_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const WhaleHoldingDtoSideEnum _$whaleHoldingDtoSideEnum_LONG =
    const WhaleHoldingDtoSideEnum._('LONG');
const WhaleHoldingDtoSideEnum _$whaleHoldingDtoSideEnum_SHORT =
    const WhaleHoldingDtoSideEnum._('SHORT');

WhaleHoldingDtoSideEnum _$whaleHoldingDtoSideEnumValueOf(String name) {
  switch (name) {
    case 'LONG':
      return _$whaleHoldingDtoSideEnum_LONG;
    case 'SHORT':
      return _$whaleHoldingDtoSideEnum_SHORT;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<WhaleHoldingDtoSideEnum> _$whaleHoldingDtoSideEnumValues =
    BuiltSet<WhaleHoldingDtoSideEnum>(const <WhaleHoldingDtoSideEnum>[
      _$whaleHoldingDtoSideEnum_LONG,
      _$whaleHoldingDtoSideEnum_SHORT,
    ]);

Serializer<WhaleHoldingDtoSideEnum> _$whaleHoldingDtoSideEnumSerializer =
    _$WhaleHoldingDtoSideEnumSerializer();

class _$WhaleHoldingDtoSideEnumSerializer
    implements PrimitiveSerializer<WhaleHoldingDtoSideEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'LONG': 'LONG',
    'SHORT': 'SHORT',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'LONG': 'LONG',
    'SHORT': 'SHORT',
  };

  @override
  final Iterable<Type> types = const <Type>[WhaleHoldingDtoSideEnum];
  @override
  final String wireName = 'WhaleHoldingDtoSideEnum';

  @override
  Object serialize(
    Serializers serializers,
    WhaleHoldingDtoSideEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  WhaleHoldingDtoSideEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => WhaleHoldingDtoSideEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$WhaleHoldingDto extends WhaleHoldingDto {
  @override
  final String userAddress;
  @override
  final String symbol;
  @override
  final WhaleHoldingDtoSideEnum side;
  @override
  final num positionSize;
  @override
  final num positionValueUsd;
  @override
  final num entryPrice;
  @override
  final num? liquidationPrice;
  @override
  final num? pnl;
  @override
  final num? roe;
  @override
  final num? leverage;
  @override
  final String snapshotTime;

  factory _$WhaleHoldingDto([void Function(WhaleHoldingDtoBuilder)? updates]) =>
      (WhaleHoldingDtoBuilder()..update(updates))._build();

  _$WhaleHoldingDto._({
    required this.userAddress,
    required this.symbol,
    required this.side,
    required this.positionSize,
    required this.positionValueUsd,
    required this.entryPrice,
    this.liquidationPrice,
    this.pnl,
    this.roe,
    this.leverage,
    required this.snapshotTime,
  }) : super._();
  @override
  WhaleHoldingDto rebuild(void Function(WhaleHoldingDtoBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  WhaleHoldingDtoBuilder toBuilder() => WhaleHoldingDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is WhaleHoldingDto &&
        userAddress == other.userAddress &&
        symbol == other.symbol &&
        side == other.side &&
        positionSize == other.positionSize &&
        positionValueUsd == other.positionValueUsd &&
        entryPrice == other.entryPrice &&
        liquidationPrice == other.liquidationPrice &&
        pnl == other.pnl &&
        roe == other.roe &&
        leverage == other.leverage &&
        snapshotTime == other.snapshotTime;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, userAddress.hashCode);
    _$hash = $jc(_$hash, symbol.hashCode);
    _$hash = $jc(_$hash, side.hashCode);
    _$hash = $jc(_$hash, positionSize.hashCode);
    _$hash = $jc(_$hash, positionValueUsd.hashCode);
    _$hash = $jc(_$hash, entryPrice.hashCode);
    _$hash = $jc(_$hash, liquidationPrice.hashCode);
    _$hash = $jc(_$hash, pnl.hashCode);
    _$hash = $jc(_$hash, roe.hashCode);
    _$hash = $jc(_$hash, leverage.hashCode);
    _$hash = $jc(_$hash, snapshotTime.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'WhaleHoldingDto')
          ..add('userAddress', userAddress)
          ..add('symbol', symbol)
          ..add('side', side)
          ..add('positionSize', positionSize)
          ..add('positionValueUsd', positionValueUsd)
          ..add('entryPrice', entryPrice)
          ..add('liquidationPrice', liquidationPrice)
          ..add('pnl', pnl)
          ..add('roe', roe)
          ..add('leverage', leverage)
          ..add('snapshotTime', snapshotTime))
        .toString();
  }
}

class WhaleHoldingDtoBuilder
    implements Builder<WhaleHoldingDto, WhaleHoldingDtoBuilder> {
  _$WhaleHoldingDto? _$v;

  String? _userAddress;
  String? get userAddress => _$this._userAddress;
  set userAddress(String? userAddress) => _$this._userAddress = userAddress;

  String? _symbol;
  String? get symbol => _$this._symbol;
  set symbol(String? symbol) => _$this._symbol = symbol;

  WhaleHoldingDtoSideEnum? _side;
  WhaleHoldingDtoSideEnum? get side => _$this._side;
  set side(WhaleHoldingDtoSideEnum? side) => _$this._side = side;

  num? _positionSize;
  num? get positionSize => _$this._positionSize;
  set positionSize(num? positionSize) => _$this._positionSize = positionSize;

  num? _positionValueUsd;
  num? get positionValueUsd => _$this._positionValueUsd;
  set positionValueUsd(num? positionValueUsd) =>
      _$this._positionValueUsd = positionValueUsd;

  num? _entryPrice;
  num? get entryPrice => _$this._entryPrice;
  set entryPrice(num? entryPrice) => _$this._entryPrice = entryPrice;

  num? _liquidationPrice;
  num? get liquidationPrice => _$this._liquidationPrice;
  set liquidationPrice(num? liquidationPrice) =>
      _$this._liquidationPrice = liquidationPrice;

  num? _pnl;
  num? get pnl => _$this._pnl;
  set pnl(num? pnl) => _$this._pnl = pnl;

  num? _roe;
  num? get roe => _$this._roe;
  set roe(num? roe) => _$this._roe = roe;

  num? _leverage;
  num? get leverage => _$this._leverage;
  set leverage(num? leverage) => _$this._leverage = leverage;

  String? _snapshotTime;
  String? get snapshotTime => _$this._snapshotTime;
  set snapshotTime(String? snapshotTime) => _$this._snapshotTime = snapshotTime;

  WhaleHoldingDtoBuilder() {
    WhaleHoldingDto._defaults(this);
  }

  WhaleHoldingDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _userAddress = $v.userAddress;
      _symbol = $v.symbol;
      _side = $v.side;
      _positionSize = $v.positionSize;
      _positionValueUsd = $v.positionValueUsd;
      _entryPrice = $v.entryPrice;
      _liquidationPrice = $v.liquidationPrice;
      _pnl = $v.pnl;
      _roe = $v.roe;
      _leverage = $v.leverage;
      _snapshotTime = $v.snapshotTime;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(WhaleHoldingDto other) {
    _$v = other as _$WhaleHoldingDto;
  }

  @override
  void update(void Function(WhaleHoldingDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  WhaleHoldingDto build() => _build();

  _$WhaleHoldingDto _build() {
    final _$result =
        _$v ??
        _$WhaleHoldingDto._(
          userAddress: BuiltValueNullFieldError.checkNotNull(
            userAddress,
            r'WhaleHoldingDto',
            'userAddress',
          ),
          symbol: BuiltValueNullFieldError.checkNotNull(
            symbol,
            r'WhaleHoldingDto',
            'symbol',
          ),
          side: BuiltValueNullFieldError.checkNotNull(
            side,
            r'WhaleHoldingDto',
            'side',
          ),
          positionSize: BuiltValueNullFieldError.checkNotNull(
            positionSize,
            r'WhaleHoldingDto',
            'positionSize',
          ),
          positionValueUsd: BuiltValueNullFieldError.checkNotNull(
            positionValueUsd,
            r'WhaleHoldingDto',
            'positionValueUsd',
          ),
          entryPrice: BuiltValueNullFieldError.checkNotNull(
            entryPrice,
            r'WhaleHoldingDto',
            'entryPrice',
          ),
          liquidationPrice: liquidationPrice,
          pnl: pnl,
          roe: roe,
          leverage: leverage,
          snapshotTime: BuiltValueNullFieldError.checkNotNull(
            snapshotTime,
            r'WhaleHoldingDto',
            'snapshotTime',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
