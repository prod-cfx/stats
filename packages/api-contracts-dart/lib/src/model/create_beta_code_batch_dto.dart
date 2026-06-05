//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'create_beta_code_batch_dto.g.dart';

/// CreateBetaCodeBatchDto
///
/// Properties:
/// * [count] - 生成数量
/// * [maxUsesPerCode] - 每个内测码可用次数
@BuiltValue()
abstract class CreateBetaCodeBatchDto implements Built<CreateBetaCodeBatchDto, CreateBetaCodeBatchDtoBuilder> {
  /// 生成数量
  @BuiltValueField(wireName: r'count')
  num get count;

  /// 每个内测码可用次数
  @BuiltValueField(wireName: r'maxUsesPerCode')
  num get maxUsesPerCode;

  CreateBetaCodeBatchDto._();

  factory CreateBetaCodeBatchDto([void updates(CreateBetaCodeBatchDtoBuilder b)]) = _$CreateBetaCodeBatchDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(CreateBetaCodeBatchDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<CreateBetaCodeBatchDto> get serializer => _$CreateBetaCodeBatchDtoSerializer();
}

class _$CreateBetaCodeBatchDtoSerializer implements PrimitiveSerializer<CreateBetaCodeBatchDto> {
  @override
  final Iterable<Type> types = const [CreateBetaCodeBatchDto, _$CreateBetaCodeBatchDto];

  @override
  final String wireName = r'CreateBetaCodeBatchDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    CreateBetaCodeBatchDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'count';
    yield serializers.serialize(
      object.count,
      specifiedType: const FullType(num),
    );
    yield r'maxUsesPerCode';
    yield serializers.serialize(
      object.maxUsesPerCode,
      specifiedType: const FullType(num),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    CreateBetaCodeBatchDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required CreateBetaCodeBatchDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'count':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.count = valueDes;
          break;
        case r'maxUsesPerCode':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.maxUsesPerCode = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  CreateBetaCodeBatchDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = CreateBetaCodeBatchDtoBuilder();
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

