import express from "express";
import path from "node:path";
import { createYearCalendar, parseYear } from "./calendar";
import { getTradeDataForYear, TradeDataQueryOptions } from "./trades";

const parsedPort = Number.parseInt(process.env.PORT ?? "3000", 10);
const DEFAULT_PORT =
  Number.isNaN(parsedPort) || parsedPort < 1 || parsedPort > 65535 ? 3000 : parsedPort;
const HOST = process.env.HOST ?? "localhost";
const APP_TITLE = "年間カレンダー";

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

function resolvePublicDirectory(): string {
  return path.resolve(__dirname, "..", "public");
}

let openModulePromise: Promise<typeof import("open")> | null = null;

async function loadOpenModule() {
  if (!openModulePromise) {
    openModulePromise = import("open");
  }

  return openModulePromise;
}

async function launchBrowser(url: string): Promise<void> {
  if (process.env.CI === "true" || process.env.DISABLE_BROWSER === "true") {
    return;
  }

  try {
    const openModule = await loadOpenModule();
    await openModule.default(url);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`ブラウザの自動起動に失敗しました: ${message}`);
  }
}

async function buildCalendarPayload(year: number, options?: TradeDataQueryOptions) {
  const calendar = createYearCalendar(year);
  const { summaries, tradesByDate } = await getTradeDataForYear(year, options);
  return {
    ...calendar,
    tradeSummaries: summaries,
    dailyTrades: tradesByDate,
  };
}

function handleCalendarError(res: express.Response, error: unknown) {
  const message = error instanceof Error ? error.message : "カレンダー生成中にエラーが発生しました";
  res.status(400).json({ error: message });
}

function createServer() {
  const app = express();
  const publicDirectory = resolvePublicDirectory();

  app.use(express.json({ limit: "5mb" }));
  app.use(express.static(publicDirectory));

  app.get("/api/calendar", async (req, res) => {
    const now = new Date();
    let year: number;
    let csvPath: string | undefined;

    try {
      const { year: yearQuery, csvPath: csvPathQuery } = req.query;

      if (Array.isArray(yearQuery)) {
        throw new Error("year パラメータは1つだけ指定してください");
      }

      if (typeof yearQuery === "object" && yearQuery !== null) {
        throw new Error("year パラメータの形式が不正です");
      }

      const yearParam = typeof yearQuery === "string" ? yearQuery : undefined;
      year = parseYear(yearParam, now.getFullYear());

      if (Array.isArray(csvPathQuery)) {
        throw new Error("csvPath パラメータは1つだけ指定してください");
      }

      if (typeof csvPathQuery === "object" && csvPathQuery !== null) {
        throw new Error("csvPath パラメータの形式が不正です");
      }

      const csvCandidate = typeof csvPathQuery === "string" ? csvPathQuery.trim() : "";
      csvPath = csvCandidate.length > 0 ? csvCandidate : undefined;
    } catch (error) {
      const message = error instanceof Error ? error.message : "不正なリクエストです";
      res.status(400).json({ error: message });
      return;
    }

    try {
      const tradeDataOptions = csvPath ? { csvPath } : undefined;
      const payload = await buildCalendarPayload(year, tradeDataOptions);
      res.json(payload);
    } catch (error) {
      handleCalendarError(res, error);
    }
  });

  async function parseUploadRequest(
    req: express.Request,
  ): Promise<{ year: number; options: TradeDataQueryOptions }> {
    const now = new Date();
    let year: number;
    let csvContent: string | undefined;
    let csvPath: string | undefined;

    const { year: yearBody, csvContent: content, csvPath: pathBody } = req.body ?? {};
    const yearParam =
      typeof yearBody === "number"
        ? String(yearBody)
        : typeof yearBody === "string"
          ? yearBody
          : undefined;
    try {
      year = parseYear(yearParam, now.getFullYear());
    } catch (error) {
      const message = error instanceof Error ? error.message : "不正なリクエストです";
      throw new ValidationError(message);
    }

    if (typeof content === "string") {
      const trimmed = content.trim();
      if (trimmed.length === 0) {
        throw new ValidationError("csvContent は空ではいけません");
      }
      csvContent = content;
    } else if (typeof pathBody === "string" && pathBody.trim().length > 0) {
      csvPath = pathBody.trim();
    } else {
      throw new ValidationError("csvContent もしくは csvPath を指定してください");
    }

    return {
      year,
      options: csvContent ? { csvContent } : { csvPath: csvPath as string },
    };
  }

  async function handleUpload(req: express.Request, res: express.Response) {
    try {
      const { year, options } = await parseUploadRequest(req);
      const payload = await buildCalendarPayload(year, options);
      res.json(payload);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
        return;
      }
      handleCalendarError(res, error);
    }
  }

  app.post("/api/calendar/upload", handleUpload);
  app.post("/api/calendar", handleUpload);

  app.get(/.*/, (_, res) => {
    res.sendFile(path.join(publicDirectory, "index.html"));
  });

  return app;
}

async function start() {
  const app = createServer();
  const server = app.listen(DEFAULT_PORT, HOST, () => {
    const addressInfo = server.address();
    if (addressInfo && typeof addressInfo === "object") {
      const url = `http://${HOST}:${addressInfo.port}`;
      console.log(`${APP_TITLE} サーバーを起動しました: ${url}`);
      void launchBrowser(url);
    } else {
      const address = addressInfo ?? "不明";
      console.log(`${APP_TITLE} サーバーを起動しました: ${address}`);
    }
  });

  server.on("error", (error: unknown) => {
    console.error("Server failed to start:", error);
    process.exit(1);
  });
}

void start();
