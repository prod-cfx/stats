//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'telegram_desktop_exchange_request_dto.g.dart';

/// TelegramDesktopExchangeRequestDto
///
/// Properties:
/// * [intentId] - Telegram 桌面登录 intentId
/// * [betaCode] - 内测码，首次创建用户时必填
@BuiltValue()
abstract class TelegramDesktopExchangeRequestDto implements Built<TelegramDesktopExchangeRequestDto, TelegramDesktopExchangeRequestDtoBuilder> {
  /// Telegram 桌面登录 intentId
  @BuiltValueField(wireName: r'intentId')
  String get intentId;

  /// 内测码，首次创建用户时必填
  @BuiltValueField(wireName: r'betaCode')
  String? get betaCode;

  TelegramDesktopExchangeRequestDto._();

  factory TelegramDesktopExchangeRequestDto([void updates(TelegramDesktopExchangeRequestDtoBuilder b)]) = _$TelegramDesktopExchangeRequestDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(TelegramDesktopExchangeRequestDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<TelegramDesktopExchangeRequestDto> get serializer => _$TelegramDesktopExchangeRequestDtoSerializer();
}

class _$TelegramDesktopExchangeRequestDtoSerializer implements PrimitiveSerializer<TelegramDesktopExchangeRequestDto> {
  @override
  final Iterable<Type> types = const [TelegramDesktopExchangeRequestDto, _$TelegramDesktopExchangeRequestDto];

  @override
  final String wireName = r'TelegramDesktopExchangeRequestDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    TelegramDesktopExchangeRequestDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'intentId';
    yield serializers.serialize(
      object.intentId,
      specifiedType: const FullType(String),
    );
    if (object.betaCode != null) {
      yield r'betaCode';
      yield serializers.serialize(
        object.betaCode,
        specifiedType: const FullType(String),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    TelegramDesktopExchangeRequestDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required TelegramDesktopExchangeRequestDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'intentId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.intentId = valueDes;
          break;
        case r'betaCode':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.betaCode = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  TelegramDesktopExchangeRequestDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = TelegramDesktopExchangeRequestDtoBuilder();
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

