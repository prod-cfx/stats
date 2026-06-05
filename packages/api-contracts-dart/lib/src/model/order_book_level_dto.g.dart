// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'order_book_level_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$OrderBookLevelDto extends OrderBookLevelDto {
  @override
  final num price;
  @override
  final num size;

  factory _$OrderBookLevelDto([
    void Function(OrderBookLevelDtoBuilder)? updates,
  ]) => (OrderBookLevelDtoBuilder()..update(updates))._build();

  _$OrderBookLevelDto._({required this.price, required this.size}) : super._();
  @override
  OrderBookLevelDto rebuild(void Function(OrderBookLevelDtoBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  OrderBookLevelDtoBuilder toBuilder() =>
      OrderBookLevelDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is OrderBookLevelDto &&
        price == other.price &&
        size == other.size;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, price.hashCode);
    _$hash = $jc(_$hash, size.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'OrderBookLevelDto')
          ..add('price', price)
          ..add('size', size))
        .toString();
  }
}

class OrderBookLevelDtoBuilder
    implements Builder<OrderBookLevelDto, OrderBookLevelDtoBuilder> {
  _$OrderBookLevelDto? _$v;

  num? _price;
  num? get price => _$this._price;
  set price(num? price) => _$this._price = price;

  num? _size;
  num? get size => _$this._size;
  set size(num? size) => _$this._size = size;

  OrderBookLevelDtoBuilder() {
    OrderBookLevelDto._defaults(this);
  }

  OrderBookLevelDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _price = $v.price;
      _size = $v.size;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(OrderBookLevelDto other) {
    _$v = other as _$OrderBookLevelDto;
  }

  @override
  void update(void Function(OrderBookLevelDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  OrderBookLevelDto build() => _build();

  _$OrderBookLevelDto _build() {
    final _$result =
        _$v ??
        _$OrderBookLevelDto._(
          price: BuiltValueNullFieldError.checkNotNull(
            price,
            r'OrderBookLevelDto',
            'price',
          ),
          size: BuiltValueNullFieldError.checkNotNull(
            size,
            r'OrderBookLevelDto',
            'size',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
