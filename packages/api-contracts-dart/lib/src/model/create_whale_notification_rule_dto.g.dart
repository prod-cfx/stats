// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_whale_notification_rule_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const CreateWhaleNotificationRuleDtoTypeEnum
_$createWhaleNotificationRuleDtoTypeEnum_ADDRESS =
    const CreateWhaleNotificationRuleDtoTypeEnum._('ADDRESS');
const CreateWhaleNotificationRuleDtoTypeEnum
_$createWhaleNotificationRuleDtoTypeEnum_SYMBOL =
    const CreateWhaleNotificationRuleDtoTypeEnum._('SYMBOL');

CreateWhaleNotificationRuleDtoTypeEnum
_$createWhaleNotificationRuleDtoTypeEnumValueOf(String name) {
  switch (name) {
    case 'ADDRESS':
      return _$createWhaleNotificationRuleDtoTypeEnum_ADDRESS;
    case 'SYMBOL':
      return _$createWhaleNotificationRuleDtoTypeEnum_SYMBOL;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<CreateWhaleNotificationRuleDtoTypeEnum>
_$createWhaleNotificationRuleDtoTypeEnumValues =
    BuiltSet<CreateWhaleNotificationRuleDtoTypeEnum>(
      const <CreateWhaleNotificationRuleDtoTypeEnum>[
        _$createWhaleNotificationRuleDtoTypeEnum_ADDRESS,
        _$createWhaleNotificationRuleDtoTypeEnum_SYMBOL,
      ],
    );

Serializer<CreateWhaleNotificationRuleDtoTypeEnum>
_$createWhaleNotificationRuleDtoTypeEnumSerializer =
    _$CreateWhaleNotificationRuleDtoTypeEnumSerializer();

class _$CreateWhaleNotificationRuleDtoTypeEnumSerializer
    implements PrimitiveSerializer<CreateWhaleNotificationRuleDtoTypeEnum> {
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
    CreateWhaleNotificationRuleDtoTypeEnum,
  ];
  @override
  final String wireName = 'CreateWhaleNotificationRuleDtoTypeEnum';

  @override
  Object serialize(
    Serializers serializers,
    CreateWhaleNotificationRuleDtoTypeEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  CreateWhaleNotificationRuleDtoTypeEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => CreateWhaleNotificationRuleDtoTypeEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$CreateWhaleNotificationRuleDto extends CreateWhaleNotificationRuleDto {
  @override
  final CreateWhaleNotificationRuleDtoTypeEnum type;
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

  factory _$CreateWhaleNotificationRuleDto([
    void Function(CreateWhaleNotificationRuleDtoBuilder)? updates,
  ]) => (CreateWhaleNotificationRuleDtoBuilder()..update(updates))._build();

  _$CreateWhaleNotificationRuleDto._({
    required this.type,
    this.address,
    this.symbol,
    required this.thresholdUsd,
    this.note,
    required this.channels,
  }) : super._();
  @override
  CreateWhaleNotificationRuleDto rebuild(
    void Function(CreateWhaleNotificationRuleDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  CreateWhaleNotificationRuleDtoBuilder toBuilder() =>
      CreateWhaleNotificationRuleDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is CreateWhaleNotificationRuleDto &&
        type == other.type &&
        address == other.address &&
        symbol == other.symbol &&
        thresholdUsd == other.thresholdUsd &&
        note == other.note &&
        channels == other.channels;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, type.hashCode);
    _$hash = $jc(_$hash, address.hashCode);
    _$hash = $jc(_$hash, symbol.hashCode);
    _$hash = $jc(_$hash, thresholdUsd.hashCode);
    _$hash = $jc(_$hash, note.hashCode);
    _$hash = $jc(_$hash, channels.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'CreateWhaleNotificationRuleDto')
          ..add('type', type)
          ..add('address', address)
          ..add('symbol', symbol)
          ..add('thresholdUsd', thresholdUsd)
          ..add('note', note)
          ..add('channels', channels))
        .toString();
  }
}

class CreateWhaleNotificationRuleDtoBuilder
    implements
        Builder<
          CreateWhaleNotificationRuleDto,
          CreateWhaleNotificationRuleDtoBuilder
        > {
  _$CreateWhaleNotificationRuleDto? _$v;

  CreateWhaleNotificationRuleDtoTypeEnum? _type;
  CreateWhaleNotificationRuleDtoTypeEnum? get type => _$this._type;
  set type(CreateWhaleNotificationRuleDtoTypeEnum? type) => _$this._type = type;

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

  CreateWhaleNotificationRuleDtoBuilder() {
    CreateWhaleNotificationRuleDto._defaults(this);
  }

  CreateWhaleNotificationRuleDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _type = $v.type;
      _address = $v.address;
      _symbol = $v.symbol;
      _thresholdUsd = $v.thresholdUsd;
      _note = $v.note;
      _channels = $v.channels.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(CreateWhaleNotificationRuleDto other) {
    _$v = other as _$CreateWhaleNotificationRuleDto;
  }

  @override
  void update(void Function(CreateWhaleNotificationRuleDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  CreateWhaleNotificationRuleDto build() => _build();

  _$CreateWhaleNotificationRuleDto _build() {
    _$CreateWhaleNotificationRuleDto _$result;
    try {
      _$result =
          _$v ??
          _$CreateWhaleNotificationRuleDto._(
            type: BuiltValueNullFieldError.checkNotNull(
              type,
              r'CreateWhaleNotificationRuleDto',
              'type',
            ),
            address: address,
            symbol: symbol,
            thresholdUsd: BuiltValueNullFieldError.checkNotNull(
              thresholdUsd,
              r'CreateWhaleNotificationRuleDto',
              'thresholdUsd',
            ),
            note: note,
            channels: channels.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'channels';
        channels.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'CreateWhaleNotificationRuleDto',
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
