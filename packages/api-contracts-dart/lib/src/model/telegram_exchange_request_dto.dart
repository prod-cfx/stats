//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'telegram_exchange_request_dto.g.dart';

/// TelegramExchangeRequestDto
///
/// Properties:
/// * [telegramId] - Telegram unique identifier
/// * [authDate] - Telegram auth date (unix timestamp)
/// * [hash] - Telegram login hash
/// * [firstName] - Telegram first name
/// * [lastName] - Telegram last name
/// * [username] - Telegram username
/// * [photoUrl] - Telegram avatar url
/// * [source_] - Telegram login source
/// * [betaCode] - 内测码，首次创建用户时必填
@BuiltValue()
abstract class TelegramExchangeRequestDto implements Built<TelegramExchangeRequestDto, TelegramExchangeRequestDtoBuilder> {
  /// Telegram unique identifier
  @BuiltValueField(wireName: r'telegramId')
  String get telegramId;

  /// Telegram auth date (unix timestamp)
  @BuiltValueField(wireName: r'authDate')
  String get authDate;

  /// Telegram login hash
  @BuiltValueField(wireName: r'hash')
  String get hash;

  /// Telegram first name
  @BuiltValueField(wireName: r'firstName')
  String? get firstName;

  /// Telegram last name
  @BuiltValueField(wireName: r'lastName')
  String? get lastName;

  /// Telegram username
  @BuiltValueField(wireName: r'username')
  String? get username;

  /// Telegram avatar url
  @BuiltValueField(wireName: r'photoUrl')
  String? get photoUrl;

  /// Telegram login source
  @BuiltValueField(wireName: r'source')
  TelegramExchangeRequestDtoSource_Enum? get source_;
  // enum source_Enum {  web,  desktop,  webapp,  };

  /// 内测码，首次创建用户时必填
  @BuiltValueField(wireName: r'betaCode')
  String? get betaCode;

  TelegramExchangeRequestDto._();

  factory TelegramExchangeRequestDto([void updates(TelegramExchangeRequestDtoBuilder b)]) = _$TelegramExchangeRequestDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(TelegramExchangeRequestDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<TelegramExchangeRequestDto> get serializer => _$TelegramExchangeRequestDtoSerializer();
}

class _$TelegramExchangeRequestDtoSerializer implements PrimitiveSerializer<TelegramExchangeRequestDto> {
  @override
  final Iterable<Type> types = const [TelegramExchangeRequestDto, _$TelegramExchangeRequestDto];

  @override
  final String wireName = r'TelegramExchangeRequestDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    TelegramExchangeRequestDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'telegramId';
    yield serializers.serialize(
      object.telegramId,
      specifiedType: const FullType(String),
    );
    yield r'authDate';
    yield serializers.serialize(
      object.authDate,
      specifiedType: const FullType(String),
    );
    yield r'hash';
    yield serializers.serialize(
      object.hash,
      specifiedType: const FullType(String),
    );
    if (object.firstName != null) {
      yield r'firstName';
      yield serializers.serialize(
        object.firstName,
        specifiedType: const FullType(String),
      );
    }
    if (object.lastName != null) {
      yield r'lastName';
      yield serializers.serialize(
        object.lastName,
        specifiedType: const FullType(String),
      );
    }
    if (object.username != null) {
      yield r'username';
      yield serializers.serialize(
        object.username,
        specifiedType: const FullType(String),
      );
    }
    if (object.photoUrl != null) {
      yield r'photoUrl';
      yield serializers.serialize(
        object.photoUrl,
        specifiedType: const FullType(String),
      );
    }
    if (object.source_ != null) {
      yield r'source';
      yield serializers.serialize(
        object.source_,
        specifiedType: const FullType(TelegramExchangeRequestDtoSource_Enum),
      );
    }
    if (object.betaCode != null) {
      yield r'betaCode';
      yield serializers.serialize(
        object.betaCode,
        specifiedType: const FullType(String),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    TelegramExchangeRequestDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required TelegramExchangeRequestDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'telegramId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.telegramId = valueDes;
          break;
        case r'authDate':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.authDate = valueDes;
          break;
        case r'hash':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.hash = valueDes;
          break;
        case r'firstName':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.firstName = valueDes;
          break;
        case r'lastName':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.lastName = valueDes;
          break;
        case r'username':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.username = valueDes;
          break;
        case r'photoUrl':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.photoUrl = valueDes;
          break;
        case r'source':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(TelegramExchangeRequestDtoSource_Enum),
          ) as TelegramExchangeRequestDtoSource_Enum;
          result.source_ = valueDes;
          break;
        case r'betaCode':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.betaCode = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  TelegramExchangeRequestDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = TelegramExchangeRequestDtoBuilder();
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

class TelegramExchangeRequestDtoSource_Enum extends EnumClass {

  /// Telegram login source
  @BuiltValueEnumConst(wireName: r'web')
  static const TelegramExchangeRequestDtoSource_Enum web = _$telegramExchangeRequestDtoSourceEnum_web;
  /// Telegram login source
  @BuiltValueEnumConst(wireName: r'desktop')
  static const TelegramExchangeRequestDtoSource_Enum desktop = _$telegramExchangeRequestDtoSourceEnum_desktop;
  /// Telegram login source
  @BuiltValueEnumConst(wireName: r'webapp')
  static const TelegramExchangeRequestDtoSource_Enum webapp = _$telegramExchangeRequestDtoSourceEnum_webapp;

  static Serializer<TelegramExchangeRequestDtoSource_Enum> get serializer => _$telegramExchangeRequestDtoSourceEnumSerializer;

  const TelegramExchangeRequestDtoSource_Enum._(String name): super(name);

  static BuiltSet<TelegramExchangeRequestDtoSource_Enum> get values => _$telegramExchangeRequestDtoSourceEnumValues;
  static TelegramExchangeRequestDtoSource_Enum valueOf(String name) => _$telegramExchangeRequestDtoSourceEnumValueOf(name);
}

