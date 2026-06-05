// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'open_order_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const OpenOrderDtoSideEnum _$openOrderDtoSideEnum_BUY =
    const OpenOrderDtoSideEnum._('BUY');
const OpenOrderDtoSideEnum _$openOrderDtoSideEnum_SELL =
    const OpenOrderDtoSideEnum._('SELL');

OpenOrderDtoSideEnum _$openOrderDtoSideEnumValueOf(String name) {
  switch (name) {
    case 'BUY':
      return _$openOrderDtoSideEnum_BUY;
    case 'SELL':
      return _$openOrderDtoSideEnum_SELL;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<OpenOrderDtoSideEnum> _$openOrderDtoSideEnumValues =
    BuiltSet<OpenOrderDtoSideEnum>(const <OpenOrderDtoSideEnum>[
      _$openOrderDtoSideEnum_BUY,
      _$openOrderDtoSideEnum_SELL,
    ]);

Serializer<OpenOrderDtoSideEnum> _$openOrderDtoSideEnumSerializer =
    _$OpenOrderDtoSideEnumSerializer();

class _$OpenOrderDtoSideEnumSerializer
    implements PrimitiveSerializer<OpenOrderDtoSideEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'BUY': 'BUY',
    'SELL': 'SELL',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'BUY': 'BUY',
    'SELL': 'SELL',
  };

  @override
  final Iterable<Type> types = const <Type>[OpenOrderDtoSideEnum];
  @override
  final String wireName = 'OpenOrderDtoSideEnum';

  @override
  Object serialize(
    Serializers serializers,
    OpenOrderDtoSideEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  OpenOrderDtoSideEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => OpenOrderDtoSideEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$OpenOrderDto extends OpenOrderDto {
  @override
  final num orderId;
  @override
  final String coin;
  @override
  final OpenOrderDtoSideEnum side;
  @override
  final String type;
  @override
  final num price;
  @override
  final num size;
  @override
  final num origSize;
  @override
  final num value;
  @override
  final String timestamp;
  @override
  final num? triggerPrice;
  @override
  final String? triggerCondition;
  @override
  final bool reduceOnly;

  factory _$OpenOrderDto([void Function(OpenOrderDtoBuilder)? updates]) =>
      (OpenOrderDtoBuilder()..update(updates))._build();

  _$OpenOrderDto._({
    required this.orderId,
    required this.coin,
    required this.side,
    required this.type,
    required this.price,
    required this.size,
    required this.origSize,
    required this.value,
    required this.timestamp,
    this.triggerPrice,
    this.triggerCondition,
    required this.reduceOnly,
  }) : super._();
  @override
  OpenOrderDto rebuild(void Function(OpenOrderDtoBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  OpenOrderDtoBuilder toBuilder() => OpenOrderDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is OpenOrderDto &&
        orderId == other.orderId &&
        coin == other.coin &&
        side == other.side &&
        type == other.type &&
        price == other.price &&
        size == other.size &&
        origSize == other.origSize &&
        value == other.value &&
        timestamp == other.timestamp &&
        triggerPrice == other.triggerPrice &&
        triggerCondition == other.triggerCondition &&
        reduceOnly == other.reduceOnly;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, orderId.hashCode);
    _$hash = $jc(_$hash, coin.hashCode);
    _$hash = $jc(_$hash, side.hashCode);
    _$hash = $jc(_$hash, type.hashCode);
    _$hash = $jc(_$hash, price.hashCode);
    _$hash = $jc(_$hash, size.hashCode);
    _$hash = $jc(_$hash, origSize.hashCode);
    _$hash = $jc(_$hash, value.hashCode);
    _$hash = $jc(_$hash, timestamp.hashCode);
    _$hash = $jc(_$hash, triggerPrice.hashCode);
    _$hash = $jc(_$hash, triggerCondition.hashCode);
    _$hash = $jc(_$hash, reduceOnly.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'OpenOrderDto')
          ..add('orderId', orderId)
          ..add('coin', coin)
          ..add('side', side)
          ..add('type', type)
          ..add('price', price)
          ..add('size', size)
          ..add('origSize', origSize)
          ..add('value', value)
          ..add('timestamp', timestamp)
          ..add('triggerPrice', triggerPrice)
          ..add('triggerCondition', triggerCondition)
          ..add('reduceOnly', reduceOnly))
        .toString();
  }
}

class OpenOrderDtoBuilder
    implements Builder<OpenOrderDto, OpenOrderDtoBuilder> {
  _$OpenOrderDto? _$v;

  num? _orderId;
  num? get orderId => _$this._orderId;
  set orderId(num? orderId) => _$this._orderId = orderId;

  String? _coin;
  String? get coin => _$this._coin;
  set coin(String? coin) => _$this._coin = coin;

  OpenOrderDtoSideEnum? _side;
  OpenOrderDtoSideEnum? get side => _$this._side;
  set side(OpenOrderDtoSideEnum? side) => _$this._side = side;

  String? _type;
  String? get type => _$this._type;
  set type(String? type) => _$this._type = type;

  num? _price;
  num? get price => _$this._price;
  set price(num? price) => _$this._price = price;

  num? _size;
  num? get size => _$this._size;
  set size(num? size) => _$this._size = size;

  num? _origSize;
  num? get origSize => _$this._origSize;
  set origSize(num? origSize) => _$this._origSize = origSize;

  num? _value;
  num? get value => _$this._value;
  set value(num? value) => _$this._value = value;

  String? _timestamp;
  String? get timestamp => _$this._timestamp;
  set timestamp(String? timestamp) => _$this._timestamp = timestamp;

  num? _triggerPrice;
  num? get triggerPrice => _$this._triggerPrice;
  set triggerPrice(num? triggerPrice) => _$this._triggerPrice = triggerPrice;

  String? _triggerCondition;
  String? get triggerCondition => _$this._triggerCondition;
  set triggerCondition(String? triggerCondition) =>
      _$this._triggerCondition = triggerCondition;

  bool? _reduceOnly;
  bool? get reduceOnly => _$this._reduceOnly;
  set reduceOnly(bool? reduceOnly) => _$this._reduceOnly = reduceOnly;

  OpenOrderDtoBuilder() {
    OpenOrderDto._defaults(this);
  }

  OpenOrderDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _orderId = $v.orderId;
      _coin = $v.coin;
      _side = $v.side;
      _type = $v.type;
      _price = $v.price;
      _size = $v.size;
      _origSize = $v.origSize;
      _value = $v.value;
      _timestamp = $v.timestamp;
      _triggerPrice = $v.triggerPrice;
      _triggerCondition = $v.triggerCondition;
      _reduceOnly = $v.reduceOnly;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(OpenOrderDto other) {
    _$v = other as _$OpenOrderDto;
  }

  @override
  void update(void Function(OpenOrderDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  OpenOrderDto build() => _build();

  _$OpenOrderDto _build() {
    final _$result =
        _$v ??
        _$OpenOrderDto._(
          orderId: BuiltValueNullFieldError.checkNotNull(
            orderId,
            r'OpenOrderDto',
            'orderId',
          ),
          coin: BuiltValueNullFieldError.checkNotNull(
            coin,
            r'OpenOrderDto',
            'coin',
          ),
          side: BuiltValueNullFieldError.checkNotNull(
            side,
            r'OpenOrderDto',
            'side',
          ),
          type: BuiltValueNullFieldError.checkNotNull(
            type,
            r'OpenOrderDto',
            'type',
          ),
          price: BuiltValueNullFieldError.checkNotNull(
            price,
            r'OpenOrderDto',
            'price',
          ),
          size: BuiltValueNullFieldError.checkNotNull(
            size,
            r'OpenOrderDto',
            'size',
          ),
          origSize: BuiltValueNullFieldError.checkNotNull(
            origSize,
            r'OpenOrderDto',
            'origSize',
          ),
          value: BuiltValueNullFieldError.checkNotNull(
            value,
            r'OpenOrderDto',
            'value',
          ),
          timestamp: BuiltValueNullFieldError.checkNotNull(
            timestamp,
            r'OpenOrderDto',
            'timestamp',
          ),
          triggerPrice: triggerPrice,
          triggerCondition: triggerCondition,
          reduceOnly: BuiltValueNullFieldError.checkNotNull(
            reduceOnly,
            r'OpenOrderDto',
            'reduceOnly',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
