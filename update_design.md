# セキュリティ強化版 実装仕様書

## 1. 概要

### 1.1 目的

本ドキュメントは、PDF結合ツールを**機密性の高いPDFを扱う社内ツール**として安全に運用するためのセキュリティ強化仕様を定義する。

### 1.2 現状の問題点

現在の実装には以下のセキュリティ上の問題がある：

| # | 問題 | リスクレベル | 説明 |
|---|------|-------------|------|
| 1 | CDN依存 | 🔴 重大 | 外部CDNからライブラリを読み込んでおり、サプライチェーン攻撃のリスクがある |
| 2 | CSPが緩い | 🔴 重大 | `connect-src`が外部CDNを許可しており、データ漏洩の経路が存在する |
| 3 | 外部フォント | 🟡 中程度 | Google Fontsへのリクエストでユーザー情報が送信される |

### 1.3 修正方針

**オプションA: ライブラリ同梱 + 厳格CSP** を採用する。

- すべての依存ライブラリをリポジトリ内の `vendor/` ディレクトリに同梱
- Content Security Policy を最も厳格な設定に変更
- 外部への通信経路を技術的に完全に封鎖

---

## 2. 修正対象ファイル

### 2.1 新規作成

| ファイルパス | 説明 |
|-------------|------|
| `vendor/materialize.min.css` | Materialize CSS |
| `vendor/materialize.min.js` | Materialize JS |
| `vendor/pdf.min.js` | PDF.js メインライブラリ |
| `vendor/pdf.worker.min.js` | PDF.js Worker |
| `vendor/pdf-lib.min.js` | pdf-lib ライブラリ |
| `vendor/jszip.min.js` | JSZip ライブラリ |
| `vendor/material-icons.css` | Material Icons CSS |
| `vendor/fonts/` | Material Icons フォントファイル |

### 2.2 修正対象

| ファイルパス | 修正内容 |
|-------------|----------|
| `index.html` | CDN参照をローカル参照に変更、CSPを厳格化 |

---

## 3. ライブラリ同梱仕様

### 3.1 ダウンロード元とバージョン

| ライブラリ | バージョン | ダウンロード元 |
|-----------|-----------|----------------|
| Materialize CSS | 1.0.0 | https://github.com/Dogfalo/materialize/releases/download/1.0.0/materialize-v1.0.0.zip |
| PDF.js | 3.11.174 | https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js |
| PDF.js Worker | 3.11.174 | https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js |
| pdf-lib | 1.17.1 | https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js |
| JSZip | 3.10.1 | https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js |
| Material Icons | latest | https://github.com/nicholasruunu/material-icons/tree/master/iconfont |

### 3.2 ディレクトリ構造（修正後）

```
pdf_editer/
├── index.html              # メインHTML（修正）
├── css/
│   └── app.css             # カスタムスタイル（変更なし）
├── js/
│   ├── app.js              # メインアプリケーション（変更なし）
│   ├── pdf-handler.js      # PDF処理（変更なし）
│   ├── zip-handler.js      # ZIP処理（変更なし）
│   └── ui-manager.js       # UI管理（変更なし）
├── vendor/                 # 【新規】依存ライブラリ
│   ├── materialize.min.css
│   ├── materialize.min.js
│   ├── pdf.min.js
│   ├── pdf.worker.min.js
│   ├── pdf-lib.min.js
│   ├── jszip.min.js
│   ├── material-icons.css
│   └── fonts/
│       ├── MaterialIcons-Regular.woff2
│       ├── MaterialIcons-Regular.woff
│       └── MaterialIcons-Regular.ttf
├── .gitignore
├── README.md
├── basic_design.md         # 元の仕様書
└── update_design.md        # 本ドキュメント
```

---

## 4. index.html 修正仕様

### 4.1 Content Security Policy（修正後）

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  font-src 'self';
  worker-src 'self' blob:;
  connect-src 'none';
  object-src 'none';
  base-uri 'none';
  frame-ancestors 'none';
">
```

**変更点：**

| ディレクティブ | 変更前 | 変更後 | 理由 |
|---------------|--------|--------|------|
| `script-src` | `'self'` + 複数CDN | `'self'` | 外部スクリプト禁止 |
| `style-src` | `'self'` + CDN | `'self' 'unsafe-inline'` | 外部CSS禁止 |
| `font-src` | `'self'` + Google Fonts | `'self'` | 外部フォント禁止 |
| `connect-src` | `'self'` + 複数CDN | `'none'` | **外部通信完全禁止** |

### 4.2 CSS読み込み（修正後）

```html
<!-- 修正前（CDN） -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/materialize/1.0.0/css/materialize.min.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons">

<!-- 修正後（ローカル） -->
<link rel="stylesheet" href="./vendor/materialize.min.css">
<link rel="stylesheet" href="./vendor/material-icons.css">
```

### 4.3 JavaScript読み込み（修正後）

```html
<!-- 修正前（CDN） -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/materialize/1.0.0/js/materialize.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<script src="https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>

<!-- 修正後（ローカル） -->
<script src="./vendor/materialize.min.js"></script>
<script src="./vendor/pdf.min.js"></script>
<script src="./vendor/pdf-lib.min.js"></script>
<script src="./vendor/jszip.min.js"></script>
```

### 4.4 PDF.js Worker設定（修正後）

```html
<!-- 修正前（CDN） -->
<script>
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
</script>

<!-- 修正後（ローカル） -->
<script>
  pdfjsLib.GlobalWorkerOptions.workerSrc = './vendor/pdf.worker.min.js';
</script>
```

---

## 5. Material Icons 同梱仕様

### 5.1 material-icons.css の内容

```css
@font-face {
  font-family: 'Material Icons';
  font-style: normal;
  font-weight: 400;
  src: url('./fonts/MaterialIcons-Regular.woff2') format('woff2'),
       url('./fonts/MaterialIcons-Regular.woff') format('woff'),
       url('./fonts/MaterialIcons-Regular.ttf') format('truetype');
}

.material-icons {
  font-family: 'Material Icons';
  font-weight: normal;
  font-style: normal;
  font-size: 24px;
  line-height: 1;
  letter-spacing: normal;
  text-transform: none;
  display: inline-block;
  white-space: nowrap;
  word-wrap: normal;
  direction: ltr;
  -webkit-font-feature-settings: 'liga';
  -webkit-font-smoothing: antialiased;
}
```

### 5.2 フォントファイルのダウンロード元

- woff2: https://fonts.gstatic.com/s/materialicons/v140/flUhRq6tzZclQEJ-Vdg-IuiaDsNc.woff2
- woff: https://fonts.gstatic.com/s/materialicons/v140/flUhRq6tzZclQEJ-Vdg-IuiaDsNa.woff
- ttf: https://fonts.gstatic.com/s/materialicons/v140/flUhRq6tzZclQEJ-Vdg-IuiaDsNcIhQ8tQ.ttf

---

## 6. セキュリティ検証項目

### 6.1 デプロイ前チェックリスト

| # | 確認項目 | 確認方法 |
|---|---------|----------|
| 1 | 外部CDNへの参照がないこと | `index.html`で`https://`を検索、0件であること |
| 2 | CSPの`connect-src`が`'none'`であること | HTMLのmeta tagを目視確認 |
| 3 | vendorディレクトリにすべてのライブラリがあること | ファイル存在確認 |
| 4 | アプリケーションが正常に動作すること | 手動テスト |

### 6.2 デプロイ後チェックリスト

| # | 確認項目 | 確認方法 |
|---|---------|----------|
| 1 | 外部通信が発生していないこと | DevTools > Network タブで確認 |
| 2 | CSPエラーが発生していないこと | DevTools > Console タブで確認 |
| 3 | PDF結合が正常に動作すること | テスト用PDFで結合を実行 |
| 4 | ダウンロードしたZIPが正常であること | merged.pdfを開いて確認 |

---

## 7. 運用上の注意事項

### 7.1 ライブラリ更新時の手順

ライブラリに脆弱性が発見された場合の更新手順：

1. 新しいバージョンのファイルをダウンロード
2. `vendor/`ディレクトリ内のファイルを置き換え
3. ローカルで動作確認
4. GitHubにプッシュ
5. GitHub Pagesで動作確認

**注意**: CDNと異なり、自動更新されないため、定期的な脆弱性チェックを推奨（月1回程度）。

### 7.2 GitHub Pages（Public）の注意点

- URLを知っている人は誰でもアクセス可能
- URLを社外に漏らさないよう注意
- 社内チャットやメールでのみURLを共有

### 7.3 推奨ブラウザ

| ブラウザ | 対応状況 |
|---------|----------|
| Chrome (Windows/Mac) | ✅ 推奨 |
| Edge (Chromium) | ✅ 推奨 |
| Firefox | ✅ 対応 |
| Safari (Mac/iOS) | ⚠️ 動作確認が必要 |

---

## 8. ファイルサイズ見積もり

| ファイル | サイズ（概算） |
|---------|---------------|
| materialize.min.css | 141 KB |
| materialize.min.js | 78 KB |
| pdf.min.js | 874 KB |
| pdf.worker.min.js | 654 KB |
| pdf-lib.min.js | 370 KB |
| jszip.min.js | 96 KB |
| material-icons.css | 1 KB |
| Material Icons フォント | 150 KB |
| **vendor合計** | **約2.4 MB** |
| 既存ファイル（HTML/CSS/JS） | 約50 KB |
| **総合計** | **約2.5 MB** |

GitHub Pagesの制限（1GB推奨）に十分余裕あり。

---

## 9. 実装手順

### Step 1: vendorディレクトリ作成とライブラリダウンロード

```bash
# vendorディレクトリ作成
mkdir -p vendor/fonts

# 各ライブラリをダウンロード
# （詳細なコマンドは実装時に記載）
```

### Step 2: Material Icons CSS作成

`vendor/material-icons.css`を作成し、フォントファイルへの相対パスを設定。

### Step 3: index.html修正

- CSPを厳格な設定に変更
- すべての外部CDN参照をローカル参照に変更

### Step 4: 動作確認

- ローカルサーバーで起動
- DevToolsでネットワーク通信を確認
- PDF結合機能をテスト

### Step 5: GitHubにプッシュ

```bash
git add .
git commit -m "Security: ライブラリ同梱 + CSP厳格化"
git push origin main
```

### Step 6: GitHub Pagesで最終確認

- 公開URLにアクセス
- DevToolsでネットワーク通信を確認
- 全機能をテスト

---

## 10. 承認

この仕様書の内容で実装を進めてよいか、確認をお願いします。

- [ ] 承認（実装を開始してください）
- [ ] 修正が必要（コメントをお願いします）
