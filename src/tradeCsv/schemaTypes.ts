import { TradeRecord } from "../tradeTypes";

export type FieldIndexMap = Record<string, number>;

export interface TradeCsvSchema {
  id: "kabucom" | "sbiOtcCfd" | "gmoClick";
  requiredFields: string[];
  parseRecord(row: string[], fieldIndices: FieldIndexMap): TradeRecord | null;
}
