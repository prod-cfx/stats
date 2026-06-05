// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'trader_open_orders_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$TraderOpenOrdersResponseDto extends TraderOpenOrdersResponseDto {
  @override
  final BuiltList<OpenOrderDto> orders;

  factory _$TraderOpenOrdersResponseDto([
    void Function(TraderOpenOrdersResponseDtoBuilder)? updates,
  ]) => (TraderOpenOrdersResponseDtoBuilder()..update(updates))._build();

  _$TraderOpenOrdersResponseDto._({required this.orders}) : super._();
  @override
  TraderOpenOrdersResponseDto rebuild(
    void Function(TraderOpenOrdersResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  TraderOpenOrdersResponseDtoBuilder toBuilder() =>
      TraderOpenOrdersResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is TraderOpenOrdersResponseDto && orders == other.orders;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, orders.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(
      r'TraderOpenOrdersResponseDto',
    )..add('orders', orders)).toString();
  }
}

class TraderOpenOrdersResponseDtoBuilder
    implements
        Builder<
          TraderOpenOrdersResponseDto,
          TraderOpenOrdersResponseDtoBuilder
        > {
  _$TraderOpenOrdersResponseDto? _$v;

  ListBuilder<OpenOrderDto>? _orders;
  ListBuilder<OpenOrderDto> get orders =>
      _$this._orders ??= ListBuilder<OpenOrderDto>();
  set orders(ListBuilder<OpenOrderDto>? orders) => _$this._orders = orders;

  TraderOpenOrdersResponseDtoBuilder() {
    TraderOpenOrdersResponseDto._defaults(this);
  }

  TraderOpenOrdersResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _orders = $v.orders.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(TraderOpenOrdersResponseDto other) {
    _$v = other as _$TraderOpenOrdersResponseDto;
  }

  @override
  void update(void Function(TraderOpenOrdersResponseDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  TraderOpenOrdersResponseDto build() => _build();

  _$TraderOpenOrdersResponseDto _build() {
    _$TraderOpenOrdersResponseDto _$result;
    try {
      _$result = _$v ?? _$TraderOpenOrdersResponseDto._(orders: orders.build());
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'orders';
        orders.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'TraderOpenOrdersResponseDto',
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
