# csv_to_pl_calendar

ブラウザで年間カレンダーを閲覧できる TypeScript + Express 製のアプリケーションです。デフォルトでは今年のカレンダーを表示し、任意の年に切り替えられます。`docs/dummy_kabucom.csv` から証券会社（kabu.com）の取引データを読み込み、日別損益をカレンダーに重ねて可視化します。

## 主な機能

- **年間カレンダーの表示**: `/api/calendar` から 12 ヶ月分のカレンダーデータを取得し、日曜始まりの表形式で描画します。
- **取引ヒートマップ**: CSV の日次損益を解析し、プラス日は緑、マイナス日は赤、ゼロは青でセル背景を塗り分けます。
- **月モーダル & 日次詳細**: 月をクリックするとモーダルが開き、各日の損益や取引詳細（銘柄、数量、手数料、損益）を確認できます。
- **累積損益チャート**: 月モーダル内に累積損益グラフを表示。さらにヘッダーの「年間推移」ボタンから 1 年間分の累積グラフをモーダルで閲覧できます。
- **対応CSV**: kabu.com（既定の `docs/dummy_kabucom.csv`）、GMOクリック証券（`docs/dummy_gmo_click_trades.csv`）、SBI OTC CFD の CSV をヘッダー自動判別で読み込みます。

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
```

## 別CSVファイルの指定

トップ画面の「CSVファイルの指定」セクションからローカルCSVを選択すると、その内容がブラウザ経由でアップロードされ、`/api/calendar/upload` エンドポイントに送信されます。以降は同じファイルを保持したまま年を切り替えて再描画できます。

API から直接切り替えたい場合は `/api/calendar` に `csvPath` クエリパラメータを付けて呼び出してください。セキュリティ上、指定できるのはリポジトリルート配下のファイルのみです（相対パスで `docs/custom.csv` などを指定してください。絶対パスや `..` を含む参照は拒否されます）。

```bash
curl "http://localhost:3000/api/calendar?year=2024&csvPath=docs/your_trades.csv"
```

## スプレッドシート（GAS）からの取得

トップ画面の「スプレッドシートから取得」セクションに、スプレッドシートに紐づけた Google Apps Script（ウェブアプリとしてデプロイ）の URL を入力すると、そのエンドポイントから暗号化済み CSV を取得して反映できます。

- ダミーデータスプシ: https://docs.google.com/spreadsheets/d/1m3G3GACuuIy2OXusrINp8Ls7UqffxFf713hwvK4vofU/edit?usp=sharing
- GAS経由で取得できるデータ: https://script.google.com/macros/s/AKfycbzIxdVW1G20fnrMeysplw2CQ3r2-qBgRd3dUBC97iRRkVbWNxAtC6OVQx9xnG1dNw/exec
- GAS本体: ./docs/GAS.gs

- レスポンスは `{ iv: string, ciphertext: string }` 形式の JSON を想定し、`ciphertext` を PSK（共有鍵）の SHA-256 から得た AES-CBC 鍵で復号します。平文は CSV として扱われ、ローカルファイルを選んだ場合と同じ形式で読み込まれます。
- デフォルトの入力例としてサンプルの GAS URL と PSK（`testpsk`）がプレースホルダーで入っています。自身の GAS を使う場合は URL と PSK を置き換えてください。
- 「取得して反映」ボタンで読み込んだ後、URL はブラウザの localStorage に保存されます。PSK はチェックボックスをオンにしたときだけ保存され、暗号化はされないので共有 PC では保存を避けてください。
- 「エンドポイントをクリア」を押すと GAS URL/PSK の保存を解除し、既定の `docs/dummy_kabucom.csv` に戻せます。
