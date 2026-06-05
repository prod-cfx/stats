//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'backtesting_create_job_execution_dto.g.dart';

/// BacktestingCreateJobExecutionDto
///
/// Properties:
/// * [slippageBps] 
/// * [feeBps] 
/// * [priceSource] 
@BuiltValue()
abstract class BacktestingCreateJobExecutionDto implements Built<BacktestingCreateJobExecutionDto, BacktestingCreateJobExecutionDtoBuilder> {
  @BuiltValueField(wireName: r'slippageBps')
  num get slippageBps;

  @BuiltValueField(wireName: r'feeBps')
  num get feeBps;

  @BuiltValueField(wireName: r'priceSource')
  BacktestingCreateJobExecutionDtoPriceSourceEnum get priceSource;
  // enum priceSourceEnum {  open,  close,  mid,  };

  BacktestingCreateJobExecutionDto._();

  factory BacktestingCreateJobExecutionDto([void updates(BacktestingCreateJobExecutionDtoBuilder b)]) = _$BacktestingCreateJobExecutionDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(BacktestingCreateJobExecutionDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<BacktestingCreateJobExecutionDto> get serializer => _$BacktestingCreateJobExecutionDtoSerializer();
}

class _$BacktestingCreateJobExecutionDtoSerializer implements PrimitiveSerializer<BacktestingCreateJobExecutionDto> {
  @override
  final Iterable<Type> types = const [BacktestingCreateJobExecutionDto, _$BacktestingCreateJobExecutionDto];

  @override
  final String wireName = r'BacktestingCreateJobExecutionDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    BacktestingCreateJobExecutionDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'slippageBps';
    yield serializers.serialize(
      object.slippageBps,
      specifiedType: const FullType(num),
    );
    yield r'feeBps';
    yield serializers.serialize(
      object.feeBps,
      specifiedType: const FullType(num),
    );
    yield r'priceSource';
    yield serializers.serialize(
      object.priceSource,
      specifiedType: const FullType(BacktestingCreateJobExecutionDtoPriceSourceEnum),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    BacktestingCreateJobExecutionDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required BacktestingCreateJobExecutionDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'slippageBps':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.slippageBps = valueDes;
          break;
        case r'feeBps':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.feeBps = valueDes;
          break;
        case r'priceSource':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BacktestingCreateJobExecutionDtoPriceSourceEnum),
          ) as BacktestingCreateJobExecutionDtoPriceSourceEnum;
          result.priceSource = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  BacktestingCreateJobExecutionDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = BacktestingCreateJobExecutionDtoBuilder();
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

class BacktestingCreateJobExecutionDtoPriceSourceEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'open')
  static const BacktestingCreateJobExecutionDtoPriceSourceEnum open = _$backtestingCreateJobExecutionDtoPriceSourceEnum_open;
  @BuiltValueEnumConst(wireName: r'close')
  static const BacktestingCreateJobExecutionDtoPriceSourceEnum close = _$backtestingCreateJobExecutionDtoPriceSourceEnum_close;
  @BuiltValueEnumConst(wireName: r'mid')
  static const BacktestingCreateJobExecutionDtoPriceSourceEnum mid = _$backtestingCreateJobExecutionDtoPriceSourceEnum_mid;

  static Serializer<BacktestingCreateJobExecutionDtoPriceSourceEnum> get serializer => _$backtestingCreateJobExecutionDtoPriceSourceEnumSerializer;

  const BacktestingCreateJobExecutionDtoPriceSourceEnum._(String name): super(name);

  static BuiltSet<BacktestingCreateJobExecutionDtoPriceSourceEnum> get values => _$backtestingCreateJobExecutionDtoPriceSourceEnumValues;
  static BacktestingCreateJobExecutionDtoPriceSourceEnum valueOf(String name) => _$backtestingCreateJobExecutionDtoPriceSourceEnumValueOf(name);
}

