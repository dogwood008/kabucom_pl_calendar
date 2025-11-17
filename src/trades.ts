import {
  createCsvLoaderFromContent,
  createDefaultTradeCsvLoader,
  createFileCsvLoader,
  TradeCsvLoader,
} from "./tradeCsvLoader";
import { DailyTradeSummary, TradeDataForYear, TradeDetail, TradeRecord } from "./tradeTypes";

const DEFAULT_CACHE_KEY = "__DEFAULT__";
const recordCache = new Map<string, TradeRecord[]>();
const cacheErrorKeys = new Set<string>();
let customLoader: TradeCsvLoader | null = null;

export interface TradeDataQueryOptions {
  csvPath?: string;
  csvContent?: string;
}

export function setTradeCsvLoader(loader: TradeCsvLoader | null): void {
  customLoader = loader;
  recordCache.clear();
  cacheErrorKeys.clear();
}

function getCacheKey(options?: TradeDataQueryOptions): string | null {
  if (options?.csvContent) {
    return null;
  }
  const csvPath = options?.csvPath?.trim();
  if (csvPath && csvPath.length > 0) {
    return `path:${csvPath}`;
  }
  return DEFAULT_CACHE_KEY;
}

function getActiveLoader(): TradeCsvLoader {
  if (customLoader) {
    return customLoader;
  }
  customLoader = createDefaultTradeCsvLoader();
  return customLoader;
}

function getLoader(options?: TradeDataQueryOptions): TradeCsvLoader {
  if (options?.csvContent) {
    return createCsvLoaderFromContent(options.csvContent);
  }
  if (options?.csvPath && options.csvPath.trim().length > 0) {
    return createFileCsvLoader({ csvPath: options.csvPath });
  }
  return getActiveLoader();
}

async function loadTradeRecords(options?: TradeDataQueryOptions): Promise<TradeRecord[]> {
  const cacheKey = getCacheKey(options);
  if (cacheKey && recordCache.has(cacheKey)) {
    return recordCache.get(cacheKey) ?? [];
  }
  const loader = getLoader(options);
  try {
    const records = await loader.loadRecords();
    if (cacheKey) {
      recordCache.set(cacheKey, records);
    }
    return records;
  } catch (error) {
    if (cacheKey && !cacheErrorKeys.has(cacheKey)) {
      cacheErrorKeys.add(cacheKey);
      const message = error instanceof Error ? error.message : String(error);
      const loaderLabel = Object.getPrototypeOf(loader)?.constructor?.name ?? "TradeCsvLoader";
      console.warn(`取引CSVの読み込みに失敗しました (${loaderLabel}): ${message}`);
    }
    if (cacheKey) {
      recordCache.set(cacheKey, []);
    }
    return [];
  }
}

function sortTrades(trades: TradeDetail[]): TradeDetail[] {
  return trades
    .slice()
    .sort((a, b) => (a.isoDateTime < b.isoDateTime ? -1 : a.isoDateTime > b.isoDateTime ? 1 : 0));
}

export async function getTradeDataForYear(
  year: number,
  options?: TradeDataQueryOptions,
): Promise<TradeDataForYear> {
  const records = await loadTradeRecords(options);
  return aggregateTradeDataForYear(records, year);
}

export async function getDailyTradeSummariesForYear(
  year: number,
  options?: TradeDataQueryOptions,
): Promise<Record<string, DailyTradeSummary>> {
  const { summaries } = await getTradeDataForYear(year, options);
  return summaries;
}

function aggregateTradeDataForYear(records: TradeRecord[], year: number): TradeDataForYear {
  const yearPrefix = `${year}-`;
  const summaries = new Map<string, DailyTradeSummary>();
  const tradesByDate = new Map<string, TradeDetail[]>();

  records.forEach((record) => {
    if (!record.isoDate.startsWith(yearPrefix)) {
      return;
    }
    updateDailySummary(summaries, record);
    appendTrade(tradesByDate, record);
  });

  return {
    summaries: Object.fromEntries(summaries),
    tradesByDate: buildSortedTradesIndex(tradesByDate),
  };
}

function updateDailySummary(
  summaries: Map<string, DailyTradeSummary>,
  record: TradeRecord,
): void {
  const summary = summaries.get(record.isoDate) ?? createEmptySummary(record.isoDate);
  summary.tradeCount += 1;
  summary.totalQuantity += record.quantity;
  if (record.side === "買") {
    summary.buyCount += 1;
  } else if (record.side === "売") {
    summary.sellCount += 1;
  }
  summary.netProfit += record.netProfit;
  summaries.set(record.isoDate, summary);
}

function createEmptySummary(isoDate: string): DailyTradeSummary {
  return {
    isoDate,
    tradeCount: 0,
    buyCount: 0,
    sellCount: 0,
    totalQuantity: 0,
    netProfit: 0,
  };
}

function appendTrade(
  tradesByDate: Map<string, TradeDetail[]>,
  record: TradeDetail,
): void {
  const existingTrades = tradesByDate.get(record.isoDate) ?? [];
  existingTrades.push(record);
  tradesByDate.set(record.isoDate, existingTrades);
}

function buildSortedTradesIndex(
  tradesByDate: Map<string, TradeDetail[]>,
): Record<string, TradeDetail[]> {
  return Array.from(tradesByDate.entries()).reduce<Record<string, TradeDetail[]>>(
    (acc, [isoDate, trades]) => {
      acc[isoDate] = sortTrades(trades);
      return acc;
    },
    {},
  );
}
