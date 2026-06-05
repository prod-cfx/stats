//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'account_ai_quant_action_request_dto.g.dart';

/// AccountAiQuantActionRequestDto
///
/// Properties:
/// * [action] 
@BuiltValue()
abstract class AccountAiQuantActionRequestDto implements Built<AccountAiQuantActionRequestDto, AccountAiQuantActionRequestDtoBuilder> {
  @BuiltValueField(wireName: r'action')
  AccountAiQuantActionRequestDtoActionEnum get action;
  // enum actionEnum {  run,  stop,  liquidate_and_stop,  };

  AccountAiQuantActionRequestDto._();

  factory AccountAiQuantActionRequestDto([void updates(AccountAiQuantActionRequestDtoBuilder b)]) = _$AccountAiQuantActionRequestDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AccountAiQuantActionRequestDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AccountAiQuantActionRequestDto> get serializer => _$AccountAiQuantActionRequestDtoSerializer();
}

class _$AccountAiQuantActionRequestDtoSerializer implements PrimitiveSerializer<AccountAiQuantActionRequestDto> {
  @override
  final Iterable<Type> types = const [AccountAiQuantActionRequestDto, _$AccountAiQuantActionRequestDto];

  @override
  final String wireName = r'AccountAiQuantActionRequestDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AccountAiQuantActionRequestDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'action';
    yield serializers.serialize(
      object.action,
      specifiedType: const FullType(AccountAiQuantActionRequestDtoActionEnum),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    AccountAiQuantActionRequestDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AccountAiQuantActionRequestDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'action':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(AccountAiQuantActionRequestDtoActionEnum),
          ) as AccountAiQuantActionRequestDtoActionEnum;
          result.action = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  AccountAiQuantActionRequestDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AccountAiQuantActionRequestDtoBuilder();
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

class AccountAiQuantActionRequestDtoActionEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'run')
  static const AccountAiQuantActionRequestDtoActionEnum run = _$accountAiQuantActionRequestDtoActionEnum_run;
  @BuiltValueEnumConst(wireName: r'stop')
  static const AccountAiQuantActionRequestDtoActionEnum stop = _$accountAiQuantActionRequestDtoActionEnum_stop;
  @BuiltValueEnumConst(wireName: r'liquidate_and_stop')
  static const AccountAiQuantActionRequestDtoActionEnum liquidateAndStop = _$accountAiQuantActionRequestDtoActionEnum_liquidateAndStop;

  static Serializer<AccountAiQuantActionRequestDtoActionEnum> get serializer => _$accountAiQuantActionRequestDtoActionEnumSerializer;

  const AccountAiQuantActionRequestDtoActionEnum._(String name): super(name);

  static BuiltSet<AccountAiQuantActionRequestDtoActionEnum> get values => _$accountAiQuantActionRequestDtoActionEnumValues;
  static AccountAiQuantActionRequestDtoActionEnum valueOf(String name) => _$accountAiQuantActionRequestDtoActionEnumValueOf(name);
}

