import { TradeRecord } from "../tradeTypes";
import { kabucomSchema } from "./kabucomSchema";
import { gmoClickSchema } from "./gmoClickSchema";
import { sbiOtcCfdSchema } from "./sbiOtcCfdSchema";
import { FieldIndexMap, TradeCsvSchema } from "./schemaTypes";

const REGISTERED_SCHEMAS: TradeCsvSchema[] = [kabucomSchema, sbiOtcCfdSchema, gmoClickSchema];

export function mapRowsToRecords(rows: string[][]): TradeRecord[] {
  if (rows.length === 0) {
    return [];
  }
  const [header, ...dataRows] = rows;
  const fieldIndices = buildFieldIndexMap(header);
  const schema = detectCsvSchema(fieldIndices);
  if (!schema) {
    return [];
  }

  return dataRows
    .map((row) => schema.parseRecord(row, fieldIndices))
    .filter((record): record is TradeRecord => record !== null);
}

function buildFieldIndexMap(header: string[]): FieldIndexMap {
  return header.reduce<FieldIndexMap>((acc, field, index) => {
    const normalizedField = normalizeHeaderField(field, index === 0);
    acc[normalizedField] = index;
    return acc;
  }, {});
}

function normalizeHeaderField(field: string, isFirstField: boolean): string {
  const trimmed = isFirstField ? field.replace(/^\ufeff/, "") : field;
  return trimmed.trim();
}

export function detectCsvSchema(fieldIndices: FieldIndexMap): TradeCsvSchema | null {
  return (
    REGISTERED_SCHEMAS.find((schema) =>
      schema.requiredFields.every((field) => field in fieldIndices),
    ) ?? null
  );
}
