//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'admin_refresh_dto.g.dart';

/// AdminRefreshDto
///
/// Properties:
/// * [refreshToken] - 刷新令牌
@BuiltValue()
abstract class AdminRefreshDto implements Built<AdminRefreshDto, AdminRefreshDtoBuilder> {
  /// 刷新令牌
  @BuiltValueField(wireName: r'refreshToken')
  String get refreshToken;

  AdminRefreshDto._();

  factory AdminRefreshDto([void updates(AdminRefreshDtoBuilder b)]) = _$AdminRefreshDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AdminRefreshDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AdminRefreshDto> get serializer => _$AdminRefreshDtoSerializer();
}

class _$AdminRefreshDtoSerializer implements PrimitiveSerializer<AdminRefreshDto> {
  @override
  final Iterable<Type> types = const [AdminRefreshDto, _$AdminRefreshDto];

  @override
  final String wireName = r'AdminRefreshDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AdminRefreshDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'refreshToken';
    yield serializers.serialize(
      object.refreshToken,
      specifiedType: const FullType(String),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    AdminRefreshDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AdminRefreshDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'refreshToken':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.refreshToken = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  AdminRefreshDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AdminRefreshDtoBuilder();
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

