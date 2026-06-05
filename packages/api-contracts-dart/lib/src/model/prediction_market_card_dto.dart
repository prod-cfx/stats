//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:backend_api_contracts/src/model/prediction_market_rules_dto.dart';
import 'package:backend_api_contracts/src/model/prediction_market_outcome_dto.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'prediction_market_card_dto.g.dart';

/// PredictionMarketCardDto
///
/// Properties:
/// * [id] - 市场外部 ID（marketId）
/// * [title] - 市场标题，优先使用 question，其次 eventTitle
/// * [options] 
/// * [probability] - 单一概率（某些只有总概率的市场）
/// * [status] - 市场状态，如 LIVE/RESOLVED 等
/// * [volume24h] - 24 小时成交额（字符串）
/// * [volumeTotal] - 总成交额（字符串）
/// * [openInterest] - 未平仓量（字符串）
/// * [rules] 
@BuiltValue()
abstract class PredictionMarketCardDto implements Built<PredictionMarketCardDto, PredictionMarketCardDtoBuilder> {
  /// 市场外部 ID（marketId）
  @BuiltValueField(wireName: r'id')
  String get id;

  /// 市场标题，优先使用 question，其次 eventTitle
  @BuiltValueField(wireName: r'title')
  String get title;

  @BuiltValueField(wireName: r'options')
  BuiltList<PredictionMarketOutcomeDto>? get options;

  /// 单一概率（某些只有总概率的市场）
  @BuiltValueField(wireName: r'probability')
  String? get probability;

  /// 市场状态，如 LIVE/RESOLVED 等
  @BuiltValueField(wireName: r'status')
  String? get status;

  /// 24 小时成交额（字符串）
  @BuiltValueField(wireName: r'volume24h')
  String? get volume24h;

  /// 总成交额（字符串）
  @BuiltValueField(wireName: r'volumeTotal')
  String? get volumeTotal;

  /// 未平仓量（字符串）
  @BuiltValueField(wireName: r'openInterest')
  String? get openInterest;

  @BuiltValueField(wireName: r'rules')
  PredictionMarketRulesDto? get rules;

  PredictionMarketCardDto._();

  factory PredictionMarketCardDto([void updates(PredictionMarketCardDtoBuilder b)]) = _$PredictionMarketCardDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(PredictionMarketCardDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<PredictionMarketCardDto> get serializer => _$PredictionMarketCardDtoSerializer();
}

class _$PredictionMarketCardDtoSerializer implements PrimitiveSerializer<PredictionMarketCardDto> {
  @override
  final Iterable<Type> types = const [PredictionMarketCardDto, _$PredictionMarketCardDto];

  @override
  final String wireName = r'PredictionMarketCardDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    PredictionMarketCardDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'id';
    yield serializers.serialize(
      object.id,
      specifiedType: const FullType(String),
    );
    yield r'title';
    yield serializers.serialize(
      object.title,
      specifiedType: const FullType(String),
    );
    if (object.options != null) {
      yield r'options';
      yield serializers.serialize(
        object.options,
        specifiedType: const FullType(BuiltList, [FullType(PredictionMarketOutcomeDto)]),
      );
    }
    if (object.probability != null) {
      yield r'probability';
      yield serializers.serialize(
        object.probability,
        specifiedType: const FullType(String),
      );
    }
    if (object.status != null) {
      yield r'status';
      yield serializers.serialize(
        object.status,
        specifiedType: const FullType(String),
      );
    }
    if (object.volume24h != null) {
      yield r'volume24h';
      yield serializers.serialize(
        object.volume24h,
        specifiedType: const FullType(String),
      );
    }
    if (object.volumeTotal != null) {
      yield r'volumeTotal';
      yield serializers.serialize(
        object.volumeTotal,
        specifiedType: const FullType(String),
      );
    }
    if (object.openInterest != null) {
      yield r'openInterest';
      yield serializers.serialize(
        object.openInterest,
        specifiedType: const FullType(String),
      );
    }
    if (object.rules != null) {
      yield r'rules';
      yield serializers.serialize(
        object.rules,
        specifiedType: const FullType(PredictionMarketRulesDto),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    PredictionMarketCardDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required PredictionMarketCardDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'id':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.id = valueDes;
          break;
        case r'title':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.title = valueDes;
          break;
        case r'options':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(PredictionMarketOutcomeDto)]),
          ) as BuiltList<PredictionMarketOutcomeDto>;
          result.options.replace(valueDes);
          break;
        case r'probability':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.probability = valueDes;
          break;
        case r'status':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.status = valueDes;
          break;
        case r'volume24h':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.volume24h = valueDes;
          break;
        case r'volumeTotal':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.volumeTotal = valueDes;
          break;
        case r'openInterest':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.openInterest = valueDes;
          break;
        case r'rules':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(PredictionMarketRulesDto),
          ) as PredictionMarketRulesDto;
          result.rules.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  PredictionMarketCardDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = PredictionMarketCardDtoBuilder();
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

