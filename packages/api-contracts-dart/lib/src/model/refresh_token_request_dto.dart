//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'refresh_token_request_dto.g.dart';

/// RefreshTokenRequestDto
///
/// Properties:
/// * [refreshToken] - 刷新令牌
@BuiltValue()
abstract class RefreshTokenRequestDto implements Built<RefreshTokenRequestDto, RefreshTokenRequestDtoBuilder> {
  /// 刷新令牌
  @BuiltValueField(wireName: r'refreshToken')
  String get refreshToken;

  RefreshTokenRequestDto._();

  factory RefreshTokenRequestDto([void updates(RefreshTokenRequestDtoBuilder b)]) = _$RefreshTokenRequestDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(RefreshTokenRequestDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<RefreshTokenRequestDto> get serializer => _$RefreshTokenRequestDtoSerializer();
}

class _$RefreshTokenRequestDtoSerializer implements PrimitiveSerializer<RefreshTokenRequestDto> {
  @override
  final Iterable<Type> types = const [RefreshTokenRequestDto, _$RefreshTokenRequestDto];

  @override
  final String wireName = r'RefreshTokenRequestDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    RefreshTokenRequestDto object, {
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
    RefreshTokenRequestDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required RefreshTokenRequestDtoBuilder result,
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
  RefreshTokenRequestDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = RefreshTokenRequestDtoBuilder();
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

