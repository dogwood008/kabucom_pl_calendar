# kabucom_pl_calendar

ブラウザで年間カレンダーを閲覧できる TypeScript + Express 製のアプリケーションです。デフォルトでは今年のカレンダーを表示し、任意の年に切り替えられます。今後 CSV アップロードに対応予定です。

## セットアップ

```bash
npm install
```

## 開発サーバーの起動

```bash
npm run dev
```

`http://localhost:3000` にブラウザが自動的に立ち上がり、年間カレンダーが表示されます。自動起動がうまく行かない場合はブラウザで URL を手動で開いてください。

## 本番ビルド & 起動

```bash
npm run build
npm start
