import { TradeCsvSchema } from "./schemaTypes";
import {
  padTimePart,
  parseCurrency,
  parseDecimal,
  safeInteger,
  toIsoDate,
} from "./parsers";

const REQUIRED_FIELDS = ["約定日時", "売/買", "数量", "建玉損益(円)"];

export const sbiOtcCfdSchema: TradeCsvSchema = {
  id: "sbiOtcCfd",
  requiredFields: REQUIRED_FIELDS,
  parseRecord: (row, fieldIndices) => {
    const dateTimeParts = parseSbiDateTime(row[fieldIndices["約定日時"]] ?? "");
    if (!dateTimeParts) {
      return null;
    }

    const grossProfit = parseCurrency(row[fieldIndices["建玉損益(円)"]] ?? "");
    const interest = parseCurrency(row[fieldIndices["金利調整額合計(円)"]] ?? "");
    const priceAdjustment = parseCurrency(row[fieldIndices["価格調整額合計(円)"]] ?? "");
    const funding = parseCurrency(row[fieldIndices["ファンディングレート合計(円)"]] ?? "");
    const settlementAmount = parseCurrency(row[fieldIndices["受渡金額(円)"]] ?? "");

    const netProfitFromComponents = grossProfit + interest + priceAdjustment + funding;
    const netProfit =
      settlementAmount !== 0 ? settlementAmount : netProfitFromComponents;

    return {
      isoDate: dateTimeParts.isoDate,
      isoTime: dateTimeParts.isoTime,
      isoDateTime: dateTimeParts.isoDateTime,
      symbol: (row[fieldIndices["銘柄"]] ?? "").trim(),
      contractMonth: "",
      side: (row[fieldIndices["売/買"]] ?? "").trim(),
      action: (row[fieldIndices["取引区分"]] ?? "").trim(),
      quantity: parseDecimal(row[fieldIndices["数量"]] ?? ""),
      price: parseDecimal(row[fieldIndices["約定価格"]] ?? ""),
      fee: 0,
      grossProfit,
      netProfit,
    };
  },
};

function parseSbiDateTime(value: string | undefined): {
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
