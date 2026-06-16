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
/// * [updateId] - Telegram update id
/// * [message]
/// * [editedMessage]
/// * [channelPost]
/// * [editedChannelPost]
/// * [callbackQuery]
/// * [inlineQuery]
/// * [chosenInlineResult]
/// * [shippingQuery]
/// * [preCheckoutQuery]
/// * [poll]
/// * [pollAnswer]
/// * [myChatMember]
/// * [chatMember]
/// * [chatJoinRequest]
@BuiltValue()
abstract class TelegramBotWebhookRequestDto implements Built<TelegramBotWebhookRequestDto, TelegramBotWebhookRequestDtoBuilder> {
  /// Telegram update id
  @BuiltValueField(wireName: r'update_id')
  num? get updateId;

  @BuiltValueField(wireName: r'message')
  BuiltMap<String, JsonObject?>? get message;

  @BuiltValueField(wireName: r'edited_message')
  BuiltMap<String, JsonObject?>? get editedMessage;

  @BuiltValueField(wireName: r'channel_post')
  BuiltMap<String, JsonObject?>? get channelPost;

  @BuiltValueField(wireName: r'edited_channel_post')
  BuiltMap<String, JsonObject?>? get editedChannelPost;

  @BuiltValueField(wireName: r'callback_query')
  BuiltMap<String, JsonObject?>? get callbackQuery;

  @BuiltValueField(wireName: r'inline_query')
  BuiltMap<String, JsonObject?>? get inlineQuery;

  @BuiltValueField(wireName: r'chosen_inline_result')
  BuiltMap<String, JsonObject?>? get chosenInlineResult;

  @BuiltValueField(wireName: r'shipping_query')
  BuiltMap<String, JsonObject?>? get shippingQuery;

  @BuiltValueField(wireName: r'pre_checkout_query')
  BuiltMap<String, JsonObject?>? get preCheckoutQuery;

  @BuiltValueField(wireName: r'poll')
  BuiltMap<String, JsonObject?>? get poll;

  @BuiltValueField(wireName: r'poll_answer')
  BuiltMap<String, JsonObject?>? get pollAnswer;

  @BuiltValueField(wireName: r'my_chat_member')
  BuiltMap<String, JsonObject?>? get myChatMember;

  @BuiltValueField(wireName: r'chat_member')
  BuiltMap<String, JsonObject?>? get chatMember;

  @BuiltValueField(wireName: r'chat_join_request')
  BuiltMap<String, JsonObject?>? get chatJoinRequest;

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
    if (object.updateId != null) {
      yield r'update_id';
      yield serializers.serialize(
        object.updateId,
        specifiedType: const FullType(num),
      );
    }
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
    if (object.channelPost != null) {
      yield r'channel_post';
      yield serializers.serialize(
        object.channelPost,
        specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
      );
    }
    if (object.editedChannelPost != null) {
      yield r'edited_channel_post';
      yield serializers.serialize(
        object.editedChannelPost,
        specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
      );
    }
    if (object.callbackQuery != null) {
      yield r'callback_query';
      yield serializers.serialize(
        object.callbackQuery,
        specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
      );
    }
    if (object.inlineQuery != null) {
      yield r'inline_query';
      yield serializers.serialize(
        object.inlineQuery,
        specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
      );
    }
    if (object.chosenInlineResult != null) {
      yield r'chosen_inline_result';
      yield serializers.serialize(
        object.chosenInlineResult,
        specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
      );
    }
    if (object.shippingQuery != null) {
      yield r'shipping_query';
      yield serializers.serialize(
        object.shippingQuery,
        specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
      );
    }
    if (object.preCheckoutQuery != null) {
      yield r'pre_checkout_query';
      yield serializers.serialize(
        object.preCheckoutQuery,
        specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
      );
    }
    if (object.poll != null) {
      yield r'poll';
      yield serializers.serialize(
        object.poll,
        specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
      );
    }
    if (object.pollAnswer != null) {
      yield r'poll_answer';
      yield serializers.serialize(
        object.pollAnswer,
        specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
      );
    }
    if (object.myChatMember != null) {
      yield r'my_chat_member';
      yield serializers.serialize(
        object.myChatMember,
        specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
      );
    }
    if (object.chatMember != null) {
      yield r'chat_member';
      yield serializers.serialize(
        object.chatMember,
        specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
      );
    }
    if (object.chatJoinRequest != null) {
      yield r'chat_join_request';
      yield serializers.serialize(
        object.chatJoinRequest,
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
        case r'update_id':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.updateId = valueDes;
          break;
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
        case r'channel_post':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>;
          result.channelPost.replace(valueDes);
          break;
        case r'edited_channel_post':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>;
          result.editedChannelPost.replace(valueDes);
          break;
        case r'callback_query':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>;
          result.callbackQuery.replace(valueDes);
          break;
        case r'inline_query':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>;
          result.inlineQuery.replace(valueDes);
          break;
        case r'chosen_inline_result':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>;
          result.chosenInlineResult.replace(valueDes);
          break;
        case r'shipping_query':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>;
          result.shippingQuery.replace(valueDes);
          break;
        case r'pre_checkout_query':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>;
          result.preCheckoutQuery.replace(valueDes);
          break;
        case r'poll':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>;
          result.poll.replace(valueDes);
          break;
        case r'poll_answer':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>;
          result.pollAnswer.replace(valueDes);
          break;
        case r'my_chat_member':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>;
          result.myChatMember.replace(valueDes);
          break;
        case r'chat_member':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>;
          result.chatMember.replace(valueDes);
          break;
        case r'chat_join_request':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>;
          result.chatJoinRequest.replace(valueDes);
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
