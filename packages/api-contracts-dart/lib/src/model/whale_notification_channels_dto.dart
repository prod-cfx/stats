//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'whale_notification_channels_dto.g.dart';

/// WhaleNotificationChannelsDto
///
/// Properties:
/// * [web] 
/// * [email] 
/// * [telegram] 
@BuiltValue()
abstract class WhaleNotificationChannelsDto implements Built<WhaleNotificationChannelsDto, WhaleNotificationChannelsDtoBuilder> {
  @BuiltValueField(wireName: r'web')
  bool get web;

  @BuiltValueField(wireName: r'email')
  bool get email;

  @BuiltValueField(wireName: r'telegram')
  bool get telegram;

  WhaleNotificationChannelsDto._();

  factory WhaleNotificationChannelsDto([void updates(WhaleNotificationChannelsDtoBuilder b)]) = _$WhaleNotificationChannelsDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(WhaleNotificationChannelsDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<WhaleNotificationChannelsDto> get serializer => _$WhaleNotificationChannelsDtoSerializer();
}

class _$WhaleNotificationChannelsDtoSerializer implements PrimitiveSerializer<WhaleNotificationChannelsDto> {
  @override
  final Iterable<Type> types = const [WhaleNotificationChannelsDto, _$WhaleNotificationChannelsDto];

  @override
  final String wireName = r'WhaleNotificationChannelsDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    WhaleNotificationChannelsDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'web';
    yield serializers.serialize(
      object.web,
      specifiedType: const FullType(bool),
    );
    yield r'email';
    yield serializers.serialize(
      object.email,
      specifiedType: const FullType(bool),
    );
    yield r'telegram';
    yield serializers.serialize(
      object.telegram,
      specifiedType: const FullType(bool),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    WhaleNotificationChannelsDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required WhaleNotificationChannelsDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'web':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.web = valueDes;
          break;
        case r'email':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.email = valueDes;
          break;
        case r'telegram':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
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
  WhaleNotificationChannelsDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = WhaleNotificationChannelsDtoBuilder();
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

