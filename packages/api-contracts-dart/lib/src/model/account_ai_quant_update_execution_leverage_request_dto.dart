//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'account_ai_quant_update_execution_leverage_request_dto.g.dart';

/// AccountAiQuantUpdateExecutionLeverageRequestDto
///
/// Properties:
/// * [leverage] - The next-cycle leverage to apply to the deployed strategy instance.
@BuiltValue()
abstract class AccountAiQuantUpdateExecutionLeverageRequestDto implements Built<AccountAiQuantUpdateExecutionLeverageRequestDto, AccountAiQuantUpdateExecutionLeverageRequestDtoBuilder> {
  /// The next-cycle leverage to apply to the deployed strategy instance.
  @BuiltValueField(wireName: r'leverage')
  num get leverage;

  AccountAiQuantUpdateExecutionLeverageRequestDto._();

  factory AccountAiQuantUpdateExecutionLeverageRequestDto([void updates(AccountAiQuantUpdateExecutionLeverageRequestDtoBuilder b)]) = _$AccountAiQuantUpdateExecutionLeverageRequestDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AccountAiQuantUpdateExecutionLeverageRequestDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AccountAiQuantUpdateExecutionLeverageRequestDto> get serializer => _$AccountAiQuantUpdateExecutionLeverageRequestDtoSerializer();
}

class _$AccountAiQuantUpdateExecutionLeverageRequestDtoSerializer implements PrimitiveSerializer<AccountAiQuantUpdateExecutionLeverageRequestDto> {
  @override
  final Iterable<Type> types = const [AccountAiQuantUpdateExecutionLeverageRequestDto, _$AccountAiQuantUpdateExecutionLeverageRequestDto];

  @override
  final String wireName = r'AccountAiQuantUpdateExecutionLeverageRequestDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AccountAiQuantUpdateExecutionLeverageRequestDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'leverage';
    yield serializers.serialize(
      object.leverage,
      specifiedType: const FullType(num),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    AccountAiQuantUpdateExecutionLeverageRequestDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AccountAiQuantUpdateExecutionLeverageRequestDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'leverage':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.leverage = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  AccountAiQuantUpdateExecutionLeverageRequestDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AccountAiQuantUpdateExecutionLeverageRequestDtoBuilder();
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

