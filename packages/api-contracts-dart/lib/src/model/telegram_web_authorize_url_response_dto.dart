//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'telegram_web_authorize_url_response_dto.g.dart';

/// TelegramWebAuthorizeUrlResponseDto
///
/// Properties:
/// * [authorizeUrl] - Telegram 网页授权地址（前端跳转用）
@BuiltValue()
abstract class TelegramWebAuthorizeUrlResponseDto implements Built<TelegramWebAuthorizeUrlResponseDto, TelegramWebAuthorizeUrlResponseDtoBuilder> {
  /// Telegram 网页授权地址（前端跳转用）
  @BuiltValueField(wireName: r'authorizeUrl')
  String get authorizeUrl;

  TelegramWebAuthorizeUrlResponseDto._();

  factory TelegramWebAuthorizeUrlResponseDto([void updates(TelegramWebAuthorizeUrlResponseDtoBuilder b)]) = _$TelegramWebAuthorizeUrlResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(TelegramWebAuthorizeUrlResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<TelegramWebAuthorizeUrlResponseDto> get serializer => _$TelegramWebAuthorizeUrlResponseDtoSerializer();
}

class _$TelegramWebAuthorizeUrlResponseDtoSerializer implements PrimitiveSerializer<TelegramWebAuthorizeUrlResponseDto> {
  @override
  final Iterable<Type> types = const [TelegramWebAuthorizeUrlResponseDto, _$TelegramWebAuthorizeUrlResponseDto];

  @override
  final String wireName = r'TelegramWebAuthorizeUrlResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    TelegramWebAuthorizeUrlResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'authorizeUrl';
    yield serializers.serialize(
      object.authorizeUrl,
      specifiedType: const FullType(String),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    TelegramWebAuthorizeUrlResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required TelegramWebAuthorizeUrlResponseDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'authorizeUrl':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.authorizeUrl = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  TelegramWebAuthorizeUrlResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = TelegramWebAuthorizeUrlResponseDtoBuilder();
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

