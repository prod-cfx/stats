// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'spot_balance_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$SpotBalanceDto extends SpotBalanceDto {
  @override
  final String coin;
  @override
  final num total;
  @override
  final num hold;
  @override
  final num available;
  @override
  final num value;

  factory _$SpotBalanceDto([void Function(SpotBalanceDtoBuilder)? updates]) =>
      (SpotBalanceDtoBuilder()..update(updates))._build();

  _$SpotBalanceDto._({
    required this.coin,
    required this.total,
    required this.hold,
    required this.available,
    required this.value,
  }) : super._();
  @override
  SpotBalanceDto rebuild(void Function(SpotBalanceDtoBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  SpotBalanceDtoBuilder toBuilder() => SpotBalanceDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is SpotBalanceDto &&
        coin == other.coin &&
        total == other.total &&
        hold == other.hold &&
        available == other.available &&
        value == other.value;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, coin.hashCode);
    _$hash = $jc(_$hash, total.hashCode);
    _$hash = $jc(_$hash, hold.hashCode);
    _$hash = $jc(_$hash, available.hashCode);
    _$hash = $jc(_$hash, value.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'SpotBalanceDto')
          ..add('coin', coin)
          ..add('total', total)
          ..add('hold', hold)
          ..add('available', available)
          ..add('value', value))
        .toString();
  }
}

class SpotBalanceDtoBuilder
    implements Builder<SpotBalanceDto, SpotBalanceDtoBuilder> {
  _$SpotBalanceDto? _$v;

  String? _coin;
  String? get coin => _$this._coin;
  set coin(String? coin) => _$this._coin = coin;

  num? _total;
  num? get total => _$this._total;
  set total(num? total) => _$this._total = total;

  num? _hold;
  num? get hold => _$this._hold;
  set hold(num? hold) => _$this._hold = hold;

  num? _available;
  num? get available => _$this._available;
  set available(num? available) => _$this._available = available;

  num? _value;
  num? get value => _$this._value;
  set value(num? value) => _$this._value = value;

  SpotBalanceDtoBuilder() {
    SpotBalanceDto._defaults(this);
  }

  SpotBalanceDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _coin = $v.coin;
      _total = $v.total;
      _hold = $v.hold;
      _available = $v.available;
      _value = $v.value;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(SpotBalanceDto other) {
    _$v = other as _$SpotBalanceDto;
  }

  @override
  void update(void Function(SpotBalanceDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  SpotBalanceDto build() => _build();

  _$SpotBalanceDto _build() {
    final _$result =
        _$v ??
        _$SpotBalanceDto._(
          coin: BuiltValueNullFieldError.checkNotNull(
            coin,
            r'SpotBalanceDto',
            'coin',
          ),
          total: BuiltValueNullFieldError.checkNotNull(
            total,
            r'SpotBalanceDto',
            'total',
          ),
          hold: BuiltValueNullFieldError.checkNotNull(
            hold,
            r'SpotBalanceDto',
            'hold',
          ),
          available: BuiltValueNullFieldError.checkNotNull(
            available,
            r'SpotBalanceDto',
            'available',
          ),
          value: BuiltValueNullFieldError.checkNotNull(
            value,
            r'SpotBalanceDto',
            'value',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
