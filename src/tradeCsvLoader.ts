import fs from "node:fs/promises";
import path from "node:path";
import { decodeCsvBuffer } from "./csv/decodeCsv";
import { parseCsv } from "./csv/parseCsv";
import { mapRowsToRecords } from "./tradeCsv/schemas";
import { TradeRecord } from "./tradeTypes";

export interface TradeCsvLoader {
  loadRecords(): Promise<TradeRecord[]>;
}

const PROJECT_ROOT = path.resolve(__dirname, "..");
const DEFAULT_CSV_RELATIVE_PATH = ["docs", "dummy_kabucom.csv"];

export interface FileCsvLoaderOptions {
  csvPath?: string;
}

export function createFileCsvLoader(options: FileCsvLoaderOptions = {}): TradeCsvLoader {
  const resolvedPath = resolveCsvPath(options.csvPath);
  return new FileCsvLoader(resolvedPath);
}

export function createDefaultTradeCsvLoader(): TradeCsvLoader {
  return createFileCsvLoader();
}

export function createCsvLoaderFromContent(csvContent: string): TradeCsvLoader {
  return new InlineCsvLoader(csvContent);
}

function ensureWithinProjectRoot(targetPath: string): string {
  const resolved = path.resolve(targetPath);
  const relative = path.relative(PROJECT_ROOT, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("CSVファイルの参照はプロジェクトルート配下のみ許可されています");
  }
  return resolved;
}

function resolveCsvPath(csvPath?: string): string {
  if (csvPath) {
    const trimmed = csvPath.trim();
    if (trimmed.length > 0) {
      const candidate = path.isAbsolute(trimmed)
        ? path.normalize(trimmed)
        : path.resolve(PROJECT_ROOT, trimmed);
      return ensureWithinProjectRoot(candidate);
    }
  }
  return path.resolve(PROJECT_ROOT, ...DEFAULT_CSV_RELATIVE_PATH);
}

class FileCsvLoader implements TradeCsvLoader {
  constructor(private readonly csvPath: string) {}

  async loadRecords(): Promise<TradeRecord[]> {
    const buffer = await fs.readFile(this.csvPath);
    return parseTradeCsv(buffer);
  }
}

class InlineCsvLoader implements TradeCsvLoader {
  constructor(private readonly csvContent: string) {}

  async loadRecords(): Promise<TradeRecord[]> {
    return parseTradeCsv(this.csvContent);
  }
}

function parseTradeCsv(csvContent: string | Buffer): TradeRecord[] {
  const decodedContent =
    typeof csvContent === "string" ? csvContent : decodeCsvBuffer(csvContent);
  const rows = parseCsv(decodedContent);
  return mapRowsToRecords(rows);
}
