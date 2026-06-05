// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'whale_notification_rule_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const WhaleNotificationRuleResponseDtoTypeEnum
_$whaleNotificationRuleResponseDtoTypeEnum_ADDRESS =
    const WhaleNotificationRuleResponseDtoTypeEnum._('ADDRESS');
const WhaleNotificationRuleResponseDtoTypeEnum
_$whaleNotificationRuleResponseDtoTypeEnum_SYMBOL =
    const WhaleNotificationRuleResponseDtoTypeEnum._('SYMBOL');

WhaleNotificationRuleResponseDtoTypeEnum
_$whaleNotificationRuleResponseDtoTypeEnumValueOf(String name) {
  switch (name) {
    case 'ADDRESS':
      return _$whaleNotificationRuleResponseDtoTypeEnum_ADDRESS;
    case 'SYMBOL':
      return _$whaleNotificationRuleResponseDtoTypeEnum_SYMBOL;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<WhaleNotificationRuleResponseDtoTypeEnum>
_$whaleNotificationRuleResponseDtoTypeEnumValues =
    BuiltSet<WhaleNotificationRuleResponseDtoTypeEnum>(
      const <WhaleNotificationRuleResponseDtoTypeEnum>[
        _$whaleNotificationRuleResponseDtoTypeEnum_ADDRESS,
        _$whaleNotificationRuleResponseDtoTypeEnum_SYMBOL,
      ],
    );

Serializer<WhaleNotificationRuleResponseDtoTypeEnum>
_$whaleNotificationRuleResponseDtoTypeEnumSerializer =
    _$WhaleNotificationRuleResponseDtoTypeEnumSerializer();

class _$WhaleNotificationRuleResponseDtoTypeEnumSerializer
    implements PrimitiveSerializer<WhaleNotificationRuleResponseDtoTypeEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'ADDRESS': 'ADDRESS',
    'SYMBOL': 'SYMBOL',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'ADDRESS': 'ADDRESS',
    'SYMBOL': 'SYMBOL',
  };

  @override
  final Iterable<Type> types = const <Type>[
    WhaleNotificationRuleResponseDtoTypeEnum,
  ];
  @override
  final String wireName = 'WhaleNotificationRuleResponseDtoTypeEnum';

  @override
  Object serialize(
    Serializers serializers,
    WhaleNotificationRuleResponseDtoTypeEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  WhaleNotificationRuleResponseDtoTypeEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => WhaleNotificationRuleResponseDtoTypeEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$WhaleNotificationRuleResponseDto
    extends WhaleNotificationRuleResponseDto {
  @override
  final String id;
  @override
  final WhaleNotificationRuleResponseDtoTypeEnum type;
  @override
  final String? address;
  @override
  final String? symbol;
  @override
  final num thresholdUsd;
  @override
  final String? note;
  @override
  final WhaleNotificationChannelsDto channels;
  @override
  final bool isActive;
  @override
  final String createdAt;
  @override
  final String updatedAt;

  factory _$WhaleNotificationRuleResponseDto([
    void Function(WhaleNotificationRuleResponseDtoBuilder)? updates,
  ]) => (WhaleNotificationRuleResponseDtoBuilder()..update(updates))._build();

  _$WhaleNotificationRuleResponseDto._({
    required this.id,
    required this.type,
    this.address,
    this.symbol,
    required this.thresholdUsd,
    this.note,
    required this.channels,
    required this.isActive,
    required this.createdAt,
    required this.updatedAt,
  }) : super._();
  @override
  WhaleNotificationRuleResponseDto rebuild(
    void Function(WhaleNotificationRuleResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  WhaleNotificationRuleResponseDtoBuilder toBuilder() =>
      WhaleNotificationRuleResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is WhaleNotificationRuleResponseDto &&
        id == other.id &&
        type == other.type &&
        address == other.address &&
        symbol == other.symbol &&
        thresholdUsd == other.thresholdUsd &&
        note == other.note &&
        channels == other.channels &&
        isActive == other.isActive &&
        createdAt == other.createdAt &&
        updatedAt == other.updatedAt;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, id.hashCode);
    _$hash = $jc(_$hash, type.hashCode);
    _$hash = $jc(_$hash, address.hashCode);
    _$hash = $jc(_$hash, symbol.hashCode);
    _$hash = $jc(_$hash, thresholdUsd.hashCode);
    _$hash = $jc(_$hash, note.hashCode);
    _$hash = $jc(_$hash, channels.hashCode);
    _$hash = $jc(_$hash, isActive.hashCode);
    _$hash = $jc(_$hash, createdAt.hashCode);
    _$hash = $jc(_$hash, updatedAt.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'WhaleNotificationRuleResponseDto')
          ..add('id', id)
          ..add('type', type)
          ..add('address', address)
          ..add('symbol', symbol)
          ..add('thresholdUsd', thresholdUsd)
          ..add('note', note)
          ..add('channels', channels)
          ..add('isActive', isActive)
          ..add('createdAt', createdAt)
          ..add('updatedAt', updatedAt))
        .toString();
  }
}

class WhaleNotificationRuleResponseDtoBuilder
    implements
        Builder<
          WhaleNotificationRuleResponseDto,
          WhaleNotificationRuleResponseDtoBuilder
        > {
  _$WhaleNotificationRuleResponseDto? _$v;

  String? _id;
  String? get id => _$this._id;
  set id(String? id) => _$this._id = id;

  WhaleNotificationRuleResponseDtoTypeEnum? _type;
  WhaleNotificationRuleResponseDtoTypeEnum? get type => _$this._type;
  set type(WhaleNotificationRuleResponseDtoTypeEnum? type) =>
      _$this._type = type;

  String? _address;
  String? get address => _$this._address;
  set address(String? address) => _$this._address = address;

  String? _symbol;
  String? get symbol => _$this._symbol;
  set symbol(String? symbol) => _$this._symbol = symbol;

  num? _thresholdUsd;
  num? get thresholdUsd => _$this._thresholdUsd;
  set thresholdUsd(num? thresholdUsd) => _$this._thresholdUsd = thresholdUsd;

  String? _note;
  String? get note => _$this._note;
  set note(String? note) => _$this._note = note;

  WhaleNotificationChannelsDtoBuilder? _channels;
  WhaleNotificationChannelsDtoBuilder get channels =>
      _$this._channels ??= WhaleNotificationChannelsDtoBuilder();
  set channels(WhaleNotificationChannelsDtoBuilder? channels) =>
      _$this._channels = channels;

  bool? _isActive;
  bool? get isActive => _$this._isActive;
  set isActive(bool? isActive) => _$this._isActive = isActive;

  String? _createdAt;
  String? get createdAt => _$this._createdAt;
  set createdAt(String? createdAt) => _$this._createdAt = createdAt;

  String? _updatedAt;
  String? get updatedAt => _$this._updatedAt;
  set updatedAt(String? updatedAt) => _$this._updatedAt = updatedAt;

  WhaleNotificationRuleResponseDtoBuilder() {
    WhaleNotificationRuleResponseDto._defaults(this);
  }

  WhaleNotificationRuleResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _type = $v.type;
      _address = $v.address;
      _symbol = $v.symbol;
      _thresholdUsd = $v.thresholdUsd;
      _note = $v.note;
      _channels = $v.channels.toBuilder();
      _isActive = $v.isActive;
      _createdAt = $v.createdAt;
      _updatedAt = $v.updatedAt;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(WhaleNotificationRuleResponseDto other) {
    _$v = other as _$WhaleNotificationRuleResponseDto;
  }

  @override
  void update(void Function(WhaleNotificationRuleResponseDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  WhaleNotificationRuleResponseDto build() => _build();

  _$WhaleNotificationRuleResponseDto _build() {
    _$WhaleNotificationRuleResponseDto _$result;
    try {
      _$result =
          _$v ??
          _$WhaleNotificationRuleResponseDto._(
            id: BuiltValueNullFieldError.checkNotNull(
              id,
              r'WhaleNotificationRuleResponseDto',
              'id',
            ),
            type: BuiltValueNullFieldError.checkNotNull(
              type,
              r'WhaleNotificationRuleResponseDto',
              'type',
            ),
            address: address,
            symbol: symbol,
            thresholdUsd: BuiltValueNullFieldError.checkNotNull(
              thresholdUsd,
              r'WhaleNotificationRuleResponseDto',
              'thresholdUsd',
            ),
            note: note,
            channels: channels.build(),
            isActive: BuiltValueNullFieldError.checkNotNull(
              isActive,
              r'WhaleNotificationRuleResponseDto',
              'isActive',
            ),
            createdAt: BuiltValueNullFieldError.checkNotNull(
              createdAt,
              r'WhaleNotificationRuleResponseDto',
              'createdAt',
            ),
            updatedAt: BuiltValueNullFieldError.checkNotNull(
              updatedAt,
              r'WhaleNotificationRuleResponseDto',
              'updatedAt',
            ),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'channels';
        channels.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'WhaleNotificationRuleResponseDto',
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
