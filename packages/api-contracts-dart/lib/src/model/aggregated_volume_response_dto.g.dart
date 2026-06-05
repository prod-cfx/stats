// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'aggregated_volume_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const AggregatedVolumeResponseDtoInstrumentTypeEnum
_$aggregatedVolumeResponseDtoInstrumentTypeEnum_SPOT =
    const AggregatedVolumeResponseDtoInstrumentTypeEnum._('SPOT');
const AggregatedVolumeResponseDtoInstrumentTypeEnum
_$aggregatedVolumeResponseDtoInstrumentTypeEnum_PERPETUAL =
    const AggregatedVolumeResponseDtoInstrumentTypeEnum._('PERPETUAL');

AggregatedVolumeResponseDtoInstrumentTypeEnum
_$aggregatedVolumeResponseDtoInstrumentTypeEnumValueOf(String name) {
  switch (name) {
    case 'SPOT':
      return _$aggregatedVolumeResponseDtoInstrumentTypeEnum_SPOT;
    case 'PERPETUAL':
      return _$aggregatedVolumeResponseDtoInstrumentTypeEnum_PERPETUAL;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<AggregatedVolumeResponseDtoInstrumentTypeEnum>
_$aggregatedVolumeResponseDtoInstrumentTypeEnumValues =
    BuiltSet<AggregatedVolumeResponseDtoInstrumentTypeEnum>(
      const <AggregatedVolumeResponseDtoInstrumentTypeEnum>[
        _$aggregatedVolumeResponseDtoInstrumentTypeEnum_SPOT,
        _$aggregatedVolumeResponseDtoInstrumentTypeEnum_PERPETUAL,
      ],
    );

Serializer<AggregatedVolumeResponseDtoInstrumentTypeEnum>
_$aggregatedVolumeResponseDtoInstrumentTypeEnumSerializer =
    _$AggregatedVolumeResponseDtoInstrumentTypeEnumSerializer();

class _$AggregatedVolumeResponseDtoInstrumentTypeEnumSerializer
    implements
        PrimitiveSerializer<AggregatedVolumeResponseDtoInstrumentTypeEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'SPOT': 'SPOT',
    'PERPETUAL': 'PERPETUAL',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'SPOT': 'SPOT',
    'PERPETUAL': 'PERPETUAL',
  };

  @override
  final Iterable<Type> types = const <Type>[
    AggregatedVolumeResponseDtoInstrumentTypeEnum,
  ];
  @override
  final String wireName = 'AggregatedVolumeResponseDtoInstrumentTypeEnum';

  @override
  Object serialize(
    Serializers serializers,
    AggregatedVolumeResponseDtoInstrumentTypeEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  AggregatedVolumeResponseDtoInstrumentTypeEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => AggregatedVolumeResponseDtoInstrumentTypeEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$AggregatedVolumeResponseDto extends AggregatedVolumeResponseDto {
  @override
  final num id;
  @override
  final String exchange;
  @override
  final String symbol;
  @override
  final AggregatedVolumeResponseDtoInstrumentTypeEnum? instrumentType;
  @override
  final String volumeUsd;
  @override
  final String dataTimestamp;
  @override
  final String source_;
  @override
  final String createdAt;
  @override
  final String updatedAt;

  factory _$AggregatedVolumeResponseDto([
    void Function(AggregatedVolumeResponseDtoBuilder)? updates,
  ]) => (AggregatedVolumeResponseDtoBuilder()..update(updates))._build();

  _$AggregatedVolumeResponseDto._({
    required this.id,
    required this.exchange,
    required this.symbol,
    this.instrumentType,
    required this.volumeUsd,
    required this.dataTimestamp,
    required this.source_,
    required this.createdAt,
    required this.updatedAt,
  }) : super._();
  @override
  AggregatedVolumeResponseDto rebuild(
    void Function(AggregatedVolumeResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AggregatedVolumeResponseDtoBuilder toBuilder() =>
      AggregatedVolumeResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AggregatedVolumeResponseDto &&
        id == other.id &&
        exchange == other.exchange &&
        symbol == other.symbol &&
        instrumentType == other.instrumentType &&
        volumeUsd == other.volumeUsd &&
        dataTimestamp == other.dataTimestamp &&
        source_ == other.source_ &&
        createdAt == other.createdAt &&
        updatedAt == other.updatedAt;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, id.hashCode);
    _$hash = $jc(_$hash, exchange.hashCode);
    _$hash = $jc(_$hash, symbol.hashCode);
    _$hash = $jc(_$hash, instrumentType.hashCode);
    _$hash = $jc(_$hash, volumeUsd.hashCode);
    _$hash = $jc(_$hash, dataTimestamp.hashCode);
    _$hash = $jc(_$hash, source_.hashCode);
    _$hash = $jc(_$hash, createdAt.hashCode);
    _$hash = $jc(_$hash, updatedAt.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'AggregatedVolumeResponseDto')
          ..add('id', id)
          ..add('exchange', exchange)
          ..add('symbol', symbol)
          ..add('instrumentType', instrumentType)
          ..add('volumeUsd', volumeUsd)
          ..add('dataTimestamp', dataTimestamp)
          ..add('source_', source_)
          ..add('createdAt', createdAt)
          ..add('updatedAt', updatedAt))
        .toString();
  }
}

class AggregatedVolumeResponseDtoBuilder
    implements
        Builder<
          AggregatedVolumeResponseDto,
          AggregatedVolumeResponseDtoBuilder
        > {
  _$AggregatedVolumeResponseDto? _$v;

  num? _id;
  num? get id => _$this._id;
  set id(num? id) => _$this._id = id;

  String? _exchange;
  String? get exchange => _$this._exchange;
  set exchange(String? exchange) => _$this._exchange = exchange;

  String? _symbol;
  String? get symbol => _$this._symbol;
  set symbol(String? symbol) => _$this._symbol = symbol;

  AggregatedVolumeResponseDtoInstrumentTypeEnum? _instrumentType;
  AggregatedVolumeResponseDtoInstrumentTypeEnum? get instrumentType =>
      _$this._instrumentType;
  set instrumentType(
    AggregatedVolumeResponseDtoInstrumentTypeEnum? instrumentType,
  ) => _$this._instrumentType = instrumentType;

  String? _volumeUsd;
  String? get volumeUsd => _$this._volumeUsd;
  set volumeUsd(String? volumeUsd) => _$this._volumeUsd = volumeUsd;

  String? _dataTimestamp;
  String? get dataTimestamp => _$this._dataTimestamp;
  set dataTimestamp(String? dataTimestamp) =>
      _$this._dataTimestamp = dataTimestamp;

  String? _source_;
  String? get source_ => _$this._source_;
  set source_(String? source_) => _$this._source_ = source_;

  String? _createdAt;
  String? get createdAt => _$this._createdAt;
  set createdAt(String? createdAt) => _$this._createdAt = createdAt;

  String? _updatedAt;
  String? get updatedAt => _$this._updatedAt;
  set updatedAt(String? updatedAt) => _$this._updatedAt = updatedAt;

  AggregatedVolumeResponseDtoBuilder() {
    AggregatedVolumeResponseDto._defaults(this);
  }

  AggregatedVolumeResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _exchange = $v.exchange;
      _symbol = $v.symbol;
      _instrumentType = $v.instrumentType;
      _volumeUsd = $v.volumeUsd;
      _dataTimestamp = $v.dataTimestamp;
      _source_ = $v.source_;
      _createdAt = $v.createdAt;
      _updatedAt = $v.updatedAt;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AggregatedVolumeResponseDto other) {
    _$v = other as _$AggregatedVolumeResponseDto;
  }

  @override
  void update(void Function(AggregatedVolumeResponseDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  AggregatedVolumeResponseDto build() => _build();

  _$AggregatedVolumeResponseDto _build() {
    final _$result =
        _$v ??
        _$AggregatedVolumeResponseDto._(
          id: BuiltValueNullFieldError.checkNotNull(
            id,
            r'AggregatedVolumeResponseDto',
            'id',
          ),
          exchange: BuiltValueNullFieldError.checkNotNull(
            exchange,
            r'AggregatedVolumeResponseDto',
            'exchange',
          ),
          symbol: BuiltValueNullFieldError.checkNotNull(
            symbol,
            r'AggregatedVolumeResponseDto',
            'symbol',
          ),
          instrumentType: instrumentType,
          volumeUsd: BuiltValueNullFieldError.checkNotNull(
            volumeUsd,
            r'AggregatedVolumeResponseDto',
            'volumeUsd',
          ),
          dataTimestamp: BuiltValueNullFieldError.checkNotNull(
            dataTimestamp,
            r'AggregatedVolumeResponseDto',
            'dataTimestamp',
          ),
          source_: BuiltValueNullFieldError.checkNotNull(
            source_,
            r'AggregatedVolumeResponseDto',
            'source_',
          ),
          createdAt: BuiltValueNullFieldError.checkNotNull(
            createdAt,
            r'AggregatedVolumeResponseDto',
            'createdAt',
          ),
          updatedAt: BuiltValueNullFieldError.checkNotNull(
            updatedAt,
            r'AggregatedVolumeResponseDto',
            'updatedAt',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
