// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'liquidation_summary_item_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const LiquidationSummaryItemDtoTimeframeEnum
_$liquidationSummaryItemDtoTimeframeEnum_n1h =
    const LiquidationSummaryItemDtoTimeframeEnum._('n1h');
const LiquidationSummaryItemDtoTimeframeEnum
_$liquidationSummaryItemDtoTimeframeEnum_n4h =
    const LiquidationSummaryItemDtoTimeframeEnum._('n4h');
const LiquidationSummaryItemDtoTimeframeEnum
_$liquidationSummaryItemDtoTimeframeEnum_n12h =
    const LiquidationSummaryItemDtoTimeframeEnum._('n12h');
const LiquidationSummaryItemDtoTimeframeEnum
_$liquidationSummaryItemDtoTimeframeEnum_n24h =
    const LiquidationSummaryItemDtoTimeframeEnum._('n24h');

LiquidationSummaryItemDtoTimeframeEnum
_$liquidationSummaryItemDtoTimeframeEnumValueOf(String name) {
  switch (name) {
    case 'n1h':
      return _$liquidationSummaryItemDtoTimeframeEnum_n1h;
    case 'n4h':
      return _$liquidationSummaryItemDtoTimeframeEnum_n4h;
    case 'n12h':
      return _$liquidationSummaryItemDtoTimeframeEnum_n12h;
    case 'n24h':
      return _$liquidationSummaryItemDtoTimeframeEnum_n24h;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<LiquidationSummaryItemDtoTimeframeEnum>
_$liquidationSummaryItemDtoTimeframeEnumValues =
    BuiltSet<LiquidationSummaryItemDtoTimeframeEnum>(
      const <LiquidationSummaryItemDtoTimeframeEnum>[
        _$liquidationSummaryItemDtoTimeframeEnum_n1h,
        _$liquidationSummaryItemDtoTimeframeEnum_n4h,
        _$liquidationSummaryItemDtoTimeframeEnum_n12h,
        _$liquidationSummaryItemDtoTimeframeEnum_n24h,
      ],
    );

Serializer<LiquidationSummaryItemDtoTimeframeEnum>
_$liquidationSummaryItemDtoTimeframeEnumSerializer =
    _$LiquidationSummaryItemDtoTimeframeEnumSerializer();

class _$LiquidationSummaryItemDtoTimeframeEnumSerializer
    implements PrimitiveSerializer<LiquidationSummaryItemDtoTimeframeEnum> {
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
    LiquidationSummaryItemDtoTimeframeEnum,
  ];
  @override
  final String wireName = 'LiquidationSummaryItemDtoTimeframeEnum';

  @override
  Object serialize(
    Serializers serializers,
    LiquidationSummaryItemDtoTimeframeEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  LiquidationSummaryItemDtoTimeframeEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => LiquidationSummaryItemDtoTimeframeEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$LiquidationSummaryItemDto extends LiquidationSummaryItemDto {
  @override
  final LiquidationSummaryItemDtoTimeframeEnum timeframe;
  @override
  final num totalUsd;
  @override
  final num longUsd;
  @override
  final num shortUsd;

  factory _$LiquidationSummaryItemDto([
    void Function(LiquidationSummaryItemDtoBuilder)? updates,
  ]) => (LiquidationSummaryItemDtoBuilder()..update(updates))._build();

  _$LiquidationSummaryItemDto._({
    required this.timeframe,
    required this.totalUsd,
    required this.longUsd,
    required this.shortUsd,
  }) : super._();
  @override
  LiquidationSummaryItemDto rebuild(
    void Function(LiquidationSummaryItemDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  LiquidationSummaryItemDtoBuilder toBuilder() =>
      LiquidationSummaryItemDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is LiquidationSummaryItemDto &&
        timeframe == other.timeframe &&
        totalUsd == other.totalUsd &&
        longUsd == other.longUsd &&
        shortUsd == other.shortUsd;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, timeframe.hashCode);
    _$hash = $jc(_$hash, totalUsd.hashCode);
    _$hash = $jc(_$hash, longUsd.hashCode);
    _$hash = $jc(_$hash, shortUsd.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'LiquidationSummaryItemDto')
          ..add('timeframe', timeframe)
          ..add('totalUsd', totalUsd)
          ..add('longUsd', longUsd)
          ..add('shortUsd', shortUsd))
        .toString();
  }
}

class LiquidationSummaryItemDtoBuilder
    implements
        Builder<LiquidationSummaryItemDto, LiquidationSummaryItemDtoBuilder> {
  _$LiquidationSummaryItemDto? _$v;

  LiquidationSummaryItemDtoTimeframeEnum? _timeframe;
  LiquidationSummaryItemDtoTimeframeEnum? get timeframe => _$this._timeframe;
  set timeframe(LiquidationSummaryItemDtoTimeframeEnum? timeframe) =>
      _$this._timeframe = timeframe;

  num? _totalUsd;
  num? get totalUsd => _$this._totalUsd;
  set totalUsd(num? totalUsd) => _$this._totalUsd = totalUsd;

  num? _longUsd;
  num? get longUsd => _$this._longUsd;
  set longUsd(num? longUsd) => _$this._longUsd = longUsd;

  num? _shortUsd;
  num? get shortUsd => _$this._shortUsd;
  set shortUsd(num? shortUsd) => _$this._shortUsd = shortUsd;

  LiquidationSummaryItemDtoBuilder() {
    LiquidationSummaryItemDto._defaults(this);
  }

  LiquidationSummaryItemDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _timeframe = $v.timeframe;
      _totalUsd = $v.totalUsd;
      _longUsd = $v.longUsd;
      _shortUsd = $v.shortUsd;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(LiquidationSummaryItemDto other) {
    _$v = other as _$LiquidationSummaryItemDto;
  }

  @override
  void update(void Function(LiquidationSummaryItemDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  LiquidationSummaryItemDto build() => _build();

  _$LiquidationSummaryItemDto _build() {
    final _$result =
        _$v ??
        _$LiquidationSummaryItemDto._(
          timeframe: BuiltValueNullFieldError.checkNotNull(
            timeframe,
            r'LiquidationSummaryItemDto',
            'timeframe',
          ),
          totalUsd: BuiltValueNullFieldError.checkNotNull(
            totalUsd,
            r'LiquidationSummaryItemDto',
            'totalUsd',
          ),
          longUsd: BuiltValueNullFieldError.checkNotNull(
            longUsd,
            r'LiquidationSummaryItemDto',
            'longUsd',
          ),
          shortUsd: BuiltValueNullFieldError.checkNotNull(
            shortUsd,
            r'LiquidationSummaryItemDto',
            'shortUsd',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
