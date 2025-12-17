import { TradeCsvSchema } from "./schemaTypes";
import {
  parseDateTimeWithSeconds,
  parseCurrency,
  parseDecimal,
} from "./parsers";
import { readField, readTrimmedField } from "./schemaUtils";

const REQUIRED_FIELDS = ["約定日時", "売/買", "数量", "建玉損益(円)"];

export const sbiOtcCfdSchema: TradeCsvSchema = {
  id: "sbiOtcCfd",
  requiredFields: REQUIRED_FIELDS,
  parseRecord: (row, fieldIndices) => {
    const dateTimeParts = parseDateTimeWithSeconds(readField(row, fieldIndices, "約定日時"));
    if (!dateTimeParts) {
      return null;
    }

    const grossProfit = parseCurrency(readField(row, fieldIndices, "建玉損益(円)"));
    const interest = parseCurrency(readField(row, fieldIndices, "金利調整額合計(円)"));
    const priceAdjustment = parseCurrency(readField(row, fieldIndices, "価格調整額合計(円)"));
    const funding = parseCurrency(readField(row, fieldIndices, "ファンディングレート合計(円)"));
    const settlementAmount = parseCurrency(readField(row, fieldIndices, "受渡金額(円)"));

    const netProfitFromComponents = grossProfit + interest + priceAdjustment + funding;
    const netProfit =
      settlementAmount !== 0 ? settlementAmount : netProfitFromComponents;

    return {
      isoDate: dateTimeParts.isoDate,
      isoTime: dateTimeParts.isoTime,
      isoDateTime: dateTimeParts.isoDateTime,
      symbol: readTrimmedField(row, fieldIndices, "銘柄"),
      contractMonth: "",
      side: readTrimmedField(row, fieldIndices, "売/買"),
      action: readTrimmedField(row, fieldIndices, "取引区分"),
      quantity: parseDecimal(readField(row, fieldIndices, "数量")),
      price: parseDecimal(readField(row, fieldIndices, "約定価格")),
      fee: 0,
      grossProfit,
      netProfit,
    };
  },
};
