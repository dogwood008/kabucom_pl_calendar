import { TradeCsvSchema } from "./schemaTypes";
import {
  parseDateTimeWithSeconds,
  parseCurrency,
  parseDecimal,
} from "./parsers";
import { readField, readTrimmedField } from "./schemaUtils";

const REQUIRED_FIELDS = [
  "約定日時",
  "取引区分",
  "売買区分",
  "約定数量",
  "約定単価",
  "銘柄名",
  "実現損益（円貨）",
];

export const gmoClickSchema: TradeCsvSchema = {
  id: "gmoClick",
  requiredFields: REQUIRED_FIELDS,
  parseRecord: (row, fieldIndices) => {
    const dateTime = parseDateTimeWithSeconds(readField(row, fieldIndices, "約定日時"));
    if (!dateTime) {
      return null;
    }

    const realizedProfit = parseCurrency(readField(row, fieldIndices, "実現損益（円貨）"));
    const realizedProfitConvertedRaw = readField(row, fieldIndices, "実現損益（円換算額）");
    const realizedProfitConverted = parseCurrency(realizedProfitConvertedRaw);
    const hasConvertedProfit =
      realizedProfitConvertedRaw !== undefined && realizedProfitConvertedRaw.trim() !== "";
    const grossProfit = hasConvertedProfit ? realizedProfitConverted : realizedProfit;

    const fee =
      parseCurrency(readField(row, fieldIndices, "手数料")) +
      parseCurrency(readField(row, fieldIndices, "手数料消費税")) +
      parseCurrency(readField(row, fieldIndices, "新規手数料")) +
      parseCurrency(readField(row, fieldIndices, "新規手数料消費税"));
    const netProfit = grossProfit - fee;

    return {
      isoDate: dateTime.isoDate,
      isoTime: dateTime.isoTime,
      isoDateTime: dateTime.isoDateTime,
      symbol: readTrimmedField(row, fieldIndices, "銘柄名"),
      contractMonth: readTrimmedField(row, fieldIndices, "限月"),
      side: readTrimmedField(row, fieldIndices, "売買区分"),
      action: readTrimmedField(row, fieldIndices, "取引区分"),
      quantity: parseDecimal(readField(row, fieldIndices, "約定数量")),
      price: parseDecimal(readField(row, fieldIndices, "約定単価")),
      fee,
      grossProfit,
      netProfit,
    };
  },
};
