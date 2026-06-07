//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'account_exchange_account_response_dto.g.dart';

/// AccountExchangeAccountResponseDto
///
/// Properties:
/// * [id] 
/// * [exchangeId] 
/// * [isBound] - 该交易所是否已绑定账户
/// * [name] 
/// * [maskedCredential] 
/// * [isTestnet] 
/// * [lastValidatedAt] 
/// * [createdAt] 
@BuiltValue()
abstract class AccountExchangeAccountResponseDto implements Built<AccountExchangeAccountResponseDto, AccountExchangeAccountResponseDtoBuilder> {
  @BuiltValueField(wireName: r'id')
  String? get id;

  @BuiltValueField(wireName: r'exchangeId')
  AccountExchangeAccountResponseDtoExchangeIdEnum get exchangeId;
  // enum exchangeIdEnum {  binance,  okx,  hyperliquid,  };

  /// 该交易所是否已绑定账户
  @BuiltValueField(wireName: r'isBound')
  bool get isBound;

  @BuiltValueField(wireName: r'name')
  String? get name;

  @BuiltValueField(wireName: r'maskedCredential')
  String? get maskedCredential;

  @BuiltValueField(wireName: r'isTestnet')
  bool? get isTestnet;

  @BuiltValueField(wireName: r'lastValidatedAt')
  DateTime? get lastValidatedAt;

  @BuiltValueField(wireName: r'createdAt')
  DateTime? get createdAt;

  AccountExchangeAccountResponseDto._();

  factory AccountExchangeAccountResponseDto([void updates(AccountExchangeAccountResponseDtoBuilder b)]) = _$AccountExchangeAccountResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AccountExchangeAccountResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AccountExchangeAccountResponseDto> get serializer => _$AccountExchangeAccountResponseDtoSerializer();
}

class _$AccountExchangeAccountResponseDtoSerializer implements PrimitiveSerializer<AccountExchangeAccountResponseDto> {
  @override
  final Iterable<Type> types = const [AccountExchangeAccountResponseDto, _$AccountExchangeAccountResponseDto];

  @override
  final String wireName = r'AccountExchangeAccountResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AccountExchangeAccountResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    if (object.id != null) {
      yield r'id';
      yield serializers.serialize(
        object.id,
        specifiedType: const FullType.nullable(String),
      );
    }
    yield r'exchangeId';
    yield serializers.serialize(
      object.exchangeId,
      specifiedType: const FullType(AccountExchangeAccountResponseDtoExchangeIdEnum),
    );
    yield r'isBound';
    yield serializers.serialize(
      object.isBound,
      specifiedType: const FullType(bool),
    );
    if (object.name != null) {
      yield r'name';
      yield serializers.serialize(
        object.name,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.maskedCredential != null) {
      yield r'maskedCredential';
      yield serializers.serialize(
        object.maskedCredential,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.isTestnet != null) {
      yield r'isTestnet';
      yield serializers.serialize(
        object.isTestnet,
        specifiedType: const FullType.nullable(bool),
      );
    }
    if (object.lastValidatedAt != null) {
      yield r'lastValidatedAt';
      yield serializers.serialize(
        object.lastValidatedAt,
        specifiedType: const FullType.nullable(DateTime),
      );
    }
    if (object.createdAt != null) {
      yield r'createdAt';
      yield serializers.serialize(
        object.createdAt,
        specifiedType: const FullType.nullable(DateTime),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    AccountExchangeAccountResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AccountExchangeAccountResponseDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'id':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.id = valueDes;
          break;
        case r'exchangeId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(AccountExchangeAccountResponseDtoExchangeIdEnum),
          ) as AccountExchangeAccountResponseDtoExchangeIdEnum;
          result.exchangeId = valueDes;
          break;
        case r'isBound':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.isBound = valueDes;
          break;
        case r'name':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.name = valueDes;
          break;
        case r'maskedCredential':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.maskedCredential = valueDes;
          break;
        case r'isTestnet':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(bool),
          ) as bool?;
          if (valueDes == null) continue;
          result.isTestnet = valueDes;
          break;
        case r'lastValidatedAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(DateTime),
          ) as DateTime?;
          if (valueDes == null) continue;
          result.lastValidatedAt = valueDes;
          break;
        case r'createdAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(DateTime),
          ) as DateTime?;
          if (valueDes == null) continue;
          result.createdAt = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  AccountExchangeAccountResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AccountExchangeAccountResponseDtoBuilder();
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

class AccountExchangeAccountResponseDtoExchangeIdEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'binance')
  static const AccountExchangeAccountResponseDtoExchangeIdEnum binance = _$accountExchangeAccountResponseDtoExchangeIdEnum_binance;
  @BuiltValueEnumConst(wireName: r'okx')
  static const AccountExchangeAccountResponseDtoExchangeIdEnum okx = _$accountExchangeAccountResponseDtoExchangeIdEnum_okx;
  @BuiltValueEnumConst(wireName: r'hyperliquid')
  static const AccountExchangeAccountResponseDtoExchangeIdEnum hyperliquid = _$accountExchangeAccountResponseDtoExchangeIdEnum_hyperliquid;

  static Serializer<AccountExchangeAccountResponseDtoExchangeIdEnum> get serializer => _$accountExchangeAccountResponseDtoExchangeIdEnumSerializer;

  const AccountExchangeAccountResponseDtoExchangeIdEnum._(String name): super(name);

  static BuiltSet<AccountExchangeAccountResponseDtoExchangeIdEnum> get values => _$accountExchangeAccountResponseDtoExchangeIdEnumValues;
  static AccountExchangeAccountResponseDtoExchangeIdEnum valueOf(String name) => _$accountExchangeAccountResponseDtoExchangeIdEnumValueOf(name);
}

