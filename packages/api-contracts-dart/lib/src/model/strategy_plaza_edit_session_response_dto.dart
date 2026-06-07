//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'strategy_plaza_edit_session_response_dto.g.dart';

/// StrategyPlazaEditSessionResponseDto
///
/// Properties:
/// * [sessionId] - 编辑会话 ID
/// * [templateId] - 关联策略模板 ID
/// * [initialMessage] - 初始消息内容
@BuiltValue()
abstract class StrategyPlazaEditSessionResponseDto implements Built<StrategyPlazaEditSessionResponseDto, StrategyPlazaEditSessionResponseDtoBuilder> {
  /// 编辑会话 ID
  @BuiltValueField(wireName: r'sessionId')
  String get sessionId;

  /// 关联策略模板 ID
  @BuiltValueField(wireName: r'templateId')
  String get templateId;

  /// 初始消息内容
  @BuiltValueField(wireName: r'initialMessage')
  String get initialMessage;

  StrategyPlazaEditSessionResponseDto._();

  factory StrategyPlazaEditSessionResponseDto([void updates(StrategyPlazaEditSessionResponseDtoBuilder b)]) = _$StrategyPlazaEditSessionResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(StrategyPlazaEditSessionResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<StrategyPlazaEditSessionResponseDto> get serializer => _$StrategyPlazaEditSessionResponseDtoSerializer();
}

class _$StrategyPlazaEditSessionResponseDtoSerializer implements PrimitiveSerializer<StrategyPlazaEditSessionResponseDto> {
  @override
  final Iterable<Type> types = const [StrategyPlazaEditSessionResponseDto, _$StrategyPlazaEditSessionResponseDto];

  @override
  final String wireName = r'StrategyPlazaEditSessionResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    StrategyPlazaEditSessionResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'sessionId';
    yield serializers.serialize(
      object.sessionId,
      specifiedType: const FullType(String),
    );
    yield r'templateId';
    yield serializers.serialize(
      object.templateId,
      specifiedType: const FullType(String),
    );
    yield r'initialMessage';
    yield serializers.serialize(
      object.initialMessage,
      specifiedType: const FullType(String),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    StrategyPlazaEditSessionResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required StrategyPlazaEditSessionResponseDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'sessionId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.sessionId = valueDes;
          break;
        case r'templateId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.templateId = valueDes;
          break;
        case r'initialMessage':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.initialMessage = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  StrategyPlazaEditSessionResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = StrategyPlazaEditSessionResponseDtoBuilder();
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

