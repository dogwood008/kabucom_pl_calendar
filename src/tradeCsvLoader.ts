import { decodeCsvArrayBuffer } from "./csv/decodeCsv";
import { parseCsv } from "./csv/parseCsv";
import { mapRowsToRecords } from "./tradeCsv/schemas";
import { TradeRecord } from "./tradeTypes";

export interface TradeCsvLoader {
  loadRecords(): Promise<TradeRecord[]>;
}

const DEFAULT_CSV_PATH = "data/dummy_kabucom.csv";

export interface FileCsvLoaderOptions {
  csvPath?: string;
}

export function createFileCsvLoader(options: FileCsvLoaderOptions = {}): TradeCsvLoader {
  const resolvedPath = resolveCsvPath(options.csvPath);
  return new FetchCsvLoader(resolvedPath);
}

export function createDefaultTradeCsvLoader(): TradeCsvLoader {
  return createFileCsvLoader();
}

export function createCsvLoaderFromContent(csvContent: string): TradeCsvLoader {
  return new InlineCsvLoader(csvContent);
}

function resolveCsvPath(csvPath?: string): string {
  if (csvPath) {
    const trimmed = csvPath.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return DEFAULT_CSV_PATH;
}

class InlineCsvLoader implements TradeCsvLoader {
  constructor(private readonly csvContent: string) {}

  async loadRecords(): Promise<TradeRecord[]> {
    return parseTradeCsv(this.csvContent);
  }
}

class FetchCsvLoader implements TradeCsvLoader {
  constructor(private readonly csvPath: string) {}

  async loadRecords(): Promise<TradeRecord[]> {
    const baseUrl = new URL(import.meta.env.BASE_URL ?? "./", window.location.href);
    const url = new URL(this.csvPath, baseUrl).toString();
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`CSVの取得に失敗しました (${response.status}) - URL: ${url}`);
    }
    const buffer = await response.arrayBuffer();
    return parseTradeCsv(buffer);
  }
}

function parseTradeCsv(csvContent: string | ArrayBuffer): TradeRecord[] {
  const decodedContent =
    typeof csvContent === "string" ? csvContent : decodeCsvArrayBuffer(csvContent);
  const rows = parseCsv(decodedContent);
  return mapRowsToRecords(rows);
}
