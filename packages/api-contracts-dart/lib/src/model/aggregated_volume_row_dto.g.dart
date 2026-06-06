// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'aggregated_volume_row_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AggregatedVolumeRowDto extends AggregatedVolumeRowDto {
  @override
  final String exchange;
  @override
  final num value;

  factory _$AggregatedVolumeRowDto([
    void Function(AggregatedVolumeRowDtoBuilder)? updates,
  ]) => (AggregatedVolumeRowDtoBuilder()..update(updates))._build();

  _$AggregatedVolumeRowDto._({required this.exchange, required this.value})
    : super._();
  @override
  AggregatedVolumeRowDto rebuild(
    void Function(AggregatedVolumeRowDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AggregatedVolumeRowDtoBuilder toBuilder() =>
      AggregatedVolumeRowDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AggregatedVolumeRowDto &&
        exchange == other.exchange &&
        value == other.value;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, exchange.hashCode);
    _$hash = $jc(_$hash, value.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'AggregatedVolumeRowDto')
          ..add('exchange', exchange)
          ..add('value', value))
        .toString();
  }
}

class AggregatedVolumeRowDtoBuilder
    implements Builder<AggregatedVolumeRowDto, AggregatedVolumeRowDtoBuilder> {
  _$AggregatedVolumeRowDto? _$v;

  String? _exchange;
  String? get exchange => _$this._exchange;
  set exchange(String? exchange) => _$this._exchange = exchange;

  num? _value;
  num? get value => _$this._value;
  set value(num? value) => _$this._value = value;

  AggregatedVolumeRowDtoBuilder() {
    AggregatedVolumeRowDto._defaults(this);
  }

  AggregatedVolumeRowDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _exchange = $v.exchange;
      _value = $v.value;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AggregatedVolumeRowDto other) {
    _$v = other as _$AggregatedVolumeRowDto;
  }

  @override
  void update(void Function(AggregatedVolumeRowDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  AggregatedVolumeRowDto build() => _build();

  _$AggregatedVolumeRowDto _build() {
    final _$result =
        _$v ??
        _$AggregatedVolumeRowDto._(
          exchange: BuiltValueNullFieldError.checkNotNull(
            exchange,
            r'AggregatedVolumeRowDto',
            'exchange',
          ),
          value: BuiltValueNullFieldError.checkNotNull(
            value,
            r'AggregatedVolumeRowDto',
            'value',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
