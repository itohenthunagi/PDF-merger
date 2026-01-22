# PDF結合ツール

複数のPDFファイルやZIPファイルをブラウザ内で結合できるWebアプリケーションです。
**全ての処理はお使いの端末内で完結**し、データは外部に送信されません。

## 特徴

- **完全クライアントサイド処理** - サーバーにデータを送信しない
- **Material Design UI** - 美しく使いやすいインターフェース
- **レスポンシブ対応** - PC・スマホ・タブレットで利用可能
- **ページ単位での編集** - 結合前に不要なページを除外可能
- **ファイル名順の自然ソート** - `2.pdf` が `10.pdf` より前に並ぶ
- **ZIP対応** - ZIP内のPDFを自動抽出
- **結果をZIPで出力** - `merged.pdf` と `manifest.json` を含むZIPファイルをダウンロード

## 機能一覧

### 基本機能

1. **ファイル入力**
   - PDFファイル（複数可）
   - ZIPファイル（複数可、ZIP内のPDFを自動抽出）
   - 混在可能（PDF + ZIP）

2. **PDF一覧表示**
   - ファイル名の自然順（numeric sort）で並び替え
   - ページ数表示
   - 含めるページ数/総ページ数のバッジ表示

3. **ページプレビュー**
   - 選択したPDFのページをサムネイル表示
   - ページごとに「含める/除外」を切り替え可能
   - 便利な一括操作（全選択/全解除/反転）

4. **PDF結合**
   - 選択されたページのみを結合
   - ファイル名順で結合
   - 結果をZIP形式でダウンロード

5. **マニフェスト生成**
   - 入力ファイル情報
   - 含めたページの記録
   - 生成日時・ツールバージョン

## セットアップ

### 必要な環境

- モダンなWebブラウザ（Chrome、Edge、Safari推奨）
- ローカルサーバー（`file://` プロトコルでは動作しません）

### インストール手順

1. **リポジトリをクローン**

```bash
git clone <repository-url>
cd pdf_editer
```

2. **ライブラリについて**

現在の実装では、CDNから以下のライブラリを読み込んでいます：

- Materialize CSS 1.0.0
- PDF.js 3.11.174
- pdf-lib 1.17.1
- JSZip 3.10.1

**⚠️ 重要：セキュリティを最優先する場合**

仕様書では、外部送信を完全に防ぐためにライブラリを `vendor/` ディレクトリに同梱することが推奨されています。CDNを使用する場合、Content Security Policy (CSP) の設定を緩める必要があります。

現在の `index.html` では、開発の簡便性のためCDNを使用していますが、本番環境では以下の手順でライブラリを同梱することを強く推奨します：

#### ライブラリを同梱する場合（推奨）

```bash
# vendorディレクトリを作成（既に存在する場合はスキップ）
mkdir vendor

# 以下のファイルをダウンロードしてvendorディレクトリに配置
# 1. Materialize CSS
#    https://github.com/Dogfalo/materialize/releases/download/1.0.0/materialize.min.css
#    https://github.com/Dogfalo/materialize/releases/download/1.0.0/materialize.min.js

# 2. PDF.js
#    https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js
#    https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js

# 3. pdf-lib
#    https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js

# 4. JSZip
#    https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js
```

その後、`index.html` のスクリプトタグを以下のように変更：

```html
<!-- CDN版（現在） -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>

<!-- ローカル版（推奨） -->
<script src="./vendor/pdf.min.js"></script>
```

同様に、PDF.js workerの設定も変更：

```javascript
// CDN版（現在）
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ローカル版（推奨）
pdfjsLib.GlobalWorkerOptions.workerSrc = './vendor/pdf.worker.min.js';
```

3. **ローカルサーバーで起動**

```bash
# Python 3の場合
python -m http.server 8000

# Node.jsのhttp-serverを使う場合
npx http-server -p 8000
```

4. **ブラウザでアクセス**

```
http://localhost:8000
```

## 使い方

### 基本的な使い方

1. **ファイルを選択**
   - 「ファイル選択」ボタンをクリック
   - PDFまたはZIPファイルを選択（複数可）
   - 自動的にPDF一覧が表示されます

2. **PDFを選択してページを編集**
   - 左側のPDF一覧から編集したいPDFをクリック
   - 右側にページのサムネイルが表示されます
   - 各ページのチェックボックスで「含める/除外」を切り替え

3. **便利な一括操作**
   - **全選択**: 全ページを結合に含める
   - **全解除**: 全ページを除外
   - **反転**: 選択状態を反転

4. **結合して保存**
   - 「結合してZip保存」ボタンをクリック
   - `pdf-merge-result_YYYYMMDD_HHMM.zip` がダウンロードされます
   - ZIP内には `merged.pdf` と `manifest.json` が含まれます

### マニフェストファイル

`manifest.json` には以下の情報が記録されます：

```json
{
  "toolVersion": "1.0.0",
  "generatedAt": "2026-01-22T12:34:56.000Z",
  "inputs": [
    {
      "name": "01.pdf",
      "pages": 12,
      "included": [1, 2, 3, 5, 6]
    },
    {
      "name": "02.pdf",
      "pages": 8,
      "included": [1, 2, 3, 4, 5, 6, 7, 8]
    }
  ]
}
```

これにより、どのファイルのどのページを結合したかを後から確認できます。

## GitHub Pagesへのデプロイ

1. **GitHubリポジトリにプッシュ**

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

2. **GitHub Pagesを有効化**
   - リポジトリの `Settings` → `Pages` に移動
   - `Source` で `main` ブランチと `/ (root)` を選択
   - `Save` をクリック

3. **公開URLにアクセス**
   - `https://<username>.github.io/<repository-name>/`
   - 社内メンバーに共有

## セキュリティについて

### 外部送信なし

このツールは、以下の方法でデータの外部送信を防いでいます：

1. **完全クライアントサイド処理**
   - 全ての処理はブラウザ内で完結
   - `fetch`, `XMLHttpRequest`, `WebSocket` などのネットワークAPIを使用していません

2. **Content Security Policy (CSP)**
   - HTMLに厳格なCSPを設定
   - 外部通信経路を技術的に封鎖

3. **データの取り扱い**
   - アップロードファイルはメモリ上に保持
   - 処理完了後は参照を破棄し、GC対象にする
   - IndexedDB / LocalStorageへの保存なし

### セキュリティテスト

以下の方法でセキュリティを確認できます：

1. **ブラウザのDevToolsを開く**
2. **Networkタブを確認**
   - ファイル操作中に外部通信が発生していないことを確認

## トラブルシューティング

### ファイルが読み込めない

- **原因**: PDFファイルが破損している、またはパスワード保護されている
- **対処**: 別のPDFファイルで試してみてください

### サムネイルが表示されない

- **原因**: PDF.js workerの読み込みに失敗している
- **対処**: ブラウザのコンソールでエラーを確認し、workerのパスが正しいか確認してください

### ZIPが生成できない

- **原因**: 含めるページが1つもない
- **対処**: 少なくとも1ページは「含める」に設定してください

### モバイルで動作が遅い

- **原因**: メモリ制約
- **対処**: ページ数の多いPDFは避け、小さいファイルから試してください

## ファイル構成

```
pdf_editer/
├── index.html          # メインHTML
├── js/
│   ├── app.js          # メインアプリケーション
│   ├── pdf-handler.js  # PDF処理ロジック
│   ├── zip-handler.js  # ZIP処理ロジック
│   └── ui-manager.js   # UI操作・イベント管理
├── css/
│   └── app.css         # カスタムスタイル
├── vendor/             # 依存ライブラリ（同梱する場合）
├── basic_design.md     # 仕様書
└── README.md           # このファイル
```

## 技術スタック

- **PDF結合**: [pdf-lib](https://pdf-lib.js.org/)
- **ZIP展開/生成**: [JSZip](https://stuk.github.io/jszip/)
- **プレビュー描画**: [PDF.js](https://mozilla.github.io/pdf.js/)
- **UI**: [Materialize CSS](https://materializecss.com/)

## ライセンス

MIT License

## 貢献

バグ報告や機能提案は、GitHubのIssuesでお願いします。

## サポート

問題が発生した場合は、以下を確認してください：

1. ブラウザのコンソールでエラーメッセージを確認
2. ブラウザのバージョンが最新か確認
3. ローカルサーバーで起動しているか確認（`file://` プロトコルでは動作しません）

---

**開発者向けメモ**:
- コードは `js/` ディレクトリ内で役割ごとに分離されています
- 各ファイルは単一責任の原則に従っています
- 新しい機能を追加する場合は、適切なハンドラーに実装してください
