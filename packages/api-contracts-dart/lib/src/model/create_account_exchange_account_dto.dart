//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'create_account_exchange_account_dto.g.dart';

/// CreateAccountExchangeAccountDto
///
/// Properties:
/// * [exchangeId] 
/// * [name] 
/// * [isTestnet] 
/// * [marketType] 
/// * [apiKey] 
/// * [apiSecret] 
/// * [passphrase] 
/// * [mainWalletAddress] 
/// * [agentPrivateKey] 
@BuiltValue()
abstract class CreateAccountExchangeAccountDto implements Built<CreateAccountExchangeAccountDto, CreateAccountExchangeAccountDtoBuilder> {
  @BuiltValueField(wireName: r'exchangeId')
  CreateAccountExchangeAccountDtoExchangeIdEnum get exchangeId;
  // enum exchangeIdEnum {  binance,  okx,  hyperliquid,  };

  @BuiltValueField(wireName: r'name')
  String? get name;

  @BuiltValueField(wireName: r'isTestnet')
  bool? get isTestnet;

  @BuiltValueField(wireName: r'marketType')
  CreateAccountExchangeAccountDtoMarketTypeEnum? get marketType;
  // enum marketTypeEnum {  spot,  perp,  };

  @BuiltValueField(wireName: r'apiKey')
  String? get apiKey;

  @BuiltValueField(wireName: r'apiSecret')
  String? get apiSecret;

  @BuiltValueField(wireName: r'passphrase')
  String? get passphrase;

  @BuiltValueField(wireName: r'mainWalletAddress')
  String? get mainWalletAddress;

  @BuiltValueField(wireName: r'agentPrivateKey')
  String? get agentPrivateKey;

  CreateAccountExchangeAccountDto._();

  factory CreateAccountExchangeAccountDto([void updates(CreateAccountExchangeAccountDtoBuilder b)]) = _$CreateAccountExchangeAccountDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(CreateAccountExchangeAccountDtoBuilder b) => b
      ..isTestnet = false
      ..marketType = CreateAccountExchangeAccountDtoMarketTypeEnum.valueOf('spot');

  @BuiltValueSerializer(custom: true)
  static Serializer<CreateAccountExchangeAccountDto> get serializer => _$CreateAccountExchangeAccountDtoSerializer();
}

class _$CreateAccountExchangeAccountDtoSerializer implements PrimitiveSerializer<CreateAccountExchangeAccountDto> {
  @override
  final Iterable<Type> types = const [CreateAccountExchangeAccountDto, _$CreateAccountExchangeAccountDto];

  @override
  final String wireName = r'CreateAccountExchangeAccountDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    CreateAccountExchangeAccountDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'exchangeId';
    yield serializers.serialize(
      object.exchangeId,
      specifiedType: const FullType(CreateAccountExchangeAccountDtoExchangeIdEnum),
    );
    if (object.name != null) {
      yield r'name';
      yield serializers.serialize(
        object.name,
        specifiedType: const FullType(String),
      );
    }
    if (object.isTestnet != null) {
      yield r'isTestnet';
      yield serializers.serialize(
        object.isTestnet,
        specifiedType: const FullType(bool),
      );
    }
    if (object.marketType != null) {
      yield r'marketType';
      yield serializers.serialize(
        object.marketType,
        specifiedType: const FullType(CreateAccountExchangeAccountDtoMarketTypeEnum),
      );
    }
    if (object.apiKey != null) {
      yield r'apiKey';
      yield serializers.serialize(
        object.apiKey,
        specifiedType: const FullType(String),
      );
    }
    if (object.apiSecret != null) {
      yield r'apiSecret';
      yield serializers.serialize(
        object.apiSecret,
        specifiedType: const FullType(String),
      );
    }
    if (object.passphrase != null) {
      yield r'passphrase';
      yield serializers.serialize(
        object.passphrase,
        specifiedType: const FullType(String),
      );
    }
    if (object.mainWalletAddress != null) {
      yield r'mainWalletAddress';
      yield serializers.serialize(
        object.mainWalletAddress,
        specifiedType: const FullType(String),
      );
    }
    if (object.agentPrivateKey != null) {
      yield r'agentPrivateKey';
      yield serializers.serialize(
        object.agentPrivateKey,
        specifiedType: const FullType(String),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    CreateAccountExchangeAccountDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required CreateAccountExchangeAccountDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'exchangeId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(CreateAccountExchangeAccountDtoExchangeIdEnum),
          ) as CreateAccountExchangeAccountDtoExchangeIdEnum;
          result.exchangeId = valueDes;
          break;
        case r'name':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.name = valueDes;
          break;
        case r'isTestnet':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.isTestnet = valueDes;
          break;
        case r'marketType':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(CreateAccountExchangeAccountDtoMarketTypeEnum),
          ) as CreateAccountExchangeAccountDtoMarketTypeEnum;
          result.marketType = valueDes;
          break;
        case r'apiKey':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.apiKey = valueDes;
          break;
        case r'apiSecret':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.apiSecret = valueDes;
          break;
        case r'passphrase':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.passphrase = valueDes;
          break;
        case r'mainWalletAddress':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.mainWalletAddress = valueDes;
          break;
        case r'agentPrivateKey':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.agentPrivateKey = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  CreateAccountExchangeAccountDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = CreateAccountExchangeAccountDtoBuilder();
    final serializedList = (serialized as Iterable<Object?>).toList();
    final unhandled = <Object?>[];
    _deserializeProperties(
      serializers,
      serialized,
      specifiedType: specifiedType,
      serializedList: serializedList,
      unhandled: unhandled,
      result: result,
    );
    return result.build();
  }
}

class CreateAccountExchangeAccountDtoExchangeIdEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'binance')
  static const CreateAccountExchangeAccountDtoExchangeIdEnum binance = _$createAccountExchangeAccountDtoExchangeIdEnum_binance;
  @BuiltValueEnumConst(wireName: r'okx')
  static const CreateAccountExchangeAccountDtoExchangeIdEnum okx = _$createAccountExchangeAccountDtoExchangeIdEnum_okx;
  @BuiltValueEnumConst(wireName: r'hyperliquid')
  static const CreateAccountExchangeAccountDtoExchangeIdEnum hyperliquid = _$createAccountExchangeAccountDtoExchangeIdEnum_hyperliquid;

  static Serializer<CreateAccountExchangeAccountDtoExchangeIdEnum> get serializer => _$createAccountExchangeAccountDtoExchangeIdEnumSerializer;

  const CreateAccountExchangeAccountDtoExchangeIdEnum._(String name): super(name);

  static BuiltSet<CreateAccountExchangeAccountDtoExchangeIdEnum> get values => _$createAccountExchangeAccountDtoExchangeIdEnumValues;
  static CreateAccountExchangeAccountDtoExchangeIdEnum valueOf(String name) => _$createAccountExchangeAccountDtoExchangeIdEnumValueOf(name);
}

class CreateAccountExchangeAccountDtoMarketTypeEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'spot')
  static const CreateAccountExchangeAccountDtoMarketTypeEnum spot = _$createAccountExchangeAccountDtoMarketTypeEnum_spot;
  @BuiltValueEnumConst(wireName: r'perp')
  static const CreateAccountExchangeAccountDtoMarketTypeEnum perp = _$createAccountExchangeAccountDtoMarketTypeEnum_perp;

  static Serializer<CreateAccountExchangeAccountDtoMarketTypeEnum> get serializer => _$createAccountExchangeAccountDtoMarketTypeEnumSerializer;

  const CreateAccountExchangeAccountDtoMarketTypeEnum._(String name): super(name);

  static BuiltSet<CreateAccountExchangeAccountDtoMarketTypeEnum> get values => _$createAccountExchangeAccountDtoMarketTypeEnumValues;
  static CreateAccountExchangeAccountDtoMarketTypeEnum valueOf(String name) => _$createAccountExchangeAccountDtoMarketTypeEnumValueOf(name);
}

