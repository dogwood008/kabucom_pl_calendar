import express from "express";
import path from "node:path";
import { createYearCalendar, parseYear } from "./calendar";

const parsedPort = Number.parseInt(process.env.PORT ?? "3000", 10);
const DEFAULT_PORT =
  Number.isNaN(parsedPort) || parsedPort < 1 || parsedPort > 65535 ? 3000 : parsedPort;
const HOST = process.env.HOST ?? "localhost";
const APP_TITLE = "年間カレンダー";

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

function createServer() {
  const app = express();
  const publicDirectory = resolvePublicDirectory();

  app.use(express.static(publicDirectory));

  app.get("/api/calendar", (req, res) => {
    const now = new Date();
    let year: number;

    try {
      const { year: yearQuery } = req.query;

      if (Array.isArray(yearQuery)) {
        throw new Error("year パラメータは1つだけ指定してください");
      }

      if (typeof yearQuery === "object" && yearQuery !== null) {
        throw new Error("year パラメータの形式が不正です");
      }

      const yearParam = typeof yearQuery === "string" ? yearQuery : undefined;
      year = parseYear(yearParam, now.getFullYear());
    } catch (error) {
      const message = error instanceof Error ? error.message : "不正なリクエストです";
      res.status(400).json({ error: message });
      return;
    }

    try {
      const calendar = createYearCalendar(year);
      res.json(calendar);
    } catch (error) {
      const message = error instanceof Error ? error.message : "カレンダー生成中にエラーが発生しました";
      res.status(400).json({ error: message });
    }

  });

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
