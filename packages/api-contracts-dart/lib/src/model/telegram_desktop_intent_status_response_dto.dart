//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'telegram_desktop_intent_status_response_dto.g.dart';

/// TelegramDesktopIntentStatusResponseDto
///
/// Properties:
/// * [status] - 登录意图状态
@BuiltValue()
abstract class TelegramDesktopIntentStatusResponseDto implements Built<TelegramDesktopIntentStatusResponseDto, TelegramDesktopIntentStatusResponseDtoBuilder> {
  /// 登录意图状态
  @BuiltValueField(wireName: r'status')
  TelegramDesktopIntentStatusResponseDtoStatusEnum get status;
  // enum statusEnum {  pending,  confirmed,  expired,  };

  TelegramDesktopIntentStatusResponseDto._();

  factory TelegramDesktopIntentStatusResponseDto([void updates(TelegramDesktopIntentStatusResponseDtoBuilder b)]) = _$TelegramDesktopIntentStatusResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(TelegramDesktopIntentStatusResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<TelegramDesktopIntentStatusResponseDto> get serializer => _$TelegramDesktopIntentStatusResponseDtoSerializer();
}

class _$TelegramDesktopIntentStatusResponseDtoSerializer implements PrimitiveSerializer<TelegramDesktopIntentStatusResponseDto> {
  @override
  final Iterable<Type> types = const [TelegramDesktopIntentStatusResponseDto, _$TelegramDesktopIntentStatusResponseDto];

  @override
  final String wireName = r'TelegramDesktopIntentStatusResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    TelegramDesktopIntentStatusResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'status';
    yield serializers.serialize(
      object.status,
      specifiedType: const FullType(TelegramDesktopIntentStatusResponseDtoStatusEnum),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    TelegramDesktopIntentStatusResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required TelegramDesktopIntentStatusResponseDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'status':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(TelegramDesktopIntentStatusResponseDtoStatusEnum),
          ) as TelegramDesktopIntentStatusResponseDtoStatusEnum;
          result.status = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  TelegramDesktopIntentStatusResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = TelegramDesktopIntentStatusResponseDtoBuilder();
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

class TelegramDesktopIntentStatusResponseDtoStatusEnum extends EnumClass {

  /// 登录意图状态
  @BuiltValueEnumConst(wireName: r'pending')
  static const TelegramDesktopIntentStatusResponseDtoStatusEnum pending = _$telegramDesktopIntentStatusResponseDtoStatusEnum_pending;
  /// 登录意图状态
  @BuiltValueEnumConst(wireName: r'confirmed')
  static const TelegramDesktopIntentStatusResponseDtoStatusEnum confirmed = _$telegramDesktopIntentStatusResponseDtoStatusEnum_confirmed;
  /// 登录意图状态
  @BuiltValueEnumConst(wireName: r'expired')
  static const TelegramDesktopIntentStatusResponseDtoStatusEnum expired = _$telegramDesktopIntentStatusResponseDtoStatusEnum_expired;

  static Serializer<TelegramDesktopIntentStatusResponseDtoStatusEnum> get serializer => _$telegramDesktopIntentStatusResponseDtoStatusEnumSerializer;

  const TelegramDesktopIntentStatusResponseDtoStatusEnum._(String name): super(name);

  static BuiltSet<TelegramDesktopIntentStatusResponseDtoStatusEnum> get values => _$telegramDesktopIntentStatusResponseDtoStatusEnumValues;
  static TelegramDesktopIntentStatusResponseDtoStatusEnum valueOf(String name) => _$telegramDesktopIntentStatusResponseDtoStatusEnumValueOf(name);
}

