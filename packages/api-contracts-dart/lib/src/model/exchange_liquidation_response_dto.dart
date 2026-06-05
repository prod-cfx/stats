//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:backend_api_contracts/src/model/exchange_liquidation_row_dto.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'exchange_liquidation_response_dto.g.dart';

/// ExchangeLiquidationResponseDto
///
/// Properties:
/// * [symbol] - 币种基础资产，例如 BTC / ETH
/// * [timeframe] - 时间区间（粒度），与 Coinglass interval 对齐，例如 1h/4h/12h/24h
/// * [rows] - 按交易所拆分的爆仓数据，第一条通常为 TOTAL 汇总行
@BuiltValue()
abstract class ExchangeLiquidationResponseDto implements Built<ExchangeLiquidationResponseDto, ExchangeLiquidationResponseDtoBuilder> {
  /// 币种基础资产，例如 BTC / ETH
  @BuiltValueField(wireName: r'symbol')
  String get symbol;

  /// 时间区间（粒度），与 Coinglass interval 对齐，例如 1h/4h/12h/24h
  @BuiltValueField(wireName: r'timeframe')
  ExchangeLiquidationResponseDtoTimeframeEnum get timeframe;
  // enum timeframeEnum {  1h,  4h,  12h,  24h,  };

  /// 按交易所拆分的爆仓数据，第一条通常为 TOTAL 汇总行
  @BuiltValueField(wireName: r'rows')
  BuiltList<ExchangeLiquidationRowDto> get rows;

  ExchangeLiquidationResponseDto._();

  factory ExchangeLiquidationResponseDto([void updates(ExchangeLiquidationResponseDtoBuilder b)]) = _$ExchangeLiquidationResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(ExchangeLiquidationResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<ExchangeLiquidationResponseDto> get serializer => _$ExchangeLiquidationResponseDtoSerializer();
}

class _$ExchangeLiquidationResponseDtoSerializer implements PrimitiveSerializer<ExchangeLiquidationResponseDto> {
  @override
  final Iterable<Type> types = const [ExchangeLiquidationResponseDto, _$ExchangeLiquidationResponseDto];

  @override
  final String wireName = r'ExchangeLiquidationResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    ExchangeLiquidationResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'symbol';
    yield serializers.serialize(
      object.symbol,
      specifiedType: const FullType(String),
    );
    yield r'timeframe';
    yield serializers.serialize(
      object.timeframe,
      specifiedType: const FullType(ExchangeLiquidationResponseDtoTimeframeEnum),
    );
    yield r'rows';
    yield serializers.serialize(
      object.rows,
      specifiedType: const FullType(BuiltList, [FullType(ExchangeLiquidationRowDto)]),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    ExchangeLiquidationResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required ExchangeLiquidationResponseDtoBuilder result,
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
        case r'timeframe':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(ExchangeLiquidationResponseDtoTimeframeEnum),
          ) as ExchangeLiquidationResponseDtoTimeframeEnum;
          result.timeframe = valueDes;
          break;
        case r'rows':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(ExchangeLiquidationRowDto)]),
          ) as BuiltList<ExchangeLiquidationRowDto>;
          result.rows.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  ExchangeLiquidationResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = ExchangeLiquidationResponseDtoBuilder();
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

class ExchangeLiquidationResponseDtoTimeframeEnum extends EnumClass {

  /// 时间区间（粒度），与 Coinglass interval 对齐，例如 1h/4h/12h/24h
  @BuiltValueEnumConst(wireName: r'1h')
  static const ExchangeLiquidationResponseDtoTimeframeEnum n1h = _$exchangeLiquidationResponseDtoTimeframeEnum_n1h;
  /// 时间区间（粒度），与 Coinglass interval 对齐，例如 1h/4h/12h/24h
  @BuiltValueEnumConst(wireName: r'4h')
  static const ExchangeLiquidationResponseDtoTimeframeEnum n4h = _$exchangeLiquidationResponseDtoTimeframeEnum_n4h;
  /// 时间区间（粒度），与 Coinglass interval 对齐，例如 1h/4h/12h/24h
  @BuiltValueEnumConst(wireName: r'12h')
  static const ExchangeLiquidationResponseDtoTimeframeEnum n12h = _$exchangeLiquidationResponseDtoTimeframeEnum_n12h;
  /// 时间区间（粒度），与 Coinglass interval 对齐，例如 1h/4h/12h/24h
  @BuiltValueEnumConst(wireName: r'24h')
  static const ExchangeLiquidationResponseDtoTimeframeEnum n24h = _$exchangeLiquidationResponseDtoTimeframeEnum_n24h;

  static Serializer<ExchangeLiquidationResponseDtoTimeframeEnum> get serializer => _$exchangeLiquidationResponseDtoTimeframeEnumSerializer;

  const ExchangeLiquidationResponseDtoTimeframeEnum._(String name): super(name);

  static BuiltSet<ExchangeLiquidationResponseDtoTimeframeEnum> get values => _$exchangeLiquidationResponseDtoTimeframeEnumValues;
  static ExchangeLiquidationResponseDtoTimeframeEnum valueOf(String name) => _$exchangeLiquidationResponseDtoTimeframeEnumValueOf(name);
}

