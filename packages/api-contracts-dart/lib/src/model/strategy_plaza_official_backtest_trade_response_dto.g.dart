// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'strategy_plaza_official_backtest_trade_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const StrategyPlazaOfficialBacktestTradeResponseDtoSideEnum
_$strategyPlazaOfficialBacktestTradeResponseDtoSideEnum_LONG =
    const StrategyPlazaOfficialBacktestTradeResponseDtoSideEnum._('LONG');
const StrategyPlazaOfficialBacktestTradeResponseDtoSideEnum
_$strategyPlazaOfficialBacktestTradeResponseDtoSideEnum_SHORT =
    const StrategyPlazaOfficialBacktestTradeResponseDtoSideEnum._('SHORT');

StrategyPlazaOfficialBacktestTradeResponseDtoSideEnum
_$strategyPlazaOfficialBacktestTradeResponseDtoSideEnumValueOf(String name) {
  switch (name) {
    case 'LONG':
      return _$strategyPlazaOfficialBacktestTradeResponseDtoSideEnum_LONG;
    case 'SHORT':
      return _$strategyPlazaOfficialBacktestTradeResponseDtoSideEnum_SHORT;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<StrategyPlazaOfficialBacktestTradeResponseDtoSideEnum>
_$strategyPlazaOfficialBacktestTradeResponseDtoSideEnumValues =
    BuiltSet<StrategyPlazaOfficialBacktestTradeResponseDtoSideEnum>(
      const <StrategyPlazaOfficialBacktestTradeResponseDtoSideEnum>[
        _$strategyPlazaOfficialBacktestTradeResponseDtoSideEnum_LONG,
        _$strategyPlazaOfficialBacktestTradeResponseDtoSideEnum_SHORT,
      ],
    );

Serializer<StrategyPlazaOfficialBacktestTradeResponseDtoSideEnum>
_$strategyPlazaOfficialBacktestTradeResponseDtoSideEnumSerializer =
    _$StrategyPlazaOfficialBacktestTradeResponseDtoSideEnumSerializer();

class _$StrategyPlazaOfficialBacktestTradeResponseDtoSideEnumSerializer
    implements
        PrimitiveSerializer<
          StrategyPlazaOfficialBacktestTradeResponseDtoSideEnum
        > {
  static const Map<String, Object> _toWire = const <String, Object>{
    'LONG': 'LONG',
    'SHORT': 'SHORT',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'LONG': 'LONG',
    'SHORT': 'SHORT',
  };

  @override
  final Iterable<Type> types = const <Type>[
    StrategyPlazaOfficialBacktestTradeResponseDtoSideEnum,
  ];
  @override
  final String wireName =
      'StrategyPlazaOfficialBacktestTradeResponseDtoSideEnum';

  @override
  Object serialize(
    Serializers serializers,
    StrategyPlazaOfficialBacktestTradeResponseDtoSideEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  StrategyPlazaOfficialBacktestTradeResponseDtoSideEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => StrategyPlazaOfficialBacktestTradeResponseDtoSideEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$StrategyPlazaOfficialBacktestTradeResponseDto
    extends StrategyPlazaOfficialBacktestTradeResponseDto {
  @override
  final String id;
  @override
  final StrategyPlazaOfficialBacktestTradeResponseDtoSideEnum side;
  @override
  final num entryTs;
  @override
  final num entryPrice;
  @override
  final num exitTs;
  @override
  final num exitPrice;
  @override
  final num returnPct;
  @override
  final String? reasonOpen;
  @override
  final String? reasonClose;
  @override
  final String? reasonOpenDisplay;
  @override
  final String? reasonCloseDisplay;

  factory _$StrategyPlazaOfficialBacktestTradeResponseDto([
    void Function(StrategyPlazaOfficialBacktestTradeResponseDtoBuilder)?
    updates,
  ]) =>
      (StrategyPlazaOfficialBacktestTradeResponseDtoBuilder()..update(updates))
          ._build();

  _$StrategyPlazaOfficialBacktestTradeResponseDto._({
    required this.id,
    required this.side,
    required this.entryTs,
    required this.entryPrice,
    required this.exitTs,
    required this.exitPrice,
    required this.returnPct,
    this.reasonOpen,
    this.reasonClose,
    this.reasonOpenDisplay,
    this.reasonCloseDisplay,
  }) : super._();
  @override
  StrategyPlazaOfficialBacktestTradeResponseDto rebuild(
    void Function(StrategyPlazaOfficialBacktestTradeResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  StrategyPlazaOfficialBacktestTradeResponseDtoBuilder toBuilder() =>
      StrategyPlazaOfficialBacktestTradeResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is StrategyPlazaOfficialBacktestTradeResponseDto &&
        id == other.id &&
        side == other.side &&
        entryTs == other.entryTs &&
        entryPrice == other.entryPrice &&
        exitTs == other.exitTs &&
        exitPrice == other.exitPrice &&
        returnPct == other.returnPct &&
        reasonOpen == other.reasonOpen &&
        reasonClose == other.reasonClose &&
        reasonOpenDisplay == other.reasonOpenDisplay &&
        reasonCloseDisplay == other.reasonCloseDisplay;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, id.hashCode);
    _$hash = $jc(_$hash, side.hashCode);
    _$hash = $jc(_$hash, entryTs.hashCode);
    _$hash = $jc(_$hash, entryPrice.hashCode);
    _$hash = $jc(_$hash, exitTs.hashCode);
    _$hash = $jc(_$hash, exitPrice.hashCode);
    _$hash = $jc(_$hash, returnPct.hashCode);
    _$hash = $jc(_$hash, reasonOpen.hashCode);
    _$hash = $jc(_$hash, reasonClose.hashCode);
    _$hash = $jc(_$hash, reasonOpenDisplay.hashCode);
    _$hash = $jc(_$hash, reasonCloseDisplay.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(
            r'StrategyPlazaOfficialBacktestTradeResponseDto',
          )
          ..add('id', id)
          ..add('side', side)
          ..add('entryTs', entryTs)
          ..add('entryPrice', entryPrice)
          ..add('exitTs', exitTs)
          ..add('exitPrice', exitPrice)
          ..add('returnPct', returnPct)
          ..add('reasonOpen', reasonOpen)
          ..add('reasonClose', reasonClose)
          ..add('reasonOpenDisplay', reasonOpenDisplay)
          ..add('reasonCloseDisplay', reasonCloseDisplay))
        .toString();
  }
}

class StrategyPlazaOfficialBacktestTradeResponseDtoBuilder
    implements
        Builder<
          StrategyPlazaOfficialBacktestTradeResponseDto,
          StrategyPlazaOfficialBacktestTradeResponseDtoBuilder
        > {
  _$StrategyPlazaOfficialBacktestTradeResponseDto? _$v;

  String? _id;
  String? get id => _$this._id;
  set id(String? id) => _$this._id = id;

  StrategyPlazaOfficialBacktestTradeResponseDtoSideEnum? _side;
  StrategyPlazaOfficialBacktestTradeResponseDtoSideEnum? get side =>
      _$this._side;
  set side(StrategyPlazaOfficialBacktestTradeResponseDtoSideEnum? side) =>
      _$this._side = side;

  num? _entryTs;
  num? get entryTs => _$this._entryTs;
  set entryTs(num? entryTs) => _$this._entryTs = entryTs;

  num? _entryPrice;
  num? get entryPrice => _$this._entryPrice;
  set entryPrice(num? entryPrice) => _$this._entryPrice = entryPrice;

  num? _exitTs;
  num? get exitTs => _$this._exitTs;
  set exitTs(num? exitTs) => _$this._exitTs = exitTs;

  num? _exitPrice;
  num? get exitPrice => _$this._exitPrice;
  set exitPrice(num? exitPrice) => _$this._exitPrice = exitPrice;

  num? _returnPct;
  num? get returnPct => _$this._returnPct;
  set returnPct(num? returnPct) => _$this._returnPct = returnPct;

  String? _reasonOpen;
  String? get reasonOpen => _$this._reasonOpen;
  set reasonOpen(String? reasonOpen) => _$this._reasonOpen = reasonOpen;

  String? _reasonClose;
  String? get reasonClose => _$this._reasonClose;
  set reasonClose(String? reasonClose) => _$this._reasonClose = reasonClose;

  String? _reasonOpenDisplay;
  String? get reasonOpenDisplay => _$this._reasonOpenDisplay;
  set reasonOpenDisplay(String? reasonOpenDisplay) =>
      _$this._reasonOpenDisplay = reasonOpenDisplay;

  String? _reasonCloseDisplay;
  String? get reasonCloseDisplay => _$this._reasonCloseDisplay;
  set reasonCloseDisplay(String? reasonCloseDisplay) =>
      _$this._reasonCloseDisplay = reasonCloseDisplay;

  StrategyPlazaOfficialBacktestTradeResponseDtoBuilder() {
    StrategyPlazaOfficialBacktestTradeResponseDto._defaults(this);
  }

  StrategyPlazaOfficialBacktestTradeResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _side = $v.side;
      _entryTs = $v.entryTs;
      _entryPrice = $v.entryPrice;
      _exitTs = $v.exitTs;
      _exitPrice = $v.exitPrice;
      _returnPct = $v.returnPct;
      _reasonOpen = $v.reasonOpen;
      _reasonClose = $v.reasonClose;
      _reasonOpenDisplay = $v.reasonOpenDisplay;
      _reasonCloseDisplay = $v.reasonCloseDisplay;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(StrategyPlazaOfficialBacktestTradeResponseDto other) {
    _$v = other as _$StrategyPlazaOfficialBacktestTradeResponseDto;
  }

  @override
  void update(
    void Function(StrategyPlazaOfficialBacktestTradeResponseDtoBuilder)?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  StrategyPlazaOfficialBacktestTradeResponseDto build() => _build();

  _$StrategyPlazaOfficialBacktestTradeResponseDto _build() {
    final _$result =
        _$v ??
        _$StrategyPlazaOfficialBacktestTradeResponseDto._(
          id: BuiltValueNullFieldError.checkNotNull(
            id,
            r'StrategyPlazaOfficialBacktestTradeResponseDto',
            'id',
          ),
          side: BuiltValueNullFieldError.checkNotNull(
            side,
            r'StrategyPlazaOfficialBacktestTradeResponseDto',
            'side',
          ),
          entryTs: BuiltValueNullFieldError.checkNotNull(
            entryTs,
            r'StrategyPlazaOfficialBacktestTradeResponseDto',
            'entryTs',
          ),
          entryPrice: BuiltValueNullFieldError.checkNotNull(
            entryPrice,
            r'StrategyPlazaOfficialBacktestTradeResponseDto',
            'entryPrice',
          ),
          exitTs: BuiltValueNullFieldError.checkNotNull(
            exitTs,
            r'StrategyPlazaOfficialBacktestTradeResponseDto',
            'exitTs',
          ),
          exitPrice: BuiltValueNullFieldError.checkNotNull(
            exitPrice,
            r'StrategyPlazaOfficialBacktestTradeResponseDto',
            'exitPrice',
          ),
          returnPct: BuiltValueNullFieldError.checkNotNull(
            returnPct,
            r'StrategyPlazaOfficialBacktestTradeResponseDto',
            'returnPct',
          ),
          reasonOpen: reasonOpen,
          reasonClose: reasonClose,
          reasonOpenDisplay: reasonOpenDisplay,
          reasonCloseDisplay: reasonCloseDisplay,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
