import express from "express";
import path from "node:path";
import open from "open";
import { createYearCalendar, parseYear } from "./calendar";

const DEFAULT_PORT = Number.parseInt(process.env.PORT ?? "3000", 10);
const HOST = process.env.HOST ?? "localhost";
const APP_TITLE = "年間カレンダー";

function resolvePublicDirectory(): string {
  return path.resolve(__dirname, "..", "public");
}

async function launchBrowser(url: string): Promise<void> {
  if (process.env.CI === "true" || process.env.DISABLE_BROWSER === "true") {
    return;
  }

  try {
    await open(url);
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
      const yearParam = typeof req.query.year === "string" ? req.query.year : undefined;
      year = parseYear(yearParam, now.getFullYear());
    } catch (error) {
      const message = error instanceof Error ? error.message : "不正なリクエストです";
      res.status(400).json({ error: message });
      return;
    }

    const calendar = createYearCalendar(year);
    res.json(calendar);
  });

  app.use((_, res) => {
    res.sendFile(path.join(publicDirectory, "index.html"));
  });

  return app;
}

async function start() {
  const app = createServer();
  const server = app.listen(DEFAULT_PORT, HOST, () => {
    const addressInfo = server.address();
    const url = typeof addressInfo === "string" ? addressInfo : `http://${HOST}:${DEFAULT_PORT}`;
    console.log(`${APP_TITLE} サーバーを起動しました: ${url}`);
    void launchBrowser(url);
  });
}

void start();
