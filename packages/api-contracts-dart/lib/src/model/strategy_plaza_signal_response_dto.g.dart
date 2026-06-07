// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'strategy_plaza_signal_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const StrategyPlazaSignalResponseDtoSideEnum
_$strategyPlazaSignalResponseDtoSideEnum_buy =
    const StrategyPlazaSignalResponseDtoSideEnum._('buy');
const StrategyPlazaSignalResponseDtoSideEnum
_$strategyPlazaSignalResponseDtoSideEnum_sell =
    const StrategyPlazaSignalResponseDtoSideEnum._('sell');

StrategyPlazaSignalResponseDtoSideEnum
_$strategyPlazaSignalResponseDtoSideEnumValueOf(String name) {
  switch (name) {
    case 'buy':
      return _$strategyPlazaSignalResponseDtoSideEnum_buy;
    case 'sell':
      return _$strategyPlazaSignalResponseDtoSideEnum_sell;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<StrategyPlazaSignalResponseDtoSideEnum>
_$strategyPlazaSignalResponseDtoSideEnumValues =
    BuiltSet<StrategyPlazaSignalResponseDtoSideEnum>(
      const <StrategyPlazaSignalResponseDtoSideEnum>[
        _$strategyPlazaSignalResponseDtoSideEnum_buy,
        _$strategyPlazaSignalResponseDtoSideEnum_sell,
      ],
    );

Serializer<StrategyPlazaSignalResponseDtoSideEnum>
_$strategyPlazaSignalResponseDtoSideEnumSerializer =
    _$StrategyPlazaSignalResponseDtoSideEnumSerializer();

class _$StrategyPlazaSignalResponseDtoSideEnumSerializer
    implements PrimitiveSerializer<StrategyPlazaSignalResponseDtoSideEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'buy': 'buy',
    'sell': 'sell',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'buy': 'buy',
    'sell': 'sell',
  };

  @override
  final Iterable<Type> types = const <Type>[
    StrategyPlazaSignalResponseDtoSideEnum,
  ];
  @override
  final String wireName = 'StrategyPlazaSignalResponseDtoSideEnum';

  @override
  Object serialize(
    Serializers serializers,
    StrategyPlazaSignalResponseDtoSideEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  StrategyPlazaSignalResponseDtoSideEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => StrategyPlazaSignalResponseDtoSideEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$StrategyPlazaSignalResponseDto extends StrategyPlazaSignalResponseDto {
  @override
  final String time;
  @override
  final StrategyPlazaSignalResponseDtoSideEnum side;
  @override
  final num price;
  @override
  final num pnlPercent;

  factory _$StrategyPlazaSignalResponseDto([
    void Function(StrategyPlazaSignalResponseDtoBuilder)? updates,
  ]) => (StrategyPlazaSignalResponseDtoBuilder()..update(updates))._build();

  _$StrategyPlazaSignalResponseDto._({
    required this.time,
    required this.side,
    required this.price,
    required this.pnlPercent,
  }) : super._();
  @override
  StrategyPlazaSignalResponseDto rebuild(
    void Function(StrategyPlazaSignalResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  StrategyPlazaSignalResponseDtoBuilder toBuilder() =>
      StrategyPlazaSignalResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is StrategyPlazaSignalResponseDto &&
        time == other.time &&
        side == other.side &&
        price == other.price &&
        pnlPercent == other.pnlPercent;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, time.hashCode);
    _$hash = $jc(_$hash, side.hashCode);
    _$hash = $jc(_$hash, price.hashCode);
    _$hash = $jc(_$hash, pnlPercent.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'StrategyPlazaSignalResponseDto')
          ..add('time', time)
          ..add('side', side)
          ..add('price', price)
          ..add('pnlPercent', pnlPercent))
        .toString();
  }
}

class StrategyPlazaSignalResponseDtoBuilder
    implements
        Builder<
          StrategyPlazaSignalResponseDto,
          StrategyPlazaSignalResponseDtoBuilder
        > {
  _$StrategyPlazaSignalResponseDto? _$v;

  String? _time;
  String? get time => _$this._time;
  set time(String? time) => _$this._time = time;

  StrategyPlazaSignalResponseDtoSideEnum? _side;
  StrategyPlazaSignalResponseDtoSideEnum? get side => _$this._side;
  set side(StrategyPlazaSignalResponseDtoSideEnum? side) => _$this._side = side;

  num? _price;
  num? get price => _$this._price;
  set price(num? price) => _$this._price = price;

  num? _pnlPercent;
  num? get pnlPercent => _$this._pnlPercent;
  set pnlPercent(num? pnlPercent) => _$this._pnlPercent = pnlPercent;

  StrategyPlazaSignalResponseDtoBuilder() {
    StrategyPlazaSignalResponseDto._defaults(this);
  }

  StrategyPlazaSignalResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _time = $v.time;
      _side = $v.side;
      _price = $v.price;
      _pnlPercent = $v.pnlPercent;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(StrategyPlazaSignalResponseDto other) {
    _$v = other as _$StrategyPlazaSignalResponseDto;
  }

  @override
  void update(void Function(StrategyPlazaSignalResponseDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  StrategyPlazaSignalResponseDto build() => _build();

  _$StrategyPlazaSignalResponseDto _build() {
    final _$result =
        _$v ??
        _$StrategyPlazaSignalResponseDto._(
          time: BuiltValueNullFieldError.checkNotNull(
            time,
            r'StrategyPlazaSignalResponseDto',
            'time',
          ),
          side: BuiltValueNullFieldError.checkNotNull(
            side,
            r'StrategyPlazaSignalResponseDto',
            'side',
          ),
          price: BuiltValueNullFieldError.checkNotNull(
            price,
            r'StrategyPlazaSignalResponseDto',
            'price',
          ),
          pnlPercent: BuiltValueNullFieldError.checkNotNull(
            pnlPercent,
            r'StrategyPlazaSignalResponseDto',
            'pnlPercent',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
