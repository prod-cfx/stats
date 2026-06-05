//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'whale_notification_delivery_map_dto.g.dart';

/// WhaleNotificationDeliveryMapDto
///
/// Properties:
/// * [web] 
/// * [email] 
/// * [telegram] 
@BuiltValue()
abstract class WhaleNotificationDeliveryMapDto implements Built<WhaleNotificationDeliveryMapDto, WhaleNotificationDeliveryMapDtoBuilder> {
  @BuiltValueField(wireName: r'web')
  String get web;

  @BuiltValueField(wireName: r'email')
  String get email;

  @BuiltValueField(wireName: r'telegram')
  String get telegram;

  WhaleNotificationDeliveryMapDto._();

  factory WhaleNotificationDeliveryMapDto([void updates(WhaleNotificationDeliveryMapDtoBuilder b)]) = _$WhaleNotificationDeliveryMapDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(WhaleNotificationDeliveryMapDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<WhaleNotificationDeliveryMapDto> get serializer => _$WhaleNotificationDeliveryMapDtoSerializer();
}

class _$WhaleNotificationDeliveryMapDtoSerializer implements PrimitiveSerializer<WhaleNotificationDeliveryMapDto> {
  @override
  final Iterable<Type> types = const [WhaleNotificationDeliveryMapDto, _$WhaleNotificationDeliveryMapDto];

  @override
  final String wireName = r'WhaleNotificationDeliveryMapDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    WhaleNotificationDeliveryMapDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'web';
    yield serializers.serialize(
      object.web,
      specifiedType: const FullType(String),
    );
    yield r'email';
    yield serializers.serialize(
      object.email,
      specifiedType: const FullType(String),
    );
    yield r'telegram';
    yield serializers.serialize(
      object.telegram,
      specifiedType: const FullType(String),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    WhaleNotificationDeliveryMapDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required WhaleNotificationDeliveryMapDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'web':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.web = valueDes;
          break;
        case r'email':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.email = valueDes;
          break;
        case r'telegram':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.telegram = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  WhaleNotificationDeliveryMapDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = WhaleNotificationDeliveryMapDtoBuilder();
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

