import { TradeCsvSchema } from "./schemaTypes";
import {
  normalizeTimeString,
  parseCurrency,
  parseDecimal,
  parseInteger,
  toIsoDate,
} from "./parsers";
import { readField, readTrimmedField } from "./schemaUtils";

const REQUIRED_FIELDS = ["成立日", "売買", "取引数量（枚）", "確定損益"];

export const kabucomSchema: TradeCsvSchema = {
  id: "kabucom",
  requiredFields: REQUIRED_FIELDS,
  parseRecord: (row, fieldIndices) => {
    const date = toIsoDate(readField(row, fieldIndices, "成立日"));
    if (!date) {
      return null;
    }

    const isoTime = normalizeTimeString(readField(row, fieldIndices, "成立時間"));
    const symbol = readTrimmedField(row, fieldIndices, "銘柄");
    const contractMonth = readTrimmedField(row, fieldIndices, "限月");
    const side = readTrimmedField(row, fieldIndices, "売買");
    const action = readTrimmedField(row, fieldIndices, "取引");

    return {
      isoDate: date,
      isoTime,
      isoDateTime: `${date}T${isoTime}:00`,
      symbol,
      contractMonth,
      side,
      action,
      quantity: parseInteger(readField(row, fieldIndices, "取引数量（枚）")),
      price: parseDecimal(readField(row, fieldIndices, "成立値段")),
      fee: parseCurrency(readField(row, fieldIndices, "手数料")),
      grossProfit: parseCurrency(readField(row, fieldIndices, "売買損益")),
      netProfit: parseCurrency(readField(row, fieldIndices, "確定損益")),
    };
  },
};
