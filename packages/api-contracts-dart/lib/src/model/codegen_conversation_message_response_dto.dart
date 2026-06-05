//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'codegen_conversation_message_response_dto.g.dart';

/// CodegenConversationMessageResponseDto
///
/// Properties:
/// * [role] - Conversation message role
/// * [content] - Conversation message content
@BuiltValue()
abstract class CodegenConversationMessageResponseDto implements Built<CodegenConversationMessageResponseDto, CodegenConversationMessageResponseDtoBuilder> {
  /// Conversation message role
  @BuiltValueField(wireName: r'role')
  CodegenConversationMessageResponseDtoRoleEnum get role;
  // enum roleEnum {  user,  assistant,  };

  /// Conversation message content
  @BuiltValueField(wireName: r'content')
  String get content;

  CodegenConversationMessageResponseDto._();

  factory CodegenConversationMessageResponseDto([void updates(CodegenConversationMessageResponseDtoBuilder b)]) = _$CodegenConversationMessageResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(CodegenConversationMessageResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<CodegenConversationMessageResponseDto> get serializer => _$CodegenConversationMessageResponseDtoSerializer();
}

class _$CodegenConversationMessageResponseDtoSerializer implements PrimitiveSerializer<CodegenConversationMessageResponseDto> {
  @override
  final Iterable<Type> types = const [CodegenConversationMessageResponseDto, _$CodegenConversationMessageResponseDto];

  @override
  final String wireName = r'CodegenConversationMessageResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    CodegenConversationMessageResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'role';
    yield serializers.serialize(
      object.role,
      specifiedType: const FullType(CodegenConversationMessageResponseDtoRoleEnum),
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
    CodegenConversationMessageResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required CodegenConversationMessageResponseDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'role':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(CodegenConversationMessageResponseDtoRoleEnum),
          ) as CodegenConversationMessageResponseDtoRoleEnum;
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
  CodegenConversationMessageResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = CodegenConversationMessageResponseDtoBuilder();
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

class CodegenConversationMessageResponseDtoRoleEnum extends EnumClass {

  /// Conversation message role
  @BuiltValueEnumConst(wireName: r'user')
  static const CodegenConversationMessageResponseDtoRoleEnum user = _$codegenConversationMessageResponseDtoRoleEnum_user;
  /// Conversation message role
  @BuiltValueEnumConst(wireName: r'assistant')
  static const CodegenConversationMessageResponseDtoRoleEnum assistant = _$codegenConversationMessageResponseDtoRoleEnum_assistant;

  static Serializer<CodegenConversationMessageResponseDtoRoleEnum> get serializer => _$codegenConversationMessageResponseDtoRoleEnumSerializer;

  const CodegenConversationMessageResponseDtoRoleEnum._(String name): super(name);

  static BuiltSet<CodegenConversationMessageResponseDtoRoleEnum> get values => _$codegenConversationMessageResponseDtoRoleEnumValues;
  static CodegenConversationMessageResponseDtoRoleEnum valueOf(String name) => _$codegenConversationMessageResponseDtoRoleEnumValueOf(name);
}

