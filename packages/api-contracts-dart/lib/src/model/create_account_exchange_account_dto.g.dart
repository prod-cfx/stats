// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_account_exchange_account_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const CreateAccountExchangeAccountDtoExchangeIdEnum
_$createAccountExchangeAccountDtoExchangeIdEnum_binance =
    const CreateAccountExchangeAccountDtoExchangeIdEnum._('binance');
const CreateAccountExchangeAccountDtoExchangeIdEnum
_$createAccountExchangeAccountDtoExchangeIdEnum_okx =
    const CreateAccountExchangeAccountDtoExchangeIdEnum._('okx');
const CreateAccountExchangeAccountDtoExchangeIdEnum
_$createAccountExchangeAccountDtoExchangeIdEnum_hyperliquid =
    const CreateAccountExchangeAccountDtoExchangeIdEnum._('hyperliquid');

CreateAccountExchangeAccountDtoExchangeIdEnum
_$createAccountExchangeAccountDtoExchangeIdEnumValueOf(String name) {
  switch (name) {
    case 'binance':
      return _$createAccountExchangeAccountDtoExchangeIdEnum_binance;
    case 'okx':
      return _$createAccountExchangeAccountDtoExchangeIdEnum_okx;
    case 'hyperliquid':
      return _$createAccountExchangeAccountDtoExchangeIdEnum_hyperliquid;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<CreateAccountExchangeAccountDtoExchangeIdEnum>
_$createAccountExchangeAccountDtoExchangeIdEnumValues =
    BuiltSet<CreateAccountExchangeAccountDtoExchangeIdEnum>(
      const <CreateAccountExchangeAccountDtoExchangeIdEnum>[
        _$createAccountExchangeAccountDtoExchangeIdEnum_binance,
        _$createAccountExchangeAccountDtoExchangeIdEnum_okx,
        _$createAccountExchangeAccountDtoExchangeIdEnum_hyperliquid,
      ],
    );

const CreateAccountExchangeAccountDtoMarketTypeEnum
_$createAccountExchangeAccountDtoMarketTypeEnum_spot =
    const CreateAccountExchangeAccountDtoMarketTypeEnum._('spot');
const CreateAccountExchangeAccountDtoMarketTypeEnum
_$createAccountExchangeAccountDtoMarketTypeEnum_perp =
    const CreateAccountExchangeAccountDtoMarketTypeEnum._('perp');

CreateAccountExchangeAccountDtoMarketTypeEnum
_$createAccountExchangeAccountDtoMarketTypeEnumValueOf(String name) {
  switch (name) {
    case 'spot':
      return _$createAccountExchangeAccountDtoMarketTypeEnum_spot;
    case 'perp':
      return _$createAccountExchangeAccountDtoMarketTypeEnum_perp;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<CreateAccountExchangeAccountDtoMarketTypeEnum>
_$createAccountExchangeAccountDtoMarketTypeEnumValues =
    BuiltSet<CreateAccountExchangeAccountDtoMarketTypeEnum>(
      const <CreateAccountExchangeAccountDtoMarketTypeEnum>[
        _$createAccountExchangeAccountDtoMarketTypeEnum_spot,
        _$createAccountExchangeAccountDtoMarketTypeEnum_perp,
      ],
    );

Serializer<CreateAccountExchangeAccountDtoExchangeIdEnum>
_$createAccountExchangeAccountDtoExchangeIdEnumSerializer =
    _$CreateAccountExchangeAccountDtoExchangeIdEnumSerializer();
Serializer<CreateAccountExchangeAccountDtoMarketTypeEnum>
_$createAccountExchangeAccountDtoMarketTypeEnumSerializer =
    _$CreateAccountExchangeAccountDtoMarketTypeEnumSerializer();

class _$CreateAccountExchangeAccountDtoExchangeIdEnumSerializer
    implements
        PrimitiveSerializer<CreateAccountExchangeAccountDtoExchangeIdEnum> {
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
    CreateAccountExchangeAccountDtoExchangeIdEnum,
  ];
  @override
  final String wireName = 'CreateAccountExchangeAccountDtoExchangeIdEnum';

  @override
  Object serialize(
    Serializers serializers,
    CreateAccountExchangeAccountDtoExchangeIdEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  CreateAccountExchangeAccountDtoExchangeIdEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => CreateAccountExchangeAccountDtoExchangeIdEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$CreateAccountExchangeAccountDtoMarketTypeEnumSerializer
    implements
        PrimitiveSerializer<CreateAccountExchangeAccountDtoMarketTypeEnum> {
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
    CreateAccountExchangeAccountDtoMarketTypeEnum,
  ];
  @override
  final String wireName = 'CreateAccountExchangeAccountDtoMarketTypeEnum';

  @override
  Object serialize(
    Serializers serializers,
    CreateAccountExchangeAccountDtoMarketTypeEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  CreateAccountExchangeAccountDtoMarketTypeEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => CreateAccountExchangeAccountDtoMarketTypeEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$CreateAccountExchangeAccountDto
    extends CreateAccountExchangeAccountDto {
  @override
  final CreateAccountExchangeAccountDtoExchangeIdEnum exchangeId;
  @override
  final String? name;
  @override
  final bool? isTestnet;
  @override
  final CreateAccountExchangeAccountDtoMarketTypeEnum? marketType;
  @override
  final String? apiKey;
  @override
  final String? apiSecret;
  @override
  final String? passphrase;
  @override
  final String? mainWalletAddress;
  @override
  final String? agentPrivateKey;

  factory _$CreateAccountExchangeAccountDto([
    void Function(CreateAccountExchangeAccountDtoBuilder)? updates,
  ]) => (CreateAccountExchangeAccountDtoBuilder()..update(updates))._build();

  _$CreateAccountExchangeAccountDto._({
    required this.exchangeId,
    this.name,
    this.isTestnet,
    this.marketType,
    this.apiKey,
    this.apiSecret,
    this.passphrase,
    this.mainWalletAddress,
    this.agentPrivateKey,
  }) : super._();
  @override
  CreateAccountExchangeAccountDto rebuild(
    void Function(CreateAccountExchangeAccountDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  CreateAccountExchangeAccountDtoBuilder toBuilder() =>
      CreateAccountExchangeAccountDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is CreateAccountExchangeAccountDto &&
        exchangeId == other.exchangeId &&
        name == other.name &&
        isTestnet == other.isTestnet &&
        marketType == other.marketType &&
        apiKey == other.apiKey &&
        apiSecret == other.apiSecret &&
        passphrase == other.passphrase &&
        mainWalletAddress == other.mainWalletAddress &&
        agentPrivateKey == other.agentPrivateKey;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, exchangeId.hashCode);
    _$hash = $jc(_$hash, name.hashCode);
    _$hash = $jc(_$hash, isTestnet.hashCode);
    _$hash = $jc(_$hash, marketType.hashCode);
    _$hash = $jc(_$hash, apiKey.hashCode);
    _$hash = $jc(_$hash, apiSecret.hashCode);
    _$hash = $jc(_$hash, passphrase.hashCode);
    _$hash = $jc(_$hash, mainWalletAddress.hashCode);
    _$hash = $jc(_$hash, agentPrivateKey.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'CreateAccountExchangeAccountDto')
          ..add('exchangeId', exchangeId)
          ..add('name', name)
          ..add('isTestnet', isTestnet)
          ..add('marketType', marketType)
          ..add('apiKey', apiKey)
          ..add('apiSecret', apiSecret)
          ..add('passphrase', passphrase)
          ..add('mainWalletAddress', mainWalletAddress)
          ..add('agentPrivateKey', agentPrivateKey))
        .toString();
  }
}

class CreateAccountExchangeAccountDtoBuilder
    implements
        Builder<
          CreateAccountExchangeAccountDto,
          CreateAccountExchangeAccountDtoBuilder
        > {
  _$CreateAccountExchangeAccountDto? _$v;

  CreateAccountExchangeAccountDtoExchangeIdEnum? _exchangeId;
  CreateAccountExchangeAccountDtoExchangeIdEnum? get exchangeId =>
      _$this._exchangeId;
  set exchangeId(CreateAccountExchangeAccountDtoExchangeIdEnum? exchangeId) =>
      _$this._exchangeId = exchangeId;

  String? _name;
  String? get name => _$this._name;
  set name(String? name) => _$this._name = name;

  bool? _isTestnet;
  bool? get isTestnet => _$this._isTestnet;
  set isTestnet(bool? isTestnet) => _$this._isTestnet = isTestnet;

  CreateAccountExchangeAccountDtoMarketTypeEnum? _marketType;
  CreateAccountExchangeAccountDtoMarketTypeEnum? get marketType =>
      _$this._marketType;
  set marketType(CreateAccountExchangeAccountDtoMarketTypeEnum? marketType) =>
      _$this._marketType = marketType;

  String? _apiKey;
  String? get apiKey => _$this._apiKey;
  set apiKey(String? apiKey) => _$this._apiKey = apiKey;

  String? _apiSecret;
  String? get apiSecret => _$this._apiSecret;
  set apiSecret(String? apiSecret) => _$this._apiSecret = apiSecret;

  String? _passphrase;
  String? get passphrase => _$this._passphrase;
  set passphrase(String? passphrase) => _$this._passphrase = passphrase;

  String? _mainWalletAddress;
  String? get mainWalletAddress => _$this._mainWalletAddress;
  set mainWalletAddress(String? mainWalletAddress) =>
      _$this._mainWalletAddress = mainWalletAddress;

  String? _agentPrivateKey;
  String? get agentPrivateKey => _$this._agentPrivateKey;
  set agentPrivateKey(String? agentPrivateKey) =>
      _$this._agentPrivateKey = agentPrivateKey;

  CreateAccountExchangeAccountDtoBuilder() {
    CreateAccountExchangeAccountDto._defaults(this);
  }

  CreateAccountExchangeAccountDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _exchangeId = $v.exchangeId;
      _name = $v.name;
      _isTestnet = $v.isTestnet;
      _marketType = $v.marketType;
      _apiKey = $v.apiKey;
      _apiSecret = $v.apiSecret;
      _passphrase = $v.passphrase;
      _mainWalletAddress = $v.mainWalletAddress;
      _agentPrivateKey = $v.agentPrivateKey;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(CreateAccountExchangeAccountDto other) {
    _$v = other as _$CreateAccountExchangeAccountDto;
  }

  @override
  void update(void Function(CreateAccountExchangeAccountDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  CreateAccountExchangeAccountDto build() => _build();

  _$CreateAccountExchangeAccountDto _build() {
    final _$result =
        _$v ??
        _$CreateAccountExchangeAccountDto._(
          exchangeId: BuiltValueNullFieldError.checkNotNull(
            exchangeId,
            r'CreateAccountExchangeAccountDto',
            'exchangeId',
          ),
          name: name,
          isTestnet: isTestnet,
          marketType: marketType,
          apiKey: apiKey,
          apiSecret: apiSecret,
          passphrase: passphrase,
          mainWalletAddress: mainWalletAddress,
          agentPrivateKey: agentPrivateKey,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
