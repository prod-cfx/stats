//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/whale_notification_inbox_controller_unread_count200_response_data.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'whale_notification_inbox_controller_unread_count200_response.g.dart';

/// WhaleNotificationInboxControllerUnreadCount200Response
///
/// Properties:
/// * [data] 
/// * [message] 
@BuiltValue()
abstract class WhaleNotificationInboxControllerUnreadCount200Response implements Built<WhaleNotificationInboxControllerUnreadCount200Response, WhaleNotificationInboxControllerUnreadCount200ResponseBuilder> {
  @BuiltValueField(wireName: r'data')
  WhaleNotificationInboxControllerUnreadCount200ResponseData? get data;

  @BuiltValueField(wireName: r'message')
  String? get message;

  WhaleNotificationInboxControllerUnreadCount200Response._();

  factory WhaleNotificationInboxControllerUnreadCount200Response([void updates(WhaleNotificationInboxControllerUnreadCount200ResponseBuilder b)]) = _$WhaleNotificationInboxControllerUnreadCount200Response;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(WhaleNotificationInboxControllerUnreadCount200ResponseBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<WhaleNotificationInboxControllerUnreadCount200Response> get serializer => _$WhaleNotificationInboxControllerUnreadCount200ResponseSerializer();
}

class _$WhaleNotificationInboxControllerUnreadCount200ResponseSerializer implements PrimitiveSerializer<WhaleNotificationInboxControllerUnreadCount200Response> {
  @override
  final Iterable<Type> types = const [WhaleNotificationInboxControllerUnreadCount200Response, _$WhaleNotificationInboxControllerUnreadCount200Response];

  @override
  final String wireName = r'WhaleNotificationInboxControllerUnreadCount200Response';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    WhaleNotificationInboxControllerUnreadCount200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    if (object.data != null) {
      yield r'data';
      yield serializers.serialize(
        object.data,
        specifiedType: const FullType(WhaleNotificationInboxControllerUnreadCount200ResponseData),
      );
    }
    if (object.message != null) {
      yield r'message';
      yield serializers.serialize(
        object.message,
        specifiedType: const FullType(String),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    WhaleNotificationInboxControllerUnreadCount200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required WhaleNotificationInboxControllerUnreadCount200ResponseBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'data':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(WhaleNotificationInboxControllerUnreadCount200ResponseData),
          ) as WhaleNotificationInboxControllerUnreadCount200ResponseData;
          result.data.replace(valueDes);
          break;
        case r'message':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.message = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  WhaleNotificationInboxControllerUnreadCount200Response deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = WhaleNotificationInboxControllerUnreadCount200ResponseBuilder();
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

