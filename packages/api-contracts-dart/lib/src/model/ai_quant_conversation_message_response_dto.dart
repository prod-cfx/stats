//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'ai_quant_conversation_message_response_dto.g.dart';

/// AiQuantConversationMessageResponseDto
///
/// Properties:
/// * [role] - 对话消息角色
/// * [content] - 对话消息内容
@BuiltValue()
abstract class AiQuantConversationMessageResponseDto implements Built<AiQuantConversationMessageResponseDto, AiQuantConversationMessageResponseDtoBuilder> {
  /// 对话消息角色
  @BuiltValueField(wireName: r'role')
  AiQuantConversationMessageResponseDtoRoleEnum get role;
  // enum roleEnum {  user,  assistant,  };

  /// 对话消息内容
  @BuiltValueField(wireName: r'content')
  String get content;

  AiQuantConversationMessageResponseDto._();

  factory AiQuantConversationMessageResponseDto([void updates(AiQuantConversationMessageResponseDtoBuilder b)]) = _$AiQuantConversationMessageResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AiQuantConversationMessageResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AiQuantConversationMessageResponseDto> get serializer => _$AiQuantConversationMessageResponseDtoSerializer();
}

class _$AiQuantConversationMessageResponseDtoSerializer implements PrimitiveSerializer<AiQuantConversationMessageResponseDto> {
  @override
  final Iterable<Type> types = const [AiQuantConversationMessageResponseDto, _$AiQuantConversationMessageResponseDto];

  @override
  final String wireName = r'AiQuantConversationMessageResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AiQuantConversationMessageResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'role';
    yield serializers.serialize(
      object.role,
      specifiedType: const FullType(AiQuantConversationMessageResponseDtoRoleEnum),
    );
    yield r'content';
    yield serializers.serialize(
      object.content,
      specifiedType: const FullType(String),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    AiQuantConversationMessageResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AiQuantConversationMessageResponseDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'role':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(AiQuantConversationMessageResponseDtoRoleEnum),
          ) as AiQuantConversationMessageResponseDtoRoleEnum;
          result.role = valueDes;
          break;
        case r'content':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.content = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  AiQuantConversationMessageResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AiQuantConversationMessageResponseDtoBuilder();
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

class AiQuantConversationMessageResponseDtoRoleEnum extends EnumClass {

  /// 对话消息角色
  @BuiltValueEnumConst(wireName: r'user')
  static const AiQuantConversationMessageResponseDtoRoleEnum user = _$aiQuantConversationMessageResponseDtoRoleEnum_user;
  /// 对话消息角色
  @BuiltValueEnumConst(wireName: r'assistant')
  static const AiQuantConversationMessageResponseDtoRoleEnum assistant = _$aiQuantConversationMessageResponseDtoRoleEnum_assistant;

  static Serializer<AiQuantConversationMessageResponseDtoRoleEnum> get serializer => _$aiQuantConversationMessageResponseDtoRoleEnumSerializer;

  const AiQuantConversationMessageResponseDtoRoleEnum._(String name): super(name);

  static BuiltSet<AiQuantConversationMessageResponseDtoRoleEnum> get values => _$aiQuantConversationMessageResponseDtoRoleEnumValues;
  static AiQuantConversationMessageResponseDtoRoleEnum valueOf(String name) => _$aiQuantConversationMessageResponseDtoRoleEnumValueOf(name);
}

