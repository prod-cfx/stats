//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'backtesting_create_job_range_dto.g.dart';

/// BacktestingCreateJobRangeDto
///
/// Properties:
/// * [fromTs] - 区间起始时间（毫秒时间戳）
/// * [toTs] - 区间结束时间（毫秒时间戳）
@BuiltValue()
abstract class BacktestingCreateJobRangeDto implements Built<BacktestingCreateJobRangeDto, BacktestingCreateJobRangeDtoBuilder> {
  /// 区间起始时间（毫秒时间戳）
  @BuiltValueField(wireName: r'fromTs')
  num get fromTs;

  /// 区间结束时间（毫秒时间戳）
  @BuiltValueField(wireName: r'toTs')
  num get toTs;

  BacktestingCreateJobRangeDto._();

  factory BacktestingCreateJobRangeDto([void updates(BacktestingCreateJobRangeDtoBuilder b)]) = _$BacktestingCreateJobRangeDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(BacktestingCreateJobRangeDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<BacktestingCreateJobRangeDto> get serializer => _$BacktestingCreateJobRangeDtoSerializer();
}

class _$BacktestingCreateJobRangeDtoSerializer implements PrimitiveSerializer<BacktestingCreateJobRangeDto> {
  @override
  final Iterable<Type> types = const [BacktestingCreateJobRangeDto, _$BacktestingCreateJobRangeDto];

  @override
  final String wireName = r'BacktestingCreateJobRangeDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    BacktestingCreateJobRangeDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'fromTs';
    yield serializers.serialize(
      object.fromTs,
      specifiedType: const FullType(num),
    );
    yield r'toTs';
    yield serializers.serialize(
      object.toTs,
      specifiedType: const FullType(num),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    BacktestingCreateJobRangeDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required BacktestingCreateJobRangeDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'fromTs':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.fromTs = valueDes;
          break;
        case r'toTs':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.toTs = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  BacktestingCreateJobRangeDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = BacktestingCreateJobRangeDtoBuilder();
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

