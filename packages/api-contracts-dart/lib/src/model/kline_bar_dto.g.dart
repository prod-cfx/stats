// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'kline_bar_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$KlineBarDto extends KlineBarDto {
  @override
  final num time;
  @override
  final num open;
  @override
  final num high;
  @override
  final num low;
  @override
  final num close;
  @override
  final num volume;

  factory _$KlineBarDto([void Function(KlineBarDtoBuilder)? updates]) =>
      (KlineBarDtoBuilder()..update(updates))._build();

  _$KlineBarDto._({
    required this.time,
    required this.open,
    required this.high,
    required this.low,
    required this.close,
    required this.volume,
  }) : super._();
  @override
  KlineBarDto rebuild(void Function(KlineBarDtoBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  KlineBarDtoBuilder toBuilder() => KlineBarDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is KlineBarDto &&
        time == other.time &&
        open == other.open &&
        high == other.high &&
        low == other.low &&
        close == other.close &&
        volume == other.volume;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, time.hashCode);
    _$hash = $jc(_$hash, open.hashCode);
    _$hash = $jc(_$hash, high.hashCode);
    _$hash = $jc(_$hash, low.hashCode);
    _$hash = $jc(_$hash, close.hashCode);
    _$hash = $jc(_$hash, volume.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'KlineBarDto')
          ..add('time', time)
          ..add('open', open)
          ..add('high', high)
          ..add('low', low)
          ..add('close', close)
          ..add('volume', volume))
        .toString();
  }
}

class KlineBarDtoBuilder implements Builder<KlineBarDto, KlineBarDtoBuilder> {
  _$KlineBarDto? _$v;

  num? _time;
  num? get time => _$this._time;
  set time(num? time) => _$this._time = time;

  num? _open;
  num? get open => _$this._open;
  set open(num? open) => _$this._open = open;

  num? _high;
  num? get high => _$this._high;
  set high(num? high) => _$this._high = high;

  num? _low;
  num? get low => _$this._low;
  set low(num? low) => _$this._low = low;

  num? _close;
  num? get close => _$this._close;
  set close(num? close) => _$this._close = close;

  num? _volume;
  num? get volume => _$this._volume;
  set volume(num? volume) => _$this._volume = volume;

  KlineBarDtoBuilder() {
    KlineBarDto._defaults(this);
  }

  KlineBarDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _time = $v.time;
      _open = $v.open;
      _high = $v.high;
      _low = $v.low;
      _close = $v.close;
      _volume = $v.volume;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(KlineBarDto other) {
    _$v = other as _$KlineBarDto;
  }

  @override
  void update(void Function(KlineBarDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  KlineBarDto build() => _build();

  _$KlineBarDto _build() {
    final _$result =
        _$v ??
        _$KlineBarDto._(
          time: BuiltValueNullFieldError.checkNotNull(
            time,
            r'KlineBarDto',
            'time',
          ),
          open: BuiltValueNullFieldError.checkNotNull(
            open,
            r'KlineBarDto',
            'open',
          ),
          high: BuiltValueNullFieldError.checkNotNull(
            high,
            r'KlineBarDto',
            'high',
          ),
          low: BuiltValueNullFieldError.checkNotNull(
            low,
            r'KlineBarDto',
            'low',
          ),
          close: BuiltValueNullFieldError.checkNotNull(
            close,
            r'KlineBarDto',
            'close',
          ),
          volume: BuiltValueNullFieldError.checkNotNull(
            volume,
            r'KlineBarDto',
            'volume',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
