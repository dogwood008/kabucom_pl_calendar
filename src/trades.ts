import fs from "node:fs/promises";
import path from "node:path";

export interface DailyTradeSummary {
  isoDate: string;
  tradeCount: number;
  buyCount: number;
  sellCount: number;
  totalQuantity: number;
  netProfit: number;
}

export interface TradeDetail {
  isoDate: string;
  isoTime: string;
  isoDateTime: string;
  symbol: string;
  contractMonth: string;
  side: string;
  action: string;
  quantity: number;
  price: number;
  fee: number;
  grossProfit: number;
  netProfit: number;
}

type TradeRecord = TradeDetail;

export interface TradeDataForYear {
  summaries: Record<string, DailyTradeSummary>;
  tradesByDate: Record<string, TradeDetail[]>;
}

const CSV_RELATIVE_PATH = ["..", "docs", "dummy.csv"];
let cachedRecords: TradeRecord[] | null = null;
let cacheErrorLogged = false;

function resolveCsvPath(): string {
  return path.resolve(__dirname, ...CSV_RELATIVE_PATH);
}

function parseCurrency(value: string | undefined): number {
  if (!value) {
    return 0;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed === "-" || trimmed === "−") {
    return 0;
  }

  let sign = 1;
  let index = 0;
  const firstChar = trimmed[0] ?? "";
  if (firstChar === "+" || firstChar === "-" || firstChar === "−") {
    sign = firstChar === "+" ? 1 : -1;
    index = 1;
  }

  const digits = trimmed
    .slice(index)
    .replace(/,/g, "")
    .replace(/円/g, "")
    .trim();

  const parsed = Number.parseFloat(digits);
  return Number.isNaN(parsed) ? 0 : parsed * sign;
}

function parseInteger(value: string | undefined): number {
  if (!value) {
    return 0;
  }
  const parsed = Number.parseInt(value.trim().replace(/,/g, ""), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function parseDecimal(value: string | undefined): number {
  if (!value) {
    return 0;
  }
  const normalized = value.trim().replace(/,/g, "");
  const parsed = Number.parseFloat(normalized);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizeTimeString(value: string | undefined): string {
  if (!value) {
    return "00:00";
  }
  const [hourRaw, minuteRaw = "00"] = value.split(":");
  const hour = Number.parseInt(hourRaw ?? "0", 10);
  const minute = Number.parseInt(minuteRaw ?? "0", 10);
  const safeHour = Number.isNaN(hour) ? 0 : hour;
  const safeMinute = Number.isNaN(minute) ? 0 : minute;
  return `${safeHour.toString().padStart(2, "0")}:${safeMinute.toString().padStart(2, "0")}`;
}

function toIsoDate(dateString: string | undefined): string | null {
  if (!dateString) {
    return null;
  }
  const [year, month, day] = dateString.split("/");
  if (!year || !month || !day) {
    return null;
  }
  const yyyy = year.padStart(4, "0");
  const mm = month.padStart(2, "0");
  const dd = day.padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i]!;
    const nextChar = content[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentField);
      currentField = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i += 1;
      }
      currentRow.push(currentField);
      if (currentRow.some((field) => field.trim().length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = "";
      continue;
    }

    currentField += char;
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

function mapRowsToRecords(rows: string[][]): TradeRecord[] {
  if (rows.length === 0) {
    return [];
  }
  const [header, ...dataRows] = rows;
  const fieldIndices = header.reduce<Record<string, number>>((acc, field, index) => {
    acc[field.trim()] = index;
    return acc;
  }, {});

  const requiredFields = ["成立日", "売買", "取引数量（枚）", "確定損益"];
  const hasRequiredFields = requiredFields.every((field) => field in fieldIndices);
  if (!hasRequiredFields) {
    return [];
  }

  return dataRows
    .map((row) => {
      const date = toIsoDate(row[fieldIndices["成立日"]] ?? "");
      if (!date) {
        return null;
      }

      const isoTime = normalizeTimeString(row[fieldIndices["成立時間"]] ?? "");
      const symbol = (row[fieldIndices["銘柄"]] ?? "").trim();
      const contractMonth = (row[fieldIndices["限月"]] ?? "").trim();
      const side = (row[fieldIndices["売買"]] ?? "").trim();
      const action = (row[fieldIndices["取引"]] ?? "").trim();

      return {
        isoDate: date,
        isoTime,
        isoDateTime: `${date}T${isoTime}:00`,
        symbol,
        contractMonth,
        side,
        action,
        quantity: parseInteger(row[fieldIndices["取引数量（枚）"]] ?? ""),
        price: parseDecimal(row[fieldIndices["成立値段"]] ?? ""),
        fee: parseCurrency(row[fieldIndices["手数料"]] ?? ""),
        grossProfit: parseCurrency(row[fieldIndices["売買損益"]] ?? ""),
        netProfit: parseCurrency(row[fieldIndices["確定損益"]] ?? ""),
      };
    })
    .filter((record): record is TradeRecord => record !== null);
}

async function loadTradeRecords(): Promise<TradeRecord[]> {
  if (cachedRecords) {
    return cachedRecords;
  }
  const csvPath = resolveCsvPath();
  try {
    const content = await fs.readFile(csvPath, "utf-8");
    const rows = parseCsv(content);
    cachedRecords = mapRowsToRecords(rows);
  } catch (error) {
    if (!cacheErrorLogged) {
      cacheErrorLogged = true;
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`取引CSVの読み込みに失敗しました (${csvPath}): ${message}`);
    }
    cachedRecords = [];
  }

  return cachedRecords;
}

function sortTrades(trades: TradeDetail[]): TradeDetail[] {
  return trades
    .slice()
    .sort((a, b) => (a.isoDateTime < b.isoDateTime ? -1 : a.isoDateTime > b.isoDateTime ? 1 : 0));
}

export async function getTradeDataForYear(year: number): Promise<TradeDataForYear> {
  const records = await loadTradeRecords();
  const summaries = new Map<string, DailyTradeSummary>();
  const tradesByDate = new Map<string, TradeDetail[]>();

  records.forEach((record) => {
    if (!record.isoDate.startsWith(`${year}-`)) {
      return;
    }
    const existing = summaries.get(record.isoDate);
    const base: DailyTradeSummary =
      existing ?? {
        isoDate: record.isoDate,
        tradeCount: 0,
        buyCount: 0,
        sellCount: 0,
        totalQuantity: 0,
        netProfit: 0,
      };
    base.tradeCount += 1;
    base.totalQuantity += record.quantity;
    if (record.side === "買") {
      base.buyCount += 1;
    } else if (record.side === "売") {
      base.sellCount += 1;
    }
    base.netProfit += record.netProfit;
    summaries.set(record.isoDate, base);

    const existingTrades = tradesByDate.get(record.isoDate) ?? [];
    existingTrades.push(record);
    tradesByDate.set(record.isoDate, existingTrades);
  });

  const sortedTradesByDate = Array.from(tradesByDate.entries()).reduce<
    Record<string, TradeDetail[]>
  >((acc, [isoDate, trades]) => {
    acc[isoDate] = sortTrades(trades);
    return acc;
  }, {});

  return {
    summaries: Object.fromEntries(summaries),
    tradesByDate: sortedTradesByDate,
  };
}

export async function getDailyTradeSummariesForYear(
  year: number,
): Promise<Record<string, DailyTradeSummary>> {
  const { summaries } = await getTradeDataForYear(year);
  return summaries;
}
