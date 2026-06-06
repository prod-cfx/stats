// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'oi_aggregate_total_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$OiAggregateTotalDto extends OiAggregateTotalDto {
  @override
  final num qty;
  @override
  final num usd;
  @override
  final num h24;

  factory _$OiAggregateTotalDto([
    void Function(OiAggregateTotalDtoBuilder)? updates,
  ]) => (OiAggregateTotalDtoBuilder()..update(updates))._build();

  _$OiAggregateTotalDto._({
    required this.qty,
    required this.usd,
    required this.h24,
  }) : super._();
  @override
  OiAggregateTotalDto rebuild(
    void Function(OiAggregateTotalDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  OiAggregateTotalDtoBuilder toBuilder() =>
      OiAggregateTotalDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is OiAggregateTotalDto &&
        qty == other.qty &&
        usd == other.usd &&
        h24 == other.h24;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, qty.hashCode);
    _$hash = $jc(_$hash, usd.hashCode);
    _$hash = $jc(_$hash, h24.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'OiAggregateTotalDto')
          ..add('qty', qty)
          ..add('usd', usd)
          ..add('h24', h24))
        .toString();
  }
}

class OiAggregateTotalDtoBuilder
    implements Builder<OiAggregateTotalDto, OiAggregateTotalDtoBuilder> {
  _$OiAggregateTotalDto? _$v;

  num? _qty;
  num? get qty => _$this._qty;
  set qty(num? qty) => _$this._qty = qty;

  num? _usd;
  num? get usd => _$this._usd;
  set usd(num? usd) => _$this._usd = usd;

  num? _h24;
  num? get h24 => _$this._h24;
  set h24(num? h24) => _$this._h24 = h24;

  OiAggregateTotalDtoBuilder() {
    OiAggregateTotalDto._defaults(this);
  }

  OiAggregateTotalDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _qty = $v.qty;
      _usd = $v.usd;
      _h24 = $v.h24;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(OiAggregateTotalDto other) {
    _$v = other as _$OiAggregateTotalDto;
  }

  @override
  void update(void Function(OiAggregateTotalDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  OiAggregateTotalDto build() => _build();

  _$OiAggregateTotalDto _build() {
    final _$result =
        _$v ??
        _$OiAggregateTotalDto._(
          qty: BuiltValueNullFieldError.checkNotNull(
            qty,
            r'OiAggregateTotalDto',
            'qty',
          ),
          usd: BuiltValueNullFieldError.checkNotNull(
            usd,
            r'OiAggregateTotalDto',
            'usd',
          ),
          h24: BuiltValueNullFieldError.checkNotNull(
            h24,
            r'OiAggregateTotalDto',
            'h24',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
