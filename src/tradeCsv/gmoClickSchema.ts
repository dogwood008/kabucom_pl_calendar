import { TradeCsvSchema } from "./schemaTypes";
import {
  padTimePart,
  parseCurrency,
  parseDecimal,
  safeInteger,
  toIsoDate,
} from "./parsers";

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
    const dateTime = parseGmoDateTime(getField(row, fieldIndices, "約定日時"));
    if (!dateTime) {
      return null;
    }

    const realizedProfit = parseCurrency(getField(row, fieldIndices, "実現損益（円貨）"));
    const realizedProfitConverted = parseCurrency(
      getField(row, fieldIndices, "実現損益（円換算額）"),
    );
    const netProfit =
      realizedProfitConverted !== 0 ? realizedProfitConverted : realizedProfit;

    const fee =
      parseCurrency(getField(row, fieldIndices, "手数料")) +
      parseCurrency(getField(row, fieldIndices, "手数料消費税")) +
      parseCurrency(getField(row, fieldIndices, "新規手数料")) +
      parseCurrency(getField(row, fieldIndices, "新規手数料消費税"));

    return {
      isoDate: dateTime.isoDate,
      isoTime: dateTime.isoTime,
      isoDateTime: dateTime.isoDateTime,
      symbol: (getField(row, fieldIndices, "銘柄名") ?? "").trim(),
      contractMonth: (getField(row, fieldIndices, "限月") ?? "").trim(),
      side: (getField(row, fieldIndices, "売買区分") ?? "").trim(),
      action: (getField(row, fieldIndices, "取引区分") ?? "").trim(),
      quantity: parseDecimal(getField(row, fieldIndices, "約定数量")),
      price: parseDecimal(getField(row, fieldIndices, "約定単価")),
      fee,
      grossProfit: realizedProfit,
      netProfit,
    };
  },
};

function getField(row: string[], fieldIndices: Record<string, number>, field: string) {
  const index = fieldIndices[field];
  return typeof index === "number" ? row[index] : undefined;
}

function parseGmoDateTime(value: string | undefined): {
  isoDate: string;
  isoTime: string;
  isoDateTime: string;
} | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const [datePart, timePartRaw] = trimmed.split(/\s+/);
  const isoDate = toIsoDate(datePart);
  if (!isoDate) {
    return null;
  }

  if (!timePartRaw) {
    return {
      isoDate,
      isoTime: "00:00",
      isoDateTime: `${isoDate}T00:00:00`,
    };
  }

  const [hourRaw, minuteRaw = "00", secondRaw = "00"] = timePartRaw.split(":");
  const hour = safeInteger(hourRaw);
  const minute = safeInteger(minuteRaw);
  const second = safeInteger(secondRaw);

  const hh = padTimePart(hour);
  const mm = padTimePart(minute);
  const ss = padTimePart(second);

  return {
    isoDate,
    isoTime: `${hh}:${mm}`,
    isoDateTime: `${isoDate}T${hh}:${mm}:${ss}`,
  };
}
