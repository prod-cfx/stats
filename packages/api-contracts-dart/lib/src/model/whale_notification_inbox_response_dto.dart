//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/whale_notification_delivery_map_dto.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'whale_notification_inbox_response_dto.g.dart';

/// WhaleNotificationInboxResponseDto
///
/// Properties:
/// * [id] 
/// * [title] 
/// * [content] 
/// * [ruleId] 
/// * [channels] 
/// * [read] 
/// * [createdAt] 
@BuiltValue()
abstract class WhaleNotificationInboxResponseDto implements Built<WhaleNotificationInboxResponseDto, WhaleNotificationInboxResponseDtoBuilder> {
  @BuiltValueField(wireName: r'id')
  String get id;

  @BuiltValueField(wireName: r'title')
  String get title;

  @BuiltValueField(wireName: r'content')
  String get content;

  @BuiltValueField(wireName: r'ruleId')
  String? get ruleId;

  @BuiltValueField(wireName: r'channels')
  WhaleNotificationDeliveryMapDto get channels;

  @BuiltValueField(wireName: r'read')
  bool get read;

  @BuiltValueField(wireName: r'createdAt')
  String get createdAt;

  WhaleNotificationInboxResponseDto._();

  factory WhaleNotificationInboxResponseDto([void updates(WhaleNotificationInboxResponseDtoBuilder b)]) = _$WhaleNotificationInboxResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(WhaleNotificationInboxResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<WhaleNotificationInboxResponseDto> get serializer => _$WhaleNotificationInboxResponseDtoSerializer();
}

class _$WhaleNotificationInboxResponseDtoSerializer implements PrimitiveSerializer<WhaleNotificationInboxResponseDto> {
  @override
  final Iterable<Type> types = const [WhaleNotificationInboxResponseDto, _$WhaleNotificationInboxResponseDto];

  @override
  final String wireName = r'WhaleNotificationInboxResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    WhaleNotificationInboxResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'id';
    yield serializers.serialize(
      object.id,
      specifiedType: const FullType(String),
    );
    yield r'title';
    yield serializers.serialize(
      object.title,
      specifiedType: const FullType(String),
    );
    yield r'content';
    yield serializers.serialize(
      object.content,
      specifiedType: const FullType(String),
    );
    if (object.ruleId != null) {
      yield r'ruleId';
      yield serializers.serialize(
        object.ruleId,
        specifiedType: const FullType(String),
      );
    }
    yield r'channels';
    yield serializers.serialize(
      object.channels,
      specifiedType: const FullType(WhaleNotificationDeliveryMapDto),
    );
    yield r'read';
    yield serializers.serialize(
      object.read,
      specifiedType: const FullType(bool),
    );
    yield r'createdAt';
    yield serializers.serialize(
      object.createdAt,
      specifiedType: const FullType(String),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    WhaleNotificationInboxResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required WhaleNotificationInboxResponseDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'id':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.id = valueDes;
          break;
        case r'title':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.title = valueDes;
          break;
        case r'content':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.content = valueDes;
          break;
        case r'ruleId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.ruleId = valueDes;
          break;
        case r'channels':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(WhaleNotificationDeliveryMapDto),
          ) as WhaleNotificationDeliveryMapDto;
          result.channels.replace(valueDes);
          break;
        case r'read':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.read = valueDes;
          break;
        case r'createdAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.createdAt = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  WhaleNotificationInboxResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = WhaleNotificationInboxResponseDtoBuilder();
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

