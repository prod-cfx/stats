//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/json_object.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'telegram_bot_webhook_request_dto.g.dart';

/// TelegramBotWebhookRequestDto
///
/// Properties:
/// * [message] 
/// * [editedMessage] 
@BuiltValue()
abstract class TelegramBotWebhookRequestDto implements Built<TelegramBotWebhookRequestDto, TelegramBotWebhookRequestDtoBuilder> {
  @BuiltValueField(wireName: r'message')
  BuiltMap<String, JsonObject?>? get message;

  @BuiltValueField(wireName: r'edited_message')
  BuiltMap<String, JsonObject?>? get editedMessage;

  TelegramBotWebhookRequestDto._();

  factory TelegramBotWebhookRequestDto([void updates(TelegramBotWebhookRequestDtoBuilder b)]) = _$TelegramBotWebhookRequestDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(TelegramBotWebhookRequestDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<TelegramBotWebhookRequestDto> get serializer => _$TelegramBotWebhookRequestDtoSerializer();
}

class _$TelegramBotWebhookRequestDtoSerializer implements PrimitiveSerializer<TelegramBotWebhookRequestDto> {
  @override
  final Iterable<Type> types = const [TelegramBotWebhookRequestDto, _$TelegramBotWebhookRequestDto];

  @override
  final String wireName = r'TelegramBotWebhookRequestDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    TelegramBotWebhookRequestDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    if (object.message != null) {
      yield r'message';
      yield serializers.serialize(
        object.message,
        specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
      );
    }
    if (object.editedMessage != null) {
      yield r'edited_message';
      yield serializers.serialize(
        object.editedMessage,
        specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    TelegramBotWebhookRequestDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required TelegramBotWebhookRequestDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'message':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>;
          result.message.replace(valueDes);
          break;
        case r'edited_message':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>;
          result.editedMessage.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  TelegramBotWebhookRequestDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = TelegramBotWebhookRequestDtoBuilder();
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

