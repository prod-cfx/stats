//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'whale_notification_inbox_controller_unread_count200_response_data.g.dart';

/// WhaleNotificationInboxControllerUnreadCount200ResponseData
///
/// Properties:
/// * [unread] 
@BuiltValue()
abstract class WhaleNotificationInboxControllerUnreadCount200ResponseData implements Built<WhaleNotificationInboxControllerUnreadCount200ResponseData, WhaleNotificationInboxControllerUnreadCount200ResponseDataBuilder> {
  @BuiltValueField(wireName: r'unread')
  num? get unread;

  WhaleNotificationInboxControllerUnreadCount200ResponseData._();

  factory WhaleNotificationInboxControllerUnreadCount200ResponseData([void updates(WhaleNotificationInboxControllerUnreadCount200ResponseDataBuilder b)]) = _$WhaleNotificationInboxControllerUnreadCount200ResponseData;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(WhaleNotificationInboxControllerUnreadCount200ResponseDataBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<WhaleNotificationInboxControllerUnreadCount200ResponseData> get serializer => _$WhaleNotificationInboxControllerUnreadCount200ResponseDataSerializer();
}

class _$WhaleNotificationInboxControllerUnreadCount200ResponseDataSerializer implements PrimitiveSerializer<WhaleNotificationInboxControllerUnreadCount200ResponseData> {
  @override
  final Iterable<Type> types = const [WhaleNotificationInboxControllerUnreadCount200ResponseData, _$WhaleNotificationInboxControllerUnreadCount200ResponseData];

  @override
  final String wireName = r'WhaleNotificationInboxControllerUnreadCount200ResponseData';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    WhaleNotificationInboxControllerUnreadCount200ResponseData object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    if (object.unread != null) {
      yield r'unread';
      yield serializers.serialize(
        object.unread,
        specifiedType: const FullType(num),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    WhaleNotificationInboxControllerUnreadCount200ResponseData object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required WhaleNotificationInboxControllerUnreadCount200ResponseDataBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'unread':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.unread = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  WhaleNotificationInboxControllerUnreadCount200ResponseData deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = WhaleNotificationInboxControllerUnreadCount200ResponseDataBuilder();
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

