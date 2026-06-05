//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'open_interest_stats_dto.g.dart';

/// OpenInterestStatsDto
///
/// Properties:
/// * [symbol] - 币种符号
/// * [startTime] - 开始时间
/// * [endTime] - 结束时间
/// * [dataPoints] - 数据点数量
/// * [max] - 最大值
/// * [min] - 最小值
/// * [avg] - 平均值
/// * [latest] - 最新值
/// * [earliest] - 最早值
/// * [change] - 变化量
/// * [changePercent] - 变化百分比
@BuiltValue()
abstract class OpenInterestStatsDto implements Built<OpenInterestStatsDto, OpenInterestStatsDtoBuilder> {
  /// 币种符号
  @BuiltValueField(wireName: r'symbol')
  String get symbol;

  /// 开始时间
  @BuiltValueField(wireName: r'startTime')
  DateTime get startTime;

  /// 结束时间
  @BuiltValueField(wireName: r'endTime')
  DateTime get endTime;

  /// 数据点数量
  @BuiltValueField(wireName: r'dataPoints')
  num get dataPoints;

  /// 最大值
  @BuiltValueField(wireName: r'max')
  num get max;

  /// 最小值
  @BuiltValueField(wireName: r'min')
  num get min;

  /// 平均值
  @BuiltValueField(wireName: r'avg')
  num get avg;

  /// 最新值
  @BuiltValueField(wireName: r'latest')
  num get latest;

  /// 最早值
  @BuiltValueField(wireName: r'earliest')
  num get earliest;

  /// 变化量
  @BuiltValueField(wireName: r'change')
  num get change;

  /// 变化百分比
  @BuiltValueField(wireName: r'changePercent')
  num get changePercent;

  OpenInterestStatsDto._();

  factory OpenInterestStatsDto([void updates(OpenInterestStatsDtoBuilder b)]) = _$OpenInterestStatsDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(OpenInterestStatsDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<OpenInterestStatsDto> get serializer => _$OpenInterestStatsDtoSerializer();
}

class _$OpenInterestStatsDtoSerializer implements PrimitiveSerializer<OpenInterestStatsDto> {
  @override
  final Iterable<Type> types = const [OpenInterestStatsDto, _$OpenInterestStatsDto];

  @override
  final String wireName = r'OpenInterestStatsDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    OpenInterestStatsDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'symbol';
    yield serializers.serialize(
      object.symbol,
      specifiedType: const FullType(String),
    );
    yield r'startTime';
    yield serializers.serialize(
      object.startTime,
      specifiedType: const FullType(DateTime),
    );
    yield r'endTime';
    yield serializers.serialize(
      object.endTime,
      specifiedType: const FullType(DateTime),
    );
    yield r'dataPoints';
    yield serializers.serialize(
      object.dataPoints,
      specifiedType: const FullType(num),
    );
    yield r'max';
    yield serializers.serialize(
      object.max,
      specifiedType: const FullType(num),
    );
    yield r'min';
    yield serializers.serialize(
      object.min,
      specifiedType: const FullType(num),
    );
    yield r'avg';
    yield serializers.serialize(
      object.avg,
      specifiedType: const FullType(num),
    );
    yield r'latest';
    yield serializers.serialize(
      object.latest,
      specifiedType: const FullType(num),
    );
    yield r'earliest';
    yield serializers.serialize(
      object.earliest,
      specifiedType: const FullType(num),
    );
    yield r'change';
    yield serializers.serialize(
      object.change,
      specifiedType: const FullType(num),
    );
    yield r'changePercent';
    yield serializers.serialize(
      object.changePercent,
      specifiedType: const FullType(num),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    OpenInterestStatsDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required OpenInterestStatsDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'symbol':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.symbol = valueDes;
          break;
        case r'startTime':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(DateTime),
          ) as DateTime;
          result.startTime = valueDes;
          break;
        case r'endTime':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(DateTime),
          ) as DateTime;
          result.endTime = valueDes;
          break;
        case r'dataPoints':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.dataPoints = valueDes;
          break;
        case r'max':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.max = valueDes;
          break;
        case r'min':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.min = valueDes;
          break;
        case r'avg':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.avg = valueDes;
          break;
        case r'latest':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.latest = valueDes;
          break;
        case r'earliest':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.earliest = valueDes;
          break;
        case r'change':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.change = valueDes;
          break;
        case r'changePercent':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.changePercent = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  OpenInterestStatsDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = OpenInterestStatsDtoBuilder();
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

