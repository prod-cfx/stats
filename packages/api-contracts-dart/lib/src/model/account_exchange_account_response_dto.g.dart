// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'account_exchange_account_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const AccountExchangeAccountResponseDtoExchangeIdEnum
_$accountExchangeAccountResponseDtoExchangeIdEnum_binance =
    const AccountExchangeAccountResponseDtoExchangeIdEnum._('binance');
const AccountExchangeAccountResponseDtoExchangeIdEnum
_$accountExchangeAccountResponseDtoExchangeIdEnum_okx =
    const AccountExchangeAccountResponseDtoExchangeIdEnum._('okx');
const AccountExchangeAccountResponseDtoExchangeIdEnum
_$accountExchangeAccountResponseDtoExchangeIdEnum_hyperliquid =
    const AccountExchangeAccountResponseDtoExchangeIdEnum._('hyperliquid');

AccountExchangeAccountResponseDtoExchangeIdEnum
_$accountExchangeAccountResponseDtoExchangeIdEnumValueOf(String name) {
  switch (name) {
    case 'binance':
      return _$accountExchangeAccountResponseDtoExchangeIdEnum_binance;
    case 'okx':
      return _$accountExchangeAccountResponseDtoExchangeIdEnum_okx;
    case 'hyperliquid':
      return _$accountExchangeAccountResponseDtoExchangeIdEnum_hyperliquid;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<AccountExchangeAccountResponseDtoExchangeIdEnum>
_$accountExchangeAccountResponseDtoExchangeIdEnumValues =
    BuiltSet<AccountExchangeAccountResponseDtoExchangeIdEnum>(
      const <AccountExchangeAccountResponseDtoExchangeIdEnum>[
        _$accountExchangeAccountResponseDtoExchangeIdEnum_binance,
        _$accountExchangeAccountResponseDtoExchangeIdEnum_okx,
        _$accountExchangeAccountResponseDtoExchangeIdEnum_hyperliquid,
      ],
    );

Serializer<AccountExchangeAccountResponseDtoExchangeIdEnum>
_$accountExchangeAccountResponseDtoExchangeIdEnumSerializer =
    _$AccountExchangeAccountResponseDtoExchangeIdEnumSerializer();

class _$AccountExchangeAccountResponseDtoExchangeIdEnumSerializer
    implements
        PrimitiveSerializer<AccountExchangeAccountResponseDtoExchangeIdEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'binance': 'binance',
    'okx': 'okx',
    'hyperliquid': 'hyperliquid',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'binance': 'binance',
    'okx': 'okx',
    'hyperliquid': 'hyperliquid',
  };

  @override
  final Iterable<Type> types = const <Type>[
    AccountExchangeAccountResponseDtoExchangeIdEnum,
  ];
  @override
  final String wireName = 'AccountExchangeAccountResponseDtoExchangeIdEnum';

  @override
  Object serialize(
    Serializers serializers,
    AccountExchangeAccountResponseDtoExchangeIdEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  AccountExchangeAccountResponseDtoExchangeIdEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => AccountExchangeAccountResponseDtoExchangeIdEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$AccountExchangeAccountResponseDto
    extends AccountExchangeAccountResponseDto {
  @override
  final String? id;
  @override
  final AccountExchangeAccountResponseDtoExchangeIdEnum exchangeId;
  @override
  final bool isBound;
  @override
  final String? name;
  @override
  final String? maskedCredential;
  @override
  final bool? isTestnet;
  @override
  final DateTime? lastValidatedAt;
  @override
  final DateTime? createdAt;

  factory _$AccountExchangeAccountResponseDto([
    void Function(AccountExchangeAccountResponseDtoBuilder)? updates,
  ]) => (AccountExchangeAccountResponseDtoBuilder()..update(updates))._build();

  _$AccountExchangeAccountResponseDto._({
    this.id,
    required this.exchangeId,
    required this.isBound,
    this.name,
    this.maskedCredential,
    this.isTestnet,
    this.lastValidatedAt,
    this.createdAt,
  }) : super._();
  @override
  AccountExchangeAccountResponseDto rebuild(
    void Function(AccountExchangeAccountResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AccountExchangeAccountResponseDtoBuilder toBuilder() =>
      AccountExchangeAccountResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AccountExchangeAccountResponseDto &&
        id == other.id &&
        exchangeId == other.exchangeId &&
        isBound == other.isBound &&
        name == other.name &&
        maskedCredential == other.maskedCredential &&
        isTestnet == other.isTestnet &&
        lastValidatedAt == other.lastValidatedAt &&
        createdAt == other.createdAt;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, id.hashCode);
    _$hash = $jc(_$hash, exchangeId.hashCode);
    _$hash = $jc(_$hash, isBound.hashCode);
    _$hash = $jc(_$hash, name.hashCode);
    _$hash = $jc(_$hash, maskedCredential.hashCode);
    _$hash = $jc(_$hash, isTestnet.hashCode);
    _$hash = $jc(_$hash, lastValidatedAt.hashCode);
    _$hash = $jc(_$hash, createdAt.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'AccountExchangeAccountResponseDto')
          ..add('id', id)
          ..add('exchangeId', exchangeId)
          ..add('isBound', isBound)
          ..add('name', name)
          ..add('maskedCredential', maskedCredential)
          ..add('isTestnet', isTestnet)
          ..add('lastValidatedAt', lastValidatedAt)
          ..add('createdAt', createdAt))
        .toString();
  }
}

class AccountExchangeAccountResponseDtoBuilder
    implements
        Builder<
          AccountExchangeAccountResponseDto,
          AccountExchangeAccountResponseDtoBuilder
        > {
  _$AccountExchangeAccountResponseDto? _$v;

  String? _id;
  String? get id => _$this._id;
  set id(String? id) => _$this._id = id;

  AccountExchangeAccountResponseDtoExchangeIdEnum? _exchangeId;
  AccountExchangeAccountResponseDtoExchangeIdEnum? get exchangeId =>
      _$this._exchangeId;
  set exchangeId(AccountExchangeAccountResponseDtoExchangeIdEnum? exchangeId) =>
      _$this._exchangeId = exchangeId;

  bool? _isBound;
  bool? get isBound => _$this._isBound;
  set isBound(bool? isBound) => _$this._isBound = isBound;

  String? _name;
  String? get name => _$this._name;
  set name(String? name) => _$this._name = name;

  String? _maskedCredential;
  String? get maskedCredential => _$this._maskedCredential;
  set maskedCredential(String? maskedCredential) =>
      _$this._maskedCredential = maskedCredential;

  bool? _isTestnet;
  bool? get isTestnet => _$this._isTestnet;
  set isTestnet(bool? isTestnet) => _$this._isTestnet = isTestnet;

  DateTime? _lastValidatedAt;
  DateTime? get lastValidatedAt => _$this._lastValidatedAt;
  set lastValidatedAt(DateTime? lastValidatedAt) =>
      _$this._lastValidatedAt = lastValidatedAt;

  DateTime? _createdAt;
  DateTime? get createdAt => _$this._createdAt;
  set createdAt(DateTime? createdAt) => _$this._createdAt = createdAt;

  AccountExchangeAccountResponseDtoBuilder() {
    AccountExchangeAccountResponseDto._defaults(this);
  }

  AccountExchangeAccountResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _exchangeId = $v.exchangeId;
      _isBound = $v.isBound;
      _name = $v.name;
      _maskedCredential = $v.maskedCredential;
      _isTestnet = $v.isTestnet;
      _lastValidatedAt = $v.lastValidatedAt;
      _createdAt = $v.createdAt;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AccountExchangeAccountResponseDto other) {
    _$v = other as _$AccountExchangeAccountResponseDto;
  }

  @override
  void update(
    void Function(AccountExchangeAccountResponseDtoBuilder)? updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  AccountExchangeAccountResponseDto build() => _build();

  _$AccountExchangeAccountResponseDto _build() {
    final _$result =
        _$v ??
        _$AccountExchangeAccountResponseDto._(
          id: id,
          exchangeId: BuiltValueNullFieldError.checkNotNull(
            exchangeId,
            r'AccountExchangeAccountResponseDto',
            'exchangeId',
          ),
          isBound: BuiltValueNullFieldError.checkNotNull(
            isBound,
            r'AccountExchangeAccountResponseDto',
            'isBound',
          ),
          name: name,
          maskedCredential: maskedCredential,
          isTestnet: isTestnet,
          lastValidatedAt: lastValidatedAt,
          createdAt: createdAt,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
