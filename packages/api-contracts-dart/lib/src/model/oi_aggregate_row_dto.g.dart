// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'oi_aggregate_row_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$OiAggregateRowDto extends OiAggregateRowDto {
  @override
  final String exchange;
  @override
  final num qty;
  @override
  final num usd;
  @override
  final num pct;
  @override
  final num h1;
  @override
  final num h4;
  @override
  final num h24;
  @override
  final num oiVol;

  factory _$OiAggregateRowDto([
    void Function(OiAggregateRowDtoBuilder)? updates,
  ]) => (OiAggregateRowDtoBuilder()..update(updates))._build();

  _$OiAggregateRowDto._({
    required this.exchange,
    required this.qty,
    required this.usd,
    required this.pct,
    required this.h1,
    required this.h4,
    required this.h24,
    required this.oiVol,
  }) : super._();
  @override
  OiAggregateRowDto rebuild(void Function(OiAggregateRowDtoBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  OiAggregateRowDtoBuilder toBuilder() =>
      OiAggregateRowDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is OiAggregateRowDto &&
        exchange == other.exchange &&
        qty == other.qty &&
        usd == other.usd &&
        pct == other.pct &&
        h1 == other.h1 &&
        h4 == other.h4 &&
        h24 == other.h24 &&
        oiVol == other.oiVol;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, exchange.hashCode);
    _$hash = $jc(_$hash, qty.hashCode);
    _$hash = $jc(_$hash, usd.hashCode);
    _$hash = $jc(_$hash, pct.hashCode);
    _$hash = $jc(_$hash, h1.hashCode);
    _$hash = $jc(_$hash, h4.hashCode);
    _$hash = $jc(_$hash, h24.hashCode);
    _$hash = $jc(_$hash, oiVol.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'OiAggregateRowDto')
          ..add('exchange', exchange)
          ..add('qty', qty)
          ..add('usd', usd)
          ..add('pct', pct)
          ..add('h1', h1)
          ..add('h4', h4)
          ..add('h24', h24)
          ..add('oiVol', oiVol))
        .toString();
  }
}

class OiAggregateRowDtoBuilder
    implements Builder<OiAggregateRowDto, OiAggregateRowDtoBuilder> {
  _$OiAggregateRowDto? _$v;

  String? _exchange;
  String? get exchange => _$this._exchange;
  set exchange(String? exchange) => _$this._exchange = exchange;

  num? _qty;
  num? get qty => _$this._qty;
  set qty(num? qty) => _$this._qty = qty;

  num? _usd;
  num? get usd => _$this._usd;
  set usd(num? usd) => _$this._usd = usd;

  num? _pct;
  num? get pct => _$this._pct;
  set pct(num? pct) => _$this._pct = pct;

  num? _h1;
  num? get h1 => _$this._h1;
  set h1(num? h1) => _$this._h1 = h1;

  num? _h4;
  num? get h4 => _$this._h4;
  set h4(num? h4) => _$this._h4 = h4;

  num? _h24;
  num? get h24 => _$this._h24;
  set h24(num? h24) => _$this._h24 = h24;

  num? _oiVol;
  num? get oiVol => _$this._oiVol;
  set oiVol(num? oiVol) => _$this._oiVol = oiVol;

  OiAggregateRowDtoBuilder() {
    OiAggregateRowDto._defaults(this);
  }

  OiAggregateRowDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _exchange = $v.exchange;
      _qty = $v.qty;
      _usd = $v.usd;
      _pct = $v.pct;
      _h1 = $v.h1;
      _h4 = $v.h4;
      _h24 = $v.h24;
      _oiVol = $v.oiVol;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(OiAggregateRowDto other) {
    _$v = other as _$OiAggregateRowDto;
  }

  @override
  void update(void Function(OiAggregateRowDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  OiAggregateRowDto build() => _build();

  _$OiAggregateRowDto _build() {
    final _$result =
        _$v ??
        _$OiAggregateRowDto._(
          exchange: BuiltValueNullFieldError.checkNotNull(
            exchange,
            r'OiAggregateRowDto',
            'exchange',
          ),
          qty: BuiltValueNullFieldError.checkNotNull(
            qty,
            r'OiAggregateRowDto',
            'qty',
          ),
          usd: BuiltValueNullFieldError.checkNotNull(
            usd,
            r'OiAggregateRowDto',
            'usd',
          ),
          pct: BuiltValueNullFieldError.checkNotNull(
            pct,
            r'OiAggregateRowDto',
            'pct',
          ),
          h1: BuiltValueNullFieldError.checkNotNull(
            h1,
            r'OiAggregateRowDto',
            'h1',
          ),
          h4: BuiltValueNullFieldError.checkNotNull(
            h4,
            r'OiAggregateRowDto',
            'h4',
          ),
          h24: BuiltValueNullFieldError.checkNotNull(
            h24,
            r'OiAggregateRowDto',
            'h24',
          ),
          oiVol: BuiltValueNullFieldError.checkNotNull(
            oiVol,
            r'OiAggregateRowDto',
            'oiVol',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
