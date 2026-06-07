//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'telegram_desktop_intent_response_dto.g.dart';

/// TelegramDesktopIntentResponseDto
///
/// Properties:
/// * [intentId] - 登录意图 ID
/// * [deepLink] - Telegram 客户端深链（tg:// 协议）
/// * [webLink] - Telegram 网页链接（无客户端时回退）
/// * [callbackUrl] - 登录确认回调地址
/// * [expiresInSeconds] - 意图过期时间（秒）
@BuiltValue()
abstract class TelegramDesktopIntentResponseDto implements Built<TelegramDesktopIntentResponseDto, TelegramDesktopIntentResponseDtoBuilder> {
  /// 登录意图 ID
  @BuiltValueField(wireName: r'intentId')
  String get intentId;

  /// Telegram 客户端深链（tg:// 协议）
  @BuiltValueField(wireName: r'deepLink')
  String get deepLink;

  /// Telegram 网页链接（无客户端时回退）
  @BuiltValueField(wireName: r'webLink')
  String get webLink;

  /// 登录确认回调地址
  @BuiltValueField(wireName: r'callbackUrl')
  String get callbackUrl;

  /// 意图过期时间（秒）
  @BuiltValueField(wireName: r'expiresInSeconds')
  num get expiresInSeconds;

  TelegramDesktopIntentResponseDto._();

  factory TelegramDesktopIntentResponseDto([void updates(TelegramDesktopIntentResponseDtoBuilder b)]) = _$TelegramDesktopIntentResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(TelegramDesktopIntentResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<TelegramDesktopIntentResponseDto> get serializer => _$TelegramDesktopIntentResponseDtoSerializer();
}

class _$TelegramDesktopIntentResponseDtoSerializer implements PrimitiveSerializer<TelegramDesktopIntentResponseDto> {
  @override
  final Iterable<Type> types = const [TelegramDesktopIntentResponseDto, _$TelegramDesktopIntentResponseDto];

  @override
  final String wireName = r'TelegramDesktopIntentResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    TelegramDesktopIntentResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'intentId';
    yield serializers.serialize(
      object.intentId,
      specifiedType: const FullType(String),
    );
    yield r'deepLink';
    yield serializers.serialize(
      object.deepLink,
      specifiedType: const FullType(String),
    );
    yield r'webLink';
    yield serializers.serialize(
      object.webLink,
      specifiedType: const FullType(String),
    );
    yield r'callbackUrl';
    yield serializers.serialize(
      object.callbackUrl,
      specifiedType: const FullType(String),
    );
    yield r'expiresInSeconds';
    yield serializers.serialize(
      object.expiresInSeconds,
      specifiedType: const FullType(num),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    TelegramDesktopIntentResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required TelegramDesktopIntentResponseDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'intentId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.intentId = valueDes;
          break;
        case r'deepLink':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.deepLink = valueDes;
          break;
        case r'webLink':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.webLink = valueDes;
          break;
        case r'callbackUrl':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.callbackUrl = valueDes;
          break;
        case r'expiresInSeconds':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.expiresInSeconds = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  TelegramDesktopIntentResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = TelegramDesktopIntentResponseDtoBuilder();
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

