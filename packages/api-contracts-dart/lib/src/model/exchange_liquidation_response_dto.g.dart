// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'exchange_liquidation_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const ExchangeLiquidationResponseDtoTimeframeEnum
_$exchangeLiquidationResponseDtoTimeframeEnum_n1h =
    const ExchangeLiquidationResponseDtoTimeframeEnum._('n1h');
const ExchangeLiquidationResponseDtoTimeframeEnum
_$exchangeLiquidationResponseDtoTimeframeEnum_n4h =
    const ExchangeLiquidationResponseDtoTimeframeEnum._('n4h');
const ExchangeLiquidationResponseDtoTimeframeEnum
_$exchangeLiquidationResponseDtoTimeframeEnum_n12h =
    const ExchangeLiquidationResponseDtoTimeframeEnum._('n12h');
const ExchangeLiquidationResponseDtoTimeframeEnum
_$exchangeLiquidationResponseDtoTimeframeEnum_n24h =
    const ExchangeLiquidationResponseDtoTimeframeEnum._('n24h');

ExchangeLiquidationResponseDtoTimeframeEnum
_$exchangeLiquidationResponseDtoTimeframeEnumValueOf(String name) {
  switch (name) {
    case 'n1h':
      return _$exchangeLiquidationResponseDtoTimeframeEnum_n1h;
    case 'n4h':
      return _$exchangeLiquidationResponseDtoTimeframeEnum_n4h;
    case 'n12h':
      return _$exchangeLiquidationResponseDtoTimeframeEnum_n12h;
    case 'n24h':
      return _$exchangeLiquidationResponseDtoTimeframeEnum_n24h;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<ExchangeLiquidationResponseDtoTimeframeEnum>
_$exchangeLiquidationResponseDtoTimeframeEnumValues =
    BuiltSet<ExchangeLiquidationResponseDtoTimeframeEnum>(
      const <ExchangeLiquidationResponseDtoTimeframeEnum>[
        _$exchangeLiquidationResponseDtoTimeframeEnum_n1h,
        _$exchangeLiquidationResponseDtoTimeframeEnum_n4h,
        _$exchangeLiquidationResponseDtoTimeframeEnum_n12h,
        _$exchangeLiquidationResponseDtoTimeframeEnum_n24h,
      ],
    );

Serializer<ExchangeLiquidationResponseDtoTimeframeEnum>
_$exchangeLiquidationResponseDtoTimeframeEnumSerializer =
    _$ExchangeLiquidationResponseDtoTimeframeEnumSerializer();

class _$ExchangeLiquidationResponseDtoTimeframeEnumSerializer
    implements
        PrimitiveSerializer<ExchangeLiquidationResponseDtoTimeframeEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'n1h': '1h',
    'n4h': '4h',
    'n12h': '12h',
    'n24h': '24h',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    '1h': 'n1h',
    '4h': 'n4h',
    '12h': 'n12h',
    '24h': 'n24h',
  };

  @override
  final Iterable<Type> types = const <Type>[
    ExchangeLiquidationResponseDtoTimeframeEnum,
  ];
  @override
  final String wireName = 'ExchangeLiquidationResponseDtoTimeframeEnum';

  @override
  Object serialize(
    Serializers serializers,
    ExchangeLiquidationResponseDtoTimeframeEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  ExchangeLiquidationResponseDtoTimeframeEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => ExchangeLiquidationResponseDtoTimeframeEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$ExchangeLiquidationResponseDto extends ExchangeLiquidationResponseDto {
  @override
  final String symbol;
  @override
  final ExchangeLiquidationResponseDtoTimeframeEnum timeframe;
  @override
  final BuiltList<ExchangeLiquidationRowDto> rows;

  factory _$ExchangeLiquidationResponseDto([
    void Function(ExchangeLiquidationResponseDtoBuilder)? updates,
  ]) => (ExchangeLiquidationResponseDtoBuilder()..update(updates))._build();

  _$ExchangeLiquidationResponseDto._({
    required this.symbol,
    required this.timeframe,
    required this.rows,
  }) : super._();
  @override
  ExchangeLiquidationResponseDto rebuild(
    void Function(ExchangeLiquidationResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  ExchangeLiquidationResponseDtoBuilder toBuilder() =>
      ExchangeLiquidationResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is ExchangeLiquidationResponseDto &&
        symbol == other.symbol &&
        timeframe == other.timeframe &&
        rows == other.rows;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, symbol.hashCode);
    _$hash = $jc(_$hash, timeframe.hashCode);
    _$hash = $jc(_$hash, rows.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'ExchangeLiquidationResponseDto')
          ..add('symbol', symbol)
          ..add('timeframe', timeframe)
          ..add('rows', rows))
        .toString();
  }
}

class ExchangeLiquidationResponseDtoBuilder
    implements
        Builder<
          ExchangeLiquidationResponseDto,
          ExchangeLiquidationResponseDtoBuilder
        > {
  _$ExchangeLiquidationResponseDto? _$v;

  String? _symbol;
  String? get symbol => _$this._symbol;
  set symbol(String? symbol) => _$this._symbol = symbol;

  ExchangeLiquidationResponseDtoTimeframeEnum? _timeframe;
  ExchangeLiquidationResponseDtoTimeframeEnum? get timeframe =>
      _$this._timeframe;
  set timeframe(ExchangeLiquidationResponseDtoTimeframeEnum? timeframe) =>
      _$this._timeframe = timeframe;

  ListBuilder<ExchangeLiquidationRowDto>? _rows;
  ListBuilder<ExchangeLiquidationRowDto> get rows =>
      _$this._rows ??= ListBuilder<ExchangeLiquidationRowDto>();
  set rows(ListBuilder<ExchangeLiquidationRowDto>? rows) => _$this._rows = rows;

  ExchangeLiquidationResponseDtoBuilder() {
    ExchangeLiquidationResponseDto._defaults(this);
  }

  ExchangeLiquidationResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _symbol = $v.symbol;
      _timeframe = $v.timeframe;
      _rows = $v.rows.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(ExchangeLiquidationResponseDto other) {
    _$v = other as _$ExchangeLiquidationResponseDto;
  }

  @override
  void update(void Function(ExchangeLiquidationResponseDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  ExchangeLiquidationResponseDto build() => _build();

  _$ExchangeLiquidationResponseDto _build() {
    _$ExchangeLiquidationResponseDto _$result;
    try {
      _$result =
          _$v ??
          _$ExchangeLiquidationResponseDto._(
            symbol: BuiltValueNullFieldError.checkNotNull(
              symbol,
              r'ExchangeLiquidationResponseDto',
              'symbol',
            ),
            timeframe: BuiltValueNullFieldError.checkNotNull(
              timeframe,
              r'ExchangeLiquidationResponseDto',
              'timeframe',
            ),
            rows: rows.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'rows';
        rows.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'ExchangeLiquidationResponseDto',
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
