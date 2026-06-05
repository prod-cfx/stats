//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'update_beta_code_status_dto.g.dart';

/// UpdateBetaCodeStatusDto
///
/// Properties:
/// * [isActive] - 是否启用
@BuiltValue()
abstract class UpdateBetaCodeStatusDto implements Built<UpdateBetaCodeStatusDto, UpdateBetaCodeStatusDtoBuilder> {
  /// 是否启用
  @BuiltValueField(wireName: r'isActive')
  bool get isActive;

  UpdateBetaCodeStatusDto._();

  factory UpdateBetaCodeStatusDto([void updates(UpdateBetaCodeStatusDtoBuilder b)]) = _$UpdateBetaCodeStatusDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(UpdateBetaCodeStatusDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<UpdateBetaCodeStatusDto> get serializer => _$UpdateBetaCodeStatusDtoSerializer();
}

class _$UpdateBetaCodeStatusDtoSerializer implements PrimitiveSerializer<UpdateBetaCodeStatusDto> {
  @override
  final Iterable<Type> types = const [UpdateBetaCodeStatusDto, _$UpdateBetaCodeStatusDto];

  @override
  final String wireName = r'UpdateBetaCodeStatusDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    UpdateBetaCodeStatusDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'isActive';
    yield serializers.serialize(
      object.isActive,
      specifiedType: const FullType(bool),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    UpdateBetaCodeStatusDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required UpdateBetaCodeStatusDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'isActive':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.isActive = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  UpdateBetaCodeStatusDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = UpdateBetaCodeStatusDtoBuilder();
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

