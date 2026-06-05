// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'whale_trade_history_item_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const WhaleTradeHistoryItemDtoSideEnum _$whaleTradeHistoryItemDtoSideEnum_LONG =
    const WhaleTradeHistoryItemDtoSideEnum._('LONG');
const WhaleTradeHistoryItemDtoSideEnum
_$whaleTradeHistoryItemDtoSideEnum_SHORT =
    const WhaleTradeHistoryItemDtoSideEnum._('SHORT');

WhaleTradeHistoryItemDtoSideEnum _$whaleTradeHistoryItemDtoSideEnumValueOf(
  String name,
) {
  switch (name) {
    case 'LONG':
      return _$whaleTradeHistoryItemDtoSideEnum_LONG;
    case 'SHORT':
      return _$whaleTradeHistoryItemDtoSideEnum_SHORT;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<WhaleTradeHistoryItemDtoSideEnum>
_$whaleTradeHistoryItemDtoSideEnumValues =
    BuiltSet<WhaleTradeHistoryItemDtoSideEnum>(
      const <WhaleTradeHistoryItemDtoSideEnum>[
        _$whaleTradeHistoryItemDtoSideEnum_LONG,
        _$whaleTradeHistoryItemDtoSideEnum_SHORT,
      ],
    );

const WhaleTradeHistoryItemDtoPositionActionEnum
_$whaleTradeHistoryItemDtoPositionActionEnum_n1 =
    const WhaleTradeHistoryItemDtoPositionActionEnum._('n1');
const WhaleTradeHistoryItemDtoPositionActionEnum
_$whaleTradeHistoryItemDtoPositionActionEnum_n2 =
    const WhaleTradeHistoryItemDtoPositionActionEnum._('n2');

WhaleTradeHistoryItemDtoPositionActionEnum
_$whaleTradeHistoryItemDtoPositionActionEnumValueOf(String name) {
  switch (name) {
    case 'n1':
      return _$whaleTradeHistoryItemDtoPositionActionEnum_n1;
    case 'n2':
      return _$whaleTradeHistoryItemDtoPositionActionEnum_n2;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<WhaleTradeHistoryItemDtoPositionActionEnum>
_$whaleTradeHistoryItemDtoPositionActionEnumValues =
    BuiltSet<WhaleTradeHistoryItemDtoPositionActionEnum>(
      const <WhaleTradeHistoryItemDtoPositionActionEnum>[
        _$whaleTradeHistoryItemDtoPositionActionEnum_n1,
        _$whaleTradeHistoryItemDtoPositionActionEnum_n2,
      ],
    );

Serializer<WhaleTradeHistoryItemDtoSideEnum>
_$whaleTradeHistoryItemDtoSideEnumSerializer =
    _$WhaleTradeHistoryItemDtoSideEnumSerializer();
Serializer<WhaleTradeHistoryItemDtoPositionActionEnum>
_$whaleTradeHistoryItemDtoPositionActionEnumSerializer =
    _$WhaleTradeHistoryItemDtoPositionActionEnumSerializer();

class _$WhaleTradeHistoryItemDtoSideEnumSerializer
    implements PrimitiveSerializer<WhaleTradeHistoryItemDtoSideEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'LONG': 'LONG',
    'SHORT': 'SHORT',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'LONG': 'LONG',
    'SHORT': 'SHORT',
  };

  @override
  final Iterable<Type> types = const <Type>[WhaleTradeHistoryItemDtoSideEnum];
  @override
  final String wireName = 'WhaleTradeHistoryItemDtoSideEnum';

  @override
  Object serialize(
    Serializers serializers,
    WhaleTradeHistoryItemDtoSideEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  WhaleTradeHistoryItemDtoSideEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => WhaleTradeHistoryItemDtoSideEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$WhaleTradeHistoryItemDtoPositionActionEnumSerializer
    implements PrimitiveSerializer<WhaleTradeHistoryItemDtoPositionActionEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'n1': '1',
    'n2': '2',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    '1': 'n1',
    '2': 'n2',
  };

  @override
  final Iterable<Type> types = const <Type>[
    WhaleTradeHistoryItemDtoPositionActionEnum,
  ];
  @override
  final String wireName = 'WhaleTradeHistoryItemDtoPositionActionEnum';

  @override
  Object serialize(
    Serializers serializers,
    WhaleTradeHistoryItemDtoPositionActionEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  WhaleTradeHistoryItemDtoPositionActionEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => WhaleTradeHistoryItemDtoPositionActionEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$WhaleTradeHistoryItemDto extends WhaleTradeHistoryItemDto {
  @override
  final String address;
  @override
  final String symbol;
  @override
  final WhaleTradeHistoryItemDtoSideEnum side;
  @override
  final num positionSize;
  @override
  final num positionValueUsd;
  @override
  final num entryPrice;
  @override
  final num liquidationPrice;
  @override
  final WhaleTradeHistoryItemDtoPositionActionEnum positionAction;
  @override
  final String createTime;

  factory _$WhaleTradeHistoryItemDto([
    void Function(WhaleTradeHistoryItemDtoBuilder)? updates,
  ]) => (WhaleTradeHistoryItemDtoBuilder()..update(updates))._build();

  _$WhaleTradeHistoryItemDto._({
    required this.address,
    required this.symbol,
    required this.side,
    required this.positionSize,
    required this.positionValueUsd,
    required this.entryPrice,
    required this.liquidationPrice,
    required this.positionAction,
    required this.createTime,
  }) : super._();
  @override
  WhaleTradeHistoryItemDto rebuild(
    void Function(WhaleTradeHistoryItemDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  WhaleTradeHistoryItemDtoBuilder toBuilder() =>
      WhaleTradeHistoryItemDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is WhaleTradeHistoryItemDto &&
        address == other.address &&
        symbol == other.symbol &&
        side == other.side &&
        positionSize == other.positionSize &&
        positionValueUsd == other.positionValueUsd &&
        entryPrice == other.entryPrice &&
        liquidationPrice == other.liquidationPrice &&
        positionAction == other.positionAction &&
        createTime == other.createTime;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, address.hashCode);
    _$hash = $jc(_$hash, symbol.hashCode);
    _$hash = $jc(_$hash, side.hashCode);
    _$hash = $jc(_$hash, positionSize.hashCode);
    _$hash = $jc(_$hash, positionValueUsd.hashCode);
    _$hash = $jc(_$hash, entryPrice.hashCode);
    _$hash = $jc(_$hash, liquidationPrice.hashCode);
    _$hash = $jc(_$hash, positionAction.hashCode);
    _$hash = $jc(_$hash, createTime.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'WhaleTradeHistoryItemDto')
          ..add('address', address)
          ..add('symbol', symbol)
          ..add('side', side)
          ..add('positionSize', positionSize)
          ..add('positionValueUsd', positionValueUsd)
          ..add('entryPrice', entryPrice)
          ..add('liquidationPrice', liquidationPrice)
          ..add('positionAction', positionAction)
          ..add('createTime', createTime))
        .toString();
  }
}

class WhaleTradeHistoryItemDtoBuilder
    implements
        Builder<WhaleTradeHistoryItemDto, WhaleTradeHistoryItemDtoBuilder> {
  _$WhaleTradeHistoryItemDto? _$v;

  String? _address;
  String? get address => _$this._address;
  set address(String? address) => _$this._address = address;

  String? _symbol;
  String? get symbol => _$this._symbol;
  set symbol(String? symbol) => _$this._symbol = symbol;

  WhaleTradeHistoryItemDtoSideEnum? _side;
  WhaleTradeHistoryItemDtoSideEnum? get side => _$this._side;
  set side(WhaleTradeHistoryItemDtoSideEnum? side) => _$this._side = side;

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

  WhaleTradeHistoryItemDtoPositionActionEnum? _positionAction;
  WhaleTradeHistoryItemDtoPositionActionEnum? get positionAction =>
      _$this._positionAction;
  set positionAction(
    WhaleTradeHistoryItemDtoPositionActionEnum? positionAction,
  ) => _$this._positionAction = positionAction;

  String? _createTime;
  String? get createTime => _$this._createTime;
  set createTime(String? createTime) => _$this._createTime = createTime;

  WhaleTradeHistoryItemDtoBuilder() {
    WhaleTradeHistoryItemDto._defaults(this);
  }

  WhaleTradeHistoryItemDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _address = $v.address;
      _symbol = $v.symbol;
      _side = $v.side;
      _positionSize = $v.positionSize;
      _positionValueUsd = $v.positionValueUsd;
      _entryPrice = $v.entryPrice;
      _liquidationPrice = $v.liquidationPrice;
      _positionAction = $v.positionAction;
      _createTime = $v.createTime;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(WhaleTradeHistoryItemDto other) {
    _$v = other as _$WhaleTradeHistoryItemDto;
  }

  @override
  void update(void Function(WhaleTradeHistoryItemDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  WhaleTradeHistoryItemDto build() => _build();

  _$WhaleTradeHistoryItemDto _build() {
    final _$result =
        _$v ??
        _$WhaleTradeHistoryItemDto._(
          address: BuiltValueNullFieldError.checkNotNull(
            address,
            r'WhaleTradeHistoryItemDto',
            'address',
          ),
          symbol: BuiltValueNullFieldError.checkNotNull(
            symbol,
            r'WhaleTradeHistoryItemDto',
            'symbol',
          ),
          side: BuiltValueNullFieldError.checkNotNull(
            side,
            r'WhaleTradeHistoryItemDto',
            'side',
          ),
          positionSize: BuiltValueNullFieldError.checkNotNull(
            positionSize,
            r'WhaleTradeHistoryItemDto',
            'positionSize',
          ),
          positionValueUsd: BuiltValueNullFieldError.checkNotNull(
            positionValueUsd,
            r'WhaleTradeHistoryItemDto',
            'positionValueUsd',
          ),
          entryPrice: BuiltValueNullFieldError.checkNotNull(
            entryPrice,
            r'WhaleTradeHistoryItemDto',
            'entryPrice',
          ),
          liquidationPrice: BuiltValueNullFieldError.checkNotNull(
            liquidationPrice,
            r'WhaleTradeHistoryItemDto',
            'liquidationPrice',
          ),
          positionAction: BuiltValueNullFieldError.checkNotNull(
            positionAction,
            r'WhaleTradeHistoryItemDto',
            'positionAction',
          ),
          createTime: BuiltValueNullFieldError.checkNotNull(
            createTime,
            r'WhaleTradeHistoryItemDto',
            'createTime',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
