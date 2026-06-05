//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'backtesting_create_job_requested_range_input_dto.g.dart';

/// BacktestingCreateJobRequestedRangeInputDto
///
/// Properties:
/// * [preset] 
/// * [startAt] 
/// * [endAt] 
@BuiltValue()
abstract class BacktestingCreateJobRequestedRangeInputDto implements Built<BacktestingCreateJobRequestedRangeInputDto, BacktestingCreateJobRequestedRangeInputDtoBuilder> {
  @BuiltValueField(wireName: r'preset')
  BacktestingCreateJobRequestedRangeInputDtoPresetEnum get preset;
  // enum presetEnum {  7D,  30D,  90D,  1Y,  CUSTOM,  };

  @BuiltValueField(wireName: r'startAt')
  String? get startAt;

  @BuiltValueField(wireName: r'endAt')
  String? get endAt;

  BacktestingCreateJobRequestedRangeInputDto._();

  factory BacktestingCreateJobRequestedRangeInputDto([void updates(BacktestingCreateJobRequestedRangeInputDtoBuilder b)]) = _$BacktestingCreateJobRequestedRangeInputDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(BacktestingCreateJobRequestedRangeInputDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<BacktestingCreateJobRequestedRangeInputDto> get serializer => _$BacktestingCreateJobRequestedRangeInputDtoSerializer();
}

class _$BacktestingCreateJobRequestedRangeInputDtoSerializer implements PrimitiveSerializer<BacktestingCreateJobRequestedRangeInputDto> {
  @override
  final Iterable<Type> types = const [BacktestingCreateJobRequestedRangeInputDto, _$BacktestingCreateJobRequestedRangeInputDto];

  @override
  final String wireName = r'BacktestingCreateJobRequestedRangeInputDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    BacktestingCreateJobRequestedRangeInputDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'preset';
    yield serializers.serialize(
      object.preset,
      specifiedType: const FullType(BacktestingCreateJobRequestedRangeInputDtoPresetEnum),
    );
    if (object.startAt != null) {
      yield r'startAt';
      yield serializers.serialize(
        object.startAt,
        specifiedType: const FullType(String),
      );
    }
    if (object.endAt != null) {
      yield r'endAt';
      yield serializers.serialize(
        object.endAt,
        specifiedType: const FullType(String),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    BacktestingCreateJobRequestedRangeInputDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required BacktestingCreateJobRequestedRangeInputDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'preset':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BacktestingCreateJobRequestedRangeInputDtoPresetEnum),
          ) as BacktestingCreateJobRequestedRangeInputDtoPresetEnum;
          result.preset = valueDes;
          break;
        case r'startAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.startAt = valueDes;
          break;
        case r'endAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.endAt = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  BacktestingCreateJobRequestedRangeInputDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = BacktestingCreateJobRequestedRangeInputDtoBuilder();
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

class BacktestingCreateJobRequestedRangeInputDtoPresetEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'7D')
  static const BacktestingCreateJobRequestedRangeInputDtoPresetEnum n7d = _$backtestingCreateJobRequestedRangeInputDtoPresetEnum_n7d;
  @BuiltValueEnumConst(wireName: r'30D')
  static const BacktestingCreateJobRequestedRangeInputDtoPresetEnum n30d = _$backtestingCreateJobRequestedRangeInputDtoPresetEnum_n30d;
  @BuiltValueEnumConst(wireName: r'90D')
  static const BacktestingCreateJobRequestedRangeInputDtoPresetEnum n90d = _$backtestingCreateJobRequestedRangeInputDtoPresetEnum_n90d;
  @BuiltValueEnumConst(wireName: r'1Y')
  static const BacktestingCreateJobRequestedRangeInputDtoPresetEnum n1y = _$backtestingCreateJobRequestedRangeInputDtoPresetEnum_n1y;
  @BuiltValueEnumConst(wireName: r'CUSTOM')
  static const BacktestingCreateJobRequestedRangeInputDtoPresetEnum CUSTOM = _$backtestingCreateJobRequestedRangeInputDtoPresetEnum_CUSTOM;

  static Serializer<BacktestingCreateJobRequestedRangeInputDtoPresetEnum> get serializer => _$backtestingCreateJobRequestedRangeInputDtoPresetEnumSerializer;

  const BacktestingCreateJobRequestedRangeInputDtoPresetEnum._(String name): super(name);

  static BuiltSet<BacktestingCreateJobRequestedRangeInputDtoPresetEnum> get values => _$backtestingCreateJobRequestedRangeInputDtoPresetEnumValues;
  static BacktestingCreateJobRequestedRangeInputDtoPresetEnum valueOf(String name) => _$backtestingCreateJobRequestedRangeInputDtoPresetEnumValueOf(name);
}

