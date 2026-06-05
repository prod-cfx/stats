//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'prediction_market_outcome_dto.g.dart';

/// PredictionMarketOutcomeDto
///
/// Properties:
/// * [label] - Outcome 标签（用于前端显示）
/// * [probability] - 概率字符串，例如 0.86 或 86
@BuiltValue()
abstract class PredictionMarketOutcomeDto implements Built<PredictionMarketOutcomeDto, PredictionMarketOutcomeDtoBuilder> {
  /// Outcome 标签（用于前端显示）
  @BuiltValueField(wireName: r'label')
  String get label;

  /// 概率字符串，例如 0.86 或 86
  @BuiltValueField(wireName: r'probability')
  String get probability;

  PredictionMarketOutcomeDto._();

  factory PredictionMarketOutcomeDto([void updates(PredictionMarketOutcomeDtoBuilder b)]) = _$PredictionMarketOutcomeDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(PredictionMarketOutcomeDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<PredictionMarketOutcomeDto> get serializer => _$PredictionMarketOutcomeDtoSerializer();
}

class _$PredictionMarketOutcomeDtoSerializer implements PrimitiveSerializer<PredictionMarketOutcomeDto> {
  @override
  final Iterable<Type> types = const [PredictionMarketOutcomeDto, _$PredictionMarketOutcomeDto];

  @override
  final String wireName = r'PredictionMarketOutcomeDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    PredictionMarketOutcomeDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'label';
    yield serializers.serialize(
      object.label,
      specifiedType: const FullType(String),
    );
    yield r'probability';
    yield serializers.serialize(
      object.probability,
      specifiedType: const FullType(String),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    PredictionMarketOutcomeDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required PredictionMarketOutcomeDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'label':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.label = valueDes;
          break;
        case r'probability':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.probability = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  PredictionMarketOutcomeDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = PredictionMarketOutcomeDtoBuilder();
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

