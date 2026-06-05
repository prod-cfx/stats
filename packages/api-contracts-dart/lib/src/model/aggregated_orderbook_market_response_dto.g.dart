// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'aggregated_orderbook_market_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const AggregatedOrderbookMarketResponseDtoTypeEnum
_$aggregatedOrderbookMarketResponseDtoTypeEnum_spot =
    const AggregatedOrderbookMarketResponseDtoTypeEnum._('spot');
const AggregatedOrderbookMarketResponseDtoTypeEnum
_$aggregatedOrderbookMarketResponseDtoTypeEnum_perp =
    const AggregatedOrderbookMarketResponseDtoTypeEnum._('perp');

AggregatedOrderbookMarketResponseDtoTypeEnum
_$aggregatedOrderbookMarketResponseDtoTypeEnumValueOf(String name) {
  switch (name) {
    case 'spot':
      return _$aggregatedOrderbookMarketResponseDtoTypeEnum_spot;
    case 'perp':
      return _$aggregatedOrderbookMarketResponseDtoTypeEnum_perp;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<AggregatedOrderbookMarketResponseDtoTypeEnum>
_$aggregatedOrderbookMarketResponseDtoTypeEnumValues =
    BuiltSet<AggregatedOrderbookMarketResponseDtoTypeEnum>(
      const <AggregatedOrderbookMarketResponseDtoTypeEnum>[
        _$aggregatedOrderbookMarketResponseDtoTypeEnum_spot,
        _$aggregatedOrderbookMarketResponseDtoTypeEnum_perp,
      ],
    );

Serializer<AggregatedOrderbookMarketResponseDtoTypeEnum>
_$aggregatedOrderbookMarketResponseDtoTypeEnumSerializer =
    _$AggregatedOrderbookMarketResponseDtoTypeEnumSerializer();

class _$AggregatedOrderbookMarketResponseDtoTypeEnumSerializer
    implements
        PrimitiveSerializer<AggregatedOrderbookMarketResponseDtoTypeEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'spot': 'spot',
    'perp': 'perp',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'spot': 'spot',
    'perp': 'perp',
  };

  @override
  final Iterable<Type> types = const <Type>[
    AggregatedOrderbookMarketResponseDtoTypeEnum,
  ];
  @override
  final String wireName = 'AggregatedOrderbookMarketResponseDtoTypeEnum';

  @override
  Object serialize(
    Serializers serializers,
    AggregatedOrderbookMarketResponseDtoTypeEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  AggregatedOrderbookMarketResponseDtoTypeEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => AggregatedOrderbookMarketResponseDtoTypeEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$AggregatedOrderbookMarketResponseDto
    extends AggregatedOrderbookMarketResponseDto {
  @override
  final String base_;
  @override
  final AggregatedOrderbookMarketResponseDtoTypeEnum type;
  @override
  final BuiltList<String> venues;

  factory _$AggregatedOrderbookMarketResponseDto([
    void Function(AggregatedOrderbookMarketResponseDtoBuilder)? updates,
  ]) =>
      (AggregatedOrderbookMarketResponseDtoBuilder()..update(updates))._build();

  _$AggregatedOrderbookMarketResponseDto._({
    required this.base_,
    required this.type,
    required this.venues,
  }) : super._();
  @override
  AggregatedOrderbookMarketResponseDto rebuild(
    void Function(AggregatedOrderbookMarketResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AggregatedOrderbookMarketResponseDtoBuilder toBuilder() =>
      AggregatedOrderbookMarketResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AggregatedOrderbookMarketResponseDto &&
        base_ == other.base_ &&
        type == other.type &&
        venues == other.venues;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, base_.hashCode);
    _$hash = $jc(_$hash, type.hashCode);
    _$hash = $jc(_$hash, venues.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'AggregatedOrderbookMarketResponseDto')
          ..add('base_', base_)
          ..add('type', type)
          ..add('venues', venues))
        .toString();
  }
}

class AggregatedOrderbookMarketResponseDtoBuilder
    implements
        Builder<
          AggregatedOrderbookMarketResponseDto,
          AggregatedOrderbookMarketResponseDtoBuilder
        > {
  _$AggregatedOrderbookMarketResponseDto? _$v;

  String? _base_;
  String? get base_ => _$this._base_;
  set base_(String? base_) => _$this._base_ = base_;

  AggregatedOrderbookMarketResponseDtoTypeEnum? _type;
  AggregatedOrderbookMarketResponseDtoTypeEnum? get type => _$this._type;
  set type(AggregatedOrderbookMarketResponseDtoTypeEnum? type) =>
      _$this._type = type;

  ListBuilder<String>? _venues;
  ListBuilder<String> get venues => _$this._venues ??= ListBuilder<String>();
  set venues(ListBuilder<String>? venues) => _$this._venues = venues;

  AggregatedOrderbookMarketResponseDtoBuilder() {
    AggregatedOrderbookMarketResponseDto._defaults(this);
  }

  AggregatedOrderbookMarketResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _base_ = $v.base_;
      _type = $v.type;
      _venues = $v.venues.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AggregatedOrderbookMarketResponseDto other) {
    _$v = other as _$AggregatedOrderbookMarketResponseDto;
  }

  @override
  void update(
    void Function(AggregatedOrderbookMarketResponseDtoBuilder)? updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  AggregatedOrderbookMarketResponseDto build() => _build();

  _$AggregatedOrderbookMarketResponseDto _build() {
    _$AggregatedOrderbookMarketResponseDto _$result;
    try {
      _$result =
          _$v ??
          _$AggregatedOrderbookMarketResponseDto._(
            base_: BuiltValueNullFieldError.checkNotNull(
              base_,
              r'AggregatedOrderbookMarketResponseDto',
              'base_',
            ),
            type: BuiltValueNullFieldError.checkNotNull(
              type,
              r'AggregatedOrderbookMarketResponseDto',
              'type',
            ),
            venues: venues.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'venues';
        venues.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'AggregatedOrderbookMarketResponseDto',
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
