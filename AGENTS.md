# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains all TypeScript sources (`server.ts` hosts Express wiring, `calendar.ts` handles date math); keep new modules colocated with their domain logic.
- `public/` serves the static calendar UI that Express returns for every route; modify assets here and keep `index.html` self-contained.
- `dist/` is generated output from `npm run build`; never edit it directly—treat it as disposable.
- `docs/dummy.csv` provides the mock trade dataset that powers day-level P/L overlays; keep similar CSVs in `docs/`.
- Root configs: `package.json` defines scripts, `tsconfig.json` governs compilation targets, and `.env` files (if added) should be listed in `.gitignore`.

## UI & Feature Notes
- カレンダーのセル背景は取引損益で色分け（プラス=緑、マイナス=赤、ゼロ=青）します。動作を変えない改修ではこの配色ルールを維持してください。
- 月カードをクリックするとモーダルが開き、日別損益と取引詳細リスト、積み上げ損益チャートを表示します。DOM 構造やアクセシビリティ属性（`aria-*`）は崩さず拡張すること。
- ヘッダーフォームには「表示」「年間推移」ボタンがあり、後者は年間チャートモーダルを開きます。ボタンの順序と縦棒区切りを保ったまま UI を改修してください。

## Build, Test, and Development Commands
- `npm install` installs Express, ts-node, and TypeScript—rerun after updating dependencies.
- `npm run dev` starts `ts-node src/server.ts` for local work; set `DISABLE_BROWSER=true` if automatic browser launch is undesirable.
- `npm run build` runs the TypeScript compiler, producing `dist/` and doubling as a strict type check.
- `npm start` runs `node dist/server.js`; use this when validating the production bundle.
- Quick API smoke test: `curl "http://localhost:3000/api/calendar?year=2025"` should return a 12-month JSON payload.

## Coding Style & Naming Conventions
- Follow the existing two-space indentation, trailing semicolons, and double-quoted strings in `.ts` files.
- Use camelCase for variables/functions, PascalCase for exported types/interfaces, and SCREAMING_SNAKE_CASE only for constants like `WEEKDAY_LABELS`.
- Prefer small, pure helpers (e.g., `createMonth`) and keep all request validation inside the Express route handler for clarity.
- Run `npm run build` before pushing to catch any type drift.

## Testing Guidelines
- No automated tests exist yet; add TypeScript-friendly test files under `src/__tests__/` or `tests/` using your preferred runner (Vitest or Jest recommended) and name them `*.test.ts`.
- Include edge cases for invalid year parsing (`parseYear`) and leap-year layouts (`createYearCalendar`).
- Manual verification: hit `/api/calendar?year=<year>` and confirm `weekdayLabels` plus 12 `months` are returned; document any anomalies in the PR description.

## Commit & Pull Request Guidelines
- Recent history favors short, imperative titles (e.g., `Fix missing closing brace in calendar API route`); follow that pattern and scope each commit tightly.
- Reference issues or PR numbers in bodies when applicable and avoid squashing unrelated concerns.
- PRs should explain the change, list test evidence (command output or screenshots of the calendar UI), and call out any new environment variables.
- Request review before merging, ensure CI (if added later) is green, and confirm `npm run build` succeeds locally.

## Communication

ユーザとのコミュニケーションは、日本語で実施してください。
