// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'spot_balance_item_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$SpotBalanceItemDto extends SpotBalanceItemDto {
  @override
  final String coin;
  @override
  final num total;
  @override
  final num hold;
  @override
  final num value;
  @override
  final num sharePercent;

  factory _$SpotBalanceItemDto([
    void Function(SpotBalanceItemDtoBuilder)? updates,
  ]) => (SpotBalanceItemDtoBuilder()..update(updates))._build();

  _$SpotBalanceItemDto._({
    required this.coin,
    required this.total,
    required this.hold,
    required this.value,
    required this.sharePercent,
  }) : super._();
  @override
  SpotBalanceItemDto rebuild(
    void Function(SpotBalanceItemDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  SpotBalanceItemDtoBuilder toBuilder() =>
      SpotBalanceItemDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is SpotBalanceItemDto &&
        coin == other.coin &&
        total == other.total &&
        hold == other.hold &&
        value == other.value &&
        sharePercent == other.sharePercent;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, coin.hashCode);
    _$hash = $jc(_$hash, total.hashCode);
    _$hash = $jc(_$hash, hold.hashCode);
    _$hash = $jc(_$hash, value.hashCode);
    _$hash = $jc(_$hash, sharePercent.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'SpotBalanceItemDto')
          ..add('coin', coin)
          ..add('total', total)
          ..add('hold', hold)
          ..add('value', value)
          ..add('sharePercent', sharePercent))
        .toString();
  }
}

class SpotBalanceItemDtoBuilder
    implements Builder<SpotBalanceItemDto, SpotBalanceItemDtoBuilder> {
  _$SpotBalanceItemDto? _$v;

  String? _coin;
  String? get coin => _$this._coin;
  set coin(String? coin) => _$this._coin = coin;

  num? _total;
  num? get total => _$this._total;
  set total(num? total) => _$this._total = total;

  num? _hold;
  num? get hold => _$this._hold;
  set hold(num? hold) => _$this._hold = hold;

  num? _value;
  num? get value => _$this._value;
  set value(num? value) => _$this._value = value;

  num? _sharePercent;
  num? get sharePercent => _$this._sharePercent;
  set sharePercent(num? sharePercent) => _$this._sharePercent = sharePercent;

  SpotBalanceItemDtoBuilder() {
    SpotBalanceItemDto._defaults(this);
  }

  SpotBalanceItemDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _coin = $v.coin;
      _total = $v.total;
      _hold = $v.hold;
      _value = $v.value;
      _sharePercent = $v.sharePercent;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(SpotBalanceItemDto other) {
    _$v = other as _$SpotBalanceItemDto;
  }

  @override
  void update(void Function(SpotBalanceItemDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  SpotBalanceItemDto build() => _build();

  _$SpotBalanceItemDto _build() {
    final _$result =
        _$v ??
        _$SpotBalanceItemDto._(
          coin: BuiltValueNullFieldError.checkNotNull(
            coin,
            r'SpotBalanceItemDto',
            'coin',
          ),
          total: BuiltValueNullFieldError.checkNotNull(
            total,
            r'SpotBalanceItemDto',
            'total',
          ),
          hold: BuiltValueNullFieldError.checkNotNull(
            hold,
            r'SpotBalanceItemDto',
            'hold',
          ),
          value: BuiltValueNullFieldError.checkNotNull(
            value,
            r'SpotBalanceItemDto',
            'value',
          ),
          sharePercent: BuiltValueNullFieldError.checkNotNull(
            sharePercent,
            r'SpotBalanceItemDto',
            'sharePercent',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
