//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'bind_telegram_request_dto.g.dart';

/// BindTelegramRequestDto
///
/// Properties:
/// * [telegramId] - Telegram unique identifier
/// * [authDate] - Telegram auth date (unix timestamp)
/// * [hash] - Telegram login hash
/// * [firstName] - Telegram first name
/// * [lastName] - Telegram last name
/// * [username] - Telegram username
/// * [photoUrl] - Telegram avatar url
@BuiltValue()
abstract class BindTelegramRequestDto implements Built<BindTelegramRequestDto, BindTelegramRequestDtoBuilder> {
  /// Telegram unique identifier
  @BuiltValueField(wireName: r'telegramId')
  String get telegramId;

  /// Telegram auth date (unix timestamp)
  @BuiltValueField(wireName: r'authDate')
  String get authDate;

  /// Telegram login hash
  @BuiltValueField(wireName: r'hash')
  String get hash;

  /// Telegram first name
  @BuiltValueField(wireName: r'firstName')
  String? get firstName;

  /// Telegram last name
  @BuiltValueField(wireName: r'lastName')
  String? get lastName;

  /// Telegram username
  @BuiltValueField(wireName: r'username')
  String? get username;

  /// Telegram avatar url
  @BuiltValueField(wireName: r'photoUrl')
  String? get photoUrl;

  BindTelegramRequestDto._();

  factory BindTelegramRequestDto([void updates(BindTelegramRequestDtoBuilder b)]) = _$BindTelegramRequestDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(BindTelegramRequestDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<BindTelegramRequestDto> get serializer => _$BindTelegramRequestDtoSerializer();
}

class _$BindTelegramRequestDtoSerializer implements PrimitiveSerializer<BindTelegramRequestDto> {
  @override
  final Iterable<Type> types = const [BindTelegramRequestDto, _$BindTelegramRequestDto];

  @override
  final String wireName = r'BindTelegramRequestDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    BindTelegramRequestDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'telegramId';
    yield serializers.serialize(
      object.telegramId,
      specifiedType: const FullType(String),
    );
    yield r'authDate';
    yield serializers.serialize(
      object.authDate,
      specifiedType: const FullType(String),
    );
    yield r'hash';
    yield serializers.serialize(
      object.hash,
      specifiedType: const FullType(String),
    );
    if (object.firstName != null) {
      yield r'firstName';
      yield serializers.serialize(
        object.firstName,
        specifiedType: const FullType(String),
      );
    }
    if (object.lastName != null) {
      yield r'lastName';
      yield serializers.serialize(
        object.lastName,
        specifiedType: const FullType(String),
      );
    }
    if (object.username != null) {
      yield r'username';
      yield serializers.serialize(
        object.username,
        specifiedType: const FullType(String),
      );
    }
    if (object.photoUrl != null) {
      yield r'photoUrl';
      yield serializers.serialize(
        object.photoUrl,
        specifiedType: const FullType(String),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    BindTelegramRequestDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required BindTelegramRequestDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'telegramId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.telegramId = valueDes;
          break;
        case r'authDate':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.authDate = valueDes;
          break;
        case r'hash':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.hash = valueDes;
          break;
        case r'firstName':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.firstName = valueDes;
          break;
        case r'lastName':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.lastName = valueDes;
          break;
        case r'username':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.username = valueDes;
          break;
        case r'photoUrl':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.photoUrl = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  BindTelegramRequestDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = BindTelegramRequestDtoBuilder();
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

