//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'telegram_bot_webhook_response_dto.g.dart';

/// TelegramBotWebhookResponseDto
///
/// Properties:
/// * [ok] - Webhook 处理成功标记（固定 true）
@BuiltValue()
abstract class TelegramBotWebhookResponseDto implements Built<TelegramBotWebhookResponseDto, TelegramBotWebhookResponseDtoBuilder> {
  /// Webhook 处理成功标记（固定 true）
  @BuiltValueField(wireName: r'ok')
  bool get ok;

  TelegramBotWebhookResponseDto._();

  factory TelegramBotWebhookResponseDto([void updates(TelegramBotWebhookResponseDtoBuilder b)]) = _$TelegramBotWebhookResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(TelegramBotWebhookResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<TelegramBotWebhookResponseDto> get serializer => _$TelegramBotWebhookResponseDtoSerializer();
}

class _$TelegramBotWebhookResponseDtoSerializer implements PrimitiveSerializer<TelegramBotWebhookResponseDto> {
  @override
  final Iterable<Type> types = const [TelegramBotWebhookResponseDto, _$TelegramBotWebhookResponseDto];

  @override
  final String wireName = r'TelegramBotWebhookResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    TelegramBotWebhookResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'ok';
    yield serializers.serialize(
      object.ok,
      specifiedType: const FullType(bool),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    TelegramBotWebhookResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required TelegramBotWebhookResponseDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'ok':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.ok = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  TelegramBotWebhookResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = TelegramBotWebhookResponseDtoBuilder();
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

