//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'user_profile_response_dto.g.dart';

/// UserProfileResponseDto
///
/// Properties:
/// * [id] - User ID
/// * [email] - Email
/// * [nickname] - Nickname
/// * [avatarUrl] - Avatar URL
/// * [emailVerified] - Whether email is verified
/// * [isGuest] - Whether the user is a guest account
/// * [roles] - User roles
/// * [createdAt] - User creation time
/// * [updatedAt] - Last update time
@BuiltValue()
abstract class UserProfileResponseDto implements Built<UserProfileResponseDto, UserProfileResponseDtoBuilder> {
  /// User ID
  @BuiltValueField(wireName: r'id')
  String get id;

  /// Email
  @BuiltValueField(wireName: r'email')
  String get email;

  /// Nickname
  @BuiltValueField(wireName: r'nickname')
  String? get nickname;

  /// Avatar URL
  @BuiltValueField(wireName: r'avatarUrl')
  String? get avatarUrl;

  /// Whether email is verified
  @BuiltValueField(wireName: r'emailVerified')
  bool get emailVerified;

  /// Whether the user is a guest account
  @BuiltValueField(wireName: r'isGuest')
  bool get isGuest;

  /// User roles
  @BuiltValueField(wireName: r'roles')
  BuiltList<String> get roles;

  /// User creation time
  @BuiltValueField(wireName: r'createdAt')
  DateTime get createdAt;

  /// Last update time
  @BuiltValueField(wireName: r'updatedAt')
  DateTime get updatedAt;

  UserProfileResponseDto._();

  factory UserProfileResponseDto([void updates(UserProfileResponseDtoBuilder b)]) = _$UserProfileResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(UserProfileResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<UserProfileResponseDto> get serializer => _$UserProfileResponseDtoSerializer();
}

class _$UserProfileResponseDtoSerializer implements PrimitiveSerializer<UserProfileResponseDto> {
  @override
  final Iterable<Type> types = const [UserProfileResponseDto, _$UserProfileResponseDto];

  @override
  final String wireName = r'UserProfileResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    UserProfileResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'id';
    yield serializers.serialize(
      object.id,
      specifiedType: const FullType(String),
    );
    yield r'email';
    yield serializers.serialize(
      object.email,
      specifiedType: const FullType(String),
    );
    if (object.nickname != null) {
      yield r'nickname';
      yield serializers.serialize(
        object.nickname,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.avatarUrl != null) {
      yield r'avatarUrl';
      yield serializers.serialize(
        object.avatarUrl,
        specifiedType: const FullType(String),
      );
    }
    yield r'emailVerified';
    yield serializers.serialize(
      object.emailVerified,
      specifiedType: const FullType(bool),
    );
    yield r'isGuest';
    yield serializers.serialize(
      object.isGuest,
      specifiedType: const FullType(bool),
    );
    yield r'roles';
    yield serializers.serialize(
      object.roles,
      specifiedType: const FullType(BuiltList, [FullType(String)]),
    );
    yield r'createdAt';
    yield serializers.serialize(
      object.createdAt,
      specifiedType: const FullType(DateTime),
    );
    yield r'updatedAt';
    yield serializers.serialize(
      object.updatedAt,
      specifiedType: const FullType(DateTime),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    UserProfileResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required UserProfileResponseDtoBuilder result,
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
        case r'email':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.email = valueDes;
          break;
        case r'nickname':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.nickname = valueDes;
          break;
        case r'avatarUrl':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.avatarUrl = valueDes;
          break;
        case r'emailVerified':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.emailVerified = valueDes;
          break;
        case r'isGuest':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.isGuest = valueDes;
          break;
        case r'roles':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(String)]),
          ) as BuiltList<String>;
          result.roles.replace(valueDes);
          break;
        case r'createdAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(DateTime),
          ) as DateTime;
          result.createdAt = valueDes;
          break;
        case r'updatedAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(DateTime),
          ) as DateTime;
          result.updatedAt = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  UserProfileResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = UserProfileResponseDtoBuilder();
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

