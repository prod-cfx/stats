//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'admin_delete_result_response_dto.g.dart';

/// AdminDeleteResultResponseDto
///
/// Properties:
/// * [success] - 是否删除成功
@BuiltValue()
abstract class AdminDeleteResultResponseDto implements Built<AdminDeleteResultResponseDto, AdminDeleteResultResponseDtoBuilder> {
  /// 是否删除成功
  @BuiltValueField(wireName: r'success')
  bool get success;

  AdminDeleteResultResponseDto._();

  factory AdminDeleteResultResponseDto([void updates(AdminDeleteResultResponseDtoBuilder b)]) = _$AdminDeleteResultResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AdminDeleteResultResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AdminDeleteResultResponseDto> get serializer => _$AdminDeleteResultResponseDtoSerializer();
}

class _$AdminDeleteResultResponseDtoSerializer implements PrimitiveSerializer<AdminDeleteResultResponseDto> {
  @override
  final Iterable<Type> types = const [AdminDeleteResultResponseDto, _$AdminDeleteResultResponseDto];

  @override
  final String wireName = r'AdminDeleteResultResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AdminDeleteResultResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'success';
    yield serializers.serialize(
      object.success,
      specifiedType: const FullType(bool),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    AdminDeleteResultResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AdminDeleteResultResponseDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'success':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.success = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  AdminDeleteResultResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AdminDeleteResultResponseDtoBuilder();
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

