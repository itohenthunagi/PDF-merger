# チェックポイント: 2026-01-25

## 発生した問題

社内にPDF結合ツールを提供したところ、「エラー: PDFの結合に失敗しました」というエラーが発生。

- URL: https://itohenthunagi.github.io/PDF-merger/
- セキュリティソフト: 未使用
- 対象ファイル: 請求書PDF（1ページ）、202512月.pdf（1ページ）

## 原因

**PDFファイルが暗号化（パスワード保護）されていた可能性が高い**

- 請求書などの業務システムから出力されるPDFは、暗号化されていることが多い
- pdf-libはデフォルトでは暗号化PDFを処理できない
- PDF.jsでの読み込み（ページ数取得）は成功するが、pdf-libでの結合処理で失敗していた

## 対策・修正内容

### 1. 暗号化PDFへの対応（コミット: 37a5b0a）

**ファイル**: `js/pdf-handler.js`

```javascript
// 変更前
const srcPdf = await PDFLib.PDFDocument.load(entry.bytes);

// 変更後
const srcPdf = await PDFLib.PDFDocument.load(entry.bytes, {
  ignoreEncryption: true
});
```

`ignoreEncryption: true` オプションを追加することで、パスワードなしで開ける暗号化PDFも結合できるようになった。

### 2. UI改善: チェックボックスの説明追加（コミット: b84c46d）

**ファイル**: `index.html`

PDF一覧セクションに注意書きを追加：

> チェックボックスは削除用です。チェックがなくても、結合には全PDFが含まれます。

社内ユーザーがチェックボックスを「結合対象の選択」と誤解していたため、削除用であることを明示。

## 現在のステータス

- 両方の修正がGitHub Pagesにデプロイ済み
- 社内ユーザーに再テストを依頼する段階

## 補足: URLの末尾の `#` について

ユーザーから質問があった `https://.../#` の `#` は「フラグメント識別子」で、この場合は特に意味がなく、エラーとは無関係。
