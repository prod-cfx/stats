//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'prediction_market_rules_dto.g.dart';

/// PredictionMarketRulesDto
///
/// Properties:
/// * [paragraphs] - 规则文案段落
/// * [createdAt] - 规则创建或更新时间（ISO 字符串）
@BuiltValue()
abstract class PredictionMarketRulesDto implements Built<PredictionMarketRulesDto, PredictionMarketRulesDtoBuilder> {
  /// 规则文案段落
  @BuiltValueField(wireName: r'paragraphs')
  BuiltList<String> get paragraphs;

  /// 规则创建或更新时间（ISO 字符串）
  @BuiltValueField(wireName: r'createdAt')
  String? get createdAt;

  PredictionMarketRulesDto._();

  factory PredictionMarketRulesDto([void updates(PredictionMarketRulesDtoBuilder b)]) = _$PredictionMarketRulesDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(PredictionMarketRulesDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<PredictionMarketRulesDto> get serializer => _$PredictionMarketRulesDtoSerializer();
}

class _$PredictionMarketRulesDtoSerializer implements PrimitiveSerializer<PredictionMarketRulesDto> {
  @override
  final Iterable<Type> types = const [PredictionMarketRulesDto, _$PredictionMarketRulesDto];

  @override
  final String wireName = r'PredictionMarketRulesDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    PredictionMarketRulesDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'paragraphs';
    yield serializers.serialize(
      object.paragraphs,
      specifiedType: const FullType(BuiltList, [FullType(String)]),
    );
    if (object.createdAt != null) {
      yield r'createdAt';
      yield serializers.serialize(
        object.createdAt,
        specifiedType: const FullType(String),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    PredictionMarketRulesDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required PredictionMarketRulesDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'paragraphs':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(String)]),
          ) as BuiltList<String>;
          result.paragraphs.replace(valueDes);
          break;
        case r'createdAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.createdAt = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  PredictionMarketRulesDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = PredictionMarketRulesDtoBuilder();
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

